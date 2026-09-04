import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Ad } from '../../core/models';

@Component({
  selector: 'app-ad-new',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" style="max-width:480px;">
      <button class="btn btn-sm" (click)="router.navigate(['/annonces'])">← Retour</button>
      <h1 class="page-title">Publier une annonce</h1>

      <form (ngSubmit)="submit()" class="card" style="padding:1rem;">
        <div class="field">
          <label>Catégorie</label>
          <select class="input" [(ngModel)]="form.category" name="category" required>
            <option value="">— Choisir —</option>
            <option value="vehicules">Véhicules</option>
            <option value="immobilier">Immobilier</option>
            <option value="electronique">Électronique</option>
            <option value="emploi">Emploi</option>
            <option value="agriculture">Agriculture</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div class="field">
          <label>Titre</label>
          <input class="input" [(ngModel)]="form.title" name="title" required maxlength="120" />
        </div>
        <div class="field">
          <label>Description</label>
          <textarea class="input" rows="4" [(ngModel)]="form.description" name="description" maxlength="4000"></textarea>
        </div>
        <div class="row" style="gap:.6rem;align-items:flex-start;">
          <div class="field grow">
            <label>Prix (FCFA)</label>
            <input class="input" type="number" inputmode="numeric" min="0" [(ngModel)]="form.price" name="price" />
          </div>
          <div class="field">
            <label>Ville</label>
            <input class="input" [(ngModel)]="form.city" name="city" placeholder="Niamey" />
          </div>
        </div>
        @if (error) { <p class="error-text">{{ error }}</p> }
        <button class="btn btn-primary btn-block" type="submit" [disabled]="loading || !form.category || !form.title.trim()">
          {{ loading ? 'Publication…' : 'Publier' }}
        </button>
      </form>
    </div>
  `,
})
export class AdNewComponent {
  api = inject(ApiService);
  router = inject(Router);

  loading = false;
  error = '';
  form = { category: '', title: '', description: '', price: null as number | null, city: '' };

  async submit() {
    this.loading = true;
    this.error = '';
    try {
      const r = await this.api.post<Ad>('/api/ads', this.form);
      this.router.navigate(['/annonces', r.data.id]);
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }
}
