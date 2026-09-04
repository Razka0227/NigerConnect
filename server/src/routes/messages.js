import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ok, fail } from '../utils.js';
import { getPeer } from './conversations.js';

const router = Router();
router.use(requireAuth);

function serializeMessage(m) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    clientMsgId: m.clientMsgId,
    type: m.type,
    body: m.body,
    mediaUrl: m.mediaUrl,
    mediaMeta: m.mediaMeta ? JSON.parse(m.mediaMeta) : undefined,
    replyToId: m.replyToId,
    deliveredAt: m.deliveredAt,
    readAt: m.readAt,
    createdAt: m.createdAt,
  };
}

async function assertMember(conversationId, userId) {
  const member = await prisma.conversationUser.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return Boolean(member);
}

// POST /api/messages  { conversationId, clientMsgId, type, body, mediaUrl?, mediaMeta?, replyToId? }
// Primary path for offline-first sync: the client queues messages locally
// (IndexedDB) and flushes them here when connectivity returns.
router.post('/', async (req, res) => {
  const {
    conversationId,
    clientMsgId,
    type = 'text',
    body,
    mediaUrl,
    mediaMeta,
    replyToId,
  } = req.body || {};

  if (!conversationId || !clientMsgId) {
    return fail(res, 400, 'conversationId et clientMsgId requis');
  }
  if (!(await assertMember(conversationId, req.user.sub))) {
    return fail(res, 403, 'Accès refusé');
  }

  const existing = await prisma.message.findUnique({
    where: { conversationId_clientMsgId: { conversationId, clientMsgId } },
  });
  // Idempotent: if the client retries the same message, return the stored one.
  if (existing) return ok(res, serializeMessage(existing));

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: req.user.sub,
      clientMsgId,
      type,
      body: body ? String(body).slice(0, 4000) : null,
      mediaUrl: mediaUrl ? String(mediaUrl).slice(0, 1000) : null,
      mediaMeta: mediaMeta ? JSON.stringify(mediaMeta) : null,
      replyToId: replyToId || null,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date(), lastMessageId: message.id },
  });

  const peer = await getPeer(conversationId, req.user.sub);
  if (peer) {
    const io = req.app.get('io');
    io?.to(`user:${peer.id}`).emit('message:new', serializeMessage(message));
    io?.to(`user:${peer.id}`).emit('conversation:updated', {
      conversationId,
      lastMessageId: message.id,
      lastMessageAt: message.createdAt,
    });
  }

  return ok(res, serializeMessage(message));
});

export default router;
