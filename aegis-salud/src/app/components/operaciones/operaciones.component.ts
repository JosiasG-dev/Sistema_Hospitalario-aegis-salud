import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HospitalService } from '../../services/hospital.service';
import { OperationalRecordsService } from '../../services/operational-records.service';
import { OperationRecord } from '../../models/operational-records.model';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { FormDraftService } from '../../services/form-draft.service';

@Component({
  selector: 'app-operaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <section class="module-page operational-module">
      <header class="module-heading">
        <div>
          <span class="module-kicker">ÁREA QUIRÚRGICA</span>
          <h2>Operaciones</h2>
          <p>Programación y seguimiento del estado de procedimientos quirúrgicos.</p>
        </div>
      </header>
      <div class="operational-summary" aria-label="Resumen de operaciones">
        <article class="operational-stat">
          <span>Operaciones registradas</span>
          <strong>{{ records.operations().length }}</strong>
        </article>
        <article class="operational-stat attention">
          <span>En programación o curso</span>
          <strong>{{ pendingOperationsCount }}</strong>
        </article>
        <article class="operational-stat success">
          <span>Procedimientos finalizados</span>
          <strong>{{ finalizedOperationsCount }}</strong>
        </article>
      </div>
      <div class="module-alert">Este registro es administrativo y no sustituye la historia clínica, el consentimiento informado ni los protocolos del hospital.</div>

      <form class="module-panel" appFormDraft="operaciones:nueva" appFormValidation [appFormValidationError]="records.storageError()" (appFormValidationDismiss)="records.clearError()" (ngSubmit)="create()">
        <h3>Programar operación</h3>
        <div class="module-form-grid">
          <div class="module-field">
            <label for="operation-patient">Paciente *</label>
            <select id="operation-patient" [(ngModel)]="form.patientId" name="patientId" required>
              <option value="" disabled>Seleccione paciente</option>
              @for (patient of activePatients; track patient.id) {
                <option [value]="patient.id">{{ patient.firstName }} {{ patient.lastName }}</option>
              }
            </select>
          </div>
          <div class="module-field">
            <label for="operation-surgeon">Cirujano responsable *</label>
            <select id="operation-surgeon" [(ngModel)]="form.surgeonName" name="surgeonName" required>
              <option value="" disabled>Seleccione médico</option>
              @for (doctor of activeDoctors; track doctor.id) {
                <option [value]="doctor.firstName + ' ' + doctor.lastName">
                  {{ doctor.firstName }} {{ doctor.lastName }} — {{ doctor.specialty }}
                </option>
              }
            </select>
          </div>
          <div class="module-field">
            <label for="operation-date">Fecha y hora *</label>
            <input id="operation-date" type="datetime-local" [(ngModel)]="form.scheduledAt" name="scheduledAt" required />
          </div>
          <div class="module-field wide">
            <label for="operation-procedure">Procedimiento *</label>
            <input id="operation-procedure" [(ngModel)]="form.procedure" name="procedure" maxlength="180" required />
          </div>
          <div class="module-field">
            <label for="operation-room">Quirófano *</label>
            <input id="operation-room" [(ngModel)]="form.room" name="room" maxlength="80" required />
          </div>
        </div>
        <button class="module-submit" type="submit">Registrar programación</button>
      </form>

      <section class="module-records" aria-label="Operaciones registradas">
        @for (record of records.operations(); track record.id) {
          <article class="module-record">
            <div class="module-record-head">
              <h3>{{ record.procedure }} <span class="module-muted">· {{ record.id }}</span></h3>
              <span class="module-badge">{{ record.status }}</span>
            </div>
            <p><strong>Paciente:</strong> {{ patientName(record.patientId) }} · <strong>Cirujano:</strong> {{ record.surgeonName }}</p>
            <p><strong>Fecha:</strong> {{ record.scheduledAt | date:'medium' }} · <strong>Quirófano:</strong> {{ record.room }}</p>
            <div class="module-record-foot">
              <span class="module-muted">Estado administrativo</span>
              <select [ngModel]="record.status" [name]="'operation-status-' + record.id"
                (ngModelChange)="changeStatus(record.id, $event)" aria-label="Estado de operación">
                <option value="Programada">Programada</option>
                <option value="En curso">En curso</option>
                <option value="Finalizada">Finalizada</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>
          </article>
        } @empty {
          <div class="module-empty">Aún no hay operaciones programadas.</div>
        }
      </section>
    </section>
  `
})
export class OperacionesComponent {
  readonly hospital = inject(HospitalService);
  readonly records = inject(OperationalRecordsService);
  readonly drafts = inject(FormDraftService);
  form = {
    patientId: '',
    procedure: '',
    surgeonName: '',
    scheduledAt: this.localDateTime(),
    room: '',
    status: 'Programada' as const
  };

  get activePatients() {
    return this.hospital.patients().filter(patient => patient.status === 'Activo');
  }

  get activeDoctors() {
    return this.hospital.doctors().filter(doctor => doctor.status === 'Activo');
  }

  get pendingOperationsCount(): number {
    return this.records.operations().filter(record => record.status === 'Programada' || record.status === 'En curso').length;
  }

  get finalizedOperationsCount(): number {
    return this.records.operations().filter(record => record.status === 'Finalizada').length;
  }

  patientName(id: string): string {
    const patient = this.hospital.patients().find(entry => entry.id === id);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente no disponible';
  }

  async create(): Promise<void> {
    if (await this.records.addOperation(this.form)) {
      this.drafts.clear('operaciones:nueva');
      this.form = {
        patientId: '', procedure: '', surgeonName: '',
        scheduledAt: this.localDateTime(), room: '', status: 'Programada'
      };
    }
  }

  async changeStatus(id: string, status: OperationRecord['status']): Promise<void> {
    await this.records.setOperationStatus(id, status);
  }

  private localDateTime(): string {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
}
