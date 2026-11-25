import { Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class FormDraftService {
  readonly error = signal('');

  constructor(private readonly auth: AuthService) {}

  save(key: string, value: Record<string, unknown>): void {
    try {
      localStorage.setItem(this.storageKey(key), JSON.stringify({
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        value: this.withoutSecrets(value),
      }));
      this.error.set('');
    } catch {
      this.error.set('No se pudo conservar el borrador temporal en esta sesión.');
    }
  }

  load(key: string): Record<string, unknown> | null {
    try {
      const saved = localStorage.getItem(this.storageKey(key));
      if (!saved) return null;
      const draft = JSON.parse(saved) as { expiresAt: number; value: Record<string, unknown> };
      if (!draft.expiresAt || draft.expiresAt < Date.now() || !draft.value || typeof draft.value !== 'object') {
        this.clear(key);
        return null;
      }
      const safeValue = this.withoutSecrets(draft.value);
      if (JSON.stringify(safeValue) !== JSON.stringify(draft.value)) {
        this.save(key, safeValue);
      }
      return safeValue;
    } catch {
      this.error.set('El borrador temporal está dañado o no se puede leer.');
      return null;
    }
  }

  clear(key: string): void {
    try {
      localStorage.removeItem(this.storageKey(key));
      this.error.set('');
    } catch {
      this.error.set('No se pudo borrar el borrador temporal de la sesión.');
    }
  }

  private storageKey(key: string): string {
    return `aegis_form_draft:${this.auth.user()?.id ?? 'unassigned'}:${key}`;
  }

  private withoutSecrets(value: Record<string, unknown>): Record<string, unknown> {
    const safe: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (/(password|contrase|token|secret|credential)/i.test(key)) continue;
      safe[key] = this.withoutNestedSecrets(entry);
    }
    return safe;
  }

  private withoutNestedSecrets(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(entry => this.withoutNestedSecrets(entry));
    if (typeof value !== 'object' || value === null) return value;
    return this.withoutSecrets(value as Record<string, unknown>);
  }
}
