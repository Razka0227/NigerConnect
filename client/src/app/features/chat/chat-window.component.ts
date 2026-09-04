import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../core/services/chat.service';
import { SocketService } from '../../core/services/socket.service';
import { DbService } from '../../core/services/db.service';
import { OfflineService } from '../../core/services/offline.service';
import { AuthService } from '../../core/services/auth.service';
import { Message } from '../../core/models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { AvatarComponent } from '../../shared/components/avatar.component';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule, RelativeTimePipe, AvatarComponent],
  template: `
    <div class="chat-shell">
      <header class="chat-head">
        <button class="icon-btn" (click)="back()">←</button>
        <app-avatar [name]="peer()?.name" [src]="peer()?.avatarUrl" size="sm" />
        <div class="grow">
          <div class="bold">{{ peer()?.name || peer()?.phone || '…' }}</div>
          <div class="muted small">{{ typing() ? 'en train d’écrire…' : (connected() ? 'en ligne' : 'hors ligne') }}</div>
        </div>
      </header>

      @if (!offline.online()) {
        <div class="banner banner-offline">Hors ligne — votre message sera envoyé à la reconnexion</div>
      }

      <div class="messages" #scroll>
        @for (m of messages(); track m.id) {
          <div class="msg-row" [class.mine]="m.senderId === me()?.id">
            <div class="bubble" [class.mine]="m.senderId === me()?.id" [class.theirs]="m.senderId !== me()?.id">
              {{ m.body }}
              <span class="time">
                {{ m.createdAt | relTime }}
                @if (m.senderId === me()?.id) { {{ m.pending ? '⏳' : m.failed ? '⚠️' : '' }} }
              </span>
            </div>
          </div>
        } @empty {
          <div class="muted" style="text-align:center;padding:2rem;">Envoyez le premier message !</div>
        }
      </div>

      <form class="composer" (ngSubmit)="send()">
        <input class="input grow" placeholder="Écrivez un message…" [(ngModel)]="draft" name="draft"
               (focus)="setTyping(true)" (blur)="setTyping(false)" />
        <button class="btn btn-primary" type="submit" [disabled]="!draft.trim()">Envoyer</button>
      </form>
    </div>
  `,
  styles: [
    `
      .chat-shell { display: flex; flex-direction: column; height: 100dvh; max-height: 100dvh; }
      .chat-head {
        display: flex; align-items: center; gap: 0.6rem;
        padding: 0.7rem 0.8rem; background: var(--surface);
        border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 5;
      }
      .icon-btn { border: none; background: none; font-size: 1.3rem; cursor: pointer; padding: 0.2rem 0.4rem; }
      .messages { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.45rem; }
      .msg-row { display: flex; }
      .msg-row.mine { justify-content: flex-end; }
      .composer {
        display: flex; gap: 0.5rem; padding: 0.6rem 0.8rem;
        background: var(--surface); border-top: 1px solid var(--border);
        padding-bottom: calc(0.6rem + env(safe-area-inset-bottom));
      }
    `,
  ],
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chat = inject(ChatService);
  private socket = inject(SocketService);
  private db = inject(DbService);
  offline = inject(OfflineService);
  private auth = inject(AuthService);

  readonly messages = signal<Message[]>([]);
  readonly peer = signal<{ name?: string; phone?: string; avatarUrl?: string } | null>(null);
  readonly typing = signal(false);

  me = this.auth.user;
  draft = '';
  connected = this.socket.connected;

  private conversationId = '';
  private onNew: ((msg: Message) => void) | null = null;

  async ngOnInit() {
    this.conversationId = this.route.snapshot.paramMap.get('id')!;
    const conv = this.chat.conversations().find((c) => c.id === this.conversationId)
      ?? await this.db.getCachedConversation(this.conversationId);
    if (conv) this.peer.set(conv.other[0] || null);

    this.messages.set(await this.chat.loadMessages(this.conversationId));
    this.socket.connect();
    this.socket.joinConversation(this.conversationId);
    this.chat.registerRead(this.conversationId);

    this.onNew = (msg: Message) => {
      if (msg.conversationId !== this.conversationId) return;
      this.appendMessage(msg);
    };
    this.socket.onMessageNew(this.onNew);
    this.scrollToBottom();
  }

  private appendMessage(msg: Message) {
    this.messages.update((list) => {
      const exists = list.some((m) => m.id === msg.id || (msg.clientMsgId && m.clientMsgId === msg.clientMsgId));
      return exists ? list : [...list, msg];
    });
    this.scrollToBottom();
  }

  async send() {
    const body = this.draft.trim();
    if (!body) return;
    this.draft = '';
    await this.chat.sendText(this.conversationId, body);
    // refresh local view to replace the pending bubble
    this.messages.set(await this.chat.loadMessages(this.conversationId));
    this.scrollToBottom();
  }

  setTyping(on: boolean) {
    this.socket.sendTyping(this.conversationId, on);
  }

  private scrollToBottom() {
    setTimeout(() => {
      const el = document.querySelector('.chat-shell .messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }

  back() {
    this.router.navigate(['/messages']);
  }

  ngOnDestroy() {
    this.socket.leaveConversation(this.conversationId);
    if (this.onNew) this.socket.off('message:new', this.onNew as any);
  }
}
