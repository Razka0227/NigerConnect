import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AuthSession, OtpResponse, User } from '../models';

const TOKEN_KEY = 'nc_token';
const USER_KEY = 'nc_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSig = signal<User | null>(this.loadUser());
  readonly user = this.userSig.asReadonly();
  readonly isLoggedIn = computed(() => this.userSig() !== null);

  constructor(private api: ApiService) {}

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  requestOtp(phone: string): Promise<OtpResponse> {
    return this.api.post<OtpResponse>('/api/auth/request-otp', { phone }).then((r) => r.data);
  }

  async verifyOtp(phone: string, code: string): Promise<AuthSession> {
    const r = await this.api.post<AuthSession>('/api/auth/verify-otp', { phone, code });
    this.setSession(r.data);
    return r.data;
  }

  setSession(session: AuthSession) {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    this.userSig.set(session.user);
  }

  async refreshMe(): Promise<User | null> {
    if (!this.token) return null;
    try {
      const r = await this.api.get<User>('/api/auth/me');
      localStorage.setItem(USER_KEY, JSON.stringify(r.data));
      this.userSig.set(r.data);
      return r.data;
    } catch {
      return null;
    }
  }

  async updateProfile(patch: Partial<User>): Promise<User> {
    const r = await this.api.patch<User>('/api/auth/me', patch);
    localStorage.setItem(USER_KEY, JSON.stringify(r.data));
    this.userSig.set(r.data);
    return r.data;
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSig.set(null);
  }
}
