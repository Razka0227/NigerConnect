import { Server } from 'socket.io';
import { prisma } from '../db.js';
import { verifyToken } from '../utils.js';

function serializeMessage(m) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    clientMsgId: m.clientMsgId,
    type: m.type,
    body: m.body,
    mediaUrl: m.mediaUrl,
    mediaMeta: m.mediaMeta ? safeJson(m.mediaMeta) : undefined,
    replyToId: m.replyToId,
    deliveredAt: m.deliveredAt,
    readAt: m.readAt,
    createdAt: m.createdAt,
  };
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return undefined; }
}

async function isMember(conversationId, userId) {
  const m = await prisma.conversationUser.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return Boolean(m);
}

export function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // tightened in prod via CORS env on HTTP; socket auth via JWT
      methods: ['GET', 'POST'],
    },
    // Low-data / degraded mode: prefer WebSocket, transparent fallback to
    // HTTP long-polling when WS is blocked or flaky.
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
    // Per-message compression (enabled by default, fine with text payloads)
    perMessageDeflate: true,
    allowUpgrades: true,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('auth_required'));
    try {
      const payload = verifyToken(token);
      socket.user = payload;
      return next();
    } catch {
      return next(new Error('invalid_token'));
    }
  });

  const online = new Map(); // userId -> Set of socket ids

  io.on('connection', async (socket) => {
    const userId = socket.user.sub;
    socket.join(`user:${userId}`);
    socket.join(`presence:${userId}`);

    if (!online.has(userId)) online.set(userId, new Set());
    online.get(userId).add(socket.id);
    socket.broadcast.emit('presence:online', userId);

    // Message sent in real time. Clients also sync via REST (offline queue),
    // both paths are idempotent via clientMsgId.
    socket.on('message:send', async (payload, ack) => {
      try {
        const {
          conversationId, clientMsgId, type = 'text', body, mediaUrl, mediaMeta, replyToId,
        } = payload || {};
        if (!conversationId || !clientMsgId) {
          return ack?.({ ok: false, error: 'conversationId et clientMsgId requis' });
        }
        if (!(await isMember(conversationId, userId))) {
          return ack?.({ ok: false, error: 'access_denied' });
        }

        const existing = await prisma.message.findUnique({
          where: { conversationId_clientMsgId: { conversationId, clientMsgId } },
        });
        if (existing) return ack?.({ ok: true, data: serializeMessage(existing), duplicate: true });

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
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

        const serialized = serializeMessage(message);
        io.to(`conv:${conversationId}`).emit('message:new', serialized);
        socket.to(`conv:${conversationId}`).emit('message:delivered', { messageId: message.id });

        // Notify members who are not viewing the window (chat list refresh)
        const members = await prisma.conversationUser.findMany({
          where: { conversationId, userId: { not: userId } },
        });
        for (const m of members) {
          io.to(`user:${m.userId}`).emit('conversation:updated', {
            conversationId,
            lastMessageId: message.id,
            lastMessageAt: message.createdAt,
          });
        }
        ack?.({ ok: true, data: serialized });
      } catch (e) {
        console.error('message:send error', e);
        ack?.({ ok: false, error: 'internal_error' });
      }
    });

    socket.on('conversation:join', (conversationId, ack) => {
      if (!conversationId) return;
      isMember(conversationId, userId).then((okMember) => {
        if (okMember) {
          socket.join(`conv:${conversationId}`);
          ack?.({ ok: true });
        } else {
          ack?.({ ok: false, error: 'access_denied' });
        }
      });
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conv:${conversationId}`).emit('typing', { conversationId, userId, isTyping });
    });

    socket.on('message:read', async ({ conversationId, messageIds }, ack) => {
      try {
        if (!(await isMember(conversationId, userId))) return ack?.({ ok: false });
        const ids = Array.isArray(messageIds) ? messageIds : [messageIds];
        await prisma.message.updateMany({
          where: { conversationId, id: { in: ids }, senderId: { not: userId }, readAt: null },
          data: { readAt: new Date() },
        });
        await prisma.conversationUser.update({
          where: { conversationId_userId: { conversationId, userId } },
          data: { lastReadAt: new Date() },
        });
        io.to(`conv:${conversationId}`).emit('message:read', { userId, messageIds: ids });
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
      socket.leave(`presence:${userId}`);
      const set = online.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          online.delete(userId);
          socket.broadcast.emit('presence:offline', userId);
        }
      }
    });
  });

  return io;
}
