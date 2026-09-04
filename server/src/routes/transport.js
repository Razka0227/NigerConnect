import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, ok, fail, paginate } from '../utils.js';

const router = Router();

function serializeRide(ride, requesterId) {
  return {
    id: ride.id,
    driver: publicUser(ride.driver),
    from: ride.from,
    to: ride.to,
    departAt: ride.departAt,
    pricePerSeat: ride.pricePerSeat,
    seatsTotal: ride.seatsTotal,
    seatsLeft: ride.seatsLeft,
    vehicle: ride.vehicle,
    status: ride.status,
    createdAt: ride.createdAt,
    requestsCount: ride.requests?.length || 0,
    hasRequested: requesterId
      ? (ride.requests || []).some((r) => r.userId === requesterId)
      : false,
  };
}

// GET /api/rides?from=&to=&date=&page=&perPage=&mine=1&driver=1
router.get('/', optionalAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(Number(req.query.perPage) || 20, 50);
  const where = { status: { not: 'cancelled' } };

  if (req.query.from) where.from = { contains: String(req.query.from) };
  if (req.query.to) where.to = { contains: String(req.query.to) };
  if (req.query.date) {
    const day = new Date(req.query.date);
    const next = new Date(day.getTime() + 24 * 3600 * 1000);
    where.departAt = { gte: day, lt: next };
  }
  if (req.query.mine === '1' && req.user) {
    where.driverId = req.user.sub;
  }
  if (req.query.driver === '1' && req.user) {
    const rideIds = (await prisma.rideRequest.findMany({
      where: { userId: req.user.sub },
      select: { rideId: true },
    })).map((r) => r.rideId);
    where.id = { in: rideIds };
  }

  const [total, rides] = await Promise.all([
    prisma.ride.count({ where }),
    prisma.ride.findMany({
      where,
      orderBy: { departAt: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { driver: true, requests: { select: { userId: true, status: true } } },
    }),
  ]);
  return paginate(res, rides.map((r) => serializeRide(r, req.user?.sub)), { page, perPage, total });
});

// GET /api/rides/:id
router.get('/:id', optionalAuth, async (req, res) => {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    include: { driver: true, requests: { include: { user: true } } },
  });
  if (!ride) return fail(res, 404, 'Trajet introuvable');
  return ok(res, serializeRide(ride, req.user?.sub));
});

// POST /api/rides  (auth, role driver) — publish a ride
router.post('/', requireAuth, async (req, res) => {
  if (!['driver', 'admin'].includes(req.user.role)) {
    return fail(res, 403, 'Publier un trajet nécessite un compte conducteur');
  }
  const { from, to, departAt, pricePerSeat, seatsTotal, vehicle } = req.body || {};
  if (!from || !to || !departAt) return fail(res, 400, 'Départ, arrivée et horaire requis');
  if (!Number.isInteger(Number(pricePerSeat)) || Number(pricePerSeat) <= 0) {
    return fail(res, 400, 'Prix par place invalide');
  }
  const seats = Math.min(Math.max(Number(seatsTotal) || 3, 1), 10);

  const ride = await prisma.ride.create({
    data: {
      driverId: req.user.sub,
      from: String(from).slice(0, 80),
      to: String(to).slice(0, 80),
      departAt: new Date(departAt),
      pricePerSeat: Number(pricePerSeat),
      seatsTotal: seats,
      seatsLeft: seats,
      vehicle: vehicle ? String(vehicle).slice(0, 80) : null,
    },
    include: { driver: true, requests: true },
  });
  return ok(res, serializeRide(ride, req.user.sub));
});

// POST /api/rides/:id/request  (auth) — ask for a seat
router.post('/:id/request', requireAuth, async (req, res) => {
  const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
  if (!ride) return fail(res, 404, 'Trajet introuvable');
  if (ride.driverId === req.user.sub) return fail(res, 400, 'Impossible de réserver son propre trajet');
  if (ride.seatsLeft <= 0) return fail(res, 400, 'Trajet complet');

  const { seats = 1 } = req.body || {};
  const n = Math.min(Math.max(Number(seats) || 1, 1), ride.seatsLeft);

  const existing = await prisma.rideRequest.findUnique({
    where: { rideId_userId: { rideId: ride.id, userId: req.user.sub } },
  });
  if (existing) {
    return fail(res, 409, 'Demande déjà envoyée');
  }

  const request = await prisma.rideRequest.create({
    data: { rideId: ride.id, userId: req.user.sub, seats: n },
  });
  const io = req.app.get('io');
  io?.to(`user:${ride.driverId}`).emit('ride:request', { rideId: ride.id, requestId: request.id });

  return ok(res, { requestId: request.id, seats: n });
});

// PATCH /api/rides/:id/requests/:requestId  { status: accepted|declined } (auth, driver)
router.patch('/:id/requests/:requestId', requireAuth, async (req, res) => {
  const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
  if (!ride) return fail(res, 404, 'Trajet introuvable');
  if (ride.driverId !== req.user.sub) return fail(res, 403, 'Accès refusé');

  const { status } = req.body || {};
  if (!['accepted', 'declined'].includes(status)) return fail(res, 400, 'Statut invalide');

  const request = await prisma.rideRequest.update({
    where: { id: req.params.requestId },
    data: { status },
  });

  if (status === 'accepted') {
    await prisma.ride.update({
      where: { id: ride.id },
      data: { seatsLeft: Math.max(0, ride.seatsLeft - request.seats) },
    });
  }
  const io = req.app.get('io');
  io?.to(`user:${request.userId}`).emit('ride:response', { rideId: ride.id, status });

  return ok(res, { requestId: request.id, status });
});

// PATCH /api/rides/:id/status  { status } (auth, driver)
router.patch('/:id/status', requireAuth, async (req, res) => {
  const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
  if (!ride) return fail(res, 404, 'Trajet introuvable');
  if (ride.driverId !== req.user.sub) return fail(res, 403, 'Accès refusé');

  const { status } = req.body || {};
  if (!['inProgress', 'completed', 'cancelled'].includes(status)) {
    return fail(res, 400, 'Statut invalide');
  }
  const updated = await prisma.ride.update({ where: { id: ride.id }, data: { status } });
  return ok(res, { id: updated.id, status: updated.status });
});

export default router;
