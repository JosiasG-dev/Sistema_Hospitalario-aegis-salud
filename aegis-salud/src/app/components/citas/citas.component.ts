import { Component, HostListener, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HospitalService } from '../../services/hospital.service';
import { Appointment } from '../../models/appointment.model';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { FormDraftService } from '../../services/form-draft.service';
import { AuthService } from '../../services/auth.service';
import { AppointmentSuggestion, DoctorAssignmentRecord, OperationalRecordsService } from '../../services/operational-records.service';

@Component({
  selector: 'app-citas',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <div class="citas-page">
      <!-- Section Header -->
      <div class="page-header">
        <div class="title-group">
          <span class="module-tag">GESTIÓN CLÍNICA Y AGENDA MÉDICA</span>
          <h2 class="page-title">Gestión de Citas Médicas</h2>
          <p class="page-desc">
            Agende consultas ambulatorias y gestione cancelaciones, liberación de consultorios y registro de inasistencias.
          </p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" (click)="openNuevaCitaModal()">
            <span>Programar Cita Médica</span>
          </button>
        </div>
      </div>
      <!-- Overview Highlight Banner -->
      <div class="baja-info-banner">
        <div class="banner-text">
          <h4>Gestión de cancelaciones de citas médicas</h4>
          <p>
            Al cancelar una cita, se libera el horario del consultorio y el médico asignado; el movimiento queda registrado en la bitácora.
          </p>
        </div>
        <div class="banner-stats">
          <div class="stat-box">
            <span class="st-num">{{ hospitalService.activeAppointmentsCount() }}</span>
            <span class="st-lbl">Citas Activas</span>
          </div>
          <div class="stat-box red-box">
            <span class="st-num">{{ hospitalService.dischargedAppointmentsCount() }}</span>
            <span class="st-lbl">Citas Canceladas</span>
          </div>
        </div>
      </div>

      <!-- Filters & Tabs -->
      <div class="filter-bar">
        <div class="search-box">
          <input 
            type="text" 
            placeholder="Buscar por paciente, documento o médico especialista..." 
            [(ngModel)]="searchQuery" 
            class="search-input" />
        </div>

        <div class="filter-chips">
          <button 
            class="filter-chip" 
            [class.active]="filterStatus === 'TODOS'"
            (click)="filterStatus = 'TODOS'">
            Todas las Citas ({{ hospitalService.appointments().length }})
          </button>
          <button 
            class="filter-chip active-chip" 
            [class.active]="filterStatus === 'Programada'"
            (click)="filterStatus = 'Programada'">
            Programadas Activas ({{ hospitalService.activeAppointmentsCount() }})
          </button>
          <button 
            class="filter-chip baja-chip" 
            [class.active]="filterStatus === 'Dada de Baja (Cancelada)'"
            (click)="filterStatus = 'Dada de Baja (Cancelada)'">
            Citas canceladas ({{ hospitalService.dischargedAppointmentsCount() }})
          </button>
        </div>
      </div>

      <!-- Appointments Table / Cards -->
      <div class="appointments-list">
        @for (app of filteredAppointments; track app.id) {
          <div class="appointment-card" [class.baja-card]="app.status === 'Dada de Baja (Cancelada)'">
            <div class="app-left">
              <div class="date-badge" [class.date-baja]="app.status === 'Dada de Baja (Cancelada)'">
                <span class="time-txt">{{ app.appointmentTime }}</span>
                <span class="date-txt">{{ app.appointmentDate }}</span>
              </div>
            </div>

            <div class="app-center">
              <div class="patient-line">
                <span class="patient-title">{{ app.patientName }}</span>
                <span class="doc-badge">{{ app.patientDocument }}</span>
                <span class="app-id-pill">{{ app.id }}</span>
              </div>

              <div class="meta-row">
                <div class="meta-item">
                  <span class="meta-val"><strong>{{ app.doctorName }}</strong> ({{ app.doctorSpecialty }})</span>
                </div>
                <div class="meta-item">
                  <span class="meta-val">{{ app.roomName }}</span>
                </div>
                @if (app.shiftName) {
                  <div class="meta-item">
                    <span class="shift-badge-card">Turno {{ app.shiftName }}</span>
                  </div>
                }
              </div>

              <div class="reason-row">
                <span class="reason-lbl">Motivo de Consulta:</span>
                <span class="reason-val">{{ app.reason }}</span>
              </div>

              <!-- Cancellation details -->
              @if (app.status === 'Dada de Baja (Cancelada)') {
                <div class="discharge-record">
                  <div class="dis-head">
                    <span><strong>CITA CANCELADA</strong></span>
                  </div>
                  <div class="dis-grid">
                    <span><strong>Fecha de cancelación:</strong> {{ app.dischargeDate }}</span>
                    <span><strong>Responsable:</strong> {{ app.dischargeBy }}</span>
                    <span class="col-full"><strong>Motivo de cancelación:</strong> {{ app.dischargeReason }}</span>
                  </div>
                </div>
              }
            </div>

            <div class="app-right">
              <div class="status-indicator">
                @if (app.status === 'Programada') {
                  <span class="badge-prog">En Agenda</span>
                } @else if (app.status === 'Atendida') {
                  <span class="badge-atendida">Atendida</span>
                } @else {
                  <span class="badge-baja-cita">Cancelada</span>
                }
              </div>

              <div class="actions-group">
                @if (app.status === 'Programada' && canMarkAttendance && auth.user()?.email === assignedDoctorEmail(app.doctorId)) {
                  <button class="btn-reagendar" type="button" (click)="markAttended(app)">
                    <span>Registrar atención</span>
                  </button>
                }
                @if (app.status === 'Programada' && canManageAppointments) {
                  <button class="btn-reagendar" type="button" (click)="openEditCitaModal(app)">
                    <span>Editar Cita</span>
                  </button>
                  <button class="btn-dar-baja" (click)="openBajaCitaModal(app)">
                    <span>Cancelar Cita</span>
                  </button>
                } @else if (app.status === 'Dada de Baja (Cancelada)' && canManageAppointments) {
                  <button class="btn-reagendar" (click)="reactivateCita(app)">
                    <span>Restablecer Cita</span>
                  </button>
                }
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <h3>No hay citas para mostrar</h3>
            <p>Utilice el botón "Programar Cita Médica" para crear una nueva o cambie el filtro.</p>
          </div>
        }
      </div>

      <!-- MODAL: CANCELAR CITA -->
      @if (showBajaCitaModal && selectedAppForBaja) {
        <div class="modal-overlay">
          <div class="modal-content baja-modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header header-danger">
              <div class="modal-title-wrap">
                <span class="modal-danger-tag">CONTROL DE CITAS &bull; AEGIS SALUD</span>
                <h3>Cancelar Cita Médica</h3>
              </div>
              <button class="close-x" (click)="closeBajaCitaModal()">&times;</button>
            </div>

            <div class="patient-baja-summary">
              <div class="summary-line">
                <span>Paciente:</span>
                <strong>{{ selectedAppForBaja.patientName }} ({{ selectedAppForBaja.patientDocument }})</strong>
              </div>
              <div class="summary-line">
                <span>Cita Asignada:</span>
                <strong>{{ selectedAppForBaja.appointmentDate }} a las {{ selectedAppForBaja.appointmentTime }} hrs</strong>
              </div>
              <div class="summary-line">
                <span>Especialista & Sala:</span>
                <strong>{{ selectedAppForBaja.doctorName }} | {{ selectedAppForBaja.roomName }}</strong>
              </div>
            </div>

            <form (ngSubmit)="submitBajaCita()" class="modal-form" appFormDraft="citas:cancelacion" appFormValidation [appFormValidationError]="hospitalService.error() || records.storageError()" (appFormValidationDismiss)="hospitalService.clearError(); records.clearError()">
              <div class="form-group">
                <label>Causa o Motivo de la Baja del Paciente en la Cita *</label>
                <select [(ngModel)]="bajaReason" name="bajaReason" required>
                  <option value="" disabled selected>Seleccione causa de baja...</option>
                  <option value="Inasistencia injustificada del paciente">Inasistencia injustificada del paciente</option>
                  <option value="Cancelación solicitada por el paciente (Aviso previo)">Cancelación solicitada por el paciente (Aviso previo)</option>
                  <option value="Alta médica previa recibida en urgencias u hospitalización">Alta médica previa recibida en urgencias u hospitalización</option>
                  <option value="Paciente no cumple con preparación clínica / Ayuno">Paciente no cumple con preparación clínica / Ayuno</option>
                  <option value="Reprogramación por emergencia médica del hospital">Reprogramación por emergencia médica del hospital</option>
                  <option value="Traslado de centro médico o egreso voluntario">Traslado de centro médico o egreso voluntario</option>
                </select>
              </div>

              <div class="form-group">
                <label>Área o Personal que Ejecuta la Baja *</label>
                <input 
                  type="text" 
                  [(ngModel)]="dischargeBy" 
                  name="dischargeBy" 
                  required 
                  placeholder="Ej: Recepción Consulta Externa / Coordinación Aegis Salud" />
              </div>

              <div class="form-group">
                <label>Contraseña de confirmación *</label>
                <input type="password" [(ngModel)]="bajaConfirmPassword" [ngModelOptions]="{standalone: true}" required autocomplete="current-password" placeholder="Ingrese su contraseña para cancelar la cita" />
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeBajaCitaModal()">Cancelar</button>
                <button type="submit" class="btn-danger-confirm" [disabled]="!bajaReason || !bajaConfirmPassword">
                  <span>Confirmar Baja del Paciente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- MODAL: PROGRAMAR NUEVA CITA -->
      @if (showNuevaCitaModal) {
        <div class="modal-overlay">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-wrap">
                <span class="modal-tag">AGENDA DE CONSULTAS</span>
                <h3>{{ editingAppointmentId ? 'Editar Cita Médica' : 'Programar Cita Médica' }}</h3>
              </div>
              <button class="close-x" (click)="closeNuevaCitaModal()">&times;</button>
            </div>

            <form (ngSubmit)="submitNuevaCita()" class="modal-form" appFormDraft="citas:nueva" appFormValidation [appFormValidationError]="hospitalService.error() || records.storageError()" (appFormValidationDismiss)="hospitalService.clearError(); records.clearError()">
              <div class="form-group">
                <label for="appointment-patient">Seleccionar Paciente (Activo) *</label>
                <div class="patient-autocomplete">
                  <input type="hidden" [(ngModel)]="newAppointment.patientId" name="patientId" required />
                  <input id="appointment-patient" type="search" [(ngModel)]="patientSearch" name="patientSearch"
                    (ngModelChange)="onPatientSearchChange()"
                    (focus)="openPatientResults()"
                    (keydown.escape)="closePatientResults()"
                    placeholder="Buscar por nombre o documento" autocomplete="off" />
                  @if (patientResultsOpen) {
                    <div class="patient-results" role="listbox" aria-label="Pacientes encontrados">
                      @for (patient of patientOptions; track patient.id) {
                        <button type="button" class="patient-result"
                          role="option"
                          [class.selected]="newAppointment.patientId === patient.id"
                          (click)="selectPatient(patient)">
                          <strong>{{ patient.firstName }} {{ patient.lastName }}</strong>
                          <span>Doc: {{ patient.documentId }}</span>
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
                @if (patientAppointmentConflict) {
                  <p class="form-error" role="alert">Este paciente ya tiene una cita que se cruza con ese horario.</p>
                }
              </div>

              <div class="form-group">
                <label>Seleccionar Médico Especialista *</label>
                <select [(ngModel)]="newAppointment.doctorId" name="doctorId" required
                  (ngModelChange)="onDoctorOrDateChange(); refreshAppointmentSuggestions()">
                  <option value="" disabled selected>Seleccione médico...</option>
                  @for (d of activeDoctors; track d.id) {
                    <option [value]="d.id">{{ d.firstName }} {{ d.lastName }} ({{ d.specialty }} - Turno {{ d.shift }})</option>
                  }
                </select>
              </div>

              <!-- Consultorio auto-resuelto desde asignación diaria -->
              <div class="assignment-info-panel" [class.has-assignment]="resolvedAssignment" [class.no-assignment]="!resolvedAssignment">
                @if (resolvedAssignment) {
                  <div class="ai-row">
                    <span class="ai-label">Consultorio asignado:</span>
                    <span class="ai-value">{{ resolvedAssignment.roomCode }} — {{ resolvedAssignment.roomName }}</span>
                  </div>
                  <div class="ai-row">
                    <span class="ai-label">Turno:</span>
                    <span class="ai-value shift-pill">{{ resolvedAssignment.shiftLabel }}</span>
                  </div>
                  <div class="ai-row">
                    <span class="ai-label">Horario disponible:</span>
                    <span class="ai-value">{{ shiftTimeRange(resolvedAssignment.shift) }}</span>
                  </div>
                } @else if (newAppointment.doctorId && newAppointment.appointmentDate) {
                  <span class="ai-none">Sin asignación para esta fecha — el sistema asignará consultorio automáticamente.</span>
                } @else {
                  <span class="ai-hint">Seleccione un médico y fecha para ver el consultorio asignado.</span>
                }
              </div>

              <div class="form-row two-col">
                <div class="form-group">
                  <label>Fecha de la Cita *</label>
                  <input type="date" [(ngModel)]="newAppointment.appointmentDate" name="appointmentDate" required
                    [min]="today" (ngModelChange)="onDoctorOrDateChange(); refreshAppointmentSuggestions()" />
                </div>
                <div class="form-group">
                  <label>Hora de la Cita *</label>
                  <input type="time" [(ngModel)]="newAppointment.appointmentTime" name="appointmentTime" required
                    [min]="resolvedAssignment ? shiftStartTime(resolvedAssignment.shift) : ''"
                    [max]="resolvedAssignment ? shiftEndTime(resolvedAssignment.shift) : ''"
                    (ngModelChange)="refreshAppointmentSuggestions()" />
                </div>
              </div>

              @if (appointmentSuggestions.length) {
                <div class="availability-suggestions">
                  <div class="suggestions-header">
                    <strong>Alternativas disponibles</strong>
                    <span>Sin salir de esta ventana</span>
                  </div>
                  <div class="suggestions-list">
                    @for (suggestion of appointmentSuggestions; track suggestion.date + suggestion.time + suggestion.doctorId + suggestion.roomId) {
                      <button type="button" class="suggestion-item"
                        (click)="applySuggestion(suggestion)">
                        <strong>{{ suggestion.date }} · {{ suggestion.time }}</strong>
                        <span>{{ suggestion.doctorName }} — {{ suggestion.specialty }}</span>
                        <small>{{ suggestion.roomCode }} · {{ suggestion.roomName }}</small>
                      </button>
                    }
                  </div>
                </div>
              }

              <div class="form-group">
                <label for="appointment-reason">Motivo de la consulta *</label>
                <textarea 
                  id="appointment-reason"
                  [(ngModel)]="newAppointment.reason" 
                  name="reason" 
                  rows="3" 
                  required 
                  placeholder="Ej: Chequeo de rutina, control de glucosa, dolor precordial recurrente..."></textarea>
              </div>

              @if (doctorAppointmentConflict) {
                <p class="form-error" role="alert">El médico o consultorio ya tiene una cita programada en ese horario (choque de horario).</p>
              }

              @if (editingAppointmentId) {
                <div class="form-group">
                  <label for="appointment-confirm-password">Contraseña de confirmación *</label>
                  <input id="appointment-confirm-password" type="password" [(ngModel)]="citaConfirmPassword"
                    [ngModelOptions]="{standalone: true}" required autocomplete="current-password"
                    placeholder="Ingrese su contraseña para guardar cambios" />
                </div>
              }

              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeNuevaCitaModal()">Cancelar</button>
                <button type="submit" class="btn-primary" [disabled]="patientAppointmentConflict || doctorAppointmentConflict || (editingAppointmentId && !citaConfirmPassword)">
                  <span>{{ editingAppointmentId ? 'Guardar cambios de cita' : 'Agendar Cita Médica' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .citas-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .module-tag {
      font-size: 0.7rem;
      font-weight: 700;
      color: #8B1E1E;
      letter-spacing: 1px;
    }

    .page-title {
      font-size: 1.6rem;
      color: var(--primary-navy);
      margin: 0.2rem 0;
    }

    .page-desc {
      color: var(--text-secondary);
      font-size: 0.88rem;
    }

    /* Banner */
    .baja-info-banner {
      background: linear-gradient(135deg, #111e33 0%, #201313 100%);
      border-left: 5px solid #8B1E1E;
      border-radius: var(--radius-md);
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      color: #ffffff;
      box-shadow: var(--shadow-sm);
    }

    .banner-text {
      flex: 1;
    }

    .banner-text h4 {
      font-size: 1.05rem;
      color: #ffffff;
      margin-bottom: 0.25rem;
    }

    .banner-text p {
      font-size: 0.83rem;
      color: #cbd5e1;
      line-height: 1.45;
    }

    .banner-stats {
      display: flex;
      gap: 1rem;
    }

    .stat-box {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 0.6rem 1rem;
      text-align: center;
      min-width: 90px;
    }

    .stat-box.red-box {
      background: rgba(139, 30, 30, 0.4);
      border-color: rgba(239, 68, 68, 0.4);
    }

    .st-num {
      display: block;
      font-size: 1.4rem;
      font-weight: 800;
    }

    .st-lbl {
      font-size: 0.68rem;
      color: #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      background: #ffffff;
      padding: 0.85rem 1.25rem;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #f8fafc;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.4rem 0.8rem;
      width: 380px;
      max-width: 100%;
    }

    .search-input {
      border: none;
      background: transparent;
      outline: none;
      width: 100%;
      font-size: 0.85rem;
    }

    .filter-chips {
      display: flex;
      gap: 0.5rem;
    }

    .filter-chip {
      padding: 0.45rem 0.9rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      background: #f1f5f9;
      color: #475569;
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }

    .filter-chip.active {
      background: #111e33;
      color: #ffffff;
    }

    .filter-chip.active-chip.active {
      background: #059669;
      color: #ffffff;
    }

    .filter-chip.baja-chip.active {
      background: #8B1E1E;
      color: #ffffff;
    }

    /* Appointments List */
    .appointments-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .appointment-card {
      background: #ffffff;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      transition: all 0.2s ease;
    }

    .appointment-card:hover {
      box-shadow: var(--shadow-md);
      border-color: #cbd5e1;
    }

    .baja-card {
      background: #fffafa;
      border-left: 5px solid #8B1E1E;
    }

    .date-badge {
      background: #111e33;
      color: #ffffff;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 95px;
      text-align: center;
      border: 1px solid #1e293b;
    }

    .date-baja {
      background: #450a0a;
      border-color: #8B1E1E;
    }

    .time-txt {
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: 0.5px;
    }

    .date-txt {
      font-size: 0.72rem;
      color: #cbd5e1;
    }

    .app-center {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .patient-line {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .patient-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--primary-navy);
    }

    .doc-badge {
      background: #f1f5f9;
      color: #475569;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 600;
    }

    .app-id-pill {
      font-size: 0.7rem;
      color: #94a3b8;
    }

    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1.25rem;
      font-size: 0.82rem;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .meta-val {
      color: #334155;
    }

    .reason-row {
      font-size: 0.82rem;
      margin-top: 0.2rem;
    }

    .reason-lbl {
      color: #64748b;
      font-weight: 600;
      margin-right: 0.3rem;
    }

    .reason-val {
      color: #1e293b;
    }

    .discharge-record {
      margin-top: 0.65rem;
      background: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 0.65rem 0.85rem;
      font-size: 0.78rem;
      color: #7f1d1d;
    }

    .dis-head {
      margin-bottom: 0.35rem;
    }

    .dis-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.25rem 1rem;
    }

    .col-full {
      grid-column: 1 / -1;
    }

    .app-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.75rem;
      min-width: 170px;
    }

    .badge-prog {
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .badge-baja-cita {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .btn-dar-baja {
      background: #fff1f2;
      color: #9f1239;
      border: 1px solid #fecdd3;
      padding: 0.45rem 0.85rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.8rem;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .btn-dar-baja:hover {
      background: #8B1E1E;
      color: #ffffff;
      border-color: #8B1E1E;
    }

    .btn-reagendar {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 0.45rem 0.85rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.8rem;
      transition: all 0.2s ease;
    }

    .btn-reagendar:hover {
      background: #2563eb;
      color: #ffffff;
    }

    /* Modal Baja Info */
    .patient-baja-summary {
      background: #f8fafc;
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      font-size: 0.82rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .summary-line {
      display: flex;
      justify-content: space-between;
    }

    .summary-line span {
      color: #64748b;
    }

    /* Modals */
    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .modal-header.header-danger {
      border-bottom: 2px solid #8B1E1E;
      background: #fef2f2;
    }

    .modal-tag {
      font-size: 0.68rem;
      font-weight: 700;
      color: #8B1E1E;
      letter-spacing: 1px;
    }

    .modal-danger-tag {
      font-size: 0.68rem;
      font-weight: 700;
      color: #991b1b;
      letter-spacing: 1px;
    }

    .close-x {
      background: transparent;
      font-size: 1.5rem;
      line-height: 1;
      color: #64748b;
    }

    .modal-form {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
    }

    .form-group input, .form-group select, .form-group textarea {
      padding: 0.6rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.85rem;
      outline: none;
    }

    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
      border-color: #8B1E1E;
      box-shadow: 0 0 0 3px rgba(139, 30, 30, 0.12);
    }

    .form-row {
      display: grid;
      gap: 1rem;
    }

    .two-col {
      grid-template-columns: 1fr 1fr;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding-top: 1rem;
      border-top: 1px solid #f1f5f9;
    }

    .btn-danger-confirm {
      background: #8B1E1E;
      color: #ffffff;
      padding: 0.65rem 1.25rem;
      border-radius: var(--radius-md);
      font-weight: 600;
    }

    .badge-atendida { background: #dcfce7; color: #166534; border-radius: 999px; padding: .25rem .65rem; font-size: .75rem; font-weight: 700; }

    .empty-state {
      background: #ffffff;
      padding: 3rem;
      text-align: center;
      border-radius: 12px;
      border: 2px dashed #cbd5e1;
    }

    .form-error { color: #b42318; margin: .25rem 0; font-weight: 650; }
    .patient-autocomplete { position: relative; }
    .patient-results { position: absolute; z-index: 20; top: calc(100% + .25rem); left: 0; right: 0; max-height: 14rem; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 7px; background: white; box-shadow: 0 10px 24px rgba(15, 23, 42, .16); }
    .patient-result { display: grid; width: 100%; grid-template-columns: 1fr auto; align-items: center; gap: .75rem; border: 0; border-bottom: 1px solid #e2e8f0; background: white; padding: .65rem .75rem; text-align: left; cursor: pointer; }
    .patient-result:last-child { border-bottom: 0; }
    .patient-result:hover, .patient-result.selected { background: #fef2f2; }
    .patient-result strong { color: #1e293b; }
    .patient-result span { color: #64748b; font-size: .78rem; }
    .patient-no-results { margin: 0; padding: .75rem; color: #64748b; font-size: .82rem; }
    .availability-suggestions { border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 8px; padding: .75rem; }
    .suggestions-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .55rem; color: #1e3a5f; }
    .suggestions-header span { font-size: .72rem; color: #64748b; }
    .suggestions-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; max-height: 14rem; overflow: auto; }
    .suggestion-item { display: grid; gap: .15rem; text-align: left; border: 1px solid #dbeafe; border-radius: 7px; background: white; padding: .55rem .65rem; color: #1e293b; cursor: pointer; }
    .suggestion-item:hover { border-color: #2563eb; background: #f8fafc; }
    .suggestion-item strong { color: #1d4ed8; }
    .suggestion-item span { font-size: .78rem; }
    .suggestion-item small { color: #64748b; }

    /* Assignment info panel */
    .assignment-info-panel { border-radius: 8px; padding: .75rem 1rem; font-size: .83rem; border: 1px solid #cbd5e1; background: #f8fafc; display: flex; flex-direction: column; gap: .35rem; }
    .assignment-info-panel.has-assignment { border-color: #bbf7d0; background: #f0fdf4; }
    .assignment-info-panel.no-assignment { border-color: #fed7aa; background: #fff7ed; }
    .ai-row { display: flex; gap: .5rem; align-items: center; }
    .ai-label { font-weight: 600; color: #334155; min-width: 140px; }
    .ai-value { color: #15803d; font-weight: 600; }
    .shift-pill { background: #dcfce7; color: #15803d; border-radius: 999px; padding: .15rem .6rem; font-size: .78rem; }
    .ai-none { color: #9a3412; font-weight: 600; }
    .ai-hint { color: #64748b; font-style: italic; }

    /* Shift badge in appointment card */
    .shift-badge-card { display: inline-block; background: #e0f2fe; color: #0369a1; border-radius: 999px; padding: .15rem .5rem; font-size: .72rem; font-weight: 700; margin-left: .3rem; }

    @media (max-width: 768px) {
      .appointment-card {
        flex-direction: column;
        align-items: flex-start;
      }
      .app-right {
        width: 100%;
        align-items: flex-start;
      }
    }
  `]
})
export class CitasComponent implements OnDestroy {
  hospitalService = inject(HospitalService);
  drafts = inject(FormDraftService);
  readonly auth = inject(AuthService);
  readonly records = inject(OperationalRecordsService);

  searchQuery = '';
  filterStatus: 'TODOS' | 'Programada' | 'Atendida' | 'Dada de Baja (Cancelada)' = 'TODOS';
  readonly today = this.localDate();
  private availableRoomIds: string[] = [];
  private availabilityRequest = 0;
  appointmentSuggestions: AppointmentSuggestion[] = [];
  patientSearch = '';
  patientResultsOpen = false;
  private patientResultsTimeout?: number;

  resolvedAssignment: DoctorAssignmentRecord | null = null;

  showBajaCitaModal = false;
  selectedAppForBaja: Appointment | null = null;
  bajaReason = '';
  dischargeBy = 'Recepción Hospitalaria Aegis Salud';

  showNuevaCitaModal = false;
  newAppointment = {
    patientId: '',
    doctorId: '',
    roomId: '',
    appointmentDate: this.localDate(),
    appointmentTime: '10:00',
    reason: ''
  };

  get activePatients() {
    return this.hospitalService.patients().filter(p => p.status === 'Activo');
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
    this.newAppointment.patientId = '';
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
    this.newAppointment.patientId = patient.id;
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

  get patientAppointmentConflict(): boolean {
    const { patientId, appointmentDate, appointmentTime } = this.newAppointment;
    if (!patientId || !appointmentDate || !appointmentTime) return false;
    const startMinutes = this.timeInMinutes(appointmentTime);
    const endMinutes = startMinutes + 30;
    return this.hospitalService.appointments().some(appointment => {
      if (appointment.id === this.editingAppointmentId) return false;
      if (appointment.status !== 'Programada' || appointment.patientId !== patientId
        || appointment.appointmentDate !== appointmentDate) return false;
      const existingStart = this.timeInMinutes(appointment.appointmentTime);
      return startMinutes < existingStart + 30 && endMinutes > existingStart;
    });
  }

  get doctorAppointmentConflict(): boolean {
    const { doctorId, appointmentDate, appointmentTime } = this.newAppointment;
    if (!doctorId || !appointmentDate || !appointmentTime) return false;
    const startMinutes = this.timeInMinutes(appointmentTime);
    const endMinutes = startMinutes + 30;
    const targetRoomId = this.resolvedAssignment?.roomId
      || this.hospitalService.doctors().find(d => d.id === doctorId)?.assignedRoomId
      || '';
    return this.hospitalService.appointments().some(appointment => {
      if (appointment.id === this.editingAppointmentId) return false;
      if (appointment.status !== 'Programada' || appointment.appointmentDate !== appointmentDate) return false;
      if (appointment.doctorId !== doctorId && (!targetRoomId || appointment.roomId !== targetRoomId)) return false;
      const existingStart = this.timeInMinutes(appointment.appointmentTime);
      return startMinutes < existingStart + 30 && endMinutes > existingStart;
    });
  }

  get activeDoctors() {
    return this.hospitalService.doctors().filter(d => d.status === 'Activo');
  }

  get availableRooms() {
    return this.hospitalService.rooms().filter(r =>
      r.status === 'Disponible' && this.availableRoomIds.includes(r.id));
  }

  get canManageAppointments(): boolean {
    return this.auth.hasRole('admin', 'recepcion');
  }

  get canMarkAttendance(): boolean {
    return this.auth.hasRole('medico_general', 'especialista');
  }

  get filteredAppointments(): Appointment[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.hospitalService.appointments().filter(a => {
      const match =
        !q ||
        a.patientName.toLowerCase().includes(q) ||
        a.patientDocument.toLowerCase().includes(q) ||
        a.doctorName.toLowerCase().includes(q) ||
        a.doctorSpecialty.toLowerCase().includes(q) ||
        a.roomName.toLowerCase().includes(q);

      if (!match) return false;

      if (this.filterStatus !== 'TODOS') {
        return a.status === this.filterStatus;
      }
      return true;
    });
  }

  editingAppointmentId: string | null = null;
  citaConfirmPassword = '';
  bajaConfirmPassword = '';

  openNuevaCitaModal() {
    this.editingAppointmentId = null;
    this.citaConfirmPassword = '';
    this.patientSearch = '';
    this.resolvedAssignment = null;
    this.newAppointment = {
      patientId: '',
      doctorId: this.activeDoctors[0]?.id || '',
      roomId: '',
      appointmentDate: this.localDate(),
      appointmentTime: '10:00',
      reason: ''
    };
    this.showNuevaCitaModal = true;
    void this.onDoctorOrDateChange();
    void this.refreshAppointmentSuggestions();
  }

  openEditCitaModal(app: Appointment) {
    this.editingAppointmentId = app.id;
    this.citaConfirmPassword = '';
    this.patientSearch = app.patientName;
    this.newAppointment = {
      patientId: app.patientId,
      doctorId: app.doctorId,
      roomId: app.roomId,
      appointmentDate: app.appointmentDate,
      appointmentTime: app.appointmentTime.slice(0, 5),
      reason: app.reason
    };
    this.showNuevaCitaModal = true;
    void this.onDoctorOrDateChange();
    void this.refreshAppointmentSuggestions();
  }

  private timeInMinutes(value: string): number {
    const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  }

  closeNuevaCitaModal() {
    this.showNuevaCitaModal = false;
  }

  async submitNuevaCita() {
    if (!this.newAppointment.patientId || !this.newAppointment.doctorId || !this.newAppointment.reason) {
      this.hospitalService.reportError('Completa los campos obligatorios de la cita médica.');
      return;
    }

    const patient = this.hospitalService.patients().find(p => p.id === this.newAppointment.patientId);
    const doctor = this.hospitalService.doctors().find(d => d.id === this.newAppointment.doctorId);

    if (!patient || !doctor) {
      this.hospitalService.reportError('Los datos seleccionados no son válidos. Revísalos e inténtalo de nuevo.');
      return;
    }

    // Resolve room from assignment snapshot or fallback to doctor's assigned room
    const resolvedRoom = this.resolvedAssignment
      ? { id: this.resolvedAssignment.roomId, display: `${this.resolvedAssignment.roomCode} (${this.resolvedAssignment.roomName})` }
      : this.hospitalService.rooms().find(r => r.id === doctor.assignedRoomId)
        ? { id: doctor.assignedRoomId!, display: `${this.hospitalService.rooms().find(r => r.id === doctor.assignedRoomId)!.code} (${this.hospitalService.rooms().find(r => r.id === doctor.assignedRoomId)!.name})` }
        : null;

    const success = this.editingAppointmentId
      ? await this.hospitalService.updateAppointment(this.editingAppointmentId, {
          patientId: patient.id,
          doctorId: doctor.id,
          roomId: resolvedRoom?.id ?? '',
          appointmentDate: this.newAppointment.appointmentDate,
          appointmentTime: this.newAppointment.appointmentTime,
          reason: this.newAppointment.reason,
          confirmPassword: this.citaConfirmPassword
        })
      : await this.hospitalService.createAppointment({
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          patientDocument: patient.documentId,
          doctorId: doctor.id,
          doctorName: `${doctor.firstName} ${doctor.lastName}`,
          doctorSpecialty: doctor.specialty,
          roomId: resolvedRoom?.id ?? '',
          roomName: resolvedRoom?.display ?? 'Consultorio por asignar',
          appointmentDate: this.newAppointment.appointmentDate,
          appointmentTime: this.newAppointment.appointmentTime,
          reason: this.newAppointment.reason
        });

    if (success) {
      this.drafts.clear('citas:nueva');
      this.showNuevaCitaModal = false;
      this.editingAppointmentId = null;
      this.citaConfirmPassword = '';
      this.resolvedAssignment = null;
    }
  }

  assignedDoctorEmail(doctorId: string): string {
    return this.hospitalService.doctors().find(doctor => doctor.id === doctorId)?.email ?? '';
  }

  async refreshAppointmentSuggestions(): Promise<void> {
    if (!this.showNuevaCitaModal) return;
    this.appointmentSuggestions = await this.records.getAppointmentSuggestions({
      patientId: this.newAppointment.patientId || undefined,
      doctorId: this.newAppointment.doctorId || undefined,
      date: this.newAppointment.appointmentDate,
      startTime: this.newAppointment.appointmentTime,
    });
  }

  applySuggestion(suggestion: AppointmentSuggestion): void {
    this.newAppointment.appointmentDate = suggestion.date;
    this.newAppointment.appointmentTime = suggestion.time;
    this.newAppointment.doctorId = suggestion.doctorId;
    this.newAppointment.roomId = suggestion.roomId;
    this.availableRoomIds = [suggestion.roomId];
    this.appointmentSuggestions = [];
    this.onDoctorOrDateChange();
  }

  onDoctorOrDateChange(): void {
    const { doctorId, appointmentDate } = this.newAppointment;
    if (!doctorId || !appointmentDate) {
      this.resolvedAssignment = null;
      return;
    }
    this.resolvedAssignment = this.records.doctorAssignments().find(
      a => a.doctorId === doctorId && a.date === appointmentDate
    ) ?? null;
  }

  shiftTimeRange(shift: 'M' | 'T' | 'N'): string {
    const map: Record<string, string> = { M: '08:00 – 13:30', T: '14:00 – 19:30', N: '20:00 – 23:30' };
    return map[shift] ?? '';
  }

  shiftStartTime(shift: 'M' | 'T' | 'N'): string {
    const map: Record<string, string> = { M: '08:00', T: '14:00', N: '20:00' };
    return map[shift] ?? '';
  }

  shiftEndTime(shift: 'M' | 'T' | 'N'): string {
    const map: Record<string, string> = { M: '13:30', T: '19:30', N: '23:30' };
    return map[shift] ?? '';
  }

  async markAttended(appointment: Appointment): Promise<void> {
    await this.hospitalService.attendAppointment(appointment.id);
  }

  async refreshAvailableRooms(): Promise<void> {
    const requestId = ++this.availabilityRequest;
    const { appointmentDate, appointmentTime } = this.newAppointment;
    if (!appointmentDate || !appointmentTime || !this.newAppointment.doctorId) {
      this.availableRoomIds = [];
      this.newAppointment.roomId = '';
      return;
    }
    const [hour, minute] = appointmentTime.split(':').map(Number);
    const totalMinutes = hour * 60 + minute + 30;
    if (totalMinutes >= 24 * 60) {
      this.availableRoomIds = [];
      this.newAppointment.roomId = '';
      return;
    }
    const endTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
    const available = await this.records.getAvailability(appointmentDate, appointmentTime, endTime);
    if (requestId !== this.availabilityRequest || !available) return;
    const selectedDoctor = this.activeDoctors.find(doctor => doctor.id === this.newAppointment.doctorId);
    this.availableRoomIds = available
      .filter(room => room.isAvailable && (
        room.doctors.some(doctor => doctor.doctorId === this.newAppointment.doctorId)
        || selectedDoctor?.assignedRoomId === room.id
      ))
      .map(room => room.id);
    if (!this.availableRoomIds.includes(this.newAppointment.roomId)) {
      this.newAppointment.roomId = this.availableRoomIds[0] ?? '';
    }
  }

  openBajaCitaModal(app: Appointment) {
    this.selectedAppForBaja = app;
    this.bajaReason = '';
    this.bajaConfirmPassword = '';
    this.dischargeBy = 'Recepción Hospitalaria Aegis Salud';
    this.showBajaCitaModal = true;
  }

  closeBajaCitaModal() {
    this.showBajaCitaModal = false;
    this.selectedAppForBaja = null;
    this.bajaConfirmPassword = '';
  }

  async submitBajaCita() {
    if (!this.selectedAppForBaja || !this.bajaReason || !this.bajaConfirmPassword) return;
    const success = await this.hospitalService.dischargeAppointmentPatient(
      this.selectedAppForBaja.id,
      this.bajaReason,
      this.dischargeBy,
      this.bajaConfirmPassword
    );
    if (success) {
      this.drafts.clear('citas:cancelacion');
      this.closeBajaCitaModal();
    }
  }

  async reactivateCita(app: Appointment) {
    if (confirm(`¿Restablecer la cita médica para el paciente ${app.patientName}?`)) {
      await this.hospitalService.reactivateAppointment(app.id);
    }
  }

  private localDate(): string {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
