import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, ok, fail, paginate } from '../utils.js';

const router = Router();
const CATEGORIES = ['vehicules', 'immobilier', 'electronique', 'emploi', 'agriculture', 'autre'];

function serializeAd(ad) {
  let images = [];
  try { images = JSON.parse(ad.images || '[]'); } catch { /* ignore */ }
  return {
    id: ad.id,
    category: ad.category,
    title: ad.title,
    description: ad.description,
    price: ad.price,
    currency: ad.currency,
    city: ad.city,
    images,
    status: ad.status,
    views: ad.views,
    createdAt: ad.createdAt,
    seller: publicUser(ad.seller),
  };
}

// GET /api/ads?category=&city=&q=&page=&perPage=&mine=1
router.get('/', optionalAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(Number(req.query.perPage) || 20, 50);
  const where = { status: 'active' };

  if (req.query.category && CATEGORIES.includes(req.query.category)) {
    where.category = req.query.category;
  }
  if (req.query.city) where.city = { contains: String(req.query.city) };
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
    ];
  }
  if (req.query.mine === '1' && req.user) {
    where.sellerId = req.user.sub;
    delete where.status;
  }

  const [total, ads] = await Promise.all([
    prisma.ad.count({ where }),
    prisma.ad.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { seller: true },
    }),
  ]);
  return paginate(res, ads.map(serializeAd), { page, perPage, total });
});

// GET /api/ads/categories
router.get('/categories', (req, res) => {
  const labels = {
    vehicules: 'Véhicules',
    immobilier: 'Immobilier',
    electronique: 'Électronique',
    emploi: 'Emploi',
    agriculture: 'Agriculture',
    autre: 'Autre',
  };
  return ok(res, CATEGORIES.map((c) => ({ id: c, label: labels[c] })));
});

// GET /api/ads/:id
router.get('/:id', async (req, res) => {
  const ad = await prisma.ad.update({
    where: { id: req.params.id },
    data: { views: { increment: 1 } },
    include: { seller: true },
  });
  return ok(res, serializeAd(ad));
});

// POST /api/ads  (auth)
router.post('/', requireAuth, async (req, res) => {
  const { category, title, description, price, currency, city, images } = req.body || {};
  if (!title || !category) return fail(res, 400, 'Titre et catégorie requis');
  if (!CATEGORIES.includes(category)) return fail(res, 400, 'Catégorie invalide');

  const ad = await prisma.ad.create({
    data: {
      sellerId: req.user.sub,
      category,
      title: String(title).slice(0, 120),
      description: String(description || '').slice(0, 4000),
      price: price != null ? Math.max(0, Number(price) || 0) : null,
      currency: currency || 'XOF',
      city: city ? String(city).slice(0, 80) : null,
      images: JSON.stringify(Array.isArray(images) ? images.slice(0, 8) : []),
    },
    include: { seller: true },
  });
  return ok(res, serializeAd(ad));
});

// PATCH /api/ads/:id  (auth, owner)
router.patch('/:id', requireAuth, async (req, res) => {
  const ad = await prisma.ad.findUnique({ where: { id: req.params.id } });
  if (!ad) return fail(res, 404, 'Annonce introuvable');
  if (ad.sellerId !== req.user.sub) return fail(res, 403, 'Accès refusé');

  const data = {};
  const { category, title, description, price, currency, city, images, status } = req.body || {};
  if (category !== undefined) {
    if (!CATEGORIES.includes(category)) return fail(res, 400, 'Catégorie invalide');
    data.category = category;
  }
  if (title !== undefined) data.title = String(title).slice(0, 120);
  if (description !== undefined) data.description = String(description).slice(0, 4000);
  if (price !== undefined) data.price = Math.max(0, Number(price) || 0);
  if (currency !== undefined) data.currency = String(currency).slice(0, 8);
  if (city !== undefined) data.city = String(city).slice(0, 80);
  if (images !== undefined) data.images = JSON.stringify(Array.isArray(images) ? images.slice(0, 8) : []);
  if (status !== undefined) {
    if (!['active', 'sold', 'archived'].includes(status)) return fail(res, 400, 'Statut invalide');
    data.status = status;
  }

  const updated = await prisma.ad.update({ where: { id: ad.id }, data, include: { seller: true } });
  return ok(res, serializeAd(updated));
});

export default router;
