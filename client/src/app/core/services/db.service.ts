import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';
import { Conversation, Message } from '../models';

export interface PendingMessage {
  id?: number;
  clientMsgId: string;
  conversationId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CachedConversation {
  id: string;
  data: Conversation;
  updatedAt: string;
}

export interface ApiCacheEntry {
  key: string;
  data: unknown;
  savedAt: number;
}

export interface ReadCursor {
  conversationId: string;
  lastReadAt: string;
}

@Injectable({ providedIn: 'root' })
export class DbService {
  private db: Dexie;
  pendingMessages!: Table<PendingMessage, number>;
  cachedConversations!: Table<CachedConversation, string>;
  cachedMessages!: Table<Message, string>;
  apiCache!: Table<ApiCacheEntry, string>;
  readCursors!: Table<ReadCursor, string>;

  constructor() {
    this.db = new Dexie('nigerconnect');
    this.db.version(1).stores({
      pendingMessages: '++id, clientMsgId, conversationId, createdAt',
      cachedConversations: 'id, updatedAt',
      cachedMessages: 'id, conversationId, createdAt',
      apiCache: 'key',
      readCursors: 'conversationId',
    });
    this.pendingMessages = this.db.table('pendingMessages');
    this.cachedConversations = this.db.table('cachedConversations');
    this.cachedMessages = this.db.table('cachedMessages');
    this.apiCache = this.db.table('apiCache');
    this.readCursors = this.db.table('readCursors');
  }

  // ---- Outbox (messages queued while offline) ----
  queueMessage(payload: Record<string, unknown>) {
    return this.pendingMessages.add({
      clientMsgId: payload['clientMsgId'] as string,
      conversationId: payload['conversationId'] as string,
      payload,
      createdAt: new Date().toISOString(),
    });
  }

  getPendingMessages(): Promise<PendingMessage[]> {
    return this.pendingMessages.toArray();
  }

  removePendingMessage(id: number) {
    return this.pendingMessages.delete(id);
  }

  async hasPendingMessages(): Promise<boolean> {
    return (await this.pendingMessages.count()) > 0;
  }

  // ---- Message cache (offline reading) ----
  async putMessages(messages: Message[]) {
    if (messages.length) await this.cachedMessages.bulkPut(messages);
  }

  async getMessages(conversationId: string, limit = 100): Promise<Message[]> {
    const rows = await this.cachedMessages
      .where('conversationId')
      .equals(conversationId)
      .toArray();
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-limit);
  }

  async cacheConversations(conversations: Conversation[]) {
    if (!conversations.length) return;
    const rows = conversations.map((c) => ({
      id: c.id,
      data: c,
      updatedAt: c.updatedAt,
    }));
    await this.cachedConversations.bulkPut(rows);
  }

  async getCachedConversations(): Promise<Conversation[]> {
    const rows = await this.cachedConversations.toArray();
    return rows
      .map((r) => r.data)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getCachedConversation(id: string): Promise<Conversation | undefined> {
    const row = await this.cachedConversations.get(id);
    return row?.data;
  }

  // ---- Generic API cache with TTL (ads, news, etc.) ----
  async cachePut(key: string, data: unknown, ttlMs: number) {
    await this.apiCache.put({ key, data, savedAt: Date.now() + ttlMs });
  }

  async cacheGet<T>(key: string): Promise<T | null> {
    const row = await this.apiCache.get(key);
    if (!row) return null;
    if (row.savedAt < Date.now()) {
      await this.apiCache.delete(key);
      return null;
    }
    return row.data as T;
  }

  async clearApiCache() {
    await this.apiCache.clear();
  }
}
