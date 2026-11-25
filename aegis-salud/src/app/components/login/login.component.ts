import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, FormValidationDirective],
  template: `
    <main class="login-page">
      <form class="login-card" appFormValidation [appFormValidationError]="auth.error()" (appFormValidationDismiss)="auth.clearError()" (ngSubmit)="submit()">
        <div class="login-brand">
          <img src="assets/logo-cropped.jpg" alt="Logotipo de Aegis Salud" />
          <div><h1>Aegis Salud</h1><p>Acceso para personal autorizado</p></div>
        </div>
        <label for="login-email">Correo de usuario</label>
        <input id="login-email" type="email" [(ngModel)]="email" name="email"
          autocomplete="username" required />
        <label for="login-password">Contraseña</label>
        <input id="login-password" type="password" [(ngModel)]="password" name="password"
          autocomplete="current-password" required />
        <button class="module-submit" type="submit" [disabled]="loading">
          {{ loading ? 'Ingresando…' : 'Iniciar sesión' }}
        </button>
        <p class="login-note">Cuentas demo: admin, recepcion, medicina, especialista, farmacia, nutricion y compras &#64;aegissalud.test. La contraseña común local se configura en backend/.env. No reutilice esa contraseña ni datos clínicos en producción.</p>
      </form>
    </main>
  `,
  styles: [`
    .login-page { min-height: 100vh; display: grid; place-items: center; padding: 1.25rem; background: #f1f5f9; }
    .login-card { display: grid; gap: .75rem; width: min(100%, 430px); border: 1px solid #e2e8f0; border-radius: 1rem; background: white; padding: 1.5rem; box-shadow: 0 16px 40px #0f172a18; }
    .login-brand { display: flex; align-items: center; gap: .85rem; margin-bottom: .5rem; }
    .login-brand img { width: 58px; height: 58px; object-fit: contain; }
    .login-brand h1 { margin: 0; color: #0f172a; font-size: 1.45rem; }
    .login-brand p,.login-note { margin: .2rem 0 0; color: #64748b; font-size: .82rem; line-height: 1.45; }
    .login-card label { color: #334155; font-size: .85rem; font-weight: 650; }
    .login-card input,.login-card select { width: 100%; padding: .7rem; border: 1px solid #cbd5e1; border-radius: .45rem; background: white; font: inherit; }
    .login-card .module-submit { width: 100%; border: 0; border-radius: .45rem; padding: .68rem 1rem; background: #8b1e1e; color: white; font-weight: 700; cursor: pointer; }
    .login-card .module-submit:hover:not(:disabled) { background: #6f1818; }
    .login-card .module-submit:disabled { opacity: .65; cursor: wait; }
  `]
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  email = '';
  password = '';
  loading = false;

  async submit(): Promise<void> {
    if (!this.email || !this.password) return;
    this.loading = true;
    await this.auth.login(this.email, this.password);
    this.loading = false;
  }
}
