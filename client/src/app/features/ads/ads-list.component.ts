import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { DbService } from '../../core/services/db.service';
import { OfflineService } from '../../core/services/offline.service';
import { Ad } from '../../core/models';
import { XofPipe } from '../../shared/pipes/xof.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

const CATS = [
  { id: '', label: 'Tout' },
  { id: 'vehicules', label: 'Véhicules' },
  { id: 'immobilier', label: 'Immobilier' },
  { id: 'electronique', label: 'Électronique' },
  { id: 'emploi', label: 'Emploi' },
  { id: 'agriculture', label: 'Agriculture' },
  { id: 'autre', label: 'Autre' },
];

@Component({
  selector: 'app-ads-list',
  standalone: true,
  imports: [RouterLink, XofPipe, RelativeTimePipe, EmptyStateComponent],
  template: `
    <div class="page">
      <div class="row" style="margin-bottom:0.5rem;">
        <h1 class="page-title grow" style="margin-bottom:0;">Annonces</h1>
        <a class="btn btn-primary btn-sm" routerLink="/annonces/nouveau">+ Publier</a>
      </div>

      <div class="chips">
        @for (cat of cats(); track cat.id) {
          <button class="chip" [class.active]="activeCat() === cat.id" (click)="setCat(cat.id)">{{ cat.label }}</button>
        }
      </div>

      @if (ads().length === 0) {
        @if (loading()) {
          <div class="skeleton" style="height:120px;margin-bottom:.6rem"></div>
          <div class="skeleton" style="height:120px"></div>
        } @else {
          <app-empty-state icon="📦" title="Aucune annonce" hint="Soyez le premier à publier une annonce." />
        }
      }

      <div class="ads-grid">
        @for (ad of ads(); track ad.id) {
          <a class="card ad-card" [routerLink]="['/annonces', ad.id]">
            <div class="ad-thumb">
              @if (ad.images.length && !offline.lowData()) {
                <img [src]="ad.images[0]" loading="lazy" alt="" />
              } @else {
                <span class="ad-emoji">{{ emoji(ad.category) }}</span>
              }
            </div>
            <div class="ad-body">
              <div class="ad-price">{{ ad.price | xof }}</div>
              <div class="ad-title">{{ ad.title }}</div>
              <div class="muted small">{{ ad.city || 'Niger' }} · {{ ad.createdAt | relTime }}</div>
            </div>
          </a>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .ads-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
      .ad-card { display: block; text-decoration: none; color: inherit; overflow: hidden; }
      .ad-thumb {
        height: 96px; background: var(--surface-2);
        display: flex; align-items: center; justify-content: center; overflow: hidden;
      }
      .ad-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .ad-emoji { font-size: 2rem; opacity: 0.7; }
      .ad-body { padding: 0.55rem 0.6rem 0.65rem; }
      .ad-price { font-weight: 800; color: var(--primary); }
      .ad-title { font-weight: 600; font-size: 0.88rem; line-height: 1.3;
                   display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    `,
  ],
})
export class AdsListComponent implements OnInit {
  private api = inject(ApiService);
  private db = inject(DbService);
  offline = inject(OfflineService);

  readonly ads = signal<Ad[]>([]);
  readonly activeCat = signal('');
  readonly loading = signal(true);
  readonly cats = signal(CATS);

  async ngOnInit() {
    await this.load();
  }

  async setCat(id: string) {
    this.activeCat.set(id);
    await this.load();
  }

  private async load() {
    const cat = this.activeCat();
    const cacheKey = `ads:${cat || 'all'}`;
    const cached = await this.db.cacheGet<Ad[]>(cacheKey);
    if (cached) { this.ads.set(cached); this.loading.set(false); }

    if (!this.offline.online()) return;
    this.loading.set(true);
    try {
      const r = await this.api.get<Ad[]>(`/api/ads?category=${cat}&perPage=30`);
      this.ads.set(r.data);
      await this.db.cachePut(cacheKey, r.data, 2 * 60 * 1000);
    } catch {
      // keep cache
    } finally {
      this.loading.set(false);
    }
  }

  emoji(category: string): string {
    return ({ vehicules: '🚗', immobilier: '🏠', electronique: '📱', emploi: '💼', agriculture: '🌾' } as any)[category] || '📦';
  }
}
