import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HospitalService } from '../../services/hospital.service';
import { Patient } from '../../models/patient.model';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { FormDraftService } from '../../services/form-draft.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-pacientes',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <div class="patients-page">
      <!-- Section Header -->
      <div class="page-header">
        <div class="title-group">
          <span class="module-tag">MÓDULO DE PACIENTES</span>
          <h2 class="page-title">Gestión de ingresos y altas hospitalarias</h2>
          <p class="page-desc">
            Registre ingresos y coordine por separado el alta médica y la autorización administrativa.
          </p>
        </div>
        <div class="header-actions">
          @if (canCreatePatient) {
            <button class="btn-primary" (click)="openIngresoModal()">
              <span>Registrar Ingreso</span>
            </button>
          }
        </div>
      </div>

      <!-- Controls & Filters Bar -->
      <div class="filter-bar">
        <div class="search-box">
          <input 
            type="text" 
            placeholder="Buscar por nombre, apellidos o CURP/DNI..." 
            [(ngModel)]="searchQuery" 
            (ngModelChange)="patientPage = 1"
            class="search-input" />
        </div>

        <div class="filter-chips">
          <button 
            class="filter-chip" 
            [class.active]="filterStatus === 'TODOS'"
            (click)="filterStatus = 'TODOS'; patientPage = 1">
            Todos ({{ hospitalService.patients().length }})
          </button>
          <button 
            class="filter-chip active-chip" 
            [class.active]="filterStatus === 'ACTIVO'"
            (click)="filterStatus = 'ACTIVO'; patientPage = 1">
            Ingresados ({{ hospitalService.activePatientsCount() }})
          </button>
          <button 
            class="filter-chip baja-chip" 
            [class.active]="filterStatus === 'EGRESO'"
            (click)="filterStatus = 'EGRESO'; patientPage = 1">
            Egresos registrados ({{ hospitalService.dischargedPatientsCount() }})
          </button>
        </div>
      </div>

      <!-- Patients Grid / List -->
      <div class="patients-grid">
        @for (p of visiblePatients; track p.id) {
          <div class="patient-card" [class.patient-discharged]="isDischarged(p)">
            <div class="card-status-bar" [class.bar-baja]="isDischarged(p)"></div>
            <div class="card-inner">
              <div class="card-top">
                <div class="avatar-badge">
                  <span>{{ p.firstName.charAt(0) }}{{ p.lastName.charAt(0) }}</span>
                </div>
                @if (filteredPatients.length > pageSize) {
                  <div class="patient-pagination" aria-label="Paginación de pacientes">
                    <span>{{ filteredPatients.length }} resultados · Página {{ patientPage }} de {{ totalPatientPages }}</span>
                    <button type="button" class="filter-chip" [disabled]="patientPage <= 1" (click)="patientPage = patientPage - 1">Anterior</button>
                    <button type="button" class="filter-chip" [disabled]="patientPage >= totalPatientPages" (click)="patientPage = patientPage + 1">Siguiente</button>
                  </div>
                }
                <div class="header-details">
                  <div class="id-row">
                    <span class="patient-code">Expediente: {{ p.medicalRecordNumber }}</span>
                    <span [ngClass]="p.status === 'Activo' ? 'badge-activo' : 'badge-baja'">
                        {{ patientStatusLabel(p) }}
                    </span>
                  </div>
                  <h3 class="patient-fullname">{{ p.firstName }} {{ p.lastName }}</h3>
                  <span class="doc-id">Doc: <strong>{{ p.documentId }}</strong></span>
                </div>
              </div>

              @if (!isAdministrative) {
              <div class="details-grid">
                <div class="detail-box">
                  <span class="d-label">Tipo Sangre:</span>
                  <span class="d-value blood-badge">{{ p.bloodType }}</span>
                </div>
                <div class="detail-box">
                  <span class="d-label">Fecha Nacimiento:</span>
                  <span class="d-value">{{ p.birthDate }}</span>
                </div>
                <div class="detail-box">
                  <span class="d-label">Teléfono:</span>
                  <span class="d-value">{{ p.phone }}</span>
                </div>
                <div class="detail-box">
                  <span class="d-label">Género:</span>
                  <span class="d-value">{{ p.gender }}</span>
                </div>
              </div>

              <div class="extra-info">
                <div class="info-row">
                  <span class="i-label">Contacto Emergencia:</span>
                  <span class="i-val">{{ p.emergencyContact.name }} ({{ p.emergencyContact.phone }})</span>
                </div>
                @if (p.allergies) {
                  <div class="info-row">
                    <span class="i-label text-allergies">Alergias:</span>
                    <span class="i-val allergy-tag">{{ p.allergies }}</span>
                  </div>
                }
              </div>
              } @else {
                @if (p.assignedBedId) { <div class="info-row"><span class="i-label">Cama:</span><span class="i-val">{{ p.assignedBedId }}</span></div> }
                @if (p.dischargeRequestedAt && !p.medicalDischargeAt) { <div class="info-row"><span class="i-label">Solicitud de alta:</span><span class="i-val">Enviada a médico · {{ p.dischargeRequestedAt | date:'short' }}</span></div> }
                @if (p.medicalDischargeAt) { <div class="info-row"><span class="i-label">Alta médica:</span><span class="i-val">Autorizada · {{ p.medicalDischargeAt | date:'short' }}</span></div> }
                @if (p.administrativeDischargeAt) { <div class="info-row"><span class="i-label">Alta administrativa:</span><span class="i-val">Completada · {{ p.administrativeDischargeAt | date:'short' }}</span></div> }
              }

              <!-- Registered discharge details -->
              @if (isDischarged(p)) {
                <div class="discharge-info-box">
                  <div class="d-info-header">
                    <strong>EGRESO REGISTRADO</strong>
                  </div>
                  <div class="d-info-body">
                    <p><strong>Fecha de egreso:</strong> {{ p.dischargeDate || (p.medicalDischargeAt | date:'yyyy-MM-dd') || (p.administrativeDischargeAt | date:'yyyy-MM-dd') }}</p>
                    @if (p.dischargeReason || p.medicalDischargeAt) { <p><strong>Motivo:</strong> {{ p.dischargeReason || 'Alta médica autorizada' }}</p> }
                    @if (!isAdministrative && p.dischargeNotes) {
                      <p><strong>Observaciones:</strong> {{ p.dischargeNotes }}</p>
                    }
                  </div>
                </div>
              }

              <!-- Action buttons -->
              <div class="card-actions">
                @if (p.canEdit) {
                  <button class="btn-secondary" (click)="openEditModal(p)">
                    <span>Editar datos</span>
                  </button>
                }
                @if (p.status === 'Activo' && canMedicalDischarge && !p.medicalDischargeAt) {
                  <button class="btn-baja" (click)="openEgresoModal(p)">
                    <span>{{ p.dischargeRequestedAt ? 'Confirmar alta médica solicitada' : 'Registrar alta médica' }}</span>
                  </button>
                } @else if (p.status === 'Activo' && canMedicalDischarge && p.medicalDischargeAt) {
                  <span class="module-muted">Alta médica confirmada · Pendiente de Administración</span>
                } @else if (p.status === 'Activo' && isAdministrative && p.medicalDischargeAt && !p.administrativeDischargeAt) {
                  <button class="btn-baja" (click)="openEgresoModal(p)">
                    <span>Autorizar alta administrativa</span>
                  </button>
                } @else if (p.status === 'Activo' && isAdministrative && !p.medicalDischargeAt) {
                  @if (!p.dischargeRequestedAt) {
                    <button class="btn-secondary" (click)="requestDischargeFromAdmin(p)">
                      <span>Solicitar alta médica</span>
                    </button>
                  } @else {
                    <span class="module-muted">Alta solicitada · Esperando confirmación del médico</span>
                  }
                } @else {
                  @if (isDischarged(p) && canReactivatePatient) {
                    <button class="btn-reactivar" (click)="reactivate(p)">
                      <span>Registrar reingreso</span>
                    </button>
                  }
                }
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <h3>No se encontraron pacientes</h3>
            <p>Ajuste la búsqueda o registre un nuevo ingreso para agregar un paciente.</p>
          </div>
        }
      </div>

      <!-- MODAL: NUEVO INGRESO -->
      @if (showIngresoModal) {
        <div class="modal-overlay">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-wrap">
                <span class="modal-tag">{{ editingPatientId ? 'EDICIÓN DE DATOS' : 'NUEVO INGRESO HOSPITALARIO' }}</span>
                <h3>{{ editingPatientId ? 'Editar datos del paciente' : 'Registrar Ingreso de Paciente' }}</h3>
              </div>
              <button class="close-x" (click)="closeIngresoModal()">&times;</button>
            </div>

            <form (ngSubmit)="submitIngreso()" class="modal-form" [appFormDraft]="patientDraftKey" appFormValidation [appFormValidationError]="hospitalService.error()" (appFormValidationDismiss)="hospitalService.clearError()">
              @if (!isNurseLimitedEdit) {
              <div class="form-row two-col">
                <div class="form-group">
                  <label>Documento de Identidad (CURP / DNI / Cédula) *</label>
                  <input type="text" [(ngModel)]="newPatient.documentId" name="documentId" required
                    maxlength="64" pattern="[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ -]+" placeholder="Ej: CURP-MGO890312" />
                </div>
                @if (!isAdministrative) {
                <div class="form-group">
                  <label>Tipo de Sangre *</label>
                  <select [(ngModel)]="newPatient.bloodType" name="bloodType" required>
                    <option value="O+">O Positivo (O+)</option>
                    <option value="O-">O Negativo (O-)</option>
                    <option value="A+">A Positivo (A+)</option>
                    <option value="A-">A Negativo (A-)</option>
                    <option value="B+">B Positivo (B+)</option>
                    <option value="B-">B Negativo (B-)</option>
                    <option value="AB+">AB Positivo (AB+)</option>
                    <option value="AB-">AB Negativo (AB-)</option>
                  </select>
                </div>
                }
              </div>

              <div class="form-row two-col">
                <div class="form-group">
                  <label>Nombres *</label>
                  <input type="text" [(ngModel)]="newPatient.firstName" name="firstName" required
                    maxlength="100" pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü][A-Za-zÁÉÍÓÚáéíóúÑñÜü .'-]*" placeholder="Ej: Juan Carlos" />
                </div>
                <div class="form-group">
                  <label>Apellidos *</label>
                  <input type="text" [(ngModel)]="newPatient.lastName" name="lastName" required
                    maxlength="120" pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü][A-Za-zÁÉÍÓÚáéíóúÑñÜü .'-]*" placeholder="Ej: Morales Solís" />
                </div>
              </div>

              <div class="form-row three-col">
                <div class="form-group">
                  <label>Fecha de Nacimiento *</label>
                  <input type="date" [(ngModel)]="newPatient.birthDate" name="birthDate"
                    required [min]="minimumBirthDate" [max]="todayDate" />
                </div>
                <div class="form-group">
                  <label>Género *</label>
                  <select [(ngModel)]="newPatient.gender" name="gender">
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Teléfono *</label>
                  <input type="tel" [(ngModel)]="newPatient.phone" name="phone" required
                    maxlength="32" pattern="[0-9+() .-]+" placeholder="55-1234-5678" />
                </div>
              </div>
              }

              @if (canEditMeasurements) {
              <div class="form-row two-col">
                <div class="form-group">
                  <label>Temperatura inicial (°C) *</label>
                  <input type="number" [(ngModel)]="newPatient.temperatureC" name="temperatureC" required min="0.01" max="42" step="0.01" />
                  <small>Debe ser mayor que 0 y no superar 42 °C.</small>
                </div>
                <div class="form-group">
                  <label>Estatura (cm) *</label>
                  <input type="number" [(ngModel)]="newPatient.heightCm" name="heightCm" required min="0.01" max="300" step="0.01" />
                  <small>Debe ser mayor que 0 y no superar 300 cm.</small>
                </div>
              </div>
              }

              <div class="form-group">
                <label>Correo Electrónico</label>
                <input type="email" [(ngModel)]="newPatient.email" name="email" placeholder="paciente@correo.com" />
              </div>

              @if (canEditInsurance) {
              <div class="sub-form-block">
                <h4>Aseguradora y cobertura</h4>
                <div class="form-row three-col">
                  <div class="form-group">
                    <label>Aseguradora</label>
                    <input [(ngModel)]="newPatient.insuranceProvider" name="insuranceProvider" maxlength="120" />
                  </div>
                  <div class="form-group">
                    <label>Número de póliza</label>
                    <input [(ngModel)]="newPatient.insurancePolicy" name="insurancePolicy" maxlength="80" />
                  </div>
                  <div class="form-group">
                    <label>Cobertura del seguro (%)</label>
                    <input type="number" [(ngModel)]="newPatient.insuranceCoveragePercent" name="insuranceCoveragePercent"
                      min="0" max="100" step="0.01" [disabled]="!newPatient.insuranceProvider" />
                    <small>Si no hay aseguradora, el cargo corresponde al paciente.</small>
                  </div>
                </div>
              </div>
              }

              @if (!isAdministrative) {
              <div class="form-group">
                <label>Alergias o Condiciones Crónicas</label>
                <input type="text" [(ngModel)]="newPatient.allergies" name="allergies" placeholder="Penicilina, polen, diabetes tipo 2..." />
              </div>
              }

              <div class="sub-form-block">
                <h4>Contacto de Emergencia</h4>
                <div class="form-row three-col">
                  <div class="form-group">
                    <label>Nombre Completo *</label>
                    <input type="text" [(ngModel)]="newPatient.emergencyName" name="emergencyName" required
                      maxlength="160" pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü][A-Za-zÁÉÍÓÚáéíóúÑñÜü .'-]*" placeholder="Familiar o responsable" />
                  </div>
                  <div class="form-group">
                    <label>Teléfono *</label>
                    <input type="tel" [(ngModel)]="newPatient.emergencyPhone" name="emergencyPhone" required
                      maxlength="32" pattern="[0-9+() .-]+" placeholder="55-8899-0011" />
                  </div>
                  <div class="form-group">
                    <label>Parentesco *</label>
                    <input type="text" [(ngModel)]="newPatient.emergencyRelation" name="emergencyRelation" required placeholder="Esposo(a), Madre, etc." />
                  </div>
                </div>
              </div>

              @if (editingPatientId) {
                <div class="form-group">
                  <label>Contraseña de confirmación (datos sensibles) *</label>
                  <input type="password" [(ngModel)]="editConfirmPassword" [ngModelOptions]="{standalone: true}" required autocomplete="current-password" placeholder="Ingrese su contraseña para guardar cambios" />
                </div>
              }

              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeIngresoModal()">Cancelar</button>
                <button type="submit" class="btn-primary">
                  <span>{{ editingPatientId ? 'Guardar cambios' : 'Confirmar Ingreso' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- MODAL: AUTORIZACIÓN DE ALTA -->
      @if (showEgresoModal && selectedPatientForEgreso) {
        <div class="modal-overlay">
          <div class="modal-content baja-modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header header-danger">
              <div class="modal-title-wrap">
                <span class="modal-danger-tag">{{ isAdministrative ? 'ALTA ADMINISTRATIVA' : 'ALTA MÉDICA' }}</span>
                <h3>{{ isAdministrative ? 'Autorizar alta administrativa' : 'Registrar alta médica' }} · {{ selectedPatientForEgreso.firstName }} {{ selectedPatientForEgreso.lastName }}</h3>
              </div>
              <button class="close-x" (click)="closeEgresoModal()">&times;</button>
            </div>

            <div class="baja-warning-alert">
              <div>
                @if (isAdministrative) {
                  <span>Confirme la contraseña de Administración. El alta no se completará si el médico no la autorizó o hay saldo pendiente.</span>
                } @else {
                  <span>Esta autorización clínica no completa el alta administrativa. Caja/Administración deberá liquidar la cuenta y confirmar el egreso.</span>
                }
              </div>
            </div>

            @if (isAdministrative) {
            <form (ngSubmit)="submitEgreso()" class="modal-form" appFormValidation [appFormValidationError]="hospitalService.error()" (appFormValidationDismiss)="hospitalService.clearError()">
              <div class="form-group">
                <label>Contraseña de Administración *</label>
                <input type="password" [(ngModel)]="masterPassword" name="masterPassword" autocomplete="current-password" required />
              </div>
              @if (editingPatientId) {
                <div class="form-group">
                  <label>Contraseña de confirmación (datos sensibles) *</label>
                  <input type="password" [(ngModel)]="editConfirmPassword" [ngModelOptions]="{standalone: true}" required autocomplete="current-password" placeholder="Ingrese su contraseña para guardar cambios" />
                </div>
              }

              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeEgresoModal()">Cancelar</button>
                <button type="submit" class="btn-danger-confirm" [disabled]="!masterPassword">
                  <span>Completar alta administrativa</span>
                </button>
              </div>
            </form>
            } @else {
            <form (ngSubmit)="submitEgreso()" class="modal-form" appFormDraft="pacientes:egreso" appFormValidation [appFormValidationError]="hospitalService.error()" (appFormValidationDismiss)="hospitalService.clearError()">
              <div class="form-group">
                <label>Motivo del alta o egreso *</label>
                <select [(ngModel)]="egresoReason" name="egresoReason" required>
                  <option value="" disabled selected>Seleccione el motivo...</option>
                  <option value="Alta Médica por Curación/Recuperación Satisfactoria">Alta Médica por Curación / Recuperación Satisfactoria</option>
                  <option value="Egreso Voluntario Solicitado por el Paciente">Egreso Voluntario Solicitado por el Paciente</option>
                  <option value="Traslado a Otra Unidad Hospitalaria / Especialidad Externa">Traslado a Otra Unidad Hospitalaria / Especialidad Externa</option>
                  <option value="Otro Motivo Clínico / Administrativo">Otro motivo clínico o administrativo</option>
                </select>
              </div>

              <div class="form-group">
                <label>Resumen clínico e indicaciones de salida *</label>
                <textarea 
                  [(ngModel)]="egresoNotes" 
                  name="egresoNotes" 
                  rows="3" 
                  minlength="10" required
                  placeholder="Escriba el plan e indicaciones de salida..."></textarea>
              </div>

              @if (editingPatientId) {
                <div class="form-group">
                  <label>Contraseña de confirmación (datos sensibles) *</label>
                  <input type="password" [(ngModel)]="editConfirmPassword" [ngModelOptions]="{standalone: true}" required autocomplete="current-password" placeholder="Ingrese su contraseña para guardar cambios" />
                </div>
              }

              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeEgresoModal()">Cancelar</button>
                <button type="submit" class="btn-danger-confirm" [disabled]="!egresoReason">
                  <span>Autorizar alta médica</span>
                </button>
              </div>
            </form>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .patients-page {
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
    .patients-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 1.25rem;
    }
    .patient-pagination { display: flex; align-items: center; justify-content: flex-end; gap: .75rem; flex-wrap: wrap; }

    .patient-card {
      background: #ffffff;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.2s ease;
    }

    .patient-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }

    .card-status-bar {
      height: 4px;
      background: #10b981;
    }

    .bar-baja {
      background: #8B1E1E;
    }

    .patient-discharged {
      background: #fafaf9;
      border-color: #fecaca;
    }

    .card-inner {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 1;
    }

    .card-top {
      display: flex;
      gap: 0.85rem;
      align-items: center;
    }

    .avatar-badge {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #111e33;
      color: #ffffff;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.05rem;
      border: 2px solid #8B1E1E;
      flex-shrink: 0;
    }

    .header-details {
      flex: 1;
    }

    .id-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.15rem;
    }

    .patient-code {
      font-size: 0.72rem;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
    }

    .badge-activo {
      font-size: 0.7rem;
      font-weight: 700;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
    }

    .badge-baja {
      font-size: 0.7rem;
      font-weight: 700;
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
    }

    .patient-fullname {
      font-size: 1.1rem;
      color: var(--primary-navy);
      line-height: 1.2;
    }

    .doc-id {
      font-size: 0.75rem;
      color: #475569;
    }

    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      background: #f8fafc;
      padding: 0.75rem;
      border-radius: 8px;
    }

    .detail-box {
      display: flex;
      flex-direction: column;
    }

    .d-label {
      font-size: 0.68rem;
      color: #64748b;
    }

    .d-value {
      font-size: 0.82rem;
      font-weight: 600;
      color: #0f172a;
    }

    .blood-badge {
      color: #8B1E1E;
      font-weight: 700;
    }

    .extra-info {
      font-size: 0.78rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .info-row {
      display: flex;
      gap: 0.4rem;
    }

    .i-label {
      color: #64748b;
      font-weight: 600;
    }

    .i-val {
      color: #1e293b;
    }

    .allergy-tag {
      background: #fef2f2;
      color: #b91c1c;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      font-weight: 600;
    }

    /* Discharge info card */
    .discharge-info-box {
      background: #fff5f5;
      border-left: 3px solid #8B1E1E;
      padding: 0.65rem 0.85rem;
      border-radius: 6px;
      font-size: 0.78rem;
    }

    .d-info-header {
      color: #8B1E1E;
      margin-bottom: 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .d-info-body p {
      margin-bottom: 0.15rem;
      color: #450a0a;
    }

    .card-actions {
      margin-top: auto;
      padding-top: 0.5rem;
      border-top: 1px solid #f1f5f9;
    }

    .btn-baja {
      width: 100%;
      background: #fff1f2;
      color: #9f1239;
      border: 1px solid #fecdd3;
      padding: 0.55rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.82rem;
      transition: all 0.2s ease;
    }

    .btn-baja:hover {
      background: #8B1E1E;
      color: #ffffff;
      border-color: #8B1E1E;
    }

    .btn-reactivar {
      width: 100%;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 0.55rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.82rem;
      transition: all 0.2s ease;
    }

    .btn-reactivar:hover {
      background: #2563eb;
      color: #ffffff;
    }

    /* Modal Styling */
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

    .close-x:hover {
      color: #0f172a;
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
      transition: border-color 0.2s;
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

    .three-col {
      grid-template-columns: 1fr 1fr 1fr;
    }

    .sub-form-block {
      background: #f8fafc;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .sub-form-block h4 {
      font-size: 0.85rem;
      margin-bottom: 0.75rem;
      color: #1e293b;
    }

    .baja-warning-alert {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
      padding: 0.85rem 1.25rem;
      font-size: 0.82rem;
      display: flex;
      gap: 0.75rem;
      line-height: 1.4;
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
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }

    .btn-danger-confirm:hover:not(:disabled) {
      background: #6e1515;
    }

    .btn-danger-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
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
export class PacientesComponent {
  readonly todayDate = this.formatDate(new Date());
  readonly minimumBirthDate = this.formatDate(new Date(new Date().setFullYear(new Date().getFullYear() - 150)));
  hospitalService = inject(HospitalService);
  drafts = inject(FormDraftService);
  auth = inject(AuthService);

  searchQuery = '';
  patientPage = 1;
  readonly pageSize = 50;
  filterStatus: 'TODOS' | 'ACTIVO' | 'EGRESO' = 'TODOS';

  showIngresoModal = false;
  editingPatientId: string | null = null;
  showEgresoModal = false;
  selectedPatientForEgreso: Patient | null = null;
  egresoReason = '';
  egresoNotes = '';
  masterPassword = '';

  newPatient = {
    documentId: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    temperatureC: null as number | null,
    heightCm: null as number | null,
    gender: 'Masculino' as 'Masculino' | 'Femenino' | 'Otro',
    phone: '',
    email: '',
    bloodType: 'O+' as Patient['bloodType'],
    allergies: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    insuranceProvider: '',
    insurancePolicy: '',
    insuranceCoveragePercent: 80
  };

  get isAdministrative(): boolean {
    return this.auth.user()?.role === 'admin';
  }

  get canCreatePatient(): boolean {
    return this.auth.hasRole('admin', 'recepcion');
  }

  get canReactivatePatient(): boolean {
    return this.auth.hasRole('admin', 'recepcion', 'medico_general', 'especialista');
  }

  get isNurseLimitedEdit(): boolean {
    return !!this.editingPatientId && this.auth.user()?.role === 'enfermeria'
      && !this.auth.hasRole('recepcion', 'medico_general', 'especialista');
  }

  get canEditMeasurements(): boolean {
    return !this.editingPatientId || this.auth.hasRole('recepcion');
  }

  get canEditInsurance(): boolean {
    return !this.editingPatientId || this.auth.hasRole('admin', 'recepcion');
  }

  get patientDraftKey(): string {
    return this.editingPatientId
      ? `pacientes:editar:${this.editingPatientId}`
      : 'pacientes:ingreso';
  }

  get canMedicalDischarge(): boolean {
    return !this.isAdministrative && this.auth.hasRole('medico_general', 'especialista');
  }
  editConfirmPassword = '';

  get filteredPatients(): Patient[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.hospitalService.patients().filter(p => {
      const matchQuery =
        !q ||
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.documentId.toLowerCase().includes(q) ||
        (p.phone ?? '').includes(q);

      if (!matchQuery) return false;

      if (this.filterStatus === 'ACTIVO') return p.status === 'Activo' && !p.medicalDischargeAt && !p.dischargeDate;
      if (this.filterStatus === 'EGRESO') return this.isDischarged(p);
      return true;
    });
  }

  get visiblePatients(): Patient[] {
    const start = (this.patientPage - 1) * this.pageSize;
    return this.filteredPatients.slice(start, start + this.pageSize);
  }

  get totalPatientPages(): number {
    return Math.max(1, Math.ceil(this.filteredPatients.length / this.pageSize));
  }

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  patientStatusLabel(patient: Patient): string {
    if (patient.status === 'Dado de Alta') return 'Alta administrativa completada';
    if (patient.dischargeReason === 'Fallecimiento') return 'Fallecimiento registrado';
    if (patient.dischargeReason?.startsWith('Alta Médica') || patient.medicalDischargeAt) return 'Alta médica registrada';
    if (patient.status === 'Dado de Baja') return 'Egreso registrado';
    if (patient.status === 'Activo') return 'Ingreso activo';
    return 'Egreso registrado';
  }

  isDischarged(patient: Patient): boolean {
    return patient.status === 'Dado de Alta' || patient.status === 'Dado de Baja' || !!patient.medicalDischargeAt || !!patient.dischargeDate;
  }

  openIngresoModal() {
    this.editingPatientId = null;
    this.newPatient = {
      documentId: '',
      firstName: '',
      lastName: '',
      birthDate: '1995-01-01',
      temperatureC: null,
      heightCm: null,
      gender: 'Masculino',
      phone: '',
      email: '',
      bloodType: 'O+',
      allergies: '',
      emergencyName: '',
      emergencyPhone: '',
      emergencyRelation: '',
      insuranceProvider: '',
      insurancePolicy: '',
      insuranceCoveragePercent: 80
    };
    this.showIngresoModal = true;
  }

  openEditModal(patient: Patient): void {
    this.editingPatientId = patient.id;
    this.editConfirmPassword = '';
    this.newPatient = {
      documentId: patient.documentId ?? '',
      firstName: patient.firstName ?? '',
      lastName: patient.lastName ?? '',
      birthDate: patient.birthDate ?? '',
      temperatureC: patient.temperatureC,
      heightCm: patient.heightCm,
      gender: patient.gender ?? 'Otro',
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      bloodType: patient.bloodType ?? 'O+',
      allergies: patient.allergies ?? '',
      emergencyName: patient.emergencyContact?.name ?? '',
      emergencyPhone: patient.emergencyContact?.phone ?? '',
      emergencyRelation: patient.emergencyContact?.relation ?? '',
      insuranceProvider: patient.insuranceProvider ?? '',
      insurancePolicy: patient.insurancePolicy ?? '',
      insuranceCoveragePercent: patient.insuranceCoveragePercent ?? 80
    };
    this.showIngresoModal = true;
  }

  closeIngresoModal() {
    this.showIngresoModal = false;
  }

  async submitIngreso() {
    if (this.editingPatientId) {
      const partial: Partial<Patient> = {
        phone: this.newPatient.phone,
        email: this.newPatient.email,
        emergencyContact: {
          name: this.newPatient.emergencyName,
          phone: this.newPatient.emergencyPhone,
          relation: this.newPatient.emergencyRelation
        }
      };
      if (!this.isNurseLimitedEdit) {
        Object.assign(partial, {
          documentId: this.newPatient.documentId,
          firstName: this.newPatient.firstName,
          lastName: this.newPatient.lastName,
          birthDate: this.newPatient.birthDate,
          gender: this.newPatient.gender
        });
      }
      if (!this.isAdministrative) {
        partial.allergies = this.newPatient.allergies;
        if (!this.isNurseLimitedEdit) {
          partial.bloodType = this.newPatient.bloodType;
        }
      }
      if (this.canEditMeasurements) {
        partial.temperatureC = this.newPatient.temperatureC;
        partial.heightCm = this.newPatient.heightCm;
      }
      if (this.canEditInsurance) {
        partial.insuranceProvider = this.newPatient.insuranceProvider;
        partial.insurancePolicy = this.newPatient.insurancePolicy;
        partial.insuranceCoveragePercent = this.newPatient.insuranceCoveragePercent;
      }
      const draftKey = this.patientDraftKey;
      if (await this.hospitalService.updatePatient(this.editingPatientId, { ...partial, confirmPassword: this.editConfirmPassword })) {
        this.drafts.clear(draftKey);
        this.showIngresoModal = false;
        this.editingPatientId = null;
        this.editConfirmPassword = '';
      }
      return;
    }

    if (!this.newPatient.firstName || !this.newPatient.lastName || !this.newPatient.documentId) {
      this.hospitalService.reportError('Completa los campos obligatorios del paciente.');
      return;
    }

    const success = await this.hospitalService.addPatient({
      documentId: this.newPatient.documentId,
      firstName: this.newPatient.firstName,
      lastName: this.newPatient.lastName,
      birthDate: this.newPatient.birthDate,
      temperatureC: this.newPatient.temperatureC!,
      heightCm: this.newPatient.heightCm!,
      gender: this.newPatient.gender,
      phone: this.newPatient.phone,
      email: this.newPatient.email,
      bloodType: this.newPatient.bloodType,
      allergies: this.newPatient.allergies,
      insuranceProvider: this.newPatient.insuranceProvider,
      insurancePolicy: this.newPatient.insurancePolicy,
      insuranceCoveragePercent: this.newPatient.insuranceCoveragePercent,
      emergencyContact: {
        name: this.newPatient.emergencyName,
        phone: this.newPatient.emergencyPhone,
        relation: this.newPatient.emergencyRelation
      }
    });

    if (success) {
      this.drafts.clear('pacientes:ingreso');
      this.showIngresoModal = false;
    }
  }

  openEgresoModal(p: Patient) {
    this.selectedPatientForEgreso = p;
    this.egresoReason = '';
    this.egresoNotes = '';
    this.masterPassword = '';
    this.showEgresoModal = true;
  }

  closeEgresoModal() {
    this.showEgresoModal = false;
    this.selectedPatientForEgreso = null;
    this.masterPassword = '';
  }

  async submitEgreso() {
    if (!this.selectedPatientForEgreso) return;
    const success = this.isAdministrative
      ? await this.hospitalService.completeAdministrativeDischarge(
          this.selectedPatientForEgreso.id,
          this.masterPassword,
        )
      : await this.hospitalService.requestMedicalDischarge(
          this.selectedPatientForEgreso.id,
          `${this.egresoReason}: ${this.egresoNotes}`.trim(),
        );
    if (success) {
      this.drafts.clear('pacientes:egreso');
      this.closeEgresoModal();
    }
  }

  async requestDischargeFromAdmin(p: Patient): Promise<void> {
    const notes = window.prompt(`Solicitar alta médica para ${p.firstName} ${p.lastName} (motivo u observación):`, 'Solicitud de alta administrativa');
    if (notes === null) return;
    await this.hospitalService.requestDischarge(p.id, notes.trim() || 'Solicitud de alta administrativa');
  }

  async reactivate(p: Patient) {
    if (confirm(`¿Desea registrar el reingreso de ${p.firstName} ${p.lastName}?`)) {
      await this.hospitalService.reactivatePatient(p.id);
    }
  }
}
