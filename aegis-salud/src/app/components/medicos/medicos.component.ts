import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HospitalService } from '../../services/hospital.service';
import { Doctor } from '../../models/doctor.model';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { FormDraftService } from '../../services/form-draft.service';
import { MEDICAL_SPECIALTIES } from '../../models/medical-specialties';
import { AuthService } from '../../services/auth.service';
import { DoctorAccount } from '../../services/hospital.service';

@Component({
  selector: 'app-medicos',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <div class="medicos-page">
      <!-- Section Header -->
      <div class="page-header">
        <div class="title-group">
          <span class="module-tag">CUERPO MÉDICO AEGIS</span>
          <h2 class="page-title">Directorio Médico: Dar de Alta y Gestión de Especialistas</h2>
          <p class="page-desc">
            Registro, acreditación clínica y control de asignación por turnos y consultorios.
          </p>
        </div>
        <div class="header-actions">
          @if (canCreateDoctor) {
            <button class="btn-primary" (click)="openAltaModal()">
              <span>Registrar Médico</span>
            </button>
          }
        </div>
      </div>
      <!-- Filters & Search -->
      <div class="filter-bar">
        <div class="search-box">
          <input 
            type="text" 
            placeholder="Buscar por médico, especialidad o cédula..." 
            [(ngModel)]="searchQuery" 
            class="search-input" />
        </div>

        <div class="filter-chips">
          <button 
            class="filter-chip" 
            [class.active]="filterStatus === 'TODOS'"
            (click)="filterStatus = 'TODOS'">
            Todos ({{ hospitalService.doctors().length }})
          </button>
          <button 
            class="filter-chip active-chip" 
            [class.active]="filterStatus === 'ACTIVO'"
            (click)="filterStatus = 'ACTIVO'">
            Activos ({{ hospitalService.activeDoctorsCount() }})
          </button>
          <button 
            class="filter-chip baja-chip" 
            [class.active]="filterStatus === 'BAJA'"
            (click)="filterStatus = 'BAJA'">
            Dados de Baja
          </button>
        </div>
      </div>

      <!-- Doctors Grid -->
      <div class="medicos-grid">
        @for (doc of filteredDoctors; track doc.id) {
          <div class="doctor-card" [class.doc-discharged]="doc.status === 'Dado de Baja'">
            <div class="doc-banner">
              <span class="doc-code">{{ doc.id }}</span>
              <span [ngClass]="doc.status === 'Activo' ? 'badge-activo' : 'badge-baja'">
                {{ doc.status }}
              </span>
            </div>

            <div class="doc-body">
              <div class="doc-icon-circle">
                <span>{{ doc.firstName.charAt(0) }}{{ doc.lastName.charAt(0) }}</span>
              </div>
              <h3 class="doc-name">{{ doc.firstName }} {{ doc.lastName }}</h3>
              <span class="doc-specialty">{{ doc.specialty }}</span>
              <span class="doc-license">Cédula Prof.: <strong>{{ doc.licenseNumber }}</strong></span>

              <div class="doc-details-list">
                <div class="detail-row">
                  <span class="lbl">Turno Laboral:</span>
                  <span class="val shift-tag">{{ doc.shift }}</span>
                </div>
                <div class="detail-row">
                  <span class="lbl">Consultorio:</span>
                  <span class="val">{{ getRoomName(doc.assignedRoomId) }}</span>
                </div>
                <div class="detail-row">
                  <span class="lbl">Teléfono Directo:</span>
                  <span class="val">{{ doc.phone }}</span>
                </div>
                <div class="detail-row">
                  <span class="lbl">Email Institucional:</span>
                  <span class="val email-val">{{ doc.email }}</span>
                </div>
              </div>

              @if (doc.status === 'Dado de Baja') {
                <div class="baja-note">
                  <span><strong>Baja registrada:</strong> {{ doc.dischargeReason }} ({{ doc.dischargeDate }})</span>
                </div>
              }
            </div>

            <div class="doc-footer">
              @if (canEditDoctors) {
                <button class="btn-secondary" (click)="openEditModal(doc)">
                  <span>Editar datos</span>
                </button>
              }
              @if (canManageDoctorStatus) {
                @if (doc.status === 'Activo') {
                  <button class="btn-doc-baja" (click)="openBajaModal(doc)">
                    <span>Dar de Baja Médico</span>
                  </button>
                } @else {
                  <button class="btn-doc-react" (click)="reactivateDoc(doc)">
                    <span>Reactivar Médico</span>
                  </button>
                }
              }
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <h3>No se encontraron médicos</h3>
            <p>Utilice el botón "Registrar Médico" para agregar personal médico.</p>
          </div>
        }
      </div>

      <!-- MODAL: DAR DE ALTA MÉDICO -->
      @if (showAltaModal) {
        <div class="modal-overlay">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-wrap">
                <span class="modal-tag">{{ editingDoctorId ? 'ACTUALIZACIÓN DE DIRECTORIO' : 'RECURSOS HUMANOS MÉDICOS' }}</span>
                <h3>{{ editingDoctorId ? 'Editar datos del médico' : 'Registrar Médico en Aegis Salud' }}</h3>
              </div>
              <button class="close-x" (click)="closeAltaModal()">&times;</button>
            </div>

            <form (ngSubmit)="submitAlta()" class="modal-form" [appFormDraft]="doctorDraftKey" appFormValidation [appFormValidationError]="hospitalService.error()" (appFormValidationDismiss)="hospitalService.clearError()">
              <div class="form-row two-col">
                <div class="form-group">
                  <label>Cédula Profesional / Licencia Médica *</label>
                  <input type="text" [(ngModel)]="newDoctor.licenseNumber" name="licenseNumber" required
                    maxlength="64" pattern="[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ .-]+" placeholder="Ej: MED-1092837" />
                </div>
                <div class="form-group">
                  <label>Especialidad Médica *</label>
                  <select [(ngModel)]="newDoctor.specialty" name="specialty" required>
                    <option value="" disabled selected>Seleccione especialidad...</option>
                    @for (specialty of specialties; track specialty) {
                      <option [value]="specialty">{{ specialty }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="form-row two-col">
                <div class="form-group">
                  <label>Nombre(s) con Título *</label>
                  <input type="text" [(ngModel)]="newDoctor.firstName" name="firstName" required
                    maxlength="100" pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü][A-Za-zÁÉÍÓÚáéíóúÑñÜü .'-]*" placeholder="Ej: Dr. Fernando" />
                </div>
                <div class="form-group">
                  <label>Apellidos *</label>
                  <input type="text" [(ngModel)]="newDoctor.lastName" name="lastName" required
                    maxlength="120" pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü][A-Za-zÁÉÍÓÚáéíóúÑñÜü .'-]*" placeholder="Ej: Herrera Orozco" />
                </div>
              </div>

              <div class="form-row two-col">
                <div class="form-group">
                  <label>Turno Asignado *</label>
                  <select [(ngModel)]="newDoctor.shift" name="shift" required>
                    <option value="Matutino">Matutino (07:00 - 15:00)</option>
                    <option value="Vespertino">Vespertino (14:00 - 21:30)</option>
                    <option value="Nocturno">Nocturno (21:00 - 07:00)</option>
                    <option value="Guardia Completa">Guardia Completa (24 hrs)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Consultorio Asignado</label>
                  <select [(ngModel)]="newDoctor.assignedRoomId" name="assignedRoomId">
                    <option value="">-- Sin Consultorio Fijo --</option>
                    @for (r of hospitalService.rooms(); track r.id) {
                      <option [value]="r.id">{{ r.code }} - {{ r.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="form-row two-col">
                <div class="form-group">
                  <label>Teléfono de Contacto *</label>
                  <input type="tel" [(ngModel)]="newDoctor.phone" name="phone" required
                    maxlength="32" pattern="[0-9+() .-]+" placeholder="55-2233-4455" />
                </div>
                <div class="form-group">
                  <label>Correo Electrónico Institucional *</label>
                  <input type="email" [(ngModel)]="newDoctor.email" name="email" required placeholder="doctor@aegissalud.org" />
                </div>
              </div>
              @if (auth.hasRole('admin')) {
                <div class="form-group">
                  <label for="doctor-user-account">Cuenta de acceso vinculada</label>
                  <small>Vincular una cuenta permite que su titular inicie sesión como médico. Solo las cuentas médicas activas y no asignadas se pueden vincular.</small>
                  <select id="doctor-user-account" [(ngModel)]="newDoctor.userId" name="userId">
                    <option [ngValue]="''">Sin cuenta vinculada</option>
                    @for (account of doctorAccounts; track account.id) {
                      <option [ngValue]="account.id" [disabled]="!account.canLink">
                        {{ account.email }} — {{ account.name }} · {{ accountStatus(account) }}
                      </option>
                    }
                  </select>
                  <small>Se muestran todos los correos registrados; las cuentas no elegibles aparecen deshabilitadas.</small>
                </div>
              }

              @if (editingDoctorId) {
                <div class="form-group">
                  <label>Contraseña de confirmación (datos sensibles) *</label>
                  <input type="password" [(ngModel)]="editConfirmPassword" [ngModelOptions]="{standalone: true}" required autocomplete="current-password" placeholder="Ingrese su contraseña para guardar cambios" />
                </div>
              }

              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeAltaModal()">Cancelar</button>
                <button type="submit" class="btn-primary">
                  <span>{{ editingDoctorId ? 'Guardar cambios' : 'Guardar y Dar de Alta' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- MODAL: DAR DE BAJA MÉDICO -->
      @if (showBajaModal && selectedDocForBaja) {
        <div class="modal-overlay">
          <div class="modal-content baja-modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header header-danger">
              <div class="modal-title-wrap">
                <span class="modal-danger-tag">BAJA DE PERSONAL MÉDICO</span>
                <h3>Dar de Baja a {{ selectedDocForBaja.firstName }} {{ selectedDocForBaja.lastName }}</h3>
              </div>
              <button class="close-x" (click)="closeBajaModal()">&times;</button>
            </div>

            <form (ngSubmit)="submitBaja()" class="modal-form" appFormDraft="medicos:egreso" appFormValidation [appFormValidationError]="hospitalService.error()" (appFormValidationDismiss)="hospitalService.clearError()">
              <div class="form-group">
                <label>Motivo de la Baja del Médico *</label>
                <select [(ngModel)]="bajaReason" name="bajaReason" required>
                  <option value="" disabled selected>Seleccione motivo...</option>
                  <option value="Fin de contrato / Renuncia voluntaria">Fin de contrato / Renuncia voluntaria</option>
                  <option value="Jubilación o Retiro Profesional">Jubilación o Retiro Profesional</option>
                  <option value="Traslado a otra sede o centro hospitalario">Traslado a otra sede o centro hospitalario</option>
                  <option value="Licencia prolongada / Año sabático">Licencia médica o académica prolongada</option>
                  <option value="Baja administrativa">Baja administrativa</option>
                </select>
              </div>

              <div class="form-group">
                <label>Contraseña de confirmación *</label>
                <input type="password" [(ngModel)]="bajaConfirmPassword" [ngModelOptions]="{standalone: true}" required autocomplete="current-password" placeholder="Ingrese su contraseña para autorizar la baja" />
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeBajaModal()">Cancelar</button>
                <button type="submit" class="btn-danger-confirm" [disabled]="!bajaReason || !bajaConfirmPassword">
                  <span>Confirmar Baja del Médico</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .medicos-page {
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

    /* Grid */
    .medicos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.25rem;
    }

    .doctor-card {
      background: #ffffff;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.2s ease;
    }

    .doctor-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
      border-color: #8B1E1E;
    }

    .doc-discharged {
      background: #f8fafc;
      border-color: #fca5a5;
    }

    .doc-banner {
      background: linear-gradient(135deg, #111e33 0%, #1d2d48 100%);
      padding: 0.65rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #8B1E1E;
    }

    .doc-code {
      font-size: 0.72rem;
      color: #cbd5e1;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .badge-activo {
      font-size: 0.7rem;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(52, 211, 153, 0.4);
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
    }

    .badge-baja {
      font-size: 0.7rem;
      font-weight: 700;
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border: 1px solid rgba(248, 113, 113, 0.4);
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
    }

    .doc-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      flex: 1;
    }

    .doc-icon-circle {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary-navy);
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      border: 2px solid #8B1E1E;
    }

    .doc-name {
      font-size: 1.15rem;
      color: var(--primary-navy);
      margin-bottom: 0.2rem;
    }

    .doc-specialty {
      font-size: 0.85rem;
      color: #8B1E1E;
      font-weight: 700;
      margin-bottom: 0.35rem;
    }

    .doc-license {
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 1rem;
    }

    .doc-details-list {
      width: 100%;
      background: #f8fafc;
      padding: 0.75rem;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      font-size: 0.78rem;
      text-align: left;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
    }

    .lbl {
      color: #64748b;
      font-weight: 600;
    }

    .val {
      font-weight: 600;
      color: #1e293b;
    }

    .shift-tag {
      background: #e2e8f0;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
    }

    .email-val {
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .baja-note {
      margin-top: 0.75rem;
      background: #fee2e2;
      color: #991b1b;
      padding: 0.45rem 0.65rem;
      border-radius: 6px;
      font-size: 0.75rem;
      text-align: left;
      width: 100%;
    }

    .doc-footer {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-top: 1px solid #f1f5f9;
      background: #fdfdfd;
    }

    .doc-footer > button {
      flex: 1 1 0;
      width: 100%;
      min-height: 2.5rem;
      padding: 0.5rem 0.65rem;
      font-size: 0.8rem;
      justify-content: center;
    }

    .btn-doc-baja {
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

    .btn-doc-baja:hover {
      background: #8B1E1E;
      color: #ffffff;
      border-color: #8B1E1E;
    }

    .btn-doc-react {
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

    .form-group input, .form-group select {
      padding: 0.6rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.85rem;
      outline: none;
    }

    .form-group input:focus, .form-group select:focus {
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

    .empty-state {
      grid-column: 1 / -1;
      background: #ffffff;
      padding: 3rem;
      text-align: center;
      border-radius: 12px;
      border: 2px dashed #cbd5e1;
    }

  `]
})
export class MedicosComponent {
  hospitalService = inject(HospitalService);
  drafts = inject(FormDraftService);
  auth = inject(AuthService);

  searchQuery = '';
  filterStatus: 'TODOS' | 'ACTIVO' | 'BAJA' = 'TODOS';

  showAltaModal = false;
  editingDoctorId: string | null = null;
  showBajaModal = false;
  selectedDocForBaja: Doctor | null = null;
  bajaReason = '';

  newDoctor = {
    licenseNumber: '',
    firstName: '',
    lastName: '',
    specialty: '',
    shift: 'Matutino' as Doctor['shift'],
    assignedRoomId: '',
    phone: '',
    email: '',
    userId: '' as number | ''
  };
  doctorAccounts: DoctorAccount[] = [];
  editConfirmPassword = '';
  bajaConfirmPassword = '';

  get specialties(): string[] {
    return [...new Set([
      ...MEDICAL_SPECIALTIES,
      ...this.hospitalService.doctors().map(doctor => doctor.specialty.trim()),
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  accountStatus(account: DoctorAccount): string {
    if (!account.isActive) return 'cuenta desactivada';
    if (account.linkedTo) return `vinculada a ${account.linkedTo}`;
    if (!['medico_general', 'especialista'].includes(account.role)) return 'rol no médico';
    return 'disponible';
  }

  get canCreateDoctor(): boolean {
    return this.auth.user()?.role === 'admin';
  }

  get canEditDoctors(): boolean {
    return this.auth.hasRole('admin', 'recepcion');
  }

  get canManageDoctorStatus(): boolean {
    return this.auth.user()?.role === 'admin';
  }

  get doctorDraftKey(): string {
    return this.editingDoctorId ? `medicos:editar:${this.editingDoctorId}` : 'medicos:nuevo';
  }

  get filteredDoctors(): Doctor[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.hospitalService.doctors().filter(d => {
      const match =
        !q ||
        d.firstName.toLowerCase().includes(q) ||
        d.lastName.toLowerCase().includes(q) ||
        d.specialty.toLowerCase().includes(q) ||
        d.licenseNumber.toLowerCase().includes(q);

      if (!match) return false;

      if (this.filterStatus === 'ACTIVO') return d.status === 'Activo';
      if (this.filterStatus === 'BAJA') return d.status === 'Dado de Baja';
      return true;
    });
  }

  getRoomName(roomId?: string): string {
    if (!roomId) return 'Sin consultorio fijo';
    const room = this.hospitalService.rooms().find(r => r.id === roomId);
    return room ? `${room.code} (${room.specialty})` : 'No encontrado';
  }

  async openAltaModal(): Promise<void> {
    this.editingDoctorId = null;
    this.newDoctor = {
      licenseNumber: '',
      firstName: '',
      lastName: '',
      specialty: 'Medicina General y Urgencias',
      shift: 'Matutino',
      assignedRoomId: '',
      phone: '',
      email: '',
      userId: ''
    };
    this.showAltaModal = true;
    if (this.auth.hasRole('admin')) this.doctorAccounts = await this.hospitalService.getDoctorAccounts();
  }

  async openEditModal(doctor: Doctor): Promise<void> {
    this.editingDoctorId = doctor.id;
    this.editConfirmPassword = '';
    this.newDoctor = {
      licenseNumber: doctor.licenseNumber,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      specialty: doctor.specialty,
      shift: doctor.shift,
      assignedRoomId: doctor.assignedRoomId ?? '',
      phone: doctor.phone ?? '',
      email: doctor.email ?? '',
      userId: doctor.userId ?? ''
    };
    this.showAltaModal = true;
    if (this.auth.hasRole('admin')) this.doctorAccounts = await this.hospitalService.getDoctorAccounts(doctor.id);
  }

  closeAltaModal() {
    this.showAltaModal = false;
  }

  async submitAlta() {
    if (!this.newDoctor.firstName || !this.newDoctor.lastName || !this.newDoctor.licenseNumber) {
      this.hospitalService.reportError('Completa los campos obligatorios del médico.');
      return;
    }

    const doctorData: Omit<Doctor, 'id' | 'status' | 'registrationDate'> = {
      licenseNumber: this.newDoctor.licenseNumber,
      firstName: this.newDoctor.firstName,
      lastName: this.newDoctor.lastName,
      specialty: this.newDoctor.specialty,
      shift: this.newDoctor.shift,
      assignedRoomId: this.newDoctor.assignedRoomId || undefined,
      phone: this.newDoctor.phone,
      email: this.newDoctor.email,
      ...(this.auth.hasRole('admin')
        ? { userId: this.newDoctor.userId === '' ? null : this.newDoctor.userId }
        : {})
    };
    const draftKey = this.doctorDraftKey;
    const success = this.editingDoctorId
      ? await this.hospitalService.updateDoctor(this.editingDoctorId, { ...doctorData, confirmPassword: this.editConfirmPassword })
      : await this.hospitalService.addDoctor(doctorData);

    if (success) {
      this.drafts.clear(draftKey);
      this.showAltaModal = false;
      this.editingDoctorId = null;
      this.editConfirmPassword = '';
    }
  }

  openBajaModal(doc: Doctor) {
    this.selectedDocForBaja = doc;
    this.bajaReason = '';
    this.bajaConfirmPassword = '';
    this.showBajaModal = true;
  }

  closeBajaModal() {
    this.showBajaModal = false;
    this.selectedDocForBaja = null;
    this.bajaConfirmPassword = '';
  }

  async submitBaja() {
    if (!this.selectedDocForBaja || !this.bajaReason || !this.bajaConfirmPassword) return;
    if (await this.hospitalService.dischargeDoctor(this.selectedDocForBaja.id, this.bajaReason, this.bajaConfirmPassword)) {
      this.drafts.clear('medicos:egreso');
      this.closeBajaModal();
    }
  }

  async reactivateDoc(doc: Doctor) {
    if (confirm(`¿Reactivar al facultativo ${doc.firstName} ${doc.lastName}?`)) {
      await this.hospitalService.reactivateDoctor(doc.id);
    }
  }
}
