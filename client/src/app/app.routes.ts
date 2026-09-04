import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LayoutComponent } from './features/layout/layout.component';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'messages',
        loadComponent: () => import('./features/chat/chat-list.component').then((m) => m.ChatListComponent),
      },
      {
        path: 'messages/:id',
        loadComponent: () => import('./features/chat/chat-window.component').then((m) => m.ChatWindowComponent),
      },
      {
        path: 'annonces',
        loadComponent: () => import('./features/ads/ads-list.component').then((m) => m.AdsListComponent),
      },
      {
        path: 'annonces/nouveau',
        loadComponent: () => import('./features/ads/ad-new.component').then((m) => m.AdNewComponent),
      },
      {
        path: 'annonces/:id',
        loadComponent: () => import('./features/ads/ad-detail.component').then((m) => m.AdDetailComponent),
      },
      {
        path: 'trajets',
        loadComponent: () => import('./features/transport/rides-list.component').then((m) => m.RidesListComponent),
      },
      {
        path: 'trajets/nouveau',
        loadComponent: () => import('./features/transport/ride-new.component').then((m) => m.RideNewComponent),
      },
      {
        path: 'trajets/:id',
        loadComponent: () => import('./features/transport/ride-detail.component').then((m) => m.RideDetailComponent),
      },
      {
        path: 'wallet',
        loadComponent: () => import('./features/payments/wallet.component').then((m) => m.WalletComponent),
      },
      {
        path: 'actualites',
        loadComponent: () => import('./features/news/news-list.component').then((m) => m.NewsListComponent),
      },
      {
        path: 'actualites/:id',
        loadComponent: () => import('./features/news/news-detail.component').then((m) => m.NewsDetailComponent),
      },
      {
        path: 'profil',
        loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
