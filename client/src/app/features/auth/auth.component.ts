import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OfflineService } from '../../core/services/offline.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-wrap">
      <div class="logo">NC</div>
      <h1>Niger Connect</h1>
      <p class="tagline muted">Messagerie, annonces, transport, paiement<br />et actualités — pensé pour le Niger.</p>

      <form class="card auth-card" (ngSubmit)="submit()">
        @if (!sent) {
          <div class="field">
            <label for="phone">Numéro de téléphone</label>
            <input id="phone" class="input" type="tel" inputmode="tel" autocomplete="tel"
                   placeholder="90 00 00 00" [(ngModel)]="phone" name="phone" required
                   (input)="phone = phone.replace(/[^0-9+ ]/g, '')" />
            <small class="muted">Ex. : 90 00 00 00 ou 09 00 00 00 0 — l'indicatif +227 est ajouté automatiquement.</small>
          </div>
          <button class="btn btn-primary btn-block" type="submit" [disabled]="loading || phoneDigits().length < 8">
            {{ loading ? 'Envoi…' : 'Recevoir le code' }}
          </button>
        } @else {
          <div class="field">
            <label for="code">Code reçu par SMS</label>
            <input id="code" class="input" type="text" inputmode="numeric" autocomplete="one-time-code"
                   placeholder="6 chiffres" maxlength="6" [(ngModel)]="code" name="code" required
                   (input)="code = code.replace(/[^0-9]/g, '')" />
            <small class="muted">En mode démo, utilisez {{ devCodeHint }} (affiché aussi dans la console du serveur).</small>
          </div>
          @if (error) { <p class="error-text">{{ error }}</p> }
          <button class="btn btn-primary btn-block" type="submit" [disabled]="loading || code.length < 6">
            {{ loading ? 'Connexion…' : 'Se connecter' }}
          </button>
          <button class="btn btn-block" type="button" (click)="back()">← Modifier le numéro</button>
        }
        @if (error && !sent) { <p class="error-text">{{ error }}</p> }
      </form>
    </div>
  `,
  styles: [
    `
      .auth-wrap { max-width: 420px; margin: 0 auto; padding: 2rem 1rem; text-align: center; }
      .logo {
        width: 72px; height: 72px; margin: 1rem auto 0.75rem;
        border-radius: 20px; background: var(--primary); color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 2rem; font-weight: 800; box-shadow: var(--shadow);
      }
      h1 { margin: 0; font-size: 1.5rem; }
      .tagline { margin: 0.4rem 0 1.4rem; font-size: 0.9rem; }
      .auth-card { padding: 1.2rem; text-align: left; }
    `,
  ],
})
export class AuthComponent {
  private auth = inject(AuthService);
  private offline = inject(OfflineService);
  private router = inject(Router);

  phone = '';
  code = '';
  sent = false;
  loading = false;
  error = '';
  devCodeHint = '123456';

  phoneDigits() {
    return this.phone.replace(/\D/g, '');
  }

  async submit() {
    this.error = '';
    this.loading = true;
    try {
      if (!this.sent) {
        const res = await this.auth.requestOtp(this.phone);
        this.sent = true;
        if (res.devCode) this.devCodeHint = res.devCode;
      } else {
        await this.auth.verifyOtp(this.phone, this.code);
        this.offline.flushOutbox();
        this.router.navigate(['/']);
      }
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  back() {
    this.sent = false;
    this.code = '';
  }
}
