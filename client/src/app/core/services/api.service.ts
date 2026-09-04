import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config';
import { ApiResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  get token(): string | null {
    return localStorage.getItem('nc_token');
  }

  private headers(): HttpHeaders {
    let h = new HttpHeaders({ Accept: 'application/json' });
    if (this.token) h = h.set('Authorization', `Bearer ${this.token}`);
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const url = `${APP_CONFIG.apiUrl}${path}`;
    const params = body === undefined ? new HttpParams() : undefined;
    try {
      const res = await firstValueFrom(
        this.http.request<ApiResponse<T>>(method, url, {
          headers: this.headers(),
          body: body === undefined ? undefined : body,
          params,
        })
      );
      return res;
    } catch (e) {
      const err = e as HttpErrorResponse;
      if (err.status === 401) {
        localStorage.removeItem('nc_token');
        localStorage.removeItem('nc_user');
        window.dispatchEvent(new CustomEvent('nc:unauthorized'));
      }
      if (err.status === 0) {
        throw new ApiError('Serveur injoignable — vérifiez que le backend tourne sur le port 4000, puis réessayez.', 0);
      }
      const message = (err.error as any)?.error?.message || 'Erreur réseau';
      throw new ApiError(message, err.status ?? 0);
    }
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body: unknown) { return this.request<T>('POST', path, body); }
  patch<T>(path: string, body: unknown) { return this.request<T>('PATCH', path, body); }
  put<T>(path: string, body: unknown) { return this.request<T>('PUT', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
