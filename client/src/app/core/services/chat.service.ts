import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { v4 as uuid } from 'uuid';
import { ApiService } from './api.service';
import { DbService } from './db.service';
import { SocketService } from './socket.service';
import { AuthService } from './auth.service';
import { Conversation, Message } from '../models';

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private api = inject(ApiService);
  private db = inject(DbService);
  private socket = inject(SocketService);
  private auth = inject(AuthService);

  readonly conversations = signal<Conversation[]>([]);
  readonly unreadTotal = computed(() =>
    this.conversations().reduce((n, c) => n + (c.lastMessage && !this.isMine(c.lastMessage) ? 1 : 0), 0)
  );

  private listeners: Array<() => void> = [];
  private syncTimer: any = null;

  private debouncedSync() {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.syncConversations(), 400);
  }

  constructor() {
    this.socket.onMessageNew((msg) => this.onIncoming(msg));
    this.socket.onConversationUpdated(() => this.debouncedSync());
    this.socket.onMessageRead(({ userId, messageIds }) => {
      const set = new Set(messageIds);
      this.conversations.update((list) =>
        list.map((c) => {
          const lm = c.lastMessage;
          if (lm && set.has(lm.id)) {
            return { ...c, lastMessage: { ...lm, readAt: new Date().toISOString() } };
          }
          return c;
        })
      );
    });
    window.addEventListener('nc:outbox-flushed', () => this.syncConversations());
  }

  isMine(msg: Message): boolean {
    return msg.senderId === this.auth.user()?.id;
  }

  async init() {
    await this.syncConversations();
  }

  async syncConversations() {
    const cached = await this.db.getCachedConversations();
    this.conversations.set(cached);
    if (!navigator.onLine) return;
    try {
      const r = await this.api.get<Conversation[]>('/api/conversations');
      await this.db.cacheConversations(r.data);
      this.conversations.set(r.data);
    } catch {
      // keep cache
    }
  }

  async openConversation(userId: string): Promise<Conversation> {
    const r = await this.api.post<Conversation>('/api/conversations', { userId });
    await this.db.cacheConversations([r.data]);
    return r.data;
  }

  async loadMessages(conversationId: string): Promise<Message[]> {
    const cached = await this.db.getMessages(conversationId);
    if (!navigator.onLine) return cached;
    try {
      const r = await this.api.get<Message[]>(`/api/conversations/${conversationId}/messages?limit=100`);
      await this.db.putMessages(r.data);
      return r.data;
    } catch {
      return cached;
    }
  }

  async sendText(conversationId: string, body: string): Promise<void> {
    const payload = {
      conversationId,
      clientMsgId: uuid(),
      type: 'text',
      body,
    };
    const optimistic: Message = {
      id: `local-${payload.clientMsgId}`,
      conversationId,
      senderId: this.auth.user()!.id,
      clientMsgId: payload.clientMsgId,
      type: 'text',
      body,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    await this.db.putMessages([optimistic]);
    this.bumpConversation(conversationId, optimistic);

    // Try real-time path first
    const ack = await this.socket.sendMessage(payload);
    if (ack?.ok && ack.data) {
      await this.db.putMessages([{ ...ack.data, pending: false }]);
      this.db.cachedMessages.delete(`local-${payload.clientMsgId}`);
      this.bumpConversation(conversationId, ack.data);
      this.socket.markRead(conversationId, []);
      return;
    }
    // Offline / no ack → queue for sync via REST
    await this.db.queueMessage(payload);
  }

  async flushOutbox() {
    // handled by OfflineService; expose here for chat window
  }

  private onIncoming(msg: Message) {
    this.db.putMessages([msg]);
    this.bumpConversation(msg.conversationId, msg);
    // auto-mark as read if the window is open (handled in component)
  }

  private async bumpConversation(conversationId: string, lastMessage: Message) {
    let conv = await this.db.getCachedConversation(conversationId);
    const updated: Conversation = conv
      ? { ...conv, lastMessage, updatedAt: new Date().toISOString() }
      : {
          id: conversationId,
          type: 'direct',
          other: [],
          lastMessage,
          updatedAt: new Date().toISOString(),
        };
    await this.db.cacheConversations([updated]);
    this.conversations.update((list) => {
      const rest = list.filter((c) => c.id !== conversationId);
      return [updated, ...rest];
    });
  }

  async registerRead(conversationId: string) {
    this.socket.markRead(conversationId, []);
    try {
      await this.api.patch(`/api/conversations/${conversationId}/read`, {});
    } catch { /* ignore */ }
  }

  ngOnDestroy() {
    this.listeners.forEach((fn) => fn());
    window.removeEventListener('nc:outbox-flushed', () => this.syncConversations());
  }
}
