import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { spanishErrorMessage } from '../../services/spanish-error-message';
import { FormDraftService } from '../../services/form-draft.service';
import { UserRole } from '../../services/auth.service';
import { AreaStaff } from '../../services/operational-records.service';

interface ManagedUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <section class="module-page operational-module">
      <header class="module-heading">
        <div><span class="module-kicker">CONTROL DE ACCESO</span><h2>Usuarios y roles</h2>
          <p>Administre cuentas personales. Las contraseñas se almacenan cifradas en el servidor.</p></div>
      </header>
      <div class="operational-summary" aria-label="Resumen de usuarios">
        <article class="operational-stat">
          <span>Cuentas registradas</span>
          <strong>{{ users().length }}</strong>
        </article>
        <article class="operational-stat success">
          <span>Cuentas activas</span>
          <strong>{{ activeUsersCount }}</strong>
        </article>
        <article class="operational-stat attention">
          <span>Accesos desactivados</span>
          <strong>{{ inactiveUsersCount }}</strong>
        </article>
      </div>
      <div class="module-alert">Las cuentas de demostración locales comparten una contraseña configurada en backend/.env. No use esa configuración en producción.</div>

      <form class="module-panel" appFormDraft="usuarios:nuevo" appFormValidation [appFormValidationError]="error()" (appFormValidationDismiss)="clearError()" (ngSubmit)="create()">
        <h3>Crear cuenta</h3>
        <div class="module-form-grid">
          <div class="module-field"><label for="user-name">Nombre *</label><input id="user-name" [(ngModel)]="form.name" name="name" required maxlength="160"
            pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü][A-Za-zÁÉÍÓÚáéíóúÑñÜü .'-]*" /></div>
          <div class="module-field"><label for="user-email">Correo *</label><input id="user-email" type="email" [(ngModel)]="form.email" name="email" required /></div>
          <div class="module-field"><label for="user-phone">Teléfono de contacto</label><input id="user-phone" type="tel" [(ngModel)]="form.phone" name="phone" maxlength="32" pattern="[0-9+() .-]*" /></div>
          <div class="module-field"><label for="user-role">Rol *</label>
            <select id="user-role" [(ngModel)]="form.role" name="role" required>
              @for (role of roles; track role.value) { <option [value]="role.value">{{ role.label }}</option> }
            </select>
          </div>
          <div class="module-field"><label for="user-password">Contraseña (mínimo 12 caracteres) *</label><input id="user-password" type="password" [(ngModel)]="form.password" name="password" minlength="12" required /></div>
          <div class="module-field"><label for="user-password-confirm">Confirmar contraseña *</label><input id="user-password-confirm" type="password" [(ngModel)]="form.password_confirmation" name="password_confirmation" required /></div>
        </div>
        <button class="module-submit" type="submit">Crear usuario</button>
      </form>

      <section class="module-panel" aria-label="Asignación de encargados">
        <h3>Encargados de área</h3>
        <p>Asigne cuentas activas creadas arriba. Farmacia requiere exactamente dos encargados; Almacén y Alimentos, al menos uno cada área.</p>
        @if (error()) { <p class="user-error" role="alert">{{ error() }}</p> }
        <div class="module-form-grid staff-assignments">
          <div class="module-field">
            <strong>Farmacia (seleccione 2)</strong>
            @for (user of staffCandidates('farmacia'); track user.id) {
              <label class="staff-choice">
                <input type="checkbox" [checked]="staffAssignments.farmacia.includes(user.id)"
                  (change)="toggleAreaStaff('farmacia', user.id)" />
                {{ user.name }} — {{ user.email }}
              </label>
            } @empty { <small>No hay cuentas activas con rol Farmacia.</small> }
            <small>Seleccionados: {{ staffAssignments.farmacia.length }} / 2</small>
          </div>
          <div class="module-field">
            <strong>Almacén</strong>
            @for (user of staffCandidates('almacen'); track user.id) {
              <label class="staff-choice">
                <input type="checkbox" [checked]="staffAssignments.almacen.includes(user.id)"
                  (change)="toggleAreaStaff('almacen', user.id)" />
                {{ user.name }} — {{ user.email }}
              </label>
            } @empty { <small>No hay cuentas activas con rol Almacén.</small> }
          </div>
          <div class="module-field">
            <strong>Alimentos</strong>
            @for (user of staffCandidates('alimentos'); track user.id) {
              <label class="staff-choice">
                <input type="checkbox" [checked]="staffAssignments.alimentos.includes(user.id)"
                  (change)="toggleAreaStaff('alimentos', user.id)" />
                {{ user.name }} — {{ user.email }}
              </label>
            } @empty { <small>No hay cuentas activas con rol Nutrición.</small> }
          </div>
        </div>
        <button class="module-submit" type="button" [disabled]="savingStaff()" (click)="saveAreaStaff()">
          {{ savingStaff() ? 'Guardando…' : 'Guardar encargados de área' }}
        </button>
      </section>

      <section class="module-records" aria-label="Cuentas registradas">
        @for (user of users(); track user.id) {
          <article class="module-record" [class.inactive-user]="!user.is_active">
            <div class="module-record-head"><h3>{{ user.name }}</h3>
              <span class="module-badge" [class.account-inactive]="!user.is_active">{{ roleName(user.role) }} · {{ user.is_active ? 'Activo' : 'Desactivado' }}</span>
            </div>
            @if (editingUserId === user.id) {
              <form class="module-form-grid" [appFormDraft]="'usuarios:editar:' + user.id" appFormValidation
                [appFormValidationError]="error()" (appFormValidationDismiss)="clearError()" (ngSubmit)="saveDetails(user)">
                <div class="module-field"><label [for]="'edit-user-name-' + user.id">Nombre *</label>
                  <input [id]="'edit-user-name-' + user.id" [(ngModel)]="editForm.name" name="name" required maxlength="160"
                    pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü][A-Za-zÁÉÍÓÚáéíóúÑñÜü .'-]*" /></div>
                <div class="module-field"><label [for]="'edit-user-email-' + user.id">Correo *</label>
                  <input [id]="'edit-user-email-' + user.id" type="email" [(ngModel)]="editForm.email" name="email" required maxlength="160" /></div>
                <div class="module-field"><label [for]="'edit-user-phone-' + user.id">Teléfono de contacto</label>
                  <input [id]="'edit-user-phone-' + user.id" type="tel" [(ngModel)]="editForm.phone" name="phone" maxlength="32" pattern="[0-9+() .-]*" /></div>
                <div class="module-record-foot">
                  <button class="module-quick-action" type="button" (click)="editingUserId = null">Cancelar edición</button>
                  <button class="module-submit" type="submit">Guardar datos</button>
                </div>
              </form>
            } @else {
              <p>{{ user.email }} · Teléfono: {{ user.phone || 'No registrado' }}</p>
              <button type="button" class="module-quick-action" (click)="editDetails(user)">Editar detalles</button>
            }
            <div class="module-record-foot">
              <label [for]="'role-' + user.id">Cambiar rol</label>
              <select [id]="'role-' + user.id" [ngModel]="user.role" [name]="'role-' + user.id"
                (ngModelChange)="changeRole(user, $event)">
                @for (role of roles; track role.value) { <option [value]="role.value">{{ role.label }}</option> }
              </select>
              <button type="button" class="module-quick-action" (click)="toggleActive(user)">
                {{ user.is_active ? 'Desactivar acceso' : 'Reactivar acceso' }}
              </button>
            </div>
          </article>
        } @empty { <div class="module-empty">No se encontraron cuentas.</div> }
      </section>
    </section>
  `,
  styles: [`
    .module-quick-action { border: 1px solid #cbd5e1; border-radius: .45rem; background: #fff; padding: .5rem .7rem; color: #334155; cursor: pointer; font-weight: 650; }
    .account-inactive { color: #b42318 !important; background: #fff1f0 !important; border-color: #fda29b !important; }
    .staff-assignments { align-items: start; }
    .staff-choice { display: flex; align-items: center; gap: .5rem; margin-top: .5rem; font-weight: 500; }
    .staff-choice input { width: auto; }
    .user-error { color: #b42318; font-weight: 650; }
  `]
})
export class UsuariosComponent implements OnInit {
  readonly users = signal<ManagedUser[]>([]);
  readonly error = signal('');
  readonly savingStaff = signal(false);
  private readonly http = inject(HttpClient);
  private readonly drafts = inject(FormDraftService);
  readonly roles: Array<{ value: UserRole; label: string }> = [
    { value: 'admin', label: 'Administración' }, { value: 'recepcion', label: 'Recepción' },
    { value: 'medico_general', label: 'Medicina general' }, { value: 'especialista', label: 'Especialista' },
    { value: 'farmacia', label: 'Farmacia' }, { value: 'nutricion', label: 'Nutrición' },
    { value: 'compras', label: 'Compras' },
    { value: 'enfermeria', label: 'Enfermería' }, { value: 'cirugia', label: 'Cirugía' },
    { value: 'almacen', label: 'Almacén' },
  ];

  clearError(): void {
    this.error.set('');
  }

  get activeUsersCount(): number {
    return this.users().filter(user => user.is_active).length;
  }

  get inactiveUsersCount(): number {
    return this.users().filter(user => !user.is_active).length;
  }

  form = { name: '', email: '', phone: '', role: 'recepcion' as UserRole, password: '', password_confirmation: '' };
  editingUserId: number | null = null;
  editForm = { name: '', email: '', phone: '' };
  staffAssignments = { farmacia: [] as number[], almacen: [] as number[], alimentos: [] as number[] };

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const [users, staff] = await Promise.all([
        firstValueFrom(this.http.get<ManagedUser[]>('/api/users')),
        firstValueFrom(this.http.get<AreaStaff>('/api/area-staff')),
      ]);
      this.users.set(users);
      this.staffAssignments = {
        farmacia: staff.farmacia.map(user => user.id),
        almacen: staff.almacen.map(user => user.id),
        alimentos: staff.alimentos.map(user => user.id),
      };
      this.error.set('');
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  async create(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/users', this.form));
      this.drafts.clear('usuarios:nuevo');
      this.form = { name: '', email: '', phone: '', role: 'recepcion', password: '', password_confirmation: '' };
      await this.refresh();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  async changeRole(user: ManagedUser, role: UserRole): Promise<void> {
    await this.update(user, { role });
  }

  async toggleActive(user: ManagedUser): Promise<void> {
    await this.update(user, { isActive: !user.is_active });
  }

  editDetails(user: ManagedUser): void {
    this.editingUserId = user.id;
    this.editForm = { name: user.name, email: user.email, phone: user.phone ?? '' };
  }

  async saveDetails(user: ManagedUser): Promise<void> {
    const saved = await this.update(user, this.editForm);
    if (saved) {
      this.drafts.clear(`usuarios:editar:${user.id}`);
      this.editingUserId = null;
    }
  }

  staffCandidates(area: keyof AreaStaff): ManagedUser[] {
    const roleByArea: Record<keyof AreaStaff, UserRole> = {
      farmacia: 'farmacia', almacen: 'almacen', alimentos: 'nutricion',
    };
    return this.users().filter(user => user.is_active && user.role === roleByArea[area]);
  }

  toggleAreaStaff(area: keyof AreaStaff, userId: number): void {
    const selected = this.staffAssignments[area];
    this.staffAssignments[area] = selected.includes(userId)
      ? selected.filter(id => id !== userId)
      : [...selected, userId];
  }

  async saveAreaStaff(): Promise<void> {
    this.savingStaff.set(true);
    try {
      await firstValueFrom(this.http.put('/api/area-staff', {
        pharmacyIds: this.staffAssignments.farmacia,
        warehouseIds: this.staffAssignments.almacen,
        foodIds: this.staffAssignments.alimentos,
      }));
      await this.refresh();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.savingStaff.set(false);
    }
  }

  roleName(role: UserRole): string {
    return this.roles.find(item => item.value === role)?.label ?? role;
  }

  private async update(user: ManagedUser, body: {
    name?: string; email?: string; phone?: string; role?: UserRole; isActive?: boolean;
  }): Promise<boolean> {
    try {
      await firstValueFrom(this.http.patch(`/api/users/${user.id}`, body));
      await this.refresh();
      return true;
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
      return false;
    }
  }

  private errorMessage(error: unknown): string {
    return spanishErrorMessage(error, 'No se pudo completar la operación de usuarios.');
  }
}
