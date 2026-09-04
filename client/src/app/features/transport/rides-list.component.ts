import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { DbService } from '../../core/services/db.service';
import { OfflineService } from '../../core/services/offline.service';
import { AuthService } from '../../core/services/auth.service';
import { Ride } from '../../core/models';
import { XofPipe } from '../../shared/pipes/xof.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

@Component({
  selector: 'app-rides-list',
  standalone: true,
  imports: [RouterLink, FormsModule, XofPipe, RelativeTimePipe, EmptyStateComponent],
  template: `
    <div class="page">
      <div class="row" style="margin-bottom:0.7rem;">
        <h1 class="page-title grow" style="margin-bottom:0;">Transport</h1>
        @if (auth.user()?.role !== 'driver') {
          <span class="muted small">Compte passager</span>
        }
        <a class="btn btn-primary btn-sm" routerLink="/trajets/nouveau">+ Trajet</a>
      </div>

      <form class="search card" (ngSubmit)="load()" style="padding:.6rem;display:flex;gap:.5rem;margin-bottom:.7rem;">
        <input class="input grow" placeholder="Départ (ex: Niamey)" [(ngModel)]="from" name="from" />
        <input class="input grow" placeholder="Arrivée (ex: Zinder)" [(ngModel)]="to" name="to" />
        <button class="btn btn-primary" type="submit">OK</button>
      </form>

      @if (rides().length === 0) {
        @if (loading()) {
          <div class="skeleton" style="height:110px;margin-bottom:.6rem"></div>
          <div class="skeleton" style="height:110px"></div>
        } @else {
          <app-empty-state icon="🚌" title="Aucun trajet trouvé" hint="Modifiez votre recherche ou publiez un trajet." />
        }
      }

      <div class="card">
        @for (ride of rides(); track ride.id) {
          <div class="list-item" [routerLink]="['/trajets', ride.id]">
            <div class="grow">
              <div class="bold">
                {{ ride.from }} → {{ ride.to }}
                <span class="chip" style="display:inline-block;margin-left:.4rem;font-size:.72rem;">{{ ride.seatsLeft }} place(s)</span>
              </div>
              <div class="muted small">
                {{ ride.departAt | relTime }} · {{ ride.vehicle || 'Véhicule' }} · {{ ride.driver?.name || 'Conducteur' }}
              </div>
            </div>
            <span class="bold" style="color:var(--primary);">{{ ride.pricePerSeat | xof }}</span>
          </div>
        } @empty {}
      </div>
    </div>
  `,
})
export class RidesListComponent implements OnInit {
  api = inject(ApiService);
  private db = inject(DbService);
  offline = inject(OfflineService);
  auth = inject(AuthService);

  from = '';
  to = '';
  readonly rides = signal<Ride[]>([]);
  readonly loading = signal(true);

  async ngOnInit() {
    await this.load();
  }

  async load() {
    const params = new URLSearchParams();
    if (this.from) params.set('from', this.from);
    if (this.to) params.set('to', this.to);
    const cacheKey = `rides:${this.from}:${this.to}`;
    const cached = await this.db.cacheGet<Ride[]>(cacheKey);
    if (cached) { this.rides.set(cached); this.loading.set(false); }
    if (!this.offline.online()) return;

    this.loading.set(true);
    try {
      const q = params.toString();
      const r = await this.api.get<Ride[]>(`/api/rides${q ? `?${q}` : ''}`);
      this.rides.set(r.data);
      await this.db.cachePut(cacheKey, r.data, 60_000);
      } catch { /* keep cache */ } finally { this.loading.set(false); }
  }
}
