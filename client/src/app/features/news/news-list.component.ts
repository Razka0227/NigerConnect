import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { DbService } from '../../core/services/db.service';
import { OfflineService } from '../../core/services/offline.service';
import { NewsItem } from '../../core/models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

const CATS = [
  { id: '', label: 'Tout' },
  { id: 'niger', label: 'Niger' },
  { id: 'economie', label: 'Économie' },
  { id: 'tech', label: 'Tech' },
  { id: 'sport', label: 'Sport' },
  { id: 'general', label: 'Général' },
];

@Component({
  selector: 'app-news-list',
  standalone: true,
  imports: [RouterLink, RelativeTimePipe, EmptyStateComponent],
  template: `
    <div class="page">
      <div class="row" style="margin-bottom:.5rem;">
        <h1 class="page-title grow" style="margin-bottom:0;">Actualités</h1>
        <button class="btn btn-sm" (click)="goHome()">Accueil</button>
      </div>

      <div class="chips">
        @for (cat of cats(); track cat.id) {
          <button class="chip" [class.active]="activeCat() === cat.id" (click)="setCat(cat.id)">{{ cat.label }}</button>
        }
      </div>

      @if (news().length === 0) {
        @if (loading()) {
          <div class="skeleton" style="height:90px;margin-bottom:.6rem"></div>
          <div class="skeleton" style="height:90px"></div>
        } @else {
          <app-empty-state icon="📰" title="Aucun article" />
        }
      }

      <div class="card">
        @for (item of news(); track item.id) {
          <a class="list-item" [routerLink]="['/actualites', item.id]">
            @if (item.imageUrl && !offline.lowData()) {
              <img [src]="item.imageUrl" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:6px;" loading="lazy" />
            }
            <div class="grow">
              <div class="small" style="color:var(--accent);font-weight:700;text-transform:uppercase;">{{ item.category }}</div>
              <div class="bold" style="line-height:1.3;">{{ item.title }}</div>
              <div class="muted small">{{ item.source }} · {{ item.publishedAt | relTime }}</div>
            </div>
          </a>
        } @empty {}
      </div>
    </div>
  `,
})
export class NewsListComponent implements OnInit {
  api = inject(ApiService);
  private db = inject(DbService);
  offline = inject(OfflineService);

  readonly news = signal<NewsItem[]>([]);
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
    const cacheKey = `news:${cat || 'all'}`;
    const cached = await this.db.cacheGet<NewsItem[]>(cacheKey);
    if (cached) { this.news.set(cached); this.loading.set(false); }
    if (!this.offline.online()) return;

    this.loading.set(true);
    try {
      const r = await this.api.get<NewsItem[]>(`/api/news?category=${cat}&perPage=30`);
      this.news.set(r.data);
      await this.db.cachePut(cacheKey, r.data, 5 * 60 * 1000);
    } catch { /* keep cache */ } finally { this.loading.set(false); }
  }

  goHome() {
    history.back();
  }
}
