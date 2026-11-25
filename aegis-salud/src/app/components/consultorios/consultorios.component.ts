import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HospitalService, NurseAccount } from '../../services/hospital.service';
import { Room } from '../../models/room.model';
import { MEDICAL_SPECIALTIES } from '../../models/medical-specialties';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { AuthService } from '../../services/auth.service';
import { OperationalRecordsService, RoomReservation } from '../../services/operational-records.service';
import { AuditLog } from '../../models/audit-log.model';

@Component({
  selector: 'app-consultorios',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <div class="consultorios-page">
      <!-- Section Header -->
      <div class="page-header">
        <div class="title-group">
          <span class="module-tag">INFRAESTRUCTURA HOSPITALARIA</span>
          <h2 class="page-title">Gestión de Consultorios: Altas, Bajas y Disponibilidad</h2>
          <p class="page-desc">
            Administración física de consultorios clínicos, quirófanos menores, pabellones y retiro de servicio.
          </p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" (click)="openAltaModal()">
            <span>Registrar Consultorio</span>
          </button>
        </div>
      </div>
      <!-- Filters & Status -->
      <div class="filter-bar">
        <div class="search-box">
          <input 
            type="text" 
            placeholder="Buscar por código, nombre o especialidad..." 
            [(ngModel)]="searchQuery" 
            class="search-input" />
        </div>

        <div class="filter-chips">
          <button 
            class="filter-chip" 
            [class.active]="filterStatus === 'TODOS'"
            (click)="filterStatus = 'TODOS'">
            Todos ({{ hospitalService.rooms().length }})
          </button>
          <button 
            class="filter-chip active-chip" 
            [class.active]="filterStatus === 'Disponible'"
            (click)="filterStatus = 'Disponible'">
            Disponibles ({{ hospitalService.availableRoomsCount() }})
          </button>
          <button 
            class="filter-chip occupied-chip" 
            [class.active]="filterStatus === 'Ocupado'"
            (click)="filterStatus = 'Ocupado'">
            Ocupados ({{ roomStatusCount('Ocupado') }})
          </button>
          <button 
            class="filter-chip maint-chip" 
            [class.active]="filterStatus === 'En Mantenimiento'"
            (click)="filterStatus = 'En Mantenimiento'">
            Mantenimiento ({{ roomStatusCount('En Mantenimiento') }})
          </button>
          <button 
            class="filter-chip baja-chip" 
            [class.active]="filterStatus === 'Dado de Baja'"
            (click)="filterStatus = 'Dado de Baja'">
            Dados de Baja
          </button>
        </div>
      </div>

      <!-- Rooms Grid -->
      <div class="consultorios-grid">
        @for (room of filteredRooms; track room.id) {
          <div class="room-card" [class.room-baja]="room.status === 'Dado de Baja'">
            <div class="room-header">
              <div class="room-code-tag">{{ room.code }}</div>
              <span [ngClass]="{
                'status-disponible': room.status === 'Disponible',
                'status-ocupado': room.status === 'Ocupado',
                'status-mantenimiento': room.status === 'En Mantenimiento',
                'status-baja': room.status === 'Dado de Baja'
              }">
                {{ room.status }}
              </span>
            </div>

            <div class="room-body">
              <h3 class="room-name">{{ room.name }}</h3>
              <div class="room-location">
                <span>{{ room.floor }}</span>
              </div>
              <div class="room-spec-pill">
                <span>Especialidad: <strong>{{ room.specialty }}</strong> · Tipo: <strong>{{ room.roomType }}</strong> · Capacidad: <strong>{{ room.capacity ?? 1 }}</strong></span>
              </div>
              @if (room.nurses?.length) {
                <p class="room-nurse-list"><strong>Enfermería asignada:</strong> {{ nurseNames(room) }}</p>
              }

              <div class="equipment-section">
                <span class="equip-title">Equipamiento e Instrumental:</span>
                <div class="equip-chips">
                  @for (eq of room.equipment; track eq) {
                    <span class="eq-tag">{{ eq }}</span>
                  } @empty {
                    <span class="no-eq">Sin equipamiento registrado</span>
                  }
                </div>
              </div>

              @if (room.status === 'Dado de Baja') {
                <div class="baja-alert-box">
                  <div class="baja-lbl">CONSULTORIO FUERA DE SERVICIO</div>
                  <p><strong>Motivo:</strong> {{ room.dischargeReason }}</p>
                  <p><strong>Fecha de Baja:</strong> {{ room.dischargeDate }}</p>
                </div>
              }
            </div>

            <div class="room-footer">
              <button class="btn-room-edit" type="button" (click)="openEditModal(room)">
                <span>Editar detalles</span>
              </button>
              @if (room.status !== 'Dado de Baja') {
                <button class="btn-room-baja" (click)="openBajaModal(room)">
                  <span>Retirar de Servicio</span>
                </button>
              } @else {
                <button class="btn-room-react" (click)="reactivateRoom(room)">
                  <span>Reactivar Consultorio</span>
                </button>
              }
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <h3>No se encontraron consultorios</h3>
            <p>Registre un consultorio para agregar una nueva sala.</p>
          </div>
        }
      </div>

      <!-- MODAL: DAR DE ALTA CONSULTORIO -->
      @if (showAltaModal) {
        <div class="modal-overlay">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-wrap">
                <span class="modal-tag">{{ editingRoom ? 'ACTUALIZACIÓN DE INSTALACIONES' : 'ALTA DE INSTALACIONES' }}</span>
                <h3>{{ editingRoom ? 'Editar consultorio' : 'Registrar Consultorio en Aegis Salud' }}</h3>
              </div>
              <button class="close-x" (click)="closeAltaModal()">&times;</button>
            </div>

            <form (ngSubmit)="submitAlta()" class="modal-form" [appFormDraft]="roomDraftKey" appFormValidation [appFormValidationError]="hospitalService.error() || operationalRecords.storageError()" (appFormValidationDismiss)="hospitalService.clearError(); operationalRecords.clearError()">
              <div class="form-row two-col">
                <div class="form-group">
                  <label>Código de Consultorio *</label>
                  <input type="text" [(ngModel)]="newRoom.code" name="code" required placeholder="Ej: CONS-E501" />
                </div>
                <div class="form-group">
                  <label>Especialidad Clínica Principal *</label>
                  <select [(ngModel)]="newRoom.specialty" name="specialty" required>
                    <option value="" disabled>Seleccione especialidad...</option>
                    @for (specialty of specialties; track specialty) {
                      <option [value]="specialty">{{ specialty }}</option>
                    }
                  </select>
                </div>
                <div class="form-group">
                  <label>Tipo de espacio *</label>
                  <select [ngModel]="addingNewRoomType ? '__new__' : newRoom.roomType" name="roomType"
                    required (ngModelChange)="onRoomTypeChange($event)">
                    @for (type of roomTypes; track type) {
                      <option [value]="type">{{ type }}</option>
                    }
                    <option value="__new__">Agregar nueva categoría…</option>
                  </select>
                  @if (addingNewRoomType) {
                    <input [(ngModel)]="customRoomType" name="customRoomType" required maxlength="120"
                      placeholder="Escriba una categoría, por ejemplo: Urgencias" />
                  }
                </div>
              </div>

              <div class="form-group">
                <label>Nombre Descriptivo del Consultorio *</label>
                <input type="text" [(ngModel)]="newRoom.name" name="name" required placeholder="Ej: Consultorio de Oftalmología y Refracción" />
              </div>

              <div class="form-row two-col">
                <div class="form-group">
                  <label>Ubicación / Piso y Pabellón *</label>
                  <input type="text" [(ngModel)]="newRoom.floor" name="floor" required placeholder="Ej: Piso 2 - Pabellón A" />
                </div>
                @if (!editingRoom) {
                  <div class="form-group">
                    <label>Disponibilidad del consultorio *</label>
                    <select [(ngModel)]="newRoom.status" name="status" required>
                      <option value="Disponible">Disponible para Consulta</option>
                      <option value="Ocupado">Ocupado / Bloqueado manualmente</option>
                      <option value="En Mantenimiento">En Mantenimiento / Acondicionamiento</option>
                    </select>
                  </div>
                }
                <div class="form-group">
                  <label>Capacidad de atención *</label>
                  <input type="number" min="1" max="100" [(ngModel)]="newRoom.capacity" name="capacity" required />
                </div>
              </div>

              <div class="form-group">
                <label>Equipamiento e Instrumental Médico (separado por comas)</label>
                <textarea 
                  [(ngModel)]="equipmentInput" 
                  name="equipmentInput" 
                  rows="3" 
                  placeholder="Ej: Camilla clínica, Monitor multiparámetro, Oftalmoscopio, Negatoscopio"></textarea>
              </div>
              @if (auth.hasRole('admin')) {
                <div class="form-group">
                  <label>Enfermería asignada a este espacio</label>
                  <select multiple [(ngModel)]="newRoom.nurseIds" name="nurseIds" size="4">
                    @for (nurse of nurseAccounts; track nurse.id) {
                      <option [ngValue]="nurse.id">{{ nurse.name }} — {{ nurse.email }}</option>
                    }
                  </select>
                  <small>Mantenga Ctrl (Windows) o Cmd (Mac) para elegir varias cuentas activas de Enfermería.</small>
                </div>
              }

              <div class="form-group">
                <label>Contraseña de confirmación *</label>
                <input type="password" [(ngModel)]="roomConfirmPassword" [ngModelOptions]="{standalone: true}" required autocomplete="current-password" placeholder="Ingrese su contraseña para confirmar" />
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeAltaModal()">Cancelar</button>
                <button type="submit" class="btn-primary" [disabled]="!roomConfirmPassword">
                  <span>{{ editingRoom ? 'Guardar cambios' : 'Guardar y Dar de Alta' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- MODAL: DAR DE BAJA CONSULTORIO -->
      @if (showBajaModal && selectedRoomForBaja) {
        <div class="modal-overlay">
          <div class="modal-content baja-modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header header-danger">
              <div class="modal-title-wrap">
                <span class="modal-danger-tag">BAJA DE ÁREA HOSPITALARIA</span>
                <h3>Dar de Baja Consultorio {{ selectedRoomForBaja.code }}</h3>
              </div>
              <button class="close-x" (click)="closeBajaModal()">&times;</button>
            </div>

            <form (ngSubmit)="submitBaja()" class="modal-form" appFormValidation [appFormValidationError]="hospitalService.error() || operationalRecords.storageError()" (appFormValidationDismiss)="hospitalService.clearError(); operationalRecords.clearError()">
              <div class="form-group">
                <label>Motivo de la Baja del Consultorio *</label>
                <select [(ngModel)]="bajaReason" name="bajaReason" required>
                  <option value="" disabled selected>Seleccione causa...</option>
                  <option value="Remodelación y adecuación arquitectónica mayor">Remodelación y adecuación arquitectónica mayor</option>
                  <option value="Desinfección profunda o cuarentena sanitaria">Desinfección profunda o cuarentena sanitaria</option>
                  <option value="Falla en instalaciones técnicas / Red eléctrica">Falla en instalaciones técnicas / Red eléctrica</option>
                  <option value="Reubicación o reconversión a otra área médica">Reubicación o reconversión a otra área médica</option>
                  <option value="Cierre definitivo por disposición hospitalaria">Cierre definitivo por disposición hospitalaria</option>
                </select>
              </div>

              <div class="form-group">
                <label>Contraseña de confirmación *</label>
                <input type="password" [(ngModel)]="bajaConfirmPassword" [ngModelOptions]="{standalone: true}" required autocomplete="current-password" placeholder="Ingrese su contraseña para autorizar la baja" />
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeBajaModal()">Cancelar</button>
                <button type="submit" class="btn-danger-confirm" [disabled]="!bajaReason || !bajaConfirmPassword">
                  <span>Confirmar Baja del Consultorio</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .consultorios-page {
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
      width: 360px;
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
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .filter-chip {
      padding: 0.45rem 0.85rem;
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

    .filter-chip.occupied-chip.active {
      background: #0284c7;
      color: #ffffff;
    }

    .filter-chip.maint-chip.active {
      background: #d97706;
      color: #ffffff;
    }

    .filter-chip.baja-chip.active {
      background: #8B1E1E;
      color: #ffffff;
    }

    /* Grid */
    .consultorios-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.25rem;
    }

    .room-card {
      background: #ffffff;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.2s ease;
    }

    .room-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }

    .room-baja {
      background: #fafaf9;
      border-color: #fca5a5;
    }

    .room-header {
      background: #f8fafc;
      padding: 0.75rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
    }

    .room-code-tag {
      font-weight: 800;
      font-size: 0.85rem;
      color: var(--primary-navy);
      letter-spacing: 0.5px;
    }

    .status-disponible {
      background: #ecfdf5;
      color: #059669;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      border: 1px solid #a7f3d0;
    }

    .status-ocupado {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      border: 1px solid #bae6fd;
    }

    .status-mantenimiento {
      background: #fef3c7;
      color: #b45309;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      border: 1px solid #fde68a;
    }

    .status-baja {
      background: #fee2e2;
      color: #991b1b;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      border: 1px solid #fca5a5;
    }

    .room-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      flex: 1;
    }

    .room-name {
      font-size: 1.1rem;
      color: var(--primary-navy);
      line-height: 1.25;
    }

    .room-location {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.82rem;
      color: #475569;
    }

    .room-spec-pill {
      font-size: 0.8rem;
      color: #8B1E1E;
    }

    .equipment-section {
      background: #f8fafc;
      padding: 0.75rem;
      border-radius: 8px;
      margin-top: 0.5rem;
    }

    .equip-title {
      font-size: 0.72rem;
      color: #64748b;
      font-weight: 700;
      display: block;
      margin-bottom: 0.4rem;
    }

    .equip-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .eq-tag {
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 0.72rem;
    }

    .no-eq {
      font-size: 0.72rem;
      color: #94a3b8;
      font-style: italic;
    }

    .baja-alert-box {
      background: #fee2e2;
      border-left: 3px solid #8B1E1E;
      padding: 0.65rem;
      border-radius: 6px;
      font-size: 0.78rem;
      color: #7f1d1d;
      margin-top: 0.5rem;
    }

    .baja-lbl {
      font-weight: 700;
      margin-bottom: 0.2rem;
    }

    .room-footer {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-top: 1px solid #f1f5f9;
    }

    .room-footer > button {
      flex: 1 1 0;
      width: 100%;
      min-height: 2.5rem;
      padding: 0.5rem 0.65rem;
      font-size: 0.8rem;
      justify-content: center;
    }

    .btn-room-baja {
      width: 100%;
      background: #fff1f2;
      color: #9f1239;
      border: 1px solid #fecdd3;
      padding: 0.5rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.8rem;
      transition: all 0.2s ease;
    }

    .btn-room-baja:hover {
      background: #8B1E1E;
      color: #ffffff;
    }

    .btn-room-react {
      width: 100%;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 0.5rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.8rem;
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

    .btn-room-edit {
      background: #e2e8f0;
      color: #1e293b;
      padding: 0.6rem 0.85rem;
      border-radius: 6px;
      font-weight: 600;
    }

    .empty-state {
      grid-column: 1 / -1;
      background: #ffffff;
      padding: 3rem;
      text-align: center;
      border-radius: 12px;
      border: 2px dashed #cbd5e1;
    }

    .calendar-panel { display: grid; gap: .85rem; padding: 1.25rem; background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
    .calendar-heading, .calendar-navigation, .reservation-item { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
    .calendar-heading p, .reservation-item p { color: #64748b; font-size: .82rem; margin-top: .2rem; }
    .calendar-navigation { white-space: nowrap; }
    .calendar-nav { border: 1px solid #cbd5e1; border-radius: .4rem; background: #fff; padding: .3rem .65rem; font-size: 1.15rem; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: .3rem; }
    .calendar-weekdays { color: #64748b; font-size: .75rem; font-weight: 700; text-align: center; }
    .calendar-day { min-height: 3.5rem; border: 1px solid #e2e8f0; border-radius: .35rem; background: #fff; color: #0f172a; display: grid; align-content: start; justify-items: start; gap: .2rem; padding: .35rem; text-align: left; }
    .calendar-day small { color: #8b1e1e; font-size: .62rem; }
    .calendar-day.other-month { background: #f8fafc; color: #94a3b8; }
    .calendar-day.selected { border-color: #8b1e1e; box-shadow: inset 0 0 0 1px #8b1e1e; }
    .calendar-day.has-reservations { background: #fff7ed; }
    .reservation-form { display: grid; gap: .8rem; border-top: 1px solid #e2e8f0; padding-top: 1rem; }
    .reservation-list, .room-audit-list { display: grid; gap: .6rem; }
    .audit-pagination { display: flex; align-items: center; justify-content: flex-end; gap: .75rem; color: #64748b; font-size: .8rem; }
    .reservation-item { padding: .7rem; border: 1px solid #e2e8f0; border-radius: .5rem; }
    .empty-calendar { color: #64748b; font-size: .85rem; padding: .5rem 0; }
    @media (max-width: 520px) { .calendar-heading { align-items: flex-start; flex-direction: column; } .calendar-day { min-height: 2.8rem; } .calendar-day small { font-size: .55rem; } }

  `]
})
export class ConsultoriosComponent implements OnInit {
  @ViewChild(FormDraftDirective) draft?: FormDraftDirective;
  readonly hospitalService = inject(HospitalService);
  readonly operationalRecords = inject(OperationalRecordsService);
  readonly auth = inject(AuthService);

  searchQuery = '';
  filterStatus: 'TODOS' | 'Disponible' | 'Ocupado' | 'En Mantenimiento' | 'Dado de Baja' = 'TODOS';

  showAltaModal = false;
  showBajaModal = false;
  selectedRoomForBaja: Room | null = null;
  editingRoom: Room | null = null;
  bajaReason = '';
  equipmentInput = '';
  nurseAccounts: NurseAccount[] = [];
  customRoomType = '';
  readonly weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  selectedCalendarDate = this.localDate();
  reservations: RoomReservation[] = [];
  reservationForm = { roomId: '', title: '', reason: '', startsAt: '', endsAt: '' };
  readonly nowLocal = this.localDateTime();

  newRoom = {
    code: '',
    name: '',
    floor: '',
    specialty: '',
    roomType: 'Consulta',
    nurseIds: [] as number[],
    status: 'Disponible' as Room['status'],
    capacity: 1
  };

  get filteredRooms(): Room[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.hospitalService.rooms().filter(r => {
      const match =
        !q ||
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.specialty.toLowerCase().includes(q) ||
        r.roomType.toLowerCase().includes(q) ||
        r.floor.toLowerCase().includes(q);

      if (!match) return false;

      if (this.filterStatus !== 'TODOS') {
        return r.status === this.filterStatus;
      }
      return true;
    });
  }

  get canManageReservations(): boolean {
    return this.auth.hasRole('admin', 'recepcion');
  }

  get specialties(): string[] {
    return [...new Set([
      ...MEDICAL_SPECIALTIES,
      ...this.hospitalService.doctors().map(doctor => doctor.specialty.trim()),
      ...this.hospitalService.rooms().map(room => room.specialty.trim()),
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  get roomTypes(): string[] {
    return [...new Set([
      'Consulta', 'Especialidades', 'Urgencias', 'Pediatría', 'Cirugía', 'Quirófano', 'Procedimientos', 'Imagenología', 'Hospitalización', 'Terapia Intensiva',
      ...this.hospitalService.rooms().map(room => room.roomType).filter(Boolean),
    ])].sort((a, b) => a.localeCompare(b, 'es'));
  }

  get roomDraftKey(): string {
    return this.editingRoom ? `consultorios:editar:${this.editingRoom.id}` : 'consultorios:nuevo';
  }

  get addingNewRoomType(): boolean {
    return this.newRoom.roomType === '__new__';
  }

  nurseNames(room: Room): string {
    return room.nurses?.map(nurse => nurse.name).join(', ') ?? '';
  }

  get reservableRooms(): Room[] {
    return this.hospitalService.rooms().filter(room => room.status === 'Disponible');
  }

  get monthLabel(): string {
    return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(this.calendarMonth);
  }

  get calendarDays(): Array<{ date: string; day: number; inMonth: boolean; reservationCount: number }> {
    const first = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = this.dateKey(date);
      return {
        date: key, day: date.getDate(), inMonth: date.getMonth() === this.calendarMonth.getMonth(),
        reservationCount: this.reservations.filter(item => item.startsAt.slice(0, 10) === key).length,
      };
    });
  }

  get selectedReservations(): RoomReservation[] {
    return this.reservations.filter(item => item.startsAt.slice(0, 10) === this.selectedCalendarDate);
  }

  roomAuditLogs: AuditLog[] = [];
  auditPage = 1;
  auditLastPage = 1;

  ngOnInit(): void {
    if (this.canManageReservations || this.auth.hasRole('medico_general', 'especialista')) {
      void this.loadReservations();
    }
    if (this.auth.hasRole('admin')) void this.loadRoomAudit();
    this.reservationForm.roomId = this.reservableRooms[0]?.id ?? '';
  }

  roomStatusCount(status: Room['status']): number {
    return this.hospitalService.rooms().filter(room => room.status === status).length;
  }

  changeMonth(offset: number): void {
    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + offset, 1);
    this.selectedCalendarDate = this.dateKey(this.calendarMonth);
    void this.loadReservations();
  }

  selectCalendarDate(date: string): void {
    this.selectedCalendarDate = date;
    const selected = new Date(`${date}T00:00:00`);
    if (selected.getMonth() !== this.calendarMonth.getMonth()) {
      this.calendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
      void this.loadReservations();
    }
    if (this.reservationForm.startsAt) {
      this.reservationForm.startsAt = `${date}T${this.reservationForm.startsAt.slice(11, 16)}`;
      this.reservationForm.endsAt = `${date}T${this.reservationForm.endsAt.slice(11, 16)}`;
    } else {
      this.reservationForm.startsAt = `${date}T09:00`;
      this.reservationForm.endsAt = `${date}T10:00`;
    }
  }

  async loadReservations(): Promise<void> {
    const from = this.dateKey(new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth(), 1));
    const to = this.dateKey(new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 0));
    this.reservations = await this.operationalRecords.getRoomReservations(from, to);
  }

  async loadRoomAudit(page = 1): Promise<void> {
    const result = await this.operationalRecords.getRoomAudit(page);
    if (!result) return;
    this.roomAuditLogs = result.data;
    this.auditPage = result.currentPage;
    this.auditLastPage = result.lastPage;
  }

  async reserveRoom(): Promise<void> {
    const form = this.reservationForm;
    if (!form.roomId || !form.title.trim() || !form.reason.trim() || !form.startsAt || !form.endsAt ||
      form.endsAt <= form.startsAt) return;
    if (await this.operationalRecords.createRoomReservation(form)) {
      this.reservationForm = { roomId: this.reservableRooms[0]?.id ?? '', title: '', reason: '', startsAt: '', endsAt: '' };
      this.draft?.clearDraft();
      await this.loadReservations();
      if (this.auth.hasRole('admin')) await this.loadRoomAudit();
    }
  }

  async cancelReservation(reservation: RoomReservation): Promise<void> {
    const reason = window.prompt('Indique el motivo para cancelar esta reserva:')?.trim();
    if (!reason) return;
    if (await this.operationalRecords.cancelRoomReservation(reservation.id, reason)) {
      await this.loadReservations();
      if (this.auth.hasRole('admin')) await this.loadRoomAudit();
    }
  }

  openAltaModal() {
    this.editingRoom = null;
    this.roomConfirmPassword = '';
    this.newRoom = {
      code: '',
      name: '',
      floor: '',
      specialty: '',
      roomType: 'Consulta',
      nurseIds: [],
      status: 'Disponible',
      capacity: 1
    };
    this.customRoomType = '';
    this.equipmentInput = 'Camilla ergonómica, Negatoscopio LED, Monitor de signos vitales';
    this.showAltaModal = true;
    if (this.auth.hasRole('admin')) void this.loadNurseAccounts();
  }

  async openEditModal(room: Room) {
    this.editingRoom = room;
    this.roomConfirmPassword = '';
    this.newRoom = {
      code: room.code,
      name: room.name,
      floor: room.floor ?? '',
      specialty: room.specialty,
      roomType: room.roomType || 'Consulta',
      nurseIds: room.nurseIds ?? [],
      status: room.status,
      capacity: room.capacity ?? 1
    };
    this.customRoomType = '';
    this.equipmentInput = room.equipment.join(', ');
    this.showAltaModal = true;
    if (this.auth.hasRole('admin')) await this.loadNurseAccounts();
  }

  async loadNurseAccounts(): Promise<void> {
    this.nurseAccounts = await this.hospitalService.getNurseAccounts();
  }

  onRoomTypeChange(value: string): void {
    this.customRoomType = '';
    this.newRoom.roomType = value;
  }

  closeAltaModal() {
    this.showAltaModal = false;
    this.editingRoom = null;
  }

  roomConfirmPassword = '';
  bajaConfirmPassword = '';

  async submitAlta() {
    if (!this.newRoom.code.trim() || !this.newRoom.name.trim() || !this.newRoom.floor.trim() ||
      !this.newRoom.specialty || !(this.addingNewRoomType ? this.customRoomType.trim() : this.newRoom.roomType)
      || !Number.isInteger(Number(this.newRoom.capacity)) || Number(this.newRoom.capacity) < 1) {
      this.hospitalService.reportError('Completa los campos obligatorios y verifica que la capacidad del consultorio sea válida.');
      return;
    }

    const eqList = this.equipmentInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const data = {
      code: this.newRoom.code,
      name: this.newRoom.name,
      floor: this.newRoom.floor,
      specialty: this.newRoom.specialty,
      roomType: this.addingNewRoomType ? this.customRoomType.trim() : this.newRoom.roomType,
      nurseIds: this.newRoom.nurseIds,
      ...(this.editingRoom ? {} : { status: this.newRoom.status }),
      capacity: Number(this.newRoom.capacity),
      equipment: eqList,
      confirmPassword: this.roomConfirmPassword
    };
    const success = this.editingRoom
      ? await this.hospitalService.updateRoom(this.editingRoom.id, data)
      : await this.hospitalService.addRoom(data as any);

    if (success) {
      this.draft?.clearDraft();
      this.roomConfirmPassword = '';
      this.closeAltaModal();
    }
  }

  openBajaModal(room: Room) {
    this.selectedRoomForBaja = room;
    this.bajaReason = '';
    this.bajaConfirmPassword = '';
    this.showBajaModal = true;
  }

  closeBajaModal() {
    this.showBajaModal = false;
    this.selectedRoomForBaja = null;
    this.bajaConfirmPassword = '';
  }

  async submitBaja() {
    if (!this.selectedRoomForBaja || !this.bajaReason || !this.bajaConfirmPassword) return;
    if (await this.hospitalService.dischargeRoom(this.selectedRoomForBaja.id, this.bajaReason, this.bajaConfirmPassword)) this.closeBajaModal();
  }

  async reactivateRoom(room: Room) {
    if (confirm(`¿Reactivar el consultorio ${room.code}?`)) {
      await this.hospitalService.reactivateRoom(room.id);
    }
  }

  private localDate(): string {
    return this.dateKey(new Date());
  }

  private localDateTime(): string {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  private dateKey(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
