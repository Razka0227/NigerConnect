import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { Wallet, Transaction } from '../../core/models';
import { XofPipe } from '../../shared/pipes/xof.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [FormsModule, XofPipe, RelativeTimePipe],
  template: `
    <div class="page">
      <button class="btn btn-sm" (click)="back()">← Retour</button>
      <h1 class="page-title">Paiement</h1>

      <div class="card wallet" style="padding:1.2rem;margin-bottom:.8rem;">
        <div class="muted small">Solde du portefeuille</div>
        <div class="balance">{{ wallet()?.balance | xof }}</div>
        <div class="muted small">Démo — recharge mobile money simulée</div>
      </div>

      <div class="card form-card">
        <h3 class="muted" style="margin:0 0 .6rem;font-size:.9rem;">{{ mode === 'deposit' ? 'Recharger via Mobile Money' : 'Envoyer de l’argent' }}</h3>

        <div class="row" style="gap:.5rem;margin-bottom:.8rem;">
          <button class="btn btn-sm grow" [class.btn-primary]="mode === 'deposit'" (click)="mode = 'deposit'">Recharger</button>
          <button class="btn btn-sm grow" [class.btn-primary]="mode === 'transfer'" (click)="mode = 'transfer'">Envoyer</button>
        </div>

        @if (mode === 'deposit') {
          <div class="field">
            <label>Fournisseur</label>
            <select class="input" [(ngModel)]="provider" name="provider">
              <option value="orange">Orange Money</option>
              <option value="moov">Moov Money</option>
              <option value="airtel">Airtel Money</option>
            </select>
          </div>
        } @else {
          <div class="field">
            <label>Numéro du destinataire</label>
            <input class="input" type="tel" inputmode="tel" [(ngModel)]="recipient" name="recipient" placeholder="90 00 00 00" />
          </div>
        }

        <div class="field">
          <label>Montant (FCFA)</label>
          <input class="input" type="number" inputmode="numeric" min="50" [(ngModel)]="amount" name="amount" />
        </div>

        @if (error) { <p class="error-text">{{ error }}</p> }
        @if (success) { <p style="color:var(--primary);font-size:.85rem;margin:.3rem 0 0;">{{ success }}</p> }

        <button class="btn btn-primary btn-block" (click)="submit()" [disabled]="loading || !amount">
          {{ loading ? 'Traitement…' : (mode === 'deposit' ? 'Recharger' : 'Envoyer') }}
        </button>
      </div>

      <h2 class="section-title">Historique</h2>
      <div class="card">
        @for (tx of txs(); track tx.id) {
          <div class="list-item">
            <span [style.color]="tx.type === 'credit' ? 'var(--primary)' : 'var(--danger)'" class="bold" style="font-size:1.1rem;">
              {{ tx.type === 'credit' ? '+' : '−' }}{{ tx.amount | xof }}
            </span>
            <div class="grow">
              <div class="small bold">{{ tx.provider ? tx.provider : 'Transfert' }} · {{ tx.reference || tx.id.slice(0, 8) }}</div>
              <div class="muted small">{{ tx.createdAt | relTime }}</div>
            </div>
            <span class="small" [class.muted]="tx.status !== 'success'">{{ tx.status }}</span>
          </div>
        } @empty {
          <div class="muted small" style="padding:.8rem 1rem;">Aucune transaction pour le moment.</div>
        }
      </div>
    </div>
  `,
  styles: ['.balance { font-size: 2rem; font-weight: 800; color: var(--primary); } .form-card { padding: 1rem; margin-bottom: 1rem; } .section-title { font-size: 1rem; margin: 1rem 0 0.6rem; }'],
})
export class WalletComponent implements OnInit {
  private api = inject(ApiService);
  private socket = inject(SocketService);
  private auth = inject(AuthService);

  readonly wallet = signal<Wallet | null>(null);
  readonly txs = signal<Transaction[]>([]);

  mode: 'deposit' | 'transfer' = 'deposit';
  provider = 'orange';
  recipient = '';
  amount: number | null = null;
  loading = false;
  error = '';
  success = '';

  async ngOnInit() {
    this.socket.connect();
    await this.load();
  }

  private async load() {
    try {
      const [w, t] = await Promise.all([
        this.api.get<Wallet>('/api/payments/wallet'),
        this.api.get<Transaction[]>('/api/payments/transactions?perPage=20'),
      ]);
      this.wallet.set(w.data);
      this.txs.set(t.data);
    } catch { /* offline */ }
  }

  async submit() {
    this.error = '';
    this.success = '';
    this.loading = true;
    try {
      if (this.mode === 'deposit') {
        const r = await this.api.post<Transaction>('/api/payments/deposit', {
          amount: this.amount, provider: this.provider,
          phone: this.auth.user()?.phone,
        });
        this.success = `Recharge de ${r.data.amount} FCFA effectuée.`;
      } else {
        const r = await this.api.post<Transaction>('/api/payments/transfer', {
          recipientPhone: this.recipient, amount: this.amount,
        });
        this.success = `Transfert de ${r.data.amount} FCFA réussi.`;
      }
      this.amount = null;
      await this.load();
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  back() {
    history.back();
  }
}
