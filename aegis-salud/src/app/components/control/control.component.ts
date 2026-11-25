import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService, UserRole } from '../../services/auth.service';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { spanishErrorMessage } from '../../services/spanish-error-message';
import { HospitalService } from '../../services/hospital.service';
import { OperationalRecordsService } from '../../services/operational-records.service';

interface PatientChoice {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
}

interface AbsenceRecord {
  id: string;
  doctorName: string;
  specialty: string;
  startsOn: string;
  endsOn: string;
  reason: string;
  status: string;
}

interface ReplacementCandidate {
  doctorId: string;
  name: string;
  specialty: string;
  roomId: string;
  startTime: string;
  endTime: string;
}

interface InvoiceRecord {
  id: string;
  patientId: string;
  patientName: string;
  description: string;
  total: number;
  paid: number;
  balance: number;
  status: string;
}

interface DefectRecord {
  id: string;
  title: string;
  description: string;
  impact: string;
  priority: string;
  status: string;
  resolution: string | null;
  resolutionMinutes: number | null;
}

interface RequisitionRecord {
  id: string;
  itemName: string;
  quantity: number;
  purpose: string;
  status: string;
  operation: string | null;
}

interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

interface TemporaryGrant {
  id: number;
  user: string;
  role: UserRole;
  reason: string;
  expiresAt: string;
  active: boolean;
}

interface EmergencyGrant {
  id: number;
  user: string;
  patient: string;
  reason: string;
  expiresAt: string;
  active: boolean;
}

