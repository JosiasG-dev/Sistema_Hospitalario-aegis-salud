import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HospitalService } from '../../services/hospital.service';
import { OperationalRecordsService } from '../../services/operational-records.service';
import { MealOrderRecord } from '../../models/operational-records.model';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { FormDraftService } from '../../services/form-draft.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-alimentos',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <section class="module-page operational-module">
      <header class="module-heading">
        <div>
          <span class="module-kicker">SERVICIO DE ALIMENTACIÓN</span>
          <h2>Alimentos</h2>
          <p>Organización y seguimiento de entregas de alimentos a pacientes.</p>
        </div>
      </header>
      <div class="module-alert">
        <strong>Cuenta activa:</strong> {{ auth.user()?.name || 'Sin cuenta identificada' }}.
        <strong>Encargado(s) de Alimentos:</strong> {{ foodStaffNames || 'No configurados' }}.
      </div>
      <div class="operational-summary" aria-label="Resumen de alimentación">
        <article class="operational-stat">
          <span>Órdenes clínicas de dieta</span>
          <strong>{{ nutritionOrders.length }}</strong>
        </article>
        <article class="operational-stat attention">
          <span>Entregas pendientes</span>
          <strong>{{ pendingOrdersCount }}</strong>
        </article>
        <article class="operational-stat success">
          <span>Entregas completadas</span>
          <strong>{{ deliveredOrdersCount }}</strong>
        </article>
      </div>
      <div class="module-alert">
        @if (isAdmin) {
          <strong>Modo Administración:</strong> Puede solicitar dietas o autorizar finalmente los alimentos preparados por Nutrición.
        } @else {
          <strong>Modo Nutrición:</strong> Prepare el alimento según la dieta indicada (ej. arroz blanco para dieta normal) y envíelo a Administración para su autorización final.
        }
      </div>

      <section class="module-panel">
        <h3>Órdenes de alimentación emitidas en consulta</h3>
        <div class="module-records">
          @for (consultation of nutritionOrders; track consultation.id) {
            <article class="module-record">
              <div class="module-record-head">
                <h3>{{ consultation.patientName || patientName(consultation.patientId) }}</h3>
                @if (consultation.assignedBedId) { <span class="module-badge">Cama {{ consultation.assignedBedId }}</span> }
              </div>
              <p><strong>Régimen:</strong> {{ consultation.nutritionDiet || 'No especificado' }}</p>
              @if (consultation.nutritionOrder) { <p><strong>Orden:</strong> {{ consultation.nutritionOrder }}</p> }
              @if (consultation.nutritionInstructions) { <p><strong>Instrucciones:</strong> {{ consultation.nutritionInstructions }}</p> }
              @if (consultation.allergies) { <p><strong>Alergias:</strong> {{ consultation.allergies }}</p> }
            </article>
          } @empty {
            <div class="module-empty">No hay órdenes de alimentación emitidas en las consultas.</div>
          }
        </div>
      </section>

      <form class="module-panel" appFormDraft="alimentos:nueva-entrega" appFormValidation [appFormValidationError]="records.storageError()" (appFormValidationDismiss)="records.clearError()" (ngSubmit)="create()">
        <h3>{{ isAdmin ? 'Solicitar dieta / entrega de alimentos' : 'Solicitar preparación de alimentos (requiere confirmación de Administración)' }}</h3>
        <div class="module-form-grid">
          <div class="module-field">
            <label for="meal-patient">Paciente *</label>
            <select id="meal-patient" [(ngModel)]="form.patientId" name="patientId" required>
              <option value="" disabled>Seleccione paciente</option>
              @for (patient of activePatients; track patient.id) {
                <option [value]="patient.id">{{ patient.firstName }} {{ patient.lastName }}</option>
              }
            </select>
          </div>
          <div class="module-field">
            <label for="meal-type">Servicio *</label>
            <select id="meal-type" [(ngModel)]="form.meal" name="meal" required>
              <option value="Desayuno">Desayuno</option>
              <option value="Comida">Comida</option>
              <option value="Cena">Cena</option>
            </select>
          </div>
          <div class="module-field">
            <label for="meal-date">Fecha de entrega *</label>
            <input id="meal-date" type="date" [(ngModel)]="form.deliveryDate" name="deliveryDate" required />
          </div>
          <div class="module-field">
            <label for="meal-diet">Tipo de dieta *</label>
            <input id="meal-diet" [(ngModel)]="form.diet" name="diet" maxlength="80" placeholder="Según indicación autorizada" required />
          </div>
          <div class="module-field">
            <label for="meal-charge">Cargo por entrega</label>
            <input id="meal-charge" type="number" min="0" step="0.01" [(ngModel)]="form.chargeAmount" name="chargeAmount" />
          </div>
          <div class="module-field wide">
            <label for="meal-notes">Observaciones de entrega (opcional)</label>
            <input id="meal-notes" [(ngModel)]="form.notes" name="notes" maxlength="180" />
          </div>
        </div>
        <button class="module-submit" type="submit">{{ isAdmin ? 'Enviar pedido a Nutrición' : 'Enviar solicitud a Administración' }}</button>
      </form>

      <section class="module-records" aria-label="Entregas de alimentos">
        @for (record of records.mealOrders(); track record.id) {
          <article class="module-record">
            <div class="module-record-head">
              <h3>{{ record.patientName || patientName(record.patientId) }} <span class="module-muted">· {{ record.id }}</span></h3>
              <span class="module-badge">{{ record.status }}</span>
            </div>
            @if (record.bed) { <p><strong>Cama:</strong> {{ record.bed }}</p> }
            <p><strong>Servicio:</strong> {{ record.meal }} · <strong>Fecha:</strong> {{ record.deliveryDate }} · <strong>Dieta:</strong> {{ record.diet }}</p>
            @if (record.preparedFood) { <p><strong>Alimento preparado:</strong> {{ record.preparedFood }}</p> }
            @if (record.allergies) { <p><strong>Alergias:</strong> {{ record.allergies }}</p> }
            @if (record.notes) { <p><strong>Observaciones:</strong> {{ record.notes }}</p> }
            <div class="module-record-foot">
              @if (record.status === 'Solicitada') {
                @if (isAdmin) {
                  <button type="button" class="module-submit" (click)="changeStatus(record.id, 'Pendiente')">Confirmar pedido</button>
                  <button type="button" class="module-button-secondary" (click)="changeStatus(record.id, 'Cancelada')">Rechazar</button>
                } @else {
                  <span class="module-muted">Pendiente de confirmación de Administración.</span>
                }
              } @else if (record.status === 'Pendiente') {
                @if (isNutrition || isAdmin) {
                  <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;width:100%">
                    <input type="text" [(ngModel)]="preparedFoodByOrder[record.id]" [name]="'prep-' + record.id"
                      placeholder="Alimento preparado (ej. Arroz blanco)" maxlength="180" style="flex:1;min-width:200px" />
                    <button type="button" class="module-submit" (click)="markPrepared(record)">Marcar alimento preparado</button>
                    @if (isAdmin) {
                      <button type="button" class="module-button-secondary" (click)="changeStatus(record.id, 'Cancelada')">Cancelar</button>
                    }
                  </div>
                }
              } @else if (record.status === 'Preparado') {
                @if (isAdmin) {
                  <button type="button" class="module-submit" (click)="changeStatus(record.id, 'Entregada')">Autorizar entrega final</button>
                  <button type="button" class="module-button-secondary" (click)="changeStatus(record.id, 'Cancelada')">Rechazar</button>
                } @else {
                  <span class="module-muted">Alimento preparado · Pendiente de autorización final de Administración.</span>
                }
              } @else if (record.status === 'Entregada') {
                <span class="module-muted">Entrega autorizada y completada por Administración.</span>
              } @else {
                <span class="module-muted">Orden cancelada.</span>
              }
            </div>
          </article>
        } @empty {
          <div class="module-empty">Aún no hay entregas registradas.</div>
        }
      </section>
    </section>
  `
})
export class AlimentosComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly hospital = inject(HospitalService);
  readonly records = inject(OperationalRecordsService);
  readonly drafts = inject(FormDraftService);
  readonly preparedFoodByOrder: Record<string, string> = {};
  form = {
    patientId: '',
    meal: 'Desayuno' as MealOrderRecord['meal'],
    diet: '',
    deliveryDate: this.today(),
    notes: '',
    chargeAmount: 0,
    status: 'Pendiente' as MealOrderRecord['status']
  };

  get isAdmin(): boolean {
    return this.auth.hasRole('admin');
  }

  get isNutrition(): boolean {
    return this.auth.hasRole('nutricion');
  }

  ngOnInit(): void {
    void this.records.loadAreaStaff();
  }

  get foodStaffNames(): string {
    return this.records.areaStaff().alimentos.map(staff => staff.name).join(' · ');
  }

  get activePatients() {
    return this.hospital.patients().filter(patient => patient.status === 'Activo');
  }

  get nutritionOrders() {
    return this.records.consultations().filter(consultation =>
      consultation.nutritionDiet || consultation.nutritionOrder || consultation.nutritionInstructions
    );
  }

  get pendingOrdersCount(): number {
    return this.records.mealOrders().filter(order => order.status === 'Pendiente').length;
  }

  get deliveredOrdersCount(): number {
    return this.records.mealOrders().filter(order => order.status === 'Entregada').length;
  }

  patientName(id: string): string {
    const patient = this.hospital.patients().find(entry => entry.id === id);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente no disponible';
  }

  async create(): Promise<void> {
    if (await this.records.addMealOrder(this.form)) {
      this.drafts.clear('alimentos:nueva-entrega');
      this.form = {
        patientId: '', meal: 'Desayuno', diet: '', chargeAmount: 0,
        deliveryDate: this.today(), notes: '', status: 'Pendiente'
      };
    }
  }

  async markPrepared(record: MealOrderRecord): Promise<void> {
    const food = (this.preparedFoodByOrder[record.id] || '').trim() || record.diet;
    if (await this.records.setMealOrderStatus(record.id, 'Preparado', food)) {
      delete this.preparedFoodByOrder[record.id];
    }
  }

  async changeStatus(id: string, status: MealOrderRecord['status']): Promise<void> {
    await this.records.setMealOrderStatus(id, status);
  }

  private today(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
