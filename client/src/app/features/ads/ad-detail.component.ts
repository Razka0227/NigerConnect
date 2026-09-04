import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { Ad } from '../../core/models';
import { XofPipe } from '../../shared/pipes/xof.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-ad-detail',
  standalone: true,
  imports: [XofPipe, RelativeTimePipe, RouterLink],
  template: `
    <div class="page">
      @if (ad()) {
        <a routerLink="/annonces" class="back">← Retour</a>

        <div class="card detail">
          @if (ad()!.images.length && !ad()!.seller) {
            <div class="hero"><span class="hero-emoji">{{ emoji }}</span></div>
          }
          <div class="detail-body">
            <div class="chip" style="display:inline-block;">{{ ad()!.category }}</div>
            <h1 class="title">{{ ad()!.title }}</h1>
            <div class="price">{{ ad()!.price | xof }}</div>
            <div class="muted small">{{ ad()!.city || 'Niger' }} · {{ ad()!.createdAt | relTime }} · {{ ad()!.views }} vues</div>
            <p class="desc">{{ ad()!.description }}</p>

            @if (ad()!.seller) {
              <div class="card seller">
                <div class="row">
                  <span class="muted small">Vendeur :</span>
                  <span class="bold">{{ ad()!.seller!.name || ad()!.seller!.phone }}</span>
                </div>
                @if (!isMine()) {
                  <button class="btn btn-primary btn-block" (click)="startChat()">Discuter avec le vendeur</button>
                }
              </div>
            }

            @if (isMine()) {
              <div class="row" style="gap:.5rem;">
                <button class="btn btn-block grow" (click)="toggleStatus('sold')">
                  {{ ad()!.status === 'sold' ? 'Remettre en vente' : 'Marquer vendu' }}
                </button>
                <button class="btn btn-danger btn-block grow" (click)="archive()">Archiver</button>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="skeleton" style="height:300px"></div>
      }
    </div>
  `,
  styles: [
    `
      .back { display: inline-block; margin-bottom: 0.8rem; text-decoration: none; }
      .detail { overflow: hidden; }
      .hero { height: 160px; background: var(--surface-2); display: flex; align-items: center; justify-content: center; }
      .hero-emoji { font-size: 3rem; opacity: 0.6; }
      .detail-body { padding: 1rem; }
      .title { font-size: 1.2rem; margin: 0.5rem 0 0.2rem; }
      .price { font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 0.2rem; }
      .desc { margin: 0.9rem 0; line-height: 1.55; }
      .seller { padding: 0.8rem; margin-top: 1rem; }
    `,
  ],
})
export class AdDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private chat = inject(ChatService);

  readonly ad = signal<Ad | null>(null);

  get emoji(): string {
    const c = this.ad()?.category || '';
    return ({ vehicules: '🚗', immobilier: '🏠', electronique: '📱', emploi: '💼', agriculture: '🌾' } as any)[c] || '📦';
  }

  isMine(): boolean {
    return this.ad()?.seller?.id === this.auth.user()?.id;
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const r = await this.api.get<Ad>(`/api/ads/${id}`);
      this.ad.set(r.data);
    } catch {
      this.router.navigate(['/annonces']);
    }
  }

  async toggleStatus(status: 'sold' | 'active') {
    const next = this.ad()!.status === 'sold' ? 'active' : 'sold';
    const r = await this.api.patch<Ad>(`/api/ads/${this.ad()!.id}`, { status: next });
    this.ad.set(r.data);
  }

  async archive() {
    await this.api.patch<Ad>(`/api/ads/${this.ad()!.id}`, { status: 'archived' });
    this.router.navigate(['/annonces']);
  }

  async startChat() {
    const conv = await this.chat.openConversation(this.ad()!.seller!.id);
    this.router.navigate(['/messages', conv.id]);
  }
}