@Component({
  selector: 'app-control',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <section class="module-page operational-module">
      <header class="module-heading">
        <div>
          <span class="module-kicker">SEGURIDAD Y OPERACIÓN</span>
          <h2>Control del sistema</h2>
          <p>Acceso de emergencia, cobertura de turnos, cobros y trazabilidad.</p>
        </div>
      </header>
      <div class="operational-summary" aria-label="Resumen de seguridad">
        <article class="operational-stat" [class.attention]="codeRed.isActive">
          <span>Código rojo</span>
          <strong>{{ codeRed.isActive ? 'Activo' : 'Inactivo' }}</strong>
        </article>
        <article class="operational-stat">
          <span>Permisos temporales activos</span>
          <strong>{{ activeTemporaryGrantsCount }}</strong>
        </article>
        <article class="operational-stat attention">
          <span>Ausencias registradas</span>
          <strong>{{ absences().length }}</strong>
        </article>
        <article class="operational-stat success">
          <span>Defectos pendientes</span>
          <strong>{{ pendingDefectsCount }}</strong>
        </article>
      </div>

      <section class="module-panel">
        <h3>Código rojo y acceso de emergencia</h3>
        <p>El acceso de emergencia requiere activación administrativa, motivo y caducidad automática.</p>
        <div class="module-alert" [class.error]="!codeRed.isActive">
          Código rojo: {{ codeRed.isActive ? 'Activo' : 'Inactivo' }}
          @if (codeRed.expiresAt) { · vence {{ codeRed.expiresAt | date:'short' }} }
        </div>
        @if (auth.hasRole('admin')) {
          <form appFormDraft="control:codigo-rojo" appFormValidation [appFormValidationError]="error() || records.storageError()" (appFormValidationDismiss)="clearFormError()" (ngSubmit)="setCodeRed()">
            <div class="module-form-grid">
              <div class="module-field">
                <label for="red-reason">Motivo de activación *</label>
                <input id="red-reason" [(ngModel)]="redReason" name="redReason" minlength="10" maxlength="500" required />
              </div>
              <div class="module-field">
                <label for="red-duration">Duración (minutos)</label>
                <input id="red-duration" type="number" [(ngModel)]="redDuration" name="redDuration" min="5" max="120" required />
              </div>
            </div>
            <button class="module-submit" type="submit">{{ codeRed.isActive ? 'Renovar código rojo' : 'Activar código rojo' }}</button>
            @if (codeRed.isActive) {
              <button class="module-quick-action" type="button" (click)="deactivateCodeRed()">Desactivar ahora</button>
            }
          </form>
          <div class="module-records">
            @for (grant of emergencyGrants(); track grant.id) {
              <article class="module-record">
                <div class="module-record-head"><h3>{{ grant.patient }} · {{ grant.user }}</h3>
                  <span class="module-badge">{{ grant.active ? 'Activo' : 'Expirado/revocado' }}</span>
                </div>
                <p>{{ grant.reason }} · Vence {{ grant.expiresAt | date:'short' }}</p>
              </article>
            }
          </div>
        } @else {
          <form appFormDraft="control:acceso-emergencia" appFormValidation [appFormValidationError]="error() || records.storageError()" (appFormValidationDismiss)="clearFormError()" (ngSubmit)="requestEmergencyAccess()">
            <div class="module-form-grid">
              @if (patients().length) {
                <div class="module-field">
                  <label for="emergency-patient">Paciente *</label>
                  <select id="emergency-patient" [(ngModel)]="emergencyPatientId" name="emergencyPatientId" required>
                    <option value="" disabled>Seleccione paciente</option>
                    @for (patient of patients(); track patient.id) {
                      <option [value]="patient.id">{{ patient.firstName }} {{ patient.lastName }}</option>
                    }
                  </select>
                </div>
              } @else {
                <div class="module-field">
                  <label for="emergency-patient-id">Identificador de expediente *</label>
                  <input id="emergency-patient-id" [(ngModel)]="emergencyPatientId" name="emergencyPatientId" required />
                </div>
              }
              <div class="module-field">
                <label for="emergency-reason">Justificación (mínimo 20 caracteres) *</label>
                <textarea id="emergency-reason" [(ngModel)]="emergencyReason" name="emergencyReason" minlength="20" maxlength="500" required></textarea>
              </div>
            </div>
            <button class="module-submit" type="submit" [disabled]="!codeRed.isActive">Solicitar acceso por 30 minutos</button>
          </form>
          @if (openedRecord()) {
            <article class="module-record">
              <h3>Expediente consultado</h3>
              <pre>{{ openedRecord() | json }}</pre>
            </article>
          }
        }
      </section>

      @if (auth.hasRole('admin')) {
        <section class="module-panel">
          <h3>Cobertura temporal de roles</h3>
          <p>El permiso expira automáticamente y cada concesión o revocación queda auditada.</p>
          <form appFormDraft="control:rol-temporal" appFormValidation [appFormValidationError]="error() || records.storageError()" (appFormValidationDismiss)="clearFormError()" (ngSubmit)="grantTemporaryRole()">
            <div class="module-form-grid">
              <div class="module-field">
                <label for="grant-user">Usuario *</label>
                <select id="grant-user" [(ngModel)]="grantForm.userId" name="grantUser" required>
                  <option value="" disabled>Seleccione usuario</option>
                  @for (user of users(); track user.id) { <option [ngValue]="user.id">{{ user.name }} · {{ user.role }}</option> }
                </select>
              </div>
              <div class="module-field">
                <label for="grant-role">Rol temporal *</label>
                <select id="grant-role" [(ngModel)]="grantForm.role" name="grantRole" required>
                  @for (role of temporaryRoles; track role.value) { <option [value]="role.value">{{ role.label }}</option> }
                </select>
              </div>
              <div class="module-field">
                <label for="grant-duration">Duración (minutos, máximo 480) *</label>
                <input id="grant-duration" type="number" [(ngModel)]="grantForm.durationMinutes" name="grantDuration" min="5" max="480" required />
              </div>
              <div class="module-field">
                <label for="grant-reason">Motivo *</label>
                <textarea id="grant-reason" [(ngModel)]="grantForm.reason" name="grantReason" minlength="15" maxlength="500" required></textarea>
              </div>
            </div>
            <button class="module-submit" type="submit">Otorgar temporalmente</button>
          </form>
          <div class="module-records">
            @for (grant of grants(); track grant.id) {
              <article class="module-record">
                <div class="module-record-head"><h3>{{ grant.user }} · {{ grant.role }}</h3>
                  <span class="module-badge">{{ grant.active ? 'Activo' : 'Expirado/revocado' }}</span>
                </div>
                <p>{{ grant.reason }} · Vence {{ grant.expiresAt | date:'short' }}</p>
                @if (grant.active) { <button class="module-quick-action" type="button" (click)="revokeGrant(grant)">Revocar</button> }
              </article>
            }
          </div>
        </section>
      }

      @if (auth.hasRole('admin', 'recepcion')) {
        <section class="module-panel">
          <h3>Ausencias y sugerencia de suplencias</h3>
          <form appFormDraft="control:ausencia" appFormValidation [appFormValidationError]="error() || records.storageError()" (appFormValidationDismiss)="clearFormError()" (ngSubmit)="createAbsence()">
            <div class="module-form-grid">
              <div class="module-field">
                <label for="absence-doctor">Médico *</label>
                <select id="absence-doctor" [(ngModel)]="absenceForm.doctorId" name="absenceDoctor" required>
                  @for (doctor of hospital.doctors(); track doctor.id) {
                    <option [value]="doctor.id">{{ doctor.firstName }} {{ doctor.lastName }} · {{ doctor.specialty }}</option>
                  }
                </select>
              </div>
              <div class="module-field"><label for="absence-start">Desde *</label><input id="absence-start" type="date" [(ngModel)]="absenceForm.startsOn" name="absenceStart" required /></div>
              <div class="module-field"><label for="absence-end">Hasta *</label><input id="absence-end" type="date" [(ngModel)]="absenceForm.endsOn" name="absenceEnd" required /></div>
              <div class="module-field"><label for="absence-reason">Motivo *</label><input id="absence-reason" [(ngModel)]="absenceForm.reason" name="absenceReason" minlength="5" maxlength="500" required /></div>
            </div>
            <button class="module-submit" type="submit">Registrar ausencia</button>
          </form>
          <div class="module-form-grid">
            <div class="module-field">
              <label for="coverage-absence">Ausencia a cubrir</label>
              <select id="coverage-absence" [(ngModel)]="coverage.absenceId" name="coverageAbsence">
                @for (absence of absences(); track absence.id) { <option [value]="absence.id">{{ absence.doctorName }} · {{ absence.startsOn }}–{{ absence.endsOn }}</option> }
              </select>
            </div>
            <div class="module-field"><label for="coverage-date">Fecha</label><input id="coverage-date" type="date" [(ngModel)]="coverage.date" name="coverageDate" /></div>
            <div class="module-field"><label for="coverage-start">Desde</label><input id="coverage-start" type="time" [(ngModel)]="coverage.startTime" name="coverageStart" /></div>
            <div class="module-field"><label for="coverage-end">Hasta</label><input id="coverage-end" type="time" [(ngModel)]="coverage.endTime" name="coverageEnd" /></div>
          </div>
          <button class="module-submit" type="button" (click)="findReplacements()">Buscar personal disponible</button>
          @for (candidate of candidates(); track candidate.doctorId) {
            <p class="module-record">{{ candidate.name }} · {{ candidate.specialty }} · {{ candidate.startTime }}–{{ candidate.endTime }} · Consultorio {{ candidate.roomId }}</p>
          } @empty { <p class="module-muted">No hay sugerencias para el rango consultado.</p> }
          <div class="module-records">
            @for (absence of absences(); track absence.id) {
              <article class="module-record">{{ absence.doctorName }} · {{ absence.specialty }} · {{ absence.startsOn }}–{{ absence.endsOn }} · {{ absence.reason }}</article>
            }
          </div>
        </section>

        <section class="module-panel">
          <h3>Fichas de cobro y pagos</h3>
          <form appFormDraft="control:ficha-cobro" appFormValidation [appFormValidationError]="error() || records.storageError()" (appFormValidationDismiss)="clearFormError()" (ngSubmit)="createInvoice()">
            <div class="module-form-grid">
              <div class="module-field">
                <label for="invoice-patient">Paciente *</label>
                <select id="invoice-patient" [(ngModel)]="invoiceForm.patientId" name="invoicePatient" required>
                  @for (patient of patients(); track patient.id) { <option [value]="patient.id">{{ patient.firstName }} {{ patient.lastName }}</option> }
                </select>
              </div>
              <div class="module-field"><label for="invoice-description">Concepto *</label><input id="invoice-description" [(ngModel)]="invoiceForm.description" name="invoiceDescription" maxlength="255" required /></div>
              <div class="module-field"><label for="invoice-total">Total *</label><input id="invoice-total" type="number" [(ngModel)]="invoiceForm.total" name="invoiceTotal" min="0.01" step="0.01" required /></div>
            </div>
            <button class="module-submit" type="submit">Crear ficha</button>
          </form>
          <div class="module-records">
            @for (invoice of invoices(); track invoice.id) {
              <article class="module-record">
                <div class="module-record-head"><h3>{{ invoice.patientName }} · {{ invoice.description }}</h3><span class="module-badge">{{ invoice.status }}</span></div>
                <p>Total {{ invoice.total | currency }} · Pagado {{ invoice.paid | currency }} · Saldo {{ invoice.balance | currency }}</p>
                @if (invoice.balance > 0) {
                  <div class="module-form-grid">
                    <div class="module-field"><label [for]="'pay-amount-' + invoice.id">Abono</label>
                      <input [id]="'pay-amount-' + invoice.id" type="number" min="0.01" step="0.01" [(ngModel)]="paymentAmount" [name]="'payAmount-' + invoice.id" />
                    </div>
                    <div class="module-field"><label [for]="'pay-method-' + invoice.id">Método</label>
                      <select [id]="'pay-method-' + invoice.id" [(ngModel)]="paymentMethod" [name]="'payMethod-' + invoice.id">
                        <option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option>
                      </select>
                    </div>
                    <button class="module-quick-action" type="button" (click)="payInvoice(invoice)">Registrar pago</button>
                  </div>
                }
              </article>
            }
          </div>
        </section>
      }

      <section class="module-panel">
        <h3>Bitácora de defectos</h3>
        <form appFormDraft="control:defecto" appFormValidation [appFormValidationError]="error() || records.storageError()" (appFormValidationDismiss)="clearFormError()" (ngSubmit)="reportDefect()">
          <div class="module-form-grid">
            <div class="module-field"><label for="defect-title">Título *</label><input id="defect-title" [(ngModel)]="defectForm.title" name="defectTitle" maxlength="180" required /></div>
            <div class="module-field"><label for="defect-impact">Impacto *</label>
              <select id="defect-impact" [(ngModel)]="defectForm.impact" name="defectImpact">
                <option>Sin impacto</option><option>Bajo</option><option>Moderado</option><option>Alto</option><option>Crítico</option>
              </select>
            </div>
            <div class="module-field"><label for="defect-priority">Prioridad *</label>
              <select id="defect-priority" [(ngModel)]="defectForm.priority" name="defectPriority">
                <option>Baja</option><option>Media</option><option>Alta</option><option>Crítica</option>
              </select>
            </div>
            <div class="module-field"><label for="defect-description">Descripción *</label><textarea id="defect-description" [(ngModel)]="defectForm.description" name="defectDescription" minlength="10" maxlength="10000" required></textarea></div>
          </div>
          <button class="module-submit" type="submit">Reportar problema</button>
        </form>
        @if (auth.hasRole('admin')) {
          <div class="module-records">
            @for (defect of defects(); track defect.id) {
              <article class="module-record">
                <div class="module-record-head"><h3>{{ defect.title }} · {{ defect.priority }}</h3><span class="module-badge">{{ defect.status }}</span></div>
                <p>{{ defect.description }}</p><p>Impacto: {{ defect.impact }}
                  @if (defect.resolutionMinutes !== null) { · Tiempo de resolución: {{ defect.resolutionMinutes }} min }
                </p>
                @if (defect.status !== 'Resuelto' && defect.status !== 'No reproducible') {
                  <textarea [(ngModel)]="resolutionText" [name]="'resolution-' + defect.id" placeholder="Solución o resultado (mínimo 5 caracteres)"></textarea>
                  <button class="module-quick-action" type="button" (click)="resolveDefect(defect)">Marcar resuelto</button>
                  <button class="module-quick-action" type="button" (click)="setDefectInProgress(defect)">En curso</button>
                }
              </article>
            }
          </div>
        }
      </section>

      @if (auth.hasRole('admin', 'almacen', 'especialista', 'cirugia')) {
        <section class="module-panel">
          <h3>Requisiciones de material quirúrgico</h3>
          @if (auth.hasRole('admin', 'especialista', 'cirugia')) {
            <form appFormDraft="control:requisicion" appFormValidation [appFormValidationError]="error() || records.storageError()" (appFormValidationDismiss)="clearFormError()" (ngSubmit)="createRequisition()">
              <div class="module-form-grid">
                <div class="module-field"><label for="req-operation">Operación</label>
                  <select id="req-operation" [(ngModel)]="requisitionForm.operationId" name="reqOperation">
                    <option value="">Sin operación asociada</option>
                    @for (operation of records.operations(); track operation.id) { <option [value]="operation.id">{{ operation.procedure }} · {{ operation.patientName }}</option> }
                  </select>
                </div>
                <div class="module-field"><label for="req-item">Insumo hospitalario *</label>
                  <select id="req-item" [(ngModel)]="requisitionForm.inventoryItemId" name="reqItem" required>
                    @for (item of records.inventory(); track item.id) { @if (item.category === 'Insumos hospitalarios') { <option [value]="item.id">{{ item.name }} · stock {{ item.stock }}</option> } }
                  </select>
                </div>
                <div class="module-field"><label for="req-quantity">Cantidad *</label><input id="req-quantity" type="number" [(ngModel)]="requisitionForm.quantity" name="reqQuantity" min="1" required /></div>
                <div class="module-field"><label for="req-purpose">Uso previsto *</label><input id="req-purpose" [(ngModel)]="requisitionForm.purpose" name="reqPurpose" minlength="5" maxlength="500" required /></div>
              </div>
              <button class="module-submit" type="submit">Solicitar material</button>
            </form>
          }
          <div class="module-records">
            @for (item of requisitions(); track item.id) {
              <article class="module-record">
                <div class="module-record-head"><h3>{{ item.itemName }} · {{ item.quantity }}</h3><span class="module-badge">{{ item.status }}</span></div>
                <p>{{ item.purpose }} @if (item.operation) { · Operación: {{ item.operation }} }</p>
                @if (auth.hasRole('admin', 'almacen') && item.status === 'Solicitada') {
                  <button class="module-quick-action" type="button" (click)="updateRequisition(item, 'Aprobada')">Aprobar</button>
                  <button class="module-quick-action" type="button" (click)="updateRequisition(item, 'Rechazada')">Rechazar</button>
                }
                @if (auth.hasRole('admin', 'almacen') && item.status === 'Aprobada') {
                  <button class="module-quick-action" type="button" (click)="updateRequisition(item, 'Entregada')">Entregar y descontar stock</button>
                }
              </article>
            }
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .module-quick-action { margin: .25rem; border: 1px solid #cbd5e1; border-radius: .45rem; background: #fff; padding: .5rem .7rem; color: #334155; cursor: pointer; font-weight: 650; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; }
  `]
})
export class ControlComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly hospital = inject(HospitalService);
  readonly records = inject(OperationalRecordsService);
  readonly error = signal('');
  readonly patients = signal<PatientChoice[]>([]);
  readonly absences = signal<AbsenceRecord[]>([]);
  readonly candidates = signal<ReplacementCandidate[]>([]);
  readonly invoices = signal<InvoiceRecord[]>([]);
  readonly defects = signal<DefectRecord[]>([]);
  readonly requisitions = signal<RequisitionRecord[]>([]);
  readonly grants = signal<TemporaryGrant[]>([]);
  readonly emergencyGrants = signal<EmergencyGrant[]>([]);
  readonly users = signal<ManagedUser[]>([]);
  readonly openedRecord = signal<Record<string, unknown> | null>(null);
  codeRed = { isActive: false, reason: '', expiresAt: null as string | null };
  redReason = '';
  redDuration = 30;
  emergencyPatientId = '';
  emergencyReason = '';
  grantForm: { userId: number | ''; role: UserRole; reason: string; durationMinutes: number } = {
    userId: '', role: 'recepcion', reason: '', durationMinutes: 60,
  };
  readonly temporaryRoles: Array<{ value: UserRole; label: string }> = [
    { value: 'recepcion', label: 'Recepción' }, { value: 'medico_general', label: 'Medicina general' },
    { value: 'especialista', label: 'Especialista' }, { value: 'farmacia', label: 'Farmacia' },
    { value: 'nutricion', label: 'Nutrición' }, { value: 'compras', label: 'Compras' },
    { value: 'enfermeria', label: 'Enfermería' }, { value: 'cirugia', label: 'Cirugía' },
    { value: 'almacen', label: 'Almacén' },
  ];
  absenceForm = { doctorId: '', startsOn: '', endsOn: '', reason: '' };
  coverage = { absenceId: '', date: '', startTime: '08:00', endTime: '08:30' };
  invoiceForm = { patientId: '', description: '', total: 0 };
  paymentAmount = 0;
  paymentMethod = 'Efectivo';
  defectForm = { title: '', description: '', impact: 'Bajo', priority: 'Media' };
  resolutionText = '';
  requisitionForm = { operationId: '', inventoryItemId: '', quantity: 1, purpose: '' };
  private readonly http = inject(HttpClient);

  clearFormError(): void {
    this.error.set('');
    this.records.clearError();
  }

  get activeTemporaryGrantsCount(): number {
    return this.grants().filter(grant => grant.active).length;
  }

  get pendingDefectsCount(): number {
    return this.defects().filter(defect => defect.status !== 'Resuelto' && defect.status !== 'No reproducible').length;
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const tasks: Promise<void>[] = [
        firstValueFrom(this.http.get<typeof this.codeRed>('/api/security/code-red')).then(value => {
          this.codeRed = value;
        }),
      ];
      if (this.auth.hasRole('admin', 'recepcion', 'medico_general', 'especialista', 'farmacia', 'nutricion', 'enfermeria', 'cirugia')) {
        tasks.push(firstValueFrom(this.http.get<PatientChoice[]>('/api/security/patients')).then(items => this.patients.set(items)));
      }
      if (this.auth.hasRole('admin')) {
        tasks.push(firstValueFrom(this.http.get<EmergencyGrant[]>('/api/security/emergency-access')).then(items => this.emergencyGrants.set(items)));
        tasks.push(firstValueFrom(this.http.get<TemporaryGrant[]>('/api/security/temporary-roles')).then(items => this.grants.set(items)));
        tasks.push(firstValueFrom(this.http.get<ManagedUser[]>('/api/users')).then(items => this.users.set(items)));
        tasks.push(firstValueFrom(this.http.get<DefectRecord[]>('/api/defects')).then(items => this.defects.set(items)));
      }
      if (this.auth.hasRole('admin', 'recepcion')) {
        tasks.push(firstValueFrom(this.http.get<AbsenceRecord[]>('/api/staff-absences')).then(items => {
          this.absences.set(items);
          if (!this.coverage.absenceId && items.length) {
            this.coverage.absenceId = items[0].id;
            this.coverage.date = items[0].startsOn;
          }
        }));
        tasks.push(firstValueFrom(this.http.get<InvoiceRecord[]>('/api/invoices')).then(items => this.invoices.set(items)));
      }
      if (this.auth.hasRole('admin', 'almacen', 'especialista', 'cirugia')) {
        tasks.push(firstValueFrom(this.http.get<RequisitionRecord[]>('/api/surgical-requisitions')).then(items => this.requisitions.set(items)));
      }
      await Promise.all(tasks);
      this.error.set('');
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  async setCodeRed(): Promise<void> {
    await this.perform(async () => {
      this.codeRed = await firstValueFrom(this.http.put<typeof this.codeRed>('/api/security/code-red', {
        isActive: true, reason: this.redReason, durationMinutes: this.redDuration,
      }));
      this.redReason = '';
    });
  }

  async deactivateCodeRed(): Promise<void> {
    await this.perform(async () => {
      this.codeRed = await firstValueFrom(this.http.put<typeof this.codeRed>('/api/security/code-red', { isActive: false }));
    });
  }

  async requestEmergencyAccess(): Promise<void> {
    await this.perform(async () => {
      const grant = await firstValueFrom(this.http.post<{ patientId: string }>('/api/security/emergency-access', {
        patientId: this.emergencyPatientId, reason: this.emergencyReason,
      }));
      this.openedRecord.set(await firstValueFrom(
        this.http.get<Record<string, unknown>>(`/api/patients/${encodeURIComponent(grant.patientId)}/record`),
      ));
      this.emergencyReason = '';
    });
  }

  async grantTemporaryRole(): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.post('/api/security/temporary-roles', this.grantForm));
      this.grantForm = { userId: '', role: 'recepcion', reason: '', durationMinutes: 60 };
      await this.load();
    });
  }

  async revokeGrant(grant: TemporaryGrant): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.delete(`/api/security/temporary-roles/${grant.id}`));
      await this.load();
    });
  }

  async createAbsence(): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.post('/api/staff-absences', this.absenceForm));
      this.absenceForm = { doctorId: '', startsOn: '', endsOn: '', reason: '' };
      await this.load();
    });
  }

  async findReplacements(): Promise<void> {
    await this.perform(async () => {
      const query = new URLSearchParams(this.coverage);
      this.candidates.set(await firstValueFrom(this.http.get<ReplacementCandidate[]>(`/api/replacement-candidates?${query}`)));
    });
  }

  async createInvoice(): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.post('/api/invoices', this.invoiceForm));
      this.invoiceForm = { patientId: '', description: '', total: 0 };
      await this.load();
    });
  }

  async payInvoice(invoice: InvoiceRecord): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.post(`/api/invoices/${encodeURIComponent(invoice.id)}/payments`, {
        amount: this.paymentAmount, method: this.paymentMethod,
      }));
      this.paymentAmount = 0;
      await this.load();
    });
  }

  async reportDefect(): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.post('/api/defects', this.defectForm));
      this.defectForm = { title: '', description: '', impact: 'Bajo', priority: 'Media' };
      if (this.auth.hasRole('admin')) await this.load();
    });
  }

  async resolveDefect(defect: DefectRecord): Promise<void> {
    await this.updateDefect(defect, 'Resuelto');
  }

  async setDefectInProgress(defect: DefectRecord): Promise<void> {
    await this.updateDefect(defect, 'En curso');
  }

  async createRequisition(): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.post('/api/surgical-requisitions', {
        ...this.requisitionForm, operationId: this.requisitionForm.operationId || null,
      }));
      this.requisitionForm = { operationId: '', inventoryItemId: '', quantity: 1, purpose: '' };
      await this.load();
    });
  }

  async updateRequisition(item: RequisitionRecord, status: string): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.patch(`/api/surgical-requisitions/${encodeURIComponent(item.id)}`, { status }));
      await this.load();
    });
  }

  private async updateDefect(defect: DefectRecord, status: string): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.patch(`/api/defects/${encodeURIComponent(defect.id)}`, {
        status, resolution: status === 'Resuelto' ? this.resolutionText : null,
      }));
      this.resolutionText = '';
      await this.load();
    });
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    try {
      await action();
      this.error.set('');
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  private errorMessage(error: unknown): string {
    return spanishErrorMessage(error, 'No se pudo completar la operación.');
  }
}
