import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser, ok, fail } from '../utils.js';

const router = Router();
router.use(requireAuth);

function serializeConversation(c) {
  const other = c.users
    .map((cu) => ({ ...cu.user, lastReadAt: cu.lastReadAt, muted: cu.muted }))
    .sort((a, b) => a.phone.localeCompare(b.phone));
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    updatedAt: c.updatedAt,
    lastMessage: c.messages[0] || null,
    other,
  };
}

// GET /api/conversations  — list of the user's conversations
router.get('/', async (req, res) => {
  const cu = await prisma.conversationUser.findMany({
    where: { userId: req.user.sub },
    orderBy: { conversation: { updatedAt: 'desc' } },
    take: 100,
    select: { conversationId: true },
  });
  const ids = cu.map((x) => x.conversationId);
  if (!ids.length) return ok(res, []);

  const conversations = await prisma.conversation.findMany({
    where: { id: { in: ids } },
    include: {
      users: { include: { user: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return ok(res, conversations.map(serializeConversation));
});

// POST /api/conversations  { userId } — open (or create) a direct conversation
router.post('/', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId || userId === req.user.sub) {
    return fail(res, 400, 'Destinataire invalide');
  }
  const other = await prisma.user.findUnique({ where: { id: userId } });
  if (!other) return fail(res, 404, 'Utilisateur introuvable');

  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'direct',
      users: { every: { userId: { in: [req.user.sub, userId] } } },
    },
    include: {
      users: { include: { user: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (existing) return ok(res, serializeConversation(existing));

  const conversation = await prisma.conversation.create({
    data: {
      type: 'direct',
      users: {
        create: [
          { userId: req.user.sub },
          { userId },
        ],
      },
    },
    include: {
      users: { include: { user: true } },
      messages: true,
    },
  });
  return ok(res, serializeConversation(conversation));
});

// GET /api/conversations/:id/messages?before=&limit=&after=
router.get('/:id/messages', async (req, res) => {
  const convId = req.params.id;
  const member = await prisma.conversationUser.findUnique({
    where: { conversationId_userId: { conversationId: convId, userId: req.user.sub } },
  });
  if (!member) return fail(res, 403, 'Accès refusé');

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const where = { conversationId: convId };
  if (req.query.before) where.createdAt = { lt: new Date(req.query.before) };
  if (req.query.after) where.createdAt = { gt: new Date(req.query.after) };

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const total = await prisma.message.count({ where: { conversationId: convId } });

  // bump lastReadAt when the user fetches
  await prisma.conversationUser.update({
    where: { conversationId_userId: { conversationId: convId, userId: req.user.sub } },
    data: { lastReadAt: new Date() },
  });

  return ok(res, messages.reverse(), {
    total,
    limit,
    hasMore: messages.length === limit,
  });
});

// PATCH /api/conversations/:id/read  — mark conversation as read
router.patch('/:id/read', async (req, res) => {
  const convId = req.params.id;
  await prisma.conversationUser.update({
    where: { conversationId_userId: { conversationId: convId, userId: req.user.sub } },
    data: { lastReadAt: new Date() },
  });
  return ok(res, { read: true });
});

// PATCH /api/conversations/:id  { muted }
router.patch('/:id', async (req, res) => {
  const convId = req.params.id;
  const { muted } = req.body || {};
  await prisma.conversationUser.update({
    where: { conversationId_userId: { conversationId: convId, userId: req.user.sub } },
    data: { muted: Boolean(muted) },
  });
  return ok(res, { muted: Boolean(muted) });
});

// GET /api/conversations/:id/unread — count of unread messages
router.get('/:id/unread', async (req, res) => {
  const convId = req.params.id;
  const member = await prisma.conversationUser.findUnique({
    where: { conversationId_userId: { conversationId: convId, userId: req.user.sub } },
  });
  if (!member) return fail(res, 403, 'Accès refusé');
  const count = await prisma.message.count({
    where: {
      conversationId: convId,
      senderId: { not: req.user.sub },
      createdAt: { gt: member.lastReadAt || new Date(0) },
    },
  });
  return ok(res, { count });
});

// Debug helper: peer user of a direct conversation
export async function getPeer(conversationId, excludeUserId) {
  const cu = await prisma.conversationUser.findMany({
    where: { conversationId, userId: { not: excludeUserId } },
    include: { user: true },
  });
  return cu[0]?.user || null;
}

export { publicUser };
export default router;
