import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { spanishErrorMessage } from './spanish-error-message';

export type UserRole =
  | 'admin' | 'recepcion' | 'medico_general' | 'especialista'
  | 'farmacia' | 'nutricion' | 'compras' | 'enfermeria' | 'cirugia' | 'almacen';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'aegis_auth_token';
  private readonly idleTimeoutMs = 15 * 60 * 1000;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
  private readonly onActivity = (): void => this.resetIdleTimer();
  readonly user = signal<AuthUser | null>(null);
  readonly error = signal('');
  readonly initializing = signal(true);
  readonly authenticated = signal(false);

  constructor(private readonly http: HttpClient) {}

  clearError(): void {
    this.error.set('');
  }

  async initialize(): Promise<void> {
    const token = sessionStorage.getItem(this.tokenKey);
    if (!token) {
      this.initializing.set(false);
      return;
    }

    try {
      const response = await firstValueFrom(this.http.get<{ user: AuthUser }>('/api/user'));
      this.user.set(response.user);
      this.authenticated.set(true);
      this.startIdleMonitor();
    } catch {
      sessionStorage.removeItem(this.tokenKey);
      this.user.set(null);
      this.authenticated.set(false);
      this.error.set('No se pudo validar la sesión previa. Inicie sesión nuevamente.');
    } finally {
      this.initializing.set(false);
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    this.error.set('');
    try {
      const response = await firstValueFrom(this.http.post<{ token: string; user: AuthUser }>('/api/login', { email, password }));
      sessionStorage.setItem(this.tokenKey, response.token);
      this.user.set(response.user);
      this.authenticated.set(true);
      this.startIdleMonitor();
      return true;
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error, 'No se pudo iniciar sesión. Verifique sus datos y que el servidor esté activo.'));
      return false;
    }
  }

  async logout(): Promise<void> {
    this.stopIdleMonitor();
    try {
      await firstValueFrom(this.http.post('/api/logout', {}));
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error, 'No se pudo cerrar la sesión en el servidor.'));
    } finally {
      sessionStorage.removeItem(this.tokenKey);
      this.user.set(null);
      this.authenticated.set(false);
    }
  }

  private startIdleMonitor(): void {
    if (typeof window === 'undefined') return;
    this.activityEvents.forEach(event => window.addEventListener(event, this.onActivity, { passive: true }));
    this.resetIdleTimer();
  }

  private stopIdleMonitor(): void {
    if (typeof window === 'undefined') return;
    this.activityEvents.forEach(event => window.removeEventListener(event, this.onActivity));
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private resetIdleTimer(): void {
    if (!this.authenticated() || typeof window === 'undefined') return;
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      void this.expireIdleSession();
    }, this.idleTimeoutMs);
  }

  private async expireIdleSession(): Promise<void> {
    await this.logout();
    this.error.set('La sesión se cerró por 15 minutos de inactividad. Inicie sesión nuevamente.');
  }

  hasRole(...roles: UserRole[]): boolean {
    const activeRoles = this.user()?.roles ?? [this.user()?.role].filter((role): role is UserRole => !!role);
    return roles.some(role => activeRoles.includes(role));
  }

  private errorMessage(error: unknown, fallback: string): string {
    return spanishErrorMessage(error, fallback);
  }
}
