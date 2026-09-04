import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { SocketService } from '../../core/services/socket.service';
import { Ride } from '../../core/models';
import { XofPipe } from '../../shared/pipes/xof.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-ride-detail',
  standalone: true,
  imports: [RouterLink, XofPipe, RelativeTimePipe],
  template: `
    <div class="page">
      <a routerLink="/trajets" class="back">← Retour</a>

      @if (ride()) {
        <div class="card" style="padding:1rem;">
          <h1 class="title">{{ ride()!.from }} → {{ ride()!.to }}</h1>
          <div class="muted small">
            {{ ride()!.departAt | relTime }} · {{ ride()!.vehicle || 'Véhicule non précisé' }}
          </div>

          <div class="row" style="margin:1rem 0;gap:.8rem;">
            <div class="stat">
              <div class="stat-n">{{ ride()!.pricePerSeat | xof }}</div>
              <div class="stat-l muted small">par place</div>
            </div>
            <div class="stat">
              <div class="stat-n">{{ ride()!.seatsLeft }}</div>
              <div class="stat-l muted small">places restantes</div>
            </div>
            <div class="stat">
              <div class="stat-n">{{ ride()!.driver?.name || ride()!.driver?.phone }}</div>
              <div class="stat-l muted small">conducteur</div>
            </div>
          </div>

          @if (isDriver()) {
            <div class="row" style="gap:.5rem;">
              <button class="btn btn-block grow" (click)="setStatus('inProgress')">Démarrer</button>
              <button class="btn btn-block grow" (click)="setStatus('completed')">Terminer</button>
              <button class="btn btn-danger btn-block grow" (click)="setStatus('cancelled')">Annuler</button>
            </div>
          } @else {
            <button class="btn btn-primary btn-block" (click)="request()" [disabled]="requesting() || ride()!.seatsLeft <= 0">
              {{ requesting() ? 'Envoi…' : (ride()!.hasRequested ? 'Demande envoyée' : 'Réserver une place') }}
            </button>
            @if (ride()!.driver) {
              <button class="btn btn-block" style="margin-top:.5rem;" (click)="contact()">💬 Contacter le conducteur</button>
            }
          }

          @if (message()) { <p class="error-text" style="text-align:center;">{{ message() }}</p> }
        </div>
      } @else {
        <div class="skeleton" style="height:200px"></div>
      }
    </div>
  `,
  styles: [
    `
      .back { display: inline-block; margin-bottom: 0.8rem; text-decoration: none; }
      .title { margin: 0 0 0.2rem; }
      .stat { flex: 1; text-align: center; background: var(--surface-2); border-radius: var(--radius-sm); padding: 0.6rem 0.4rem; }
      .stat-n { font-weight: 800; }
    `,
  ],
})
export class RideDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private chat = inject(ChatService);
  private socket = inject(SocketService);

  readonly ride = signal<Ride | null>(null);
  readonly requesting = signal(false);
  readonly message = signal('');

  private rideId = '';

  isDriver(): boolean {
    return this.ride()?.driver?.id === this.auth.user()?.id;
  }

  async ngOnInit() {
    this.rideId = this.route.snapshot.paramMap.get('id')!;
    this.socket.connect();
    try {
      const r = await this.api.get<Ride>(`/api/rides/${this.rideId}`);
      this.ride.set(r.data);
    } catch {
      this.router.navigate(['/trajets']);
    }
  }

  async request() {
    this.requesting.set(true);
    this.message.set('');
    try {
      await this.api.post(`/api/rides/${this.rideId}/request`, { seats: 1 });
      this.message.set('Demande envoyée ! Le conducteur vous répondra bientôt.');
      const r = await this.api.get<Ride>(`/api/rides/${this.rideId}`);
      this.ride.set(r.data);
    } catch (e: any) {
      this.message.set(e.message);
    } finally {
      this.requesting.set(false);
    }
  }

  async setStatus(status: string) {
    await this.api.patch(`/api/rides/${this.rideId}/status`, { status });
    const r = await this.api.get<Ride>(`/api/rides/${this.rideId}`);
    this.ride.set(r.data);
  }

  async contact() {
    const conv = await this.chat.openConversation(this.ride()!.driver!.id);
    this.router.navigate(['/messages', conv.id]);
  }
}
