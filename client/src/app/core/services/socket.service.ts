import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import { APP_CONFIG } from '../config';
import { AuthService } from './auth.service';
import { Message } from '../models';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private auth = inject(AuthService);
  private socket: Socket | null = null;
  readonly connected = signal(false);
  readonly degraded = signal(false); // true when only polling transport works

  connect() {
    if (this.socket?.connected) return;
    if (!this.auth.token) return;
    if (this.socket) {
      this.socket.connect();
      return;
    }

    this.socket = io(APP_CONFIG.apiUrl, {
      auth: { token: this.auth.token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
      timeout: 15000,
    });

    this.socket.on('connect', () => {
      this.connected.set(true);
      this.degraded.set(false);
    });
    this.socket.io.on('upgrade' as never, () => this.degraded.set(false));
    this.socket.io.on('upgradeError' as never, () => this.degraded.set(true));
    this.socket.io.on('reconnect_attempt', () => {
      // after 2 failed attempts assume degraded connectivity
      if (this.socket!.io.engine?.transport?.name === 'polling') this.degraded.set(true);
    });
    this.socket.on('disconnect', () => this.connected.set(false));
  }

  disconnect() {
    this.socket?.disconnect();
  }

  // ---- Messaging ----
  onMessageNew(cb: (msg: Message) => void) {
    this.socket?.on('message:new', cb);
  }

  onConversationUpdated(cb: (payload: { conversationId: string; lastMessageId: string }) => void) {
    this.socket?.on('conversation:updated', cb);
  }

  onMessageRead(cb: (payload: { userId: string; messageIds: string[] }) => void) {
    this.socket?.on('message:read', cb);
  }

  onPresence(cb: (userId: string, online: boolean) => void) {
    this.socket?.on('presence:online', (id: string) => cb(id, true));
    this.socket?.on('presence:offline', (id: string) => cb(id, false));
  }

  off(event: string, handler: (...args: any[]) => void) {
    this.socket?.off(event, handler as never);
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('conversation:join', conversationId);
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('conversation:leave', conversationId);
  }

  sendMessage(payload: Record<string, unknown>): Promise<{ ok: boolean; data?: Message; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ ok: false, error: 'offline' });
        return;
      }
      this.socket.emit('message:send', payload, (ack: any) => {
        resolve(ack || { ok: false, error: 'no_ack' });
      });
    });
  }

  markRead(conversationId: string, messageIds: string[]) {
    this.socket?.emit('message:read', { conversationId, messageIds });
  }

  sendTyping(conversationId: string, isTyping: boolean) {
    this.socket?.emit('typing', { conversationId, isTyping });
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
