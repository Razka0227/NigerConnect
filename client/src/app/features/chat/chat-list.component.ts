import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChatService } from '../../core/services/chat.service';
import { DbService } from '../../core/services/db.service';
import { ApiService } from '../../core/services/api.service';
import { User } from '../../core/models';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [RouterLink, AvatarComponent, RelativeTimePipe, EmptyStateComponent, FormsModule],
  template: `
    <div class="page">
      <h1 class="page-title">Messages</h1>

      <form class="search" (ngSubmit)="search()">
        <input class="input" type="search" placeholder="Rechercher par téléphone ou nom…"
               [(ngModel)]="query" name="q" />
      </form>

      @if (results()) {
        <div class="card" style="margin-bottom:.6rem;">
          @for (u of results(); track u.id) {
            <div class="list-item" (click)="startChat(u.id)">
              <app-avatar [name]="u.name" [src]="u.avatarUrl" size="sm" />
              <div class="grow">
                <div class="bold">{{ u.name || u.phone }}</div>
                <div class="muted small">{{ u.phone }}</div>
              </div>
              <button class="btn btn-primary btn-sm">Discuter</button>
            </div>
          } @empty {
            <div class="muted small" style="padding:.75rem 1rem;">Aucun résultat.</div>
          }
        </div>
      }

      @if (chat.conversations().length === 0) {
        <app-empty-state icon="💬" title="Aucune conversation"
                         hint="Cherchez un numéro ci-dessus pour démarrer une discussion." />
      }

      <div class="card">
        @for (conv of chat.conversations(); track conv.id) {
          <a class="list-item" [routerLink]="['/messages', conv.id]">
            <app-avatar [name]="conv.other[0]?.name" [src]="conv.other[0]?.avatarUrl" />
            <div class="grow">
              <div class="row">
                <span class="bold grow" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  {{ conv.other[0]?.name || conv.other[0]?.phone || conv.title }}
                </span>
                @if (conv.lastMessage && !chat.isMine(conv.lastMessage)) {
                  <span class="badge">1</span>
                }
              </div>
              <div class="muted small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                @if (conv.lastMessage) {
                  {{ chat.isMine(conv.lastMessage) ? 'Vous : ' : '' }}{{ conv.lastMessage.body }}
                } @else { Nouvelle conversation }
              </div>
            </div>
            @if (conv.lastMessage) {
              <span class="muted small">{{ conv.lastMessage.createdAt | relTime }}</span>
            }
          </a>
        } @empty {}
      </div>
    </div>
  `,
  styles: ['.search { margin-bottom: 0.8rem; }'],
})
export class ChatListComponent implements OnInit {
  chat = inject(ChatService);
  private api = inject(ApiService);
  private router = inject(Router);

  query = '';
  readonly results = signal<User[] | null>(null);

  async ngOnInit() {
    await this.chat.init();
  }

  async search() {
    if (this.query.trim().length < 3) return;
    try {
      const r = await this.api.get<User[]>(`/api/users/search?q=${encodeURIComponent(this.query.trim())}`);
      this.results.set(r.data);
    } catch {
      this.results.set([]);
    }
  }

  async startChat(userId: string) {
    const conv = await this.chat.openConversation(userId);
    this.results.set(null);
    this.query = '';
    this.router.navigate(['/messages', conv.id]);
  }
}
