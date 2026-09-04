import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { DbService } from '../../core/services/db.service';
import { NewsDetail } from '../../core/models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-news-detail',
  standalone: true,
  imports: [RouterLink, RelativeTimePipe],
  template: `
    <div class="page">
      <a routerLink="/actualites" class="back">← Retour aux actualités</a>

      @if (item()) {
        <article class="card" style="padding:1.2rem;">
          <div class="small" style="color:var(--accent);font-weight:700;text-transform:uppercase;">{{ item()!.category }}</div>
          <h1 style="font-size:1.3rem;margin:.4rem 0 .3rem;">{{ item()!.title }}</h1>
          <div class="muted small">{{ item()!.source }} · {{ item()!.publishedAt | relTime }}</div>
          @if (item()!.imageUrl) {
            <img [src]="item()!.imageUrl" alt="" style="width:100%;border-radius:8px;margin:.8rem 0;" loading="lazy" />
          }
          <p style="line-height:1.6;">{{ item()!.summary }}</p>
          @if (item()!.body) { <p style="line-height:1.6;">{{ item()!.body }}</p> }
        </article>
      } @else {
        <div class="skeleton" style="height:300px"></div>
      }
    </div>
  `,
  styles: ['.back { display: inline-block; margin-bottom: 0.8rem; text-decoration: none; }'],
})
export class NewsDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private db = inject(DbService);

  readonly item = signal<NewsDetail | null>(null);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    const cached = await this.db.cacheGet<NewsDetail>(`news:item:${id}`);
    if (cached) this.item.set(cached);
    try {
      const r = await this.api.get<NewsDetail>(`/api/news/${id}`);
      this.item.set(r.data);
      await this.db.cachePut(`news:item:${id}`, r.data, 10 * 60 * 1000);
    } catch { /* keep cache */ }
  }
}
