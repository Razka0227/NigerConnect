import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { OfflineService } from '../../core/services/offline.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      @if (!offline.online()) {
        <div class="banner banner-offline">Hors ligne — les messages sont enregistrés et envoyés dès la reconnexion</div>
      } @else if (offline.lowData()) {
        <div class="banner banner-degraded">Connexion lente — mode économie de données activé</div>
      }

      <router-outlet />

      <nav class="bottom-nav">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
          <span class="nav-ic">🏠</span> Accueil
        </a>
        <a routerLink="/messages" routerLinkActive="active">
          <span class="nav-ic">💬</span> Messages
        </a>
        <a routerLink="/annonces" routerLinkActive="active">
          <span class="nav-ic">📦</span> Annonces
        </a>
        <a routerLink="/trajets" routerLinkActive="active">
          <span class="nav-ic">🚌</span> Trajets
        </a>
        <a routerLink="/profil" routerLinkActive="active">
          <span class="nav-ic">👤</span> Profil
        </a>
      </nav>
    </div>
  `,
})
export class LayoutComponent {
  offline = inject(OfflineService);
}
