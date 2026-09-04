import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { DbService } from '../../core/services/db.service';
import { OfflineService } from '../../core/services/offline.service';
import { SocketService } from '../../core/services/socket.service';
import { APP_CONFIG } from '../../core/config';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { XofPipe } from '../../shared/pipes/xof.pipe';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, FormsModule, AvatarComponent, XofPipe],
  template: `
    <div class="page">
      <h1 class="page-title">Profil</h1>

      <div class="card" style="padding:1.2rem;display:flex;align-items:center;gap:.9rem;margin-bottom:.8rem;">
        <app-avatar [name]="auth.user()?.name" [src]="auth.user()?.avatarUrl" size="lg" />
        <div class="grow">
          <div class="bold" style="font-size:1.05rem;">{{ auth.user()?.name || auth.user()?.phone }}</div>
          <div class="muted small">{{ auth.user()?.phone }}</div>
          <div class="muted small">
            Compte {{ auth.user()?.role === 'driver' ? 'conducteur' : 'passager' }}
            @if (auth.user()?.isVerified) { · vérifié ✓ }
          </div>
        </div>
      </div>

      <div class="card" style="padding:.4rem .9rem;margin-bottom:.8rem;">
        <div class="field" style="margin:.5rem 0;">
          <label>Nom complet</label>
          <div class="row">
            <input class="input grow" [(ngModel)]="name" name="name" />
            <button class="btn btn-primary btn-sm" (click)="save()">Enregistrer</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:.8rem;">
        <a class="list-item" routerLink="/wallet">
          <span class="nav-ic">💳</span>
          <span class="grow bold">Portefeuille</span>
          <span class="muted small">{{ balance() | xof }}</span>
        </a>
        <a class="list-item" routerLink="/actualites">
          <span class="nav-ic">📰</span>
          <span class="grow bold">Actualités</span>
        </a>
        <div class="list-item">
          <span class="nav-ic">📶</span>
          <span class="grow bold">État de la connexion</span>
          <span class="muted small">{{ offline.online() ? (socket.connected() ? 'en ligne' : 'serveur…') : 'hors ligne' }}</span>
        </div>
        <div class="list-item">
          <span class="nav-ic">💾</span>
          <span class="grow bold">Messages en attente (hors ligne)</span>
          <span class="muted small">{{ pending() }}</span>
        </div>
        <div class="list-item">
          <span class="nav-ic">🌐</span>
          <span class="grow bold">Langue</span>
          <span class="muted small">Français</span>
        </div>
      </div>

      <div class="card" style="padding:.6rem;">
        <div class="muted small" style="padding:0 .4rem .4rem;">Niger Connect v{{ APP_CONFIG.version }} — développé pour fonctionner avec peu de data.</div>
        <button class="btn btn-danger btn-block" (click)="logout()">Se déconnecter</button>
      </div>
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private db = inject(DbService);
  offline = inject(OfflineService);
  socket = inject(SocketService);
  private router = inject(Router);
  APP_CONFIG = APP_CONFIG;

  name = '';
  readonly pending = signal(0);
  readonly balance = signal(0);

  async ngOnInit() {
    this.name = this.auth.user()?.name || '';
    this.pending.set((await this.db.getPendingMessages()).length);
    try {
      const r = await this.api.get<{ balance: number }>('/api/payments/wallet');
      this.balance.set(r.data.balance);
    } catch { /* offline */ }
  }

  async save() {
    await this.auth.updateProfile({ name: this.name });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/auth']);
  }
}
