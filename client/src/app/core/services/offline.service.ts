import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { DbService } from './db.service';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class OfflineService implements OnDestroy {
  private api = inject(ApiService);
  private db = inject(DbService);
  private socket = inject(SocketService);

  readonly online = signal<boolean>(navigator.onLine);
  readonly lowData = signal<boolean>(this.detectLowData());

  private listeners: Array<() => void> = [];

  constructor() {
    // degraded socket connectivity → low-data mode
    effect(() => {
      if (this.socket.degraded()) this.lowData.set(true);
    });

    // Detect degraded connectivity
    const nav = navigator as Navigator & { connection?: any };
    if (nav.connection?.addEventListener) {
      nav.connection.addEventListener('change', () => this.lowData.set(this.detectLowData()));
    }

    this.listeners.push(
      addWindowListener('online', () => {
        this.online.set(true);
        this.flushOutbox();
      }),
      addWindowListener('offline', () => this.online.set(false)),
      addWindowListener('nc:unauthorized', () => this.socket.disconnect())
    );
  }

  private detectLowData(): boolean {
    const nav = navigator as Navigator & { connection?: any };
    const et = nav.connection?.effectiveType;
    const saver = nav.connection?.saveData;
    return (et === '2g' || et === 'slow-2g') || !!saver;
  }

  // Flush locally queued messages to the server (offline-first sync).
  async flushOutbox(): Promise<number> {
    if (!navigator.onLine) return 0;
    const pending = await this.db.getPendingMessages();
    let sent = 0;
    for (const item of pending) {
      try {
        await this.api.post('/api/messages', item.payload);
        await this.db.removePendingMessage(item.id!);
        sent += 1;
      } catch {
        break; // keep remaining for next flush
      }
    }
    if (sent > 0) {
      window.dispatchEvent(new CustomEvent('nc:outbox-flushed'));
    }
    return sent;
  }

  ngOnDestroy() {
    this.listeners.forEach((fn) => fn());
  }
}

function addWindowListener(type: string, fn: () => void): () => void {
  window.addEventListener(type, fn);
  return () => window.removeEventListener(type, fn);
}
