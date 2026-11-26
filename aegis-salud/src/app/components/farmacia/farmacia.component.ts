import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { HospitalService } from '../../services/hospital.service';
import { OperationalRecordsService } from '../../services/operational-records.service';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { FormDraftService } from '../../services/form-draft.service';

@Component({
  selector: 'app-farmacia',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <section class="module-page operational-module">
      <header class="module-heading">
        <div>
          <span class="module-kicker">DISPENSACIÓN Y EXISTENCIAS</span>
          <h2>Farmacia</h2>
          <p>Registro de dispensaciones y descuento de existencias del almacén de medicamentos.</p>
        </div>
      </header>
      <div class="module-alert">
        <strong>Cuenta activa:</strong> {{ auth.user()?.name || 'Sin cuenta identificada' }}.
        <strong>Encargados autorizados:</strong>
        {{ pharmacyStaffNames || 'No configurados' }}.
      </div>
      @if (pharmacyStaff.length !== 2) {
        <p class="form-error" role="alert">Farmacia requiere exactamente dos encargados activos. Admin debe configurarlos en Usuarios y roles.</p>
      }
      <div class="operational-summary" aria-label="Resumen de farmacia">
        <article class="operational-stat">
          <span>Medicamentos disponibles</span>
          <strong>{{ availableMedicines.length }}</strong>
        </article>
        <article class="operational-stat">
          <span>Pacientes activos</span>
          <strong>{{ activePatients.length }}</strong>
        </article>
        <article class="operational-stat">
          <span>Dispensaciones registradas</span>
          <strong>{{ records.dispensations().length }}</strong>
        </article>
      </div>
      <div class="module-alert">
        @if (isAdmin) {
          <strong>Modo Administración:</strong> Puede solicitar medicamentos para un paciente o autorizar finalmente las dispensaciones surtidas por Farmacia.
        } @else {
          <strong>Modo Farmacia:</strong> Surta los pedidos solicitados por Administración o envíe una dispensación para autorización final de Administración.
        }
      </div>

      <form class="module-panel" appFormDraft="farmacia:dispensacion" appFormValidation [appFormValidationError]="records.storageError()" (appFormValidationDismiss)="records.clearError()" (ngSubmit)="dispense()">
        <h3>{{ isAdmin ? 'Solicitar medicamento a Farmacia' : 'Preparar / Solicitar dispensación' }}</h3>
        <div class="module-form-grid">
          <div class="module-field">
            <label for="dispense-patient">Paciente *</label>
            <div class="patient-autocomplete">
              <input type="hidden" [(ngModel)]="form.patientId" name="patientId" required />
              <input id="dispense-patient" type="search" [(ngModel)]="patientSearch" name="patientSearch"
                (ngModelChange)="onPatientSearchChange()"
                (focus)="openPatientResults()"
                (keydown.escape)="closePatientResults()"
                placeholder="Buscar por nombre o documento" autocomplete="off" />
              @if (patientResultsOpen) {
                <div class="patient-results" role="listbox" aria-label="Pacientes encontrados">
                  @for (patient of patientOptions; track patient.id) {
                    <button type="button" class="patient-result"
                      role="option"
                      [class.selected]="form.patientId === patient.id"
                      (click)="selectPatient(patient)">
                      <strong>{{ patient.firstName }} {{ patient.lastName }}</strong>
                      <span>{{ patient.documentId }}</span>
                    </button>
                  } @empty {
                    <p class="patient-no-results">No se encontraron pacientes activos.</p>
                  }
                </div>
              }
            </div>
            @if (patientSearch.trim().length > 0 && !patientOptions.length) {
              <small>No se encontraron pacientes activos.</small>
            }
          </div>
          <div class="module-field">
            <label for="dispense-item">Medicamento *</label>
            <select id="dispense-item" [(ngModel)]="form.itemId" name="itemId" required>
              <option value="" disabled>Seleccione medicamento disponible</option>
              @for (item of availableMedicines; track item.id) {
                <option [value]="item.id">{{ item.name }} — {{ item.stock }} {{ item.unit }} · {{ item.unitPrice | currency:'MXN':'symbol':'1.2-2' }}</option>
              }
            </select>
          </div>
          <div class="module-field">
            <label for="dispense-quantity">Cantidad *</label>
            <input id="dispense-quantity" type="number" min="1" step="1" [(ngModel)]="form.quantity" name="quantity" required />
          </div>
          <div class="module-field">
            <label for="dispense-rx">Folio de receta *</label>
            <input id="dispense-rx" [(ngModel)]="form.prescription" name="prescription" maxlength="80" required />
            @if (prescriptionAlreadyRegistered) {
              <small class="form-error" role="alert">Ese folio de receta ya fue registrado.</small>
            }
          </div>
          @if (!isAdmin) {
            <div class="module-field">
              <label for="dispense-responsible">Responsable de farmacia *</label>
              <select id="dispense-responsible" [(ngModel)]="form.responsibleId" name="responsibleId"
                required [disabled]="pharmacyStaff.length !== 2">
                <option [ngValue]="0" disabled>Seleccione encargado</option>
                @for (staff of pharmacyStaff; track staff.id) {
                  <option [ngValue]="staff.id"
                    [disabled]="auth.user()?.role === 'farmacia' && staff.id !== auth.user()?.id">{{ staff.name }}</option>
                }
              </select>
            </div>
            @if (selectedItem?.isControlled) {
              <div class="module-field">
                <label for="prescriber-email">Correo de médico prescriptor *</label>
                <input id="prescriber-email" type="email" [(ngModel)]="form.prescriberEmail" name="prescriberEmail" required autocomplete="username" />
              </div>
              <div class="module-field">
                <label for="prescriber-password">Contraseña de autorización médica *</label>
                <input id="prescriber-password" type="password" [(ngModel)]="prescriberPassword"
                  [ngModelOptions]="{standalone: true}" required autocomplete="current-password" />
              </div>
            }
          }
        </div>
        <button class="module-submit" type="submit"
          [disabled]="prescriptionAlreadyRegistered || (!isAdmin && pharmacyStaff.length !== 2)">
          {{ isAdmin ? 'Enviar pedido a Farmacia' : 'Enviar a autorización de Administración' }}
        </button>
      </form>

      <div class="module-filter-bar">
        <div class="search-box">
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input 
            type="text" 
            placeholder="Buscar dispensación por paciente, medicamento, receta o ID..." 
            [(ngModel)]="searchQuery" 
            class="search-input" />
        </div>
      </div>

      <section class="module-records" aria-label="Dispensaciones">
        @for (record of filteredDispensations; track record.id) {
          <article class="module-record">
            <div class="module-record-head">
              <h3>{{ itemName(record.itemId) }} <span class="module-muted">· {{ record.id }}</span></h3>
              <span class="module-badge" [ngClass]="{'badge-success': (record.status || 'Autorizada') === 'Autorizada' || record.status === 'Surtida', 'badge-danger': record.status === 'Cancelada', 'badge-warning': record.status === 'Solicitada'}">{{ record.status || 'Autorizada' }} · {{ record.quantity }} unidad(es)</span>
            </div>
            <p><strong>Paciente:</strong> {{ patientName(record.patientId) }} · <strong>Receta:</strong> {{ record.prescription }}</p>
            <p><strong>Responsable:</strong> {{ record.responsible }} · <strong>Fecha:</strong> {{ record.dispensedAt | date:'medium' }}</p>
            @if (record.batches?.length) {
              <p><strong>Lotes FEFO:</strong>
                @for (batch of record.batches; track batch.code) { {{ batch.code }} ({{ batch.quantity }}, vence {{ batch.expirationDate }}) } 
              </p>
            }
            <div class="module-record-foot">
              @if (record.status === 'Solicitada') {
                @if (!isAdmin) {
                  <button type="button" class="module-submit module-button-success" (click)="fulfillOrder(record.id)">Dar / Surtir medicamento</button>
                } @else {
                  <button type="button" class="module-button-danger" (click)="changeStatus(record.id, 'Cancelada')">Cancelar pedido</button>
                }
              } @else if (record.status === 'Surtida') {
                @if (isAdmin) {
                  <button type="button" class="module-submit module-button-success" (click)="changeStatus(record.id, 'Autorizada')">Autorizar entrega final</button>
                  <button type="button" class="module-button-danger" (click)="changeStatus(record.id, 'Cancelada')">Rechazar</button>
                } @else {
                  <span class="module-muted">Medicamento surtido · Pendiente de autorización final de Administración.</span>
                }
              } @else if (record.status === 'Cancelada') {
                <span class="module-muted" style="color: #b91c1c; font-weight: 600;">Pedido rechazado / cancelado.</span>
              } @else {
                <span class="module-muted" style="color: #15803d; font-weight: 600;">Entrega autorizada por Administración (confirmada).</span>
              }
            </div>
          </article>
        } @empty {
          <div class="module-empty">Aún no hay dispensaciones registradas.</div>
        }
      </section>
    </section>
  `,
  styles: [`
    .form-error { color: #b42318; margin: .25rem 0; font-weight: 650; }
    .patient-autocomplete { position: relative; }
    .patient-results { position: absolute; z-index: 20; top: calc(100% + .25rem); left: 0; right: 0; max-height: 14rem; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 7px; background: white; box-shadow: 0 10px 24px rgba(15,23,42,.16); }
    .patient-result { display: grid; width: 100%; grid-template-columns: 1fr auto; align-items: center; gap: .75rem; border: 0; border-bottom: 1px solid #e2e8f0; background: white; padding: .65rem .75rem; text-align: left; cursor: pointer; }
    .patient-result:last-child { border-bottom: 0; }
    .patient-result:hover, .patient-result.selected { background: #fef2f2; }
    .patient-result strong { color: #1e293b; }
    .patient-result span { color: #64748b; font-size: .78rem; }
    .patient-no-results { margin: 0; padding: .75rem; color: #64748b; font-size: .82rem; }
  `]
})
export class FarmaciaComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly hospital = inject(HospitalService);
  readonly records = inject(OperationalRecordsService);
  readonly drafts = inject(FormDraftService);
  searchQuery = '';
  patientSearch = '';
  patientResultsOpen = false;
  private patientResultsTimeout?: number;
  form = {
    patientId: '', itemId: '', quantity: 1, prescription: '', responsibleId: 0,
    prescriberEmail: ''
  };
  prescriberPassword = '';

  ngOnInit(): void {
    void this.loadStaff();
  }

  async loadStaff(): Promise<void> {
    await this.records.loadAreaStaff();
    const assigned = this.pharmacyStaff;
    const currentUserId = this.auth.user()?.id;
    this.form.responsibleId = assigned.find(staff => staff.id === currentUserId)?.id ?? assigned[0]?.id ?? 0;
  }

  get activePatients() {
    return this.hospital.patients().filter(patient => patient.status === 'Activo');
  }

  get patientOptions() {
    const query = this.normalizePatientSearch(this.patientSearch);
    if (!query) {
      return this.activePatients.slice(0, 50);
    }
    return this.activePatients.filter(patient =>
      this.normalizePatientSearch(`${patient.firstName} ${patient.lastName} ${patient.documentId}`).includes(query)
    ).slice(0, 50);
  }

  private normalizePatientSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .trim();
  }

  onPatientSearchChange(): void {
    this.form.patientId = '';
    this.openPatientResults();
  }

  openPatientResults(): void {
    this.patientResultsOpen = true;
    this.clearPatientResultsTimeout();
    this.patientResultsTimeout = window.setTimeout(() => this.closePatientResults(), 5_000);
  }

  closePatientResults(): void {
    this.patientResultsOpen = false;
    this.clearPatientResultsTimeout();
  }

  ngOnDestroy(): void {
    this.clearPatientResultsTimeout();
  }

  private clearPatientResultsTimeout(): void {
    if (this.patientResultsTimeout !== undefined) {
      window.clearTimeout(this.patientResultsTimeout);
      this.patientResultsTimeout = undefined;
    }
  }

  selectPatient(patient: { id: string; firstName: string; lastName: string }): void {
    this.form.patientId = patient.id;
    this.patientSearch = `${patient.firstName} ${patient.lastName}`;
    this.closePatientResults();
  }

  @HostListener('document:click', ['$event'])
  closePatientResultsOnOutsideClick(event: MouseEvent): void {
    if (!this.patientResultsOpen || !(event.target instanceof Element)) return;
    if (!event.target.closest('.patient-results, .patient-autocomplete input[type="search"]')) {
      this.closePatientResults();
    }
  }

  get pharmacyStaff() {
    return this.records.areaStaff().farmacia;
  }

  get filteredDispensations() {
    const q = this.searchQuery.trim().toLowerCase();
    const list = this.records.dispensations();
    if (!q) return list;
    return list.filter(record =>
      this.itemName(record.itemId).toLowerCase().includes(q) ||
      this.patientName(record.patientId).toLowerCase().includes(q) ||
      record.prescription.toLowerCase().includes(q) ||
      record.id.toLowerCase().includes(q) ||
      (record.status && record.status.toLowerCase().includes(q))
    );
  }

  get pharmacyStaffNames(): string {
    return this.pharmacyStaff.map(staff => staff.name).join(' · ');
  }

  get prescriptionAlreadyRegistered(): boolean {
    const prescription = this.form.prescription.trim().toLocaleLowerCase('es');
    return prescription.length > 0 && this.records.dispensations().some(record =>
      record.prescription.trim().toLocaleLowerCase('es') === prescription
    );
  }

  get availableMedicines() {
    return this.records.inventory().filter(item => item.category === 'Medicamentos' && (item.availableStock ?? 0) > 0);
  }

  get selectedItem() {
    return this.records.inventory().find(item => item.id === this.form.itemId);
  }

  patientName(id: string): string {
    const patient = this.hospital.patients().find(entry => entry.id === id);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente no disponible';
  }

  itemName(id: string): string {
    return this.records.inventory().find(item => item.id === id)?.name ?? 'Medicamento retirado';
  }

  get isAdmin(): boolean {
    return this.auth.hasRole('admin');
  }

  async fulfillOrder(id: string): Promise<void> {
    await this.records.setDispensationStatus(id, 'Surtida', {
      responsibleId: this.auth.user()?.id ?? this.form.responsibleId,
    });
  }

  async changeStatus(id: string, status: 'Autorizada' | 'Cancelada'): Promise<void> {
    await this.records.setDispensationStatus(id, status);
  }

  async dispense(): Promise<void> {
    if (this.prescriptionAlreadyRegistered || (!this.isAdmin && this.pharmacyStaff.length !== 2)) return;
    const baseRecord = this.isAdmin
      ? { patientId: this.form.patientId, itemId: this.form.itemId, quantity: this.form.quantity, prescription: this.form.prescription }
      : (this.selectedItem?.isControlled ? { ...this.form, prescriberPassword: this.prescriberPassword } : this.form);
    if (await this.records.dispense(baseRecord)) {
      this.drafts.clear('farmacia:dispensacion');
      this.form = {
        patientId: '', itemId: '', quantity: 1, prescription: '',
        responsibleId: this.auth.user()?.id ?? this.pharmacyStaff[0]?.id ?? 0, prescriberEmail: ''
      };
      this.patientSearch = '';
      this.prescriberPassword = '';
    }
  }
}
