import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { HospitalService } from '../../services/hospital.service';
import { OperationalRecordsService } from '../../services/operational-records.service';
import { ConsultationRecord } from '../../models/operational-records.model';

interface ConsultationForm {
  patientId: string;
  doctorId: string;
  consultationType: 'general' | 'specialty';
  scheduledAt: string;
  reason: string;
  notes: string;
  diagnosis: string;
  vitalsText: string;
  treatmentPlan: string;
  specialtyFindings: string;
  nutritionDiet: string;
  nutritionOrder: string;
  nutritionInstructions: string;
}

@Component({
  selector: 'app-consultas',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <section class="module-page operational-module">
      <header class="module-heading">
        <div>
          <span class="module-kicker">ATENCIÓN MÉDICA Y CLÍNICA</span>
          <h2>Consultas</h2>
          <p>Atención primaria y seguimiento con campos diferenciados para cada especialidad.</p>
        </div>
      </header>
      <div class="operational-summary" aria-label="Resumen de consultas">
        <article class="operational-stat">
          <span>Consultas registradas</span>
          <strong>{{ visibleConsultations.length }}</strong>
        </article>
        <article class="operational-stat">
          <span>Pacientes activos</span>
          <strong>{{ activePatients.length }}</strong>
        </article>
        <article class="operational-stat success">
          <span>Atenciones finalizadas</span>
          <strong>{{ finalizedConsultationsCount }}</strong>
        </article>
      </div>
      <div class="module-tabs" role="tablist" aria-label="Tipo de consulta">
        <button type="button" [class.active]="form.consultationType === 'general'" (click)="selectType('general')">Medicina General</button>
        <button type="button" [class.active]="form.consultationType === 'specialty'" (click)="selectType('specialty')">Especialidades Médicas</button>
      </div>

      @if (canCreate) {
        <form class="module-panel" appFormDraft="consultas:nueva" appFormValidation [appFormValidationError]="records.storageError()" (appFormValidationDismiss)="records.clearError()" (ngSubmit)="create()">
          <h3>{{ form.consultationType === 'general' ? 'Atención de medicina general' : 'Atención por especialidad' }}</h3>
          <div class="module-form-grid">
            <div class="module-field">
              <label for="consult-patient">Paciente *</label>
              <select id="consult-patient" [(ngModel)]="form.patientId" name="patientId" required>
                <option value="" disabled>Seleccione paciente</option>
                @for (patient of activePatients; track patient.id) {
                  <option [value]="patient.id">{{ patient.firstName }} {{ patient.lastName }}</option>
                }
              </select>
            </div>
            <div class="module-field">
              <label for="consult-doctor">Médico *</label>
              <select id="consult-doctor" [(ngModel)]="form.doctorId" name="doctorId" required>
                <option value="" disabled>Seleccione médico</option>
                @for (doctor of eligibleDoctors; track doctor.id) {
                  <option [value]="doctor.id">{{ doctor.firstName }} {{ doctor.lastName }} — {{ doctor.specialty }}</option>
                }
              </select>
            </div>
            <div class="module-field">
              <label for="consult-date">Fecha y hora *</label>
              <input id="consult-date" type="datetime-local" [(ngModel)]="form.scheduledAt" name="scheduledAt" required />
            </div>
            <div class="module-field wide">
              <label for="consult-reason">Motivo de atención *</label>
              <input id="consult-reason" [(ngModel)]="form.reason" name="reason" maxlength="180" required />
            </div>
            <div class="module-field">
              <label for="consult-diagnosis">Diagnóstico o impresión clínica</label>
              <textarea id="consult-diagnosis" [(ngModel)]="form.diagnosis" name="diagnosis" maxlength="4000"></textarea>
            </div>
            <div class="module-field">
              <label for="consult-vitals">Signos vitales (TA, pulso, temperatura, etc.)</label>
              <textarea id="consult-vitals" [(ngModel)]="form.vitalsText" name="vitalsText"></textarea>
            </div>
            @if (form.consultationType === 'general') {
              <div class="module-field wide">
                <label for="consult-treatment">Plan de atención</label>
                <textarea id="consult-treatment" [(ngModel)]="form.treatmentPlan" name="treatmentPlan"></textarea>
              </div>
            } @else {
              <div class="module-field">
                <label for="specialty-findings">Hallazgos propios de la especialidad</label>
                <textarea id="specialty-findings" [(ngModel)]="form.specialtyFindings" name="specialtyFindings"
                  placeholder="Registrar resultados clínicos específicos de esta especialidad"></textarea>
              </div>
              <div class="module-field">
                <label for="specialty-plan">Plan de especialidad</label>
                <textarea id="specialty-plan" [(ngModel)]="form.treatmentPlan" name="treatmentPlan"></textarea>
              </div>
            }
            <fieldset class="module-fieldset">
              <legend>Alimentos y nutrición · orden médica</legend>
              <div class="module-form-grid">
                <div class="module-field">
                  <label for="nutrition-diet">Régimen / dieta indicada</label>
                  <input id="nutrition-diet" [(ngModel)]="form.nutritionDiet" name="nutritionDiet"
                    placeholder="Ej. dieta indicada por el equipo tratante" />
                </div>
                <div class="module-field">
                  <label for="nutrition-order">Orden de alimentación</label>
                  <textarea id="nutrition-order" [(ngModel)]="form.nutritionOrder" name="nutritionOrder"></textarea>
                </div>
                <div class="module-field wide">
                  <label for="nutrition-instructions">Instrucciones para nutrición y alimentos</label>
                  <textarea id="nutrition-instructions" [(ngModel)]="form.nutritionInstructions" name="nutritionInstructions"></textarea>
                </div>
              </div>
            </fieldset>
            <div class="module-field wide">
              <label for="consult-notes">Notas de consulta</label>
              <textarea id="consult-notes" [(ngModel)]="form.notes" name="notes" maxlength="4000"></textarea>
            </div>
          </div>
          <button class="module-submit" type="submit">Guardar registro clínico</button>
        </form>
      }

      <section class="module-records" aria-label="Consultas registradas">
        @for (record of visibleConsultations; track record.id) {
          <article class="module-record">
            <div class="module-record-head">
              <h3>{{ record.patientName || patientName(record.patientId) }} <span class="module-muted">· {{ record.id }}</span></h3>
              <span class="module-badge">{{ record.consultationType === 'general' ? 'Medicina General' : (record.specialty || 'Especialidad') }}</span>
            </div>
            <p><strong>Fecha:</strong> {{ record.scheduledAt | date:'medium' }} · <strong>Médico:</strong> {{ record.doctorName || doctorName(record.doctorId) }}</p>
            <p><strong>Motivo:</strong> {{ record.reason }} · <strong>Estado:</strong> {{ record.status }}</p>
            @if (record.diagnosis) { <p><strong>Diagnóstico:</strong> {{ record.diagnosis }}</p> }
            @for (addendum of record.addenda ?? []; track addendum.id) {
              <p><strong>Adenda · {{ addendum.doctorName }} · {{ addendum.createdAt | date:'short' }}:</strong> {{ addendum.notes }}</p>
            }
            @if (record.nutritionDiet || record.nutritionOrder) {
              <div class="nutrition-summary">
                <strong>Orden de alimentación</strong>
                <p>{{ record.nutritionDiet || 'Régimen no especificado' }} · {{ record.nutritionOrder || 'Sin detalle adicional' }}</p>
                @if (record.nutritionInstructions) { <p>{{ record.nutritionInstructions }}</p> }
              </div>
            }
            @if (canChangeStatus) {
              <div class="module-record-foot">
                <span class="module-muted">Estado de atención</span>
                <select [ngModel]="record.status" [name]="'consult-status-' + record.id"
                  (ngModelChange)="changeStatus(record.id, $event)" aria-label="Estado de consulta">
                  <option value="Programada">Programada</option>
                  <option value="En curso">En curso</option>
                  <option value="Finalizada">Finalizada</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
            }
            @if (canAddendum) {
              <div class="module-field">
                <label [for]="'addendum-' + record.id">Nota aclaratoria (adenda)</label>
                <textarea [id]="'addendum-' + record.id" [(ngModel)]="addendumNotes[record.id]"
                  [name]="'addendum-' + record.id" maxlength="4000"></textarea>
                <button class="module-quick-action" type="button" [disabled]="!addendumNotes[record.id]?.trim()"
                  (click)="addAddendum(record.id)">Agregar adenda sin alterar la nota original</button>
              </div>
            }
          </article>
        } @empty {
          <div class="module-empty">Aún no hay consultas registradas.</div>
        }
      </section>
    </section>
  `,
  styles: [`
    .module-tabs { display: flex; flex-wrap: wrap; gap: .5rem; }
    .module-tabs button { border: 1px solid #cbd5e1; border-radius: .5rem; background: white; color: #334155; padding: .65rem 1rem; cursor: pointer; font-weight: 650; }
    .module-tabs button.active { border-color: #8b1e1e; background: #8b1e1e; color: white; }
    .module-fieldset { grid-column: 1 / -1; min-width: 0; border: 1px solid #cbd5e1; border-radius: .6rem; padding: .9rem; }
    .module-fieldset legend { padding: 0 .4rem; color: #475569; font-size: .85rem; font-weight: 700; }
    .nutrition-summary { margin-top: .75rem; border-left: 3px solid #0f766e; background: #f0fdfa; padding: .65rem .8rem; }
  `]
})
export class ConsultasComponent {
  @ViewChild(FormDraftDirective) draft?: FormDraftDirective;
  readonly hospital = inject(HospitalService);
  readonly records = inject(OperationalRecordsService);
  readonly auth = inject(AuthService);
  form: ConsultationForm = this.emptyForm();
  addendumNotes: Record<string, string> = {};

  get canCreate(): boolean {
    return this.auth.user()?.role !== 'admin' && this.auth.hasRole('medico_general', 'especialista');
  }

  get canAddendum(): boolean {
    return this.auth.user()?.role !== 'admin' && this.auth.hasRole('medico_general', 'especialista');
  }

  get canChangeStatus(): boolean {
    return this.auth.user()?.role !== 'admin' && this.auth.hasRole('medico_general', 'especialista', 'cirugia');
  }

  get activePatients() {
    return this.hospital.patients().filter(patient => patient.status === 'Activo');
  }

  get eligibleDoctors() {
    return this.hospital.doctors().filter(doctor =>
      doctor.status === 'Activo' &&
      (this.form.consultationType === 'general'
        ? doctor.specialty.toLocaleLowerCase().includes('general')
        : !doctor.specialty.toLocaleLowerCase().includes('general'))
    );
  }

  get visibleConsultations() {
    return this.records.consultations().filter(record => record.consultationType === this.form.consultationType);
  }

  get finalizedConsultationsCount(): number {
    return this.records.consultations().filter(record => record.status === 'Finalizada').length;
  }

  selectType(type: 'general' | 'specialty'): void {
    this.form.consultationType = type;
  }

  patientName(id: string): string {
    const patient = this.hospital.patients().find(entry => entry.id === id);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente no disponible';
  }

  doctorName(id?: string): string {
    const doctor = this.hospital.doctors().find(entry => entry.id === id);
    return doctor ? `${doctor.firstName} ${doctor.lastName}` : 'Médico no disponible';
  }

  async create(): Promise<void> {
    const doctor = this.hospital.doctors().find(entry => entry.id === this.form.doctorId);
    const success = await this.records.addConsultation({
      patientId: this.form.patientId,
      doctorId: this.form.doctorId,
      consultationType: this.form.consultationType,
      specialty: this.form.consultationType === 'specialty' ? doctor?.specialty : 'Medicina General',
      scheduledAt: this.form.scheduledAt,
      reason: this.form.reason,
      notes: this.form.notes,
      diagnosis: this.form.diagnosis,
      vitals: this.parseVitals(this.form.vitalsText),
      treatmentPlan: this.form.treatmentPlan,
      specialtyData: this.form.consultationType === 'specialty' ? { findings: this.form.specialtyFindings } : undefined,
      nutritionDiet: this.form.nutritionDiet,
      nutritionOrder: this.form.nutritionOrder,
      nutritionInstructions: this.form.nutritionInstructions,
      status: 'Programada',
    });
    if (success) {
      this.draft?.clearDraft();
      this.form = this.emptyForm();
    }
  }

  async addAddendum(id: string): Promise<void> {
    const notes = this.addendumNotes[id]?.trim();
    if (!notes) return;
    if (await this.records.addConsultationAddendum(id, notes)) {
      delete this.addendumNotes[id];
    }
  }

  async changeStatus(id: string, status: ConsultationRecord['status']): Promise<void> {
    await this.records.setConsultationStatus(id, status);
  }

  private parseVitals(value: string): Record<string, string> | undefined {
    const text = value.trim();
    return text ? { notes: text } : undefined;
  }

  private emptyForm(): ConsultationForm {
    return {
      patientId: '', doctorId: '', consultationType: 'general',
      scheduledAt: this.localDateTime(), reason: '', notes: '', diagnosis: '',
      vitalsText: '', treatmentPlan: '', specialtyFindings: '',
      nutritionDiet: '', nutritionOrder: '', nutritionInstructions: '',
    };
  }

  private localDateTime(): string {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
}
