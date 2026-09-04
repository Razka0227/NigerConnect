import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, ok, fail } from '../utils.js';

const router = Router();

// GET /api/users/search?q=&exclude=&limit=
// Search by phone or username — useful to start a chat.
router.get('/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim().replace(/[\s.-]/g, '');
  const limit = Math.min(Number(req.query.limit) || 10, 25);
  if (q.length < 3) return ok(res, []);

  const like = `%${q}%`;
  const users = await prisma.user.findMany({
    where: {
      id: { not: req.user.sub },
      AND: [
        { OR: [{ phone: { contains: like } }, { username: { contains: like } }, { name: { contains: like } }] },
      ],
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, users.map(publicUser));
});

// GET /api/users/:id
router.get('/:id', optionalAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return fail(res, 404, 'Utilisateur introuvable');
  return ok(res, publicUser(user));
});

// POST /api/users/device-token  (auth)  register FCM/push token
router.post('/device-token', requireAuth, async (req, res) => {
  const { token, platform = 'web' } = req.body || {};
  if (!token) return fail(res, 400, 'Token requis');
  await prisma.deviceToken.upsert({
    where: { userId_token: { userId: req.user.sub, token } },
    update: { platform, updatedAt: new Date() },
    create: { userId: req.user.sub, token, platform },
  });
  return ok(res, { registered: true });
});

export default router;
