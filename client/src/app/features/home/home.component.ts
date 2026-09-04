import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { DbService } from '../../core/services/db.service';
import { OfflineService } from '../../core/services/offline.service';
import { NewsItem, Wallet } from '../../core/models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { XofPipe } from '../../shared/pipes/xof.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, RelativeTimePipe, XofPipe, EmptyStateComponent],
  template: `
    <div class="page">
      <header class="row" style="margin-bottom: 1rem;">
        <div>
          <h1 class="page-title" style="margin-bottom: 0;">{{ greeting }} 👋</h1>
          <span class="muted small">{{ user()?.name || user()?.phone }}</span>
        </div>
      </header>

      @if (wallet()) {
        <a routerLink="/wallet" class="card wallet-card">
          <div class="row">
            <span class="muted small">Solde mobile money</span>
            <span class="grow"></span>
            <span class="muted small">{{ offline.lowData() ? 'économique' : 'plus' }}</span>
          </div>
          <div class="wallet-balance">{{ wallet()!.balance | xof }}</div>
        </a>
      }

      <div class="grid">
        <a routerLink="/wallet" class="tile"><span class="tile-ic">💳</span>Paiement</a>
        <a routerLink="/annonces/nouveau" class="tile"><span class="tile-ic">📦</span>Publier une annonce</a>
        <a routerLink="/trajets/nouveau" class="tile"><span class="tile-ic">🚌</span>Proposer un trajet</a>
        <a routerLink="/actualites" class="tile"><span class="tile-ic">📰</span>Actualités</a>
      </div>

      <h2 class="section-title">Actualités du Niger</h2>
      @if (news().length === 0) {
        <div class="skeleton" style="height:64px;margin-bottom:.5rem"></div>
        <div class="skeleton" style="height:64px"></div>
      }
      <div class="card news-list">
        @for (item of news(); track item.id) {
          <a class="list-item" [routerLink]="['/actualites', item.id]">
            <div class="grow">
              <div class="small" style="color:var(--accent);font-weight:700;text-transform:uppercase;">{{ item.category }}</div>
              <div class="bold" style="line-height:1.3;">{{ item.title }}</div>
              <div class="muted small" style="margin-top:2px;">{{ item.source }} · {{ item.publishedAt | relTime }}</div>
            </div>
          </a>
        } @empty {
          <app-empty-state icon="📰" title="Aucune actualité" hint="Revenez plus tard." />
        }
      </div>
    </div>
  `,
  styles: [
    `
      .wallet-card { display: block; padding: 0.9rem 1rem; margin-bottom: 1rem; text-decoration: none; color: inherit; }
      .wallet-balance { font-size: 1.6rem; font-weight: 800; color: var(--primary); margin-top: 0.2rem; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-bottom: 1.2rem; }
      .tile {
        display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
        background: var(--surface); border: 1px solid var(--border);
        border-radius: var(--radius); padding: 0.9rem 0.5rem;
        text-decoration: none; color: var(--text); font-size: 0.85rem; font-weight: 600;
      }
      .tile-ic { font-size: 1.4rem; }
      .section-title { font-size: 1rem; margin: 0 0 0.6rem; }
      .news-list { overflow: hidden; }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private db = inject(DbService);
  offline = inject(OfflineService);

  user = this.auth.user;
  readonly wallet = signal<Wallet | null>(null);
  readonly news = signal<NewsItem[]>([]);

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  async ngOnInit() {
    this.loadWallet();
    this.loadNews();
  }

  private async loadWallet() {
    try {
      const r = await this.api.get<Wallet>('/api/payments/wallet');
      this.wallet.set(r.data);
    } catch {
      // offline: show cached
    }
  }

  private async loadNews() {
    const cacheKey = 'news:home';
    const cached = await this.db.cacheGet<NewsItem[]>(cacheKey);
    if (cached) this.news.set(cached);
    if (!this.offline.online()) return;
    try {
      const r = await this.api.get<NewsItem[]>('/api/news?perPage=5');
      this.news.set(r.data);
      await this.db.cachePut(cacheKey, r.data, 5 * 60 * 1000);
    } catch {
      // keep cache
    }
  }
}
