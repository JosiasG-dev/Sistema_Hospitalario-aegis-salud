import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { HospitalService } from '../../services/hospital.service';
import {
  AvailabilityEntry,
  DoctorAssignmentRecord,
  DoctorHistory,
  DemandMetrics,
  DemandRotationResult,
  OperationalRecordsService,
} from '../../services/operational-records.service';

const SHIFTS: Array<{ key: 'M' | 'T' | 'N'; label: string; range: string; color: string }> = [
  { key: 'M', label: 'Mañana',  range: '08:00–14:00', color: '#fef3c7' },
  { key: 'T', label: 'Tarde',   range: '14:00–20:00', color: '#ede9fe' },
  { key: 'N', label: 'Noche',   range: '20:00–08:00', color: '#e0f2fe' },
];

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <section class="module-page operational-module">
      <header class="module-heading">
        <div>
          <span class="module-kicker">ASIGNACIÓN DE PERSONAL Y ESPACIOS</span>
          <h2>Agenda y disponibilidad</h2>
          <p>Matriz de asignación diaria de médicos, rotación por demanda y búsqueda de consultorios.</p>
        </div>
      </header>

      <!-- ── Summary Stats ── -->
      <div class="operational-summary" aria-label="Resumen de asignaciones">
        <article class="operational-stat">
          <span>Asignaciones esta semana</span>
          <strong>{{ weekAssignments.length }}</strong>
        </article>
        <article class="operational-stat warn" [class.warn-active]="unassignedTodayCount > 0">
          <span>Sin asignación hoy</span>
          <strong>{{ unassignedTodayCount }}</strong>
        </article>
        <article class="operational-stat">
          <span>Turno con mayor demanda</span>
          <strong>{{ demandMetrics ? shiftLabel(demandMetrics.highestDemand) : '—' }}</strong>
        </article>
        <article class="operational-stat">
          <span>Consultorios disponibles</span>
          <strong>{{ hospital.availableRoomsCount() }}</strong>
        </article>
      </div>

      <!-- ── Week Range Picker ── -->
      <div class="week-nav">
        <button class="nav-btn" type="button" (click)="shiftWeek(-1)">‹ Semana anterior</button>
        <span class="week-label">{{ weekStart }} – {{ weekEnd }}</span>
        <button class="nav-btn" type="button" (click)="shiftWeek(1)">Semana siguiente ›</button>
        <button class="nav-btn today-btn" type="button" (click)="goToday()">Hoy</button>
      </div>

      <!-- ── Rotation Matrix ── -->
      <section class="module-panel matrix-panel">
        <h3>Matriz de Asignación · Turno × Fecha</h3>
        <div class="matrix-scroll">
          <table class="matrix-table">
            <thead>
              <tr>
                <th class="th-turno">Turno</th>
                @for (day of weekDays; track day.date) {
                  <th [class.th-today]="day.date === today">
                    <div class="th-day-name">{{ day.name }}</div>
                    <div class="th-day-date">{{ day.date | slice:5 }}</div>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (shift of shifts; track shift.key) {
                <tr>
                  <td class="td-shift" [style.background]="shift.color">
                    <span class="shift-key">{{ shift.key }}</span>
                    <span class="shift-name">{{ shift.label }}</span>
                    <small>{{ shift.range }}</small>
                  </td>
                  @for (day of weekDays; track day.date) {
                    <td class="td-cell" [class.td-today]="day.date === today" [class.td-past]="day.date < today">
                      @let cells = getAssignments(day.date, shift.key);
                      <div class="cell-list">
                        @for (cell of cells; track cell.id) {
                          <div class="cell-assigned" (click)="selectCell(day.date, shift.key, cell)">
                            <span class="cell-doctor">{{ cell.doctorName }}</span>
                            <span class="cell-room">{{ cell.roomCode }}</span>
                          </div>
                        } @empty {
                          @if (!canManage || day.date < today) {
                            <span class="no-assign">—</span>
                          }
                        }
                        @if (canManage && day.date >= today) {
                          <button class="btn-assign-cell" type="button"
                            (click)="openAssignForm(day.date, shift.key)">+ Asignar</button>
                        }
                      </div>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- ── Demand Panel (selected date) ── -->
      @if (demandMetrics) {
        <section class="module-panel demand-panel">
          <div class="demand-header">
            <div class="demand-title-row">
              <h3>Métricas de demanda</h3>
              <input type="date" [(ngModel)]="selectedDate" name="selectedDate" [min]="today"
                (ngModelChange)="loadDemandMetrics()" class="demand-date-input" />
            </div>
            @if (canManage) {
              <button class="btn-rotate" type="button" (click)="runRotation()" [disabled]="rotationLoading">
                @if (rotationLoading) { <span>Rotando…</span> } @else { <span>⟳ Rotar por demanda</span> }
              </button>
            }
          </div>
          <div class="demand-bars">
            @for (shift of shifts; track shift.key) {
              <div class="demand-bar-item">
                <div class="demand-bar-label">
                  <span class="shift-badge" [style.background]="shift.color">{{ shift.key }}</span>
                  {{ shift.label }}
                </div>
                <div class="demand-bar-track">
                  <div class="demand-bar-fill" [style.width]="demandPct(shift.key) + '%'" [style.background]="shift.key === demandMetrics.highestDemand ? '#8b1e1e' : '#94a3b8'"></div>
                </div>
                <div class="demand-bar-nums">
                  <span>{{ demandMetrics.appointmentsByShift[shift.key] ?? 0 }} citas</span>
                  <span>{{ demandMetrics.doctorsByShift[shift.key] ?? 0 }} méd.</span>
                </div>
              </div>
            }
          </div>
          @if (rotationResult) {
            <div class="rotation-result">
              <strong>Resultado de rotación:</strong> {{ rotationResult.rotatedCount }} médico(s) reasignado(s) hacia el turno {{ shiftLabel(rotationResult.highestDemandShift) }}.
              <ul>
                @for (line of rotationResult.log; track line) { <li>{{ line }}</li> }
              </ul>
            </div>
          }
        </section>
      }

      <!-- ── Assignment Form (admin) ── -->
      @if (canManage) {
        <section class="module-panel">
          <h3>Asignar médico a turno y consultorio</h3>
          <form class="module-form-grid" appFormDraft="agenda:asignacion" appFormValidation
            [appFormValidationError]="records.storageError()" (appFormValidationDismiss)="records.clearError()"
            (ngSubmit)="submitAssignment()">
            <div class="module-field">
              <label>Médico *</label>
              <select [(ngModel)]="assignForm.doctorId" name="doctorId" required>
                <option value="" disabled>Seleccione médico</option>
                @for (doctor of activeDoctors; track doctor.id) {
                  <option [value]="doctor.id">{{ doctor.firstName }} {{ doctor.lastName }} — {{ doctor.specialty }}</option>
                }
              </select>
            </div>
            <div class="module-field">
              <label>Consultorio *</label>
              <select [(ngModel)]="assignForm.roomId" name="roomId" required>
                <option value="" disabled>Seleccione consultorio</option>
                @for (room of activeRooms; track room.id) {
                  <option [value]="room.id">{{ room.code }} — {{ room.name }}</option>
                }
              </select>
            </div>
            <div class="module-field">
              <label>Fecha *</label>
              <input type="date" [(ngModel)]="assignForm.date" name="date" required [min]="today" />
            </div>
            <div class="module-field">
              <label>Turno *</label>
              <div class="shift-radios">
                @for (shift of shifts; track shift.key) {
                  <label class="shift-radio-label" [style.background]="assignForm.shift === shift.key ? shift.color : '#f8fafc'">
                    <input type="radio" [(ngModel)]="assignForm.shift" name="shift" [value]="shift.key" required />
                    <span>{{ shift.key }} · {{ shift.label }}<small> {{ shift.range }}</small></span>
                  </label>
                }
              </div>
            </div>
            <div class="module-field full-col">
              <label>Motivo / Notas</label>
              <input type="text" [(ngModel)]="assignForm.changeReason" name="changeReason"
                placeholder="Ej: Ajuste por alta afluencia matutina" />
            </div>
            <div class="full-col">
              <button class="module-submit" type="submit">Guardar asignación</button>
            </div>
          </form>
        </section>
      }

      <!-- ── Room Reservations ── -->
      @if (canManage) {
        <section class="module-panel">
          <h3>Reservas de Consultorios</h3>
          <form class="module-form-grid" appFormDraft="agenda:reserva" appFormValidation
            [appFormValidationError]="records.storageError()" (appFormValidationDismiss)="records.clearError()"
            (ngSubmit)="submitReservation()">
            <div class="module-field">
              <label>Consultorio *</label>
              <select [(ngModel)]="reservationForm.roomId" name="resRoomId" required>
                <option value="" disabled>Seleccione consultorio</option>
                @for (room of activeRooms; track room.id) {
                  <option [value]="room.id">{{ room.code }} — {{ room.name }}</option>
                }
              </select>
            </div>
            <div class="module-field">
              <label>Título / Propósito *</label>
              <input type="text" [(ngModel)]="reservationForm.title" name="resTitle" required
                placeholder="Ej: Jornada de vacunación" />
            </div>
            <div class="module-field">
              <label>Inicio *</label>
              <input type="datetime-local" [(ngModel)]="reservationForm.startsAt" name="resStart" required />
            </div>
            <div class="module-field">
              <label>Fin *</label>
              <input type="datetime-local" [(ngModel)]="reservationForm.endsAt" name="resEnd" required />
            </div>
            <div class="module-field full-col">
              <label>Motivo *</label>
              <input type="text" [(ngModel)]="reservationForm.reason" name="resReason" required
                placeholder="Ej: Bloqueo temporal por mantenimiento de equipos" />
            </div>
            <div class="full-col">
              <button class="module-submit" type="submit">Crear reserva</button>
            </div>
          </form>
        </section>
      }

      <!-- ── Doctor History ── -->
      @if (canManage) {
        <section class="module-panel">
          <h3>Historial de atención y horarios</h3>
          <p class="module-muted">Consulta las atenciones registradas por médico en la fecha elegida.</p>
          <div class="module-form-grid">
            <div class="module-field">
              <label for="doctor-history-doctor">Médico *</label>
              <select id="doctor-history-doctor" [(ngModel)]="historyDoctorId" name="historyDoctorId" required>
                <option value="" disabled>Seleccione médico</option>
                @for (doctor of hospital.doctors(); track doctor.id) {
                  <option [value]="doctor.id">{{ doctor.firstName }} {{ doctor.lastName }} — {{ doctor.specialty }}</option>
                }
              </select>
            </div>
            <div class="module-field">
              <label for="doctor-history-date">Día del historial *</label>
              <input id="doctor-history-date" type="date" [(ngModel)]="historyDate" name="historyDate" required />
            </div>
          </div>
          <button type="button" class="module-submit" (click)="loadDoctorHistory()">Consultar historial</button>
          @if (history) {
            <div class="history-results">
              <h4>{{ history.doctor.firstName }} {{ history.doctor.lastName }} · {{ history.date }}</h4>
              <h5>Asignación diaria de consultorio y turno</h5>
              <div class="module-records">
                @for (asg of history.assignments ?? []; track asg.id) {
                  <article class="module-record">
                    <strong>{{ asg.shiftLabel }}</strong>
                    <p>Consultorio: {{ asg.roomName }}@if (asg.changeReason) { · {{ asg.changeReason }} }</p>
                  </article>
                } @empty {
                  <p class="module-muted">Sin asignación diaria registrada para esta fecha.</p>
                }
              </div>
              <h5>Citas y atenciones</h5>
              <div class="module-records">
                @for (visit of history.appointments; track visit.id) {
                  <article class="module-record">
                    <strong>{{ visit.appointmentTime }} · {{ visit.patientName }}</strong>
                    <p>Consultorio: {{ visit.roomName }} · {{ visit.status ?? 'Atendida' }}@if (visit.attendedAt) { · Atención: {{ visit.attendedAt | date:'shortTime' }} }</p>
                  </article>
                } @empty {
                  <p class="module-muted">No hay citas o atenciones registradas para esta fecha.</p>
                }
              </div>
              <h5>Horario y consultorios asignados</h5>
              <div class="module-records">
                @for (schedule of history.schedules; track schedule.dayOfWeek + schedule.startTime) {
                  <article class="module-record">
                    <strong>{{ schedule.startTime }}–{{ schedule.endTime }} · {{ schedule.shift }}</strong>
                    <p>Consultorio: {{ schedule.roomName }} · Registrado: {{ schedule.recordedAt | date:'short' }}</p>
                  </article>
                } @empty {
                  <p class="module-muted">Sin asignación de horario registrada para esa fecha.</p>
                }
              </div>
            </div>
          }
        </section>
      }

      <!-- ── Availability Search ── -->
      <section class="module-panel">
        <h3>Búsqueda de consultorios por horario</h3>
        <div class="module-form-grid">
          <div class="module-field">
            <label for="availability-date">Fecha</label>
            <input id="availability-date" type="date" [(ngModel)]="availabilityDate" name="availabilityDate"
              (ngModelChange)="searchAvailability()" />
          </div>
          <div class="module-field">
            <label for="availability-start">Desde</label>
            <input id="availability-start" type="time" [(ngModel)]="availabilityStart" name="availabilityStart"
              (ngModelChange)="searchAvailability()" />
          </div>
          <div class="module-field">
            <label for="availability-end">Hasta</label>
            <input id="availability-end" type="time" [(ngModel)]="availabilityEnd" name="availabilityEnd"
              (ngModelChange)="searchAvailability()" />
          </div>
        </div>
        <button type="button" class="module-submit" (click)="searchAvailability()">Actualizar disponibilidad</button>
        <div class="module-records">
          @for (room of availability; track room.id) {
            <article class="module-record">
              <div class="module-record-head">
                <h3>{{ room.code }} — {{ room.name }}</h3>
                <span class="module-badge" [class.availability-free]="room.isAvailable">
                  {{ room.isAvailable ? 'Libre' : 'Con cita asignada' }}
                </span>
              </div>
              @for (doctor of room.doctors; track doctor.doctorId) {
                <p><strong>{{ doctor.doctorName }}</strong> · {{ doctor.specialty }} ·
                  {{ doctor.startTime }}–{{ doctor.endTime }} ({{ doctor.shift }})</p>
              } @empty {
                <p class="module-muted">Sin médico asignado en este rango.</p>
              }
            </article>
          } @empty {
            <div class="module-empty">Seleccione un rango para consultar los consultorios disponibles.</div>
          }
        </div>
      </section>
    </section>

    <!-- ── Cell Detail Overlay ── -->
    @if (selectedCellAssignment) {
      <div class="modal-overlay" (click)="selectedCellAssignment = null">
        <div class="modal-content cell-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Asignación del {{ selectedCellDate }} · Turno {{ selectedCellShift }}</h3>
            <button class="close-x" (click)="selectedCellAssignment = null">&times;</button>
          </div>
          <div class="cell-detail">
            <p><strong>Médico:</strong> {{ selectedCellAssignment.doctorName }}</p>
            <p><strong>Especialidad:</strong> {{ selectedCellAssignment.doctorSpecialty }}</p>
            <p><strong>Consultorio:</strong> {{ selectedCellAssignment.roomCode }} — {{ selectedCellAssignment.roomName }}</p>
            <p><strong>Turno:</strong> {{ selectedCellAssignment.shiftLabel }}</p>
            @if (selectedCellAssignment.changeReason) {
              <p><strong>Motivo:</strong> {{ selectedCellAssignment.changeReason }}</p>
            }
          </div>
          @if (canManage && selectedCellDate >= today) {
            <div class="cell-modal-footer">
              <button class="module-submit" type="button" (click)="preloadEdit(selectedCellAssignment)">
                Editar / Reasignar
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .matrix-panel { overflow: hidden; }
    .matrix-scroll { overflow-x: auto; }
    .matrix-table { width: 100%; border-collapse: collapse; min-width: 640px; }
    .matrix-table th, .matrix-table td { border: 1px solid #e2e8f0; padding: .5rem .6rem; }
    .matrix-table thead th { background: #f8fafc; font-size: .78rem; text-align: center; }
    .th-turno { width: 110px; }
    .th-today { background: #fff7ed !important; border-bottom: 3px solid #f97316 !important; }
    .th-day-name { font-weight: 700; color: #1e293b; }
    .th-day-date { font-size: .72rem; color: #64748b; }
    .td-shift { text-align: center; vertical-align: middle; }
    .shift-key { display: block; font-size: 1.3rem; font-weight: 800; color: #1e293b; }
    .shift-name { display: block; font-size: .78rem; font-weight: 700; }
    .td-shift small { display: block; font-size: .68rem; color: #64748b; }
    .td-cell { vertical-align: top; min-width: 110px; }
    .td-today { background: #fff7ed; }
    .td-past { opacity: .7; }
    .cell-list { display: flex; flex-direction: column; gap: .3rem; }
    .cell-assigned { background: #f0fdf4; border-radius: 6px; padding: .4rem .5rem; cursor: pointer; border: 1px solid #bbf7d0; }
    .cell-assigned:hover { border-color: #22c55e; }
    .cell-doctor { display: block; font-size: .78rem; font-weight: 700; color: #15803d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
    .cell-room { display: block; font-size: .7rem; color: #64748b; }
    .cell-empty { text-align: center; padding: .5rem 0; }
    .btn-assign-cell { font-size: .72rem; color: #8b1e1e; border: 1px dashed #fca5a5; border-radius: 5px; padding: .25rem .4rem; background: #fff; cursor: pointer; }
    .btn-assign-cell:hover { background: #fef2f2; }
    .no-assign { color: #cbd5e1; font-size: .82rem; }
    .week-nav { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .week-label { flex: 1; text-align: center; font-weight: 700; color: #334155; }
    .nav-btn { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: .4rem .9rem; cursor: pointer; font-size: .82rem; }
    .nav-btn:hover { background: #e2e8f0; }
    .today-btn { color: #8b1e1e; border-color: #fca5a5; background: #fff1f2; }
    .demand-panel { background: #fafafa; }
    .demand-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: .75rem; flex-wrap: wrap; }
    .demand-title-row { display: flex; align-items: center; gap: .75rem; }
    .demand-date-input { padding: .3rem .55rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: .82rem; }
    .demand-bars { display: grid; gap: .75rem; }
    .demand-bar-item { display: grid; grid-template-columns: 100px 1fr 110px; align-items: center; gap: .75rem; }
    .demand-bar-label { display: flex; align-items: center; gap: .4rem; font-size: .82rem; font-weight: 600; }
    .shift-badge { display: inline-block; width: 1.5rem; height: 1.5rem; border-radius: 50%; text-align: center; line-height: 1.5rem; font-size: .72rem; font-weight: 800; }
    .demand-bar-track { background: #f1f5f9; border-radius: 999px; height: 10px; overflow: hidden; }
    .demand-bar-fill { height: 100%; border-radius: 999px; transition: width .4s; }
    .demand-bar-nums { font-size: .75rem; color: #64748b; display: flex; gap: .4rem; }
    .btn-rotate { background: #8b1e1e; color: #fff; border: none; border-radius: 6px; padding: .5rem 1rem; cursor: pointer; font-weight: 700; }
    .btn-rotate:disabled { opacity: .6; cursor: default; }
    .rotation-result { margin-top: .75rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: .75rem; font-size: .82rem; }
    .rotation-result ul { margin: .4rem 0 0 1rem; padding: 0; }
    .shift-radios { display: flex; gap: .5rem; flex-wrap: wrap; }
    .shift-radio-label { display: flex; align-items: center; gap: .4rem; border: 1px solid #cbd5e1; border-radius: 7px; padding: .4rem .75rem; cursor: pointer; font-size: .82rem; transition: all .15s; }
    .shift-radio-label input { accent-color: #8b1e1e; }
    .shift-radio-label small { display: block; font-size: .68rem; color: #64748b; }
    .full-col { grid-column: 1 / -1; }
    .warn-active strong { color: #dc2626; }
    .history-results { display: grid; gap: .75rem; margin-top: 1rem; }
    .history-results h4, .history-results h5 { margin: .25rem 0; color: #334155; }
    .module-quick-action { border: 1px solid #cbd5e1; border-radius: .45rem; background: #fff; padding: .5rem .7rem; color: #334155; cursor: pointer; font-weight: 650; }
    .availability-free { background: #dcfce7; color: #166534; }
    .cell-modal { max-width: 420px; }
    .cell-detail { padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: .5rem; }
    .cell-detail p { margin: 0; font-size: .88rem; }
    .cell-modal-footer { padding: .75rem 1.5rem; border-top: 1px solid #f1f5f9; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; z-index: 50; }
    .modal-content { background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.2); width: 95%; max-width: 580px; overflow: hidden; }
    .modal-header { padding: 1rem 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
    .close-x { background: transparent; font-size: 1.5rem; line-height: 1; color: #64748b; cursor: pointer; border: none; }
  `]
})
export class AgendaComponent implements OnInit {
  @ViewChild(FormDraftDirective) draft?: FormDraftDirective;
  readonly hospital = inject(HospitalService);
  readonly records = inject(OperationalRecordsService);
  readonly auth = inject(AuthService);

  readonly shifts = SHIFTS;
  readonly today = this.localDate();

  // Week navigation
  private weekOffset = 0;
  get weekStart(): string { return this.calcWeekStart(this.weekOffset); }
  get weekEnd(): string {
    const d = new Date(this.weekStart + 'T12:00:00');
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }
  get weekDays(): Array<{ date: string; name: string }> {
    const result: Array<{ date: string; name: string }> = [];
    const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const start = new Date(this.weekStart + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      result.push({ date: d.toISOString().slice(0, 10), name: names[d.getDay()] });
    }
    return result;
  }

  // Computed assignment data
  get weekAssignments(): DoctorAssignmentRecord[] {
    return this.records.doctorAssignments().filter(
      a => a.date >= this.weekStart && a.date <= this.weekEnd
    );
  }

  get unassignedTodayCount(): number {
    const assignedToday = new Set(
      this.records.doctorAssignments().filter(a => a.date === this.today).map(a => a.doctorId)
    );
    return this.activeDoctors.filter(d => !assignedToday.has(d.id)).length;
  }

  getAssignments(date: string, shift: 'M' | 'T' | 'N'): DoctorAssignmentRecord[] {
    return this.records.doctorAssignments().filter(a => a.date === date && a.shift === shift);
  }

  // Selected date demand metrics
  selectedDate = this.today;
  demandMetrics: DemandMetrics | null = null;
  rotationResult: DemandRotationResult | null = null;
  rotationLoading = false;

  // Cell selection
  selectedCellDate = '';
  selectedCellShift: 'M' | 'T' | 'N' | '' = '';
  selectedCellAssignment: DoctorAssignmentRecord | null = null;

  // Assignment form
  assignForm = { doctorId: '', roomId: '', date: this.today, shift: 'M' as 'M' | 'T' | 'N', changeReason: '' };

  // Reservation form
  reservationForm = { roomId: '', title: '', reason: '', startsAt: '', endsAt: '' };

  // History
  historyDoctorId = '';
  historyDate = this.yesterday;
  history: DoctorHistory | null = null;

  // Availability
  availabilityDate = this.today;
  availabilityStart = '08:00';
  availabilityEnd = '09:00';
  availability: AvailabilityEntry[] = [];
  private availabilityRequest = 0;

  async ngOnInit(): Promise<void> {
    this.historyDoctorId = this.hospital.doctors()[0]?.id ?? '';
    await this.loadDemandMetrics();
    if (this.canManage && this.historyDoctorId) void this.loadDoctorHistory();
  }

  get yesterday(): string {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  get canManage(): boolean { return this.auth.hasRole('admin'); }
  get activeDoctors() { return this.hospital.doctors().filter(d => d.status === 'Activo'); }
  get activeRooms() { return this.hospital.rooms().filter(r => r.status !== 'Dado de Baja'); }

  shiftLabel(key: string): string {
    return SHIFTS.find(s => s.key === key)?.label ?? key;
  }

  demandPct(shift: 'M' | 'T' | 'N'): number {
    if (!this.demandMetrics) return 0;
    const total = Object.values(this.demandMetrics.appointmentsByShift).reduce((a, b) => a + b, 0);
    return total === 0 ? 0 : Math.round(((this.demandMetrics.appointmentsByShift[shift] ?? 0) / total) * 100);
  }

  shiftWeek(dir: -1 | 1): void { this.weekOffset += dir; }
  goToday(): void { this.weekOffset = 0; }

  selectCell(date: string, shift: 'M' | 'T' | 'N', assignment: DoctorAssignmentRecord): void {
    this.selectedCellDate = date;
    this.selectedCellShift = shift;
    this.selectedCellAssignment = assignment;
  }

  openAssignForm(date: string, shift: 'M' | 'T' | 'N'): void {
    this.assignForm.date = date;
    this.assignForm.shift = shift;
    document.querySelector('form[appFormDraft="agenda:asignacion"]')?.scrollIntoView({ behavior: 'smooth' });
  }

  preloadEdit(assignment: DoctorAssignmentRecord): void {
    this.assignForm = {
      doctorId: assignment.doctorId,
      roomId: assignment.roomId,
      date: assignment.date,
      shift: assignment.shift,
      changeReason: '',
    };
    this.selectedCellAssignment = null;
    document.querySelector('form[appFormDraft="agenda:asignacion"]')?.scrollIntoView({ behavior: 'smooth' });
  }

  async submitAssignment(): Promise<void> {
    const { doctorId, roomId, date, shift, changeReason } = this.assignForm;
    if (!doctorId || !roomId || !date || !shift) {
      this.records.storageError.set('Completa todos los campos obligatorios de la asignación.');
      return;
    }
    const ok = await this.records.storeDoctorAssignment({ doctorId, roomId, date, shift, changeReason });
    if (ok) {
      this.draft?.clearDraft();
      this.assignForm = { doctorId: '', roomId: '', date: this.today, shift: 'M', changeReason: '' };
      await this.records.fetchDoctorAssignments({ startDate: this.weekStart, endDate: this.weekEnd });
      await this.loadDemandMetrics();
    }
  }

  async submitReservation(): Promise<void> {
    const { roomId, title, reason, startsAt, endsAt } = this.reservationForm;
    if (!roomId || !title || !reason || !startsAt || !endsAt) {
      this.records.storageError.set('Completa todos los campos obligatorios de la reserva.');
      return;
    }
    const ok = await this.records.createRoomReservation({ roomId, title, reason, startsAt, endsAt });
    if (ok) {
      this.reservationForm = { roomId: '', title: '', reason: '', startsAt: '', endsAt: '' };
    }
  }

  async runRotation(): Promise<void> {
    if (!this.selectedDate) return;
    this.rotationLoading = true;
    this.rotationResult = null;
    const result = await this.records.rotateDoctorAssignments({ date: this.selectedDate, reason: 'Rotación automática por demanda' });
    this.rotationLoading = false;
    if (result) {
      this.rotationResult = result;
      await this.loadDemandMetrics();
    }
  }

  async loadDemandMetrics(): Promise<void> {
    this.demandMetrics = await this.records.getDemandMetrics(this.selectedDate);
  }

  async loadDoctorHistory(): Promise<void> {
    if (!this.historyDoctorId || !this.historyDate) { this.history = null; return; }
    this.history = await this.records.getDoctorHistory(this.historyDoctorId, this.historyDate);
  }

  async searchAvailability(): Promise<void> {
    if (!this.availabilityDate || !this.availabilityStart || !this.availabilityEnd ||
      this.availabilityStart >= this.availabilityEnd) {
      this.availability = [];
      return;
    }
    const requestId = ++this.availabilityRequest;
    const result = await this.records.getAvailability(this.availabilityDate, this.availabilityStart, this.availabilityEnd);
    if (requestId === this.availabilityRequest && result) this.availability = result;
  }

  private calcWeekStart(offset: number): string {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
    return new Date(monday.getTime() - monday.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private localDate(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
