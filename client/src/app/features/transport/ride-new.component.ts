import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Ride } from '../../core/models';

@Component({
  selector: 'app-ride-new',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" style="max-width:480px;">
      <button class="btn btn-sm" (click)="router.navigate(['/trajets'])">← Retour</button>
      <h1 class="page-title">Proposer un trajet</h1>

      @if (errorRole) {
        <div class="card" style="padding:.8rem;margin-bottom:.8rem;background:var(--accent-soft);border-color:var(--accent);">
          <span class="small">Votre compte est passager. Pour publier des trajets, contactez l’administrateur ou utilisez le compte conducteur de démo (+227 90 00 00 04).</span>
        </div>
      }

      <form (ngSubmit)="submit()" class="card" style="padding:1rem;">
        <div class="field">
          <label>Ville de départ</label>
          <input class="input" [(ngModel)]="form.from" name="from" required placeholder="Niamey" />
        </div>
        <div class="field">
          <label>Ville d'arrivée</label>
          <input class="input" [(ngModel)]="form.to" name="to" required placeholder="Zinder" />
        </div>
        <div class="field">
          <label>Date et heure de départ</label>
          <input class="input" type="datetime-local" [(ngModel)]="form.departAt" name="departAt" required />
        </div>
        <div class="row" style="gap:.6rem;align-items:flex-start;">
          <div class="field grow">
            <label>Prix / place (FCFA)</label>
            <input class="input" type="number" inputmode="numeric" min="0" [(ngModel)]="form.pricePerSeat" name="pricePerSeat" required />
          </div>
          <div class="field">
            <label>Places</label>
            <input class="input" type="number" inputmode="numeric" min="1" max="10" value="3" [(ngModel)]="form.seatsTotal" name="seatsTotal" />
          </div>
          <div class="field">
            <label>Véhicule</label>
            <input class="input" [(ngModel)]="form.vehicle" name="vehicle" placeholder="Hiace" />
          </div>
        </div>
        @if (error) { <p class="error-text">{{ error }}</p> }
        <button class="btn btn-primary btn-block" type="submit" [disabled]="loading || !form.from || !form.to || !form.departAt">
          {{ loading ? 'Publication…' : 'Publier le trajet' }}
        </button>
      </form>
    </div>
  `,
})
export class RideNewComponent {
  api = inject(ApiService);
  router = inject(Router);

  loading = false;
  error = '';
  errorRole = false;
  form = {
    from: '', to: '', departAt: '',
    pricePerSeat: null as number | null, seatsTotal: 3, vehicle: '',
  };

  async submit() {
    this.loading = true;
    this.error = '';
    this.errorRole = false;
    try {
      const r = await this.api.post<Ride>('/api/rides', {
        ...this.form,
        departAt: new Date(this.form.departAt).toISOString(),
      });
      this.router.navigate(['/trajets']);
    } catch (e: any) {
      this.error = e.message;
      if (e.status === 403) this.errorRole = true;
    } finally {
      this.loading = false;
    }
  }
}
