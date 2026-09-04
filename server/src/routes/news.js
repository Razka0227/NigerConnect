import { Router } from 'express';
import { prisma } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { ok, paginate } from '../utils.js';

const router = Router();

// GET /api/news?category=&page=&perPage=
// Returns compact news items (light payload for low-data mode).
router.get('/', optionalAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(Number(req.query.perPage) || 15, 50);
  const where = {};
  const cat = ['general', 'niger', 'afrique', 'sport', 'tech', 'economie'];
  if (req.query.category && cat.includes(req.query.category)) {
    where.category = req.query.category;
  }

  const [total, items] = await Promise.all([
    prisma.newsItem.count({ where }),
    prisma.newsItem.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        category: true,
        title: true,
        summary: true,
        imageUrl: true,
        source: true,
        publishedAt: true,
      },
    }),
  ]);
  return paginate(res, items, { page, perPage, total });
});

// GET /api/news/:id — full article
router.get('/:id', async (req, res) => {
  const item = await prisma.newsItem.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ ok: false, error: { message: 'Article introuvable' } });
  return ok(res, item);
});

export default router;
