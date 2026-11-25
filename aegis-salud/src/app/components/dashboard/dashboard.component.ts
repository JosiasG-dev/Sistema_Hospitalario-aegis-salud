import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HospitalService } from '../../services/hospital.service';
import { AuthService } from '../../services/auth.service';
import { auditActionLabel } from '../../models/audit-log.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-page">
      <!-- Welcome Header Banner -->
      <section class="hospital-hero">
        <div class="hero-content">
          <div class="hero-badge">Aegis Salud &bull; Panel central</div>
          <h2 class="hero-title">Sistema de Gestión y Registro Hospitalario</h2>
          <p class="hero-text">
            Control de ingresos y altas médicas, asignación del cuerpo médico, gestión de consultorios y agenda de citas.
          </p>
          <div class="hero-actions">
            @if (canAccess('pacientes')) {
              <button class="btn-primary" (click)="navigate('pacientes')">
                <span>Registrar Ingreso</span>
              </button>
            }
            @if (canAccess('consultas')) {
              <button class="btn-primary" (click)="navigate('consultas')">
                <span>Atención Médica</span>
              </button>
            }
            @if (canAccess('operaciones')) {
              <button class="btn-primary dark-btn" (click)="navigate('operaciones')">
                <span>Área Quirúrgica</span>
              </button>
            }
            @if (canAccess('medicos')) {
              <button class="btn-primary dark-btn" (click)="navigate('medicos')">
                <span>Registrar Médico</span>
              </button>
            }
            @if (canAccess('consultorios')) {
              <button class="btn-primary dark-btn" (click)="navigate('consultorios')">
                <span>Registrar Consultorio</span>
              </button>
            }
            @if (canAccess('citas')) {
              <button class="btn-primary crimson-btn" (click)="navigate('citas')">
                <span>Gestión de Citas</span>
              </button>
            }
            @if (canAccess('farmacia')) {
              <button class="btn-primary" (click)="navigate('farmacia')">
                <span>Dispensación Farmacia</span>
              </button>
            }
            @if (canAccess('alimentos')) {
              <button class="btn-primary crimson-btn" (click)="navigate('alimentos')">
                <span>Servicio de Alimentos</span>
              </button>
            }
            @if (canAccess('almacenes') && !canAccess('medicos')) {
              <button class="btn-primary dark-btn" (click)="navigate('almacenes')">
                <span>Gestión de Almacenes</span>
              </button>
            }
            @if (canAccess('compras') && !canAccess('medicos')) {
              <button class="btn-primary dark-btn" (click)="navigate('compras')">
                <span>Solicitudes de Compra</span>
              </button>
            }
          </div>
        </div>
        <div class="hero-logo-box">
          <img src="assets/logo-cropped.jpg" alt="Logotipo de Aegis Salud" class="hero-logo" />
        </div>
      </section>

      <!-- KPI Metrics Grid -->
      <section class="kpi-grid">
        <!-- Metric 1: Pacientes -->
        <div class="kpi-card" [class.clickable]="canAccess('pacientes')" (click)="navigate('pacientes')">
          <div class="kpi-header">
            <span class="kpi-status-badge active-tag">Activos: {{ hospitalService.activePatientsCount() }}</span>
          </div>
          <div class="kpi-data">
            <h3 class="kpi-value">{{ hospitalService.patients().length }}</h3>
            <p class="kpi-label">Pacientes en Registro Total</p>
          </div>
          <div class="kpi-footer">
            <span class="text-danger">{{ hospitalService.dischargedPatientsCount() }} egreso(s) de paciente registrado(s)</span>
          </div>
        </div>

        <!-- Metric 2: Médicos -->
        <div class="kpi-card" [class.clickable]="canAccess('medicos')" (click)="navigate('medicos')">
          <div class="kpi-header">
            <span class="kpi-status-badge active-tag">Activos: {{ hospitalService.activeDoctorsCount() }}</span>
          </div>
          <div class="kpi-data">
            <h3 class="kpi-value">{{ hospitalService.doctors().length }}</h3>
            <p class="kpi-label">Médicos Especialistas</p>
          </div>
          <div class="kpi-footer">
            <span>Plantilla médica en turno activo</span>
          </div>
        </div>

        <!-- Metric 3: Consultorios -->
        <div class="kpi-card" [class.clickable]="canAccess('consultorios')" (click)="navigate('consultorios')">
          <div class="kpi-header">
            <span class="kpi-status-badge available-tag">{{ hospitalService.availableRoomsCount() }} Disponibles</span>
          </div>
          <div class="kpi-data">
            <h3 class="kpi-value">{{ hospitalService.rooms().length }}</h3>
            <p class="kpi-label">Consultorios Hospitalarios</p>
          </div>
          <div class="kpi-footer">
            <span>Capacidad hospitalaria instalada</span>
          </div>
        </div>

        <!-- Metric 4: Citas Médicas -->
        <div class="kpi-card" [class.clickable]="canAccess('citas')" (click)="navigate('citas')">
          <div class="kpi-header">
            <span class="kpi-status-badge pending-tag">{{ hospitalService.activeAppointmentsCount() }} Programadas</span>
          </div>
          <div class="kpi-data">
            <h3 class="kpi-value">{{ hospitalService.appointments().length }}</h3>
            <p class="kpi-label">Citas en Agenda General</p>
          </div>
          <div class="kpi-footer">
            <span class="text-danger">{{ hospitalService.dischargedAppointmentsCount() }} citas canceladas</span>
          </div>
        </div>
      </section>

      <!-- Tables and Activity Overview -->
      <div class="overview-grid">
        <!-- Recent admissions and discharges -->
        <div class="card overview-card">
          <div class="card-header">
            <div>
              <h4 class="card-title">Ingresos y egresos recientes</h4>
              <p class="card-subtitle">Trazabilidad en tiempo real de registros hospitalarios</p>
            </div>
            @if (canAccess('auditoria')) {
              <button class="view-all-btn" (click)="navigate('auditoria')">Ver Bitácora Completa &rarr;</button>
            }
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Módulo</th>
                  <th>Tipo Acción</th>
                  <th>Identificador / Nombre</th>
                  <th>Motivo / Observaciones</th>
                </tr>
              </thead>
              <tbody>
                @for (log of hospitalService.auditLogs().slice(0, 5); track log.id) {
                  <tr>
                    <td class="text-muted">{{ log.timestamp }}</td>
                    <td>
                      <span class="module-chip">{{ log.entityType }}</span>
                    </td>
                    <td>
                      <span [ngClass]="{
                        'status-pill-alta': log.action === 'Alta',
                        'status-pill-baja': log.action === 'Baja',
                        'status-pill-react': log.action === 'Reactivación'
                      }">
                        {{ auditActionLabel(log) }}
                      </span>
                    </td>
                    <td class="fw-bold">{{ log.entityName }}</td>
                    <td class="text-desc">{{ log.reason || log.details || '-' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Quick Summary Card -->
        <div class="card summary-panel">
          <div class="card-header">
            <h4 class="card-title">Atención Médica Hoy</h4>
          </div>

          <div class="appointment-summary-list">
            <div class="today-banner">
              <span class="today-date">{{ todayFormatted }}</span>
              <span class="today-tag">Jornada Activa</span>
            </div>

            @for (app of hospitalService.appointments().slice(0, 3); track app.id) {
              <div class="app-item-card" [class.baja-border]="app.status === 'Dada de Baja (Cancelada)'">
                <div class="app-time-badge">
                  <span>{{ app.appointmentTime }}</span>
                  <span class="time-sub">hrs</span>
                </div>
                <div class="app-details">
                  <strong class="patient-name">{{ app.patientName }}</strong>
                  <span class="doctor-spec">{{ app.doctorName }} &bull; {{ app.doctorSpecialty }}</span>
                  <span class="room-pill">{{ app.roomName }}</span>
                </div>
                <div>
                  @if (app.status === 'Programada') {
                    <span class="status-badge-active">Programada</span>
                  } @else {
                    <span class="status-badge-danger">Baja Registrada</span>
                  }
                </div>
              </div>
            }
          </div>

          @if (canAccess('citas')) {
            <div class="quick-link-box">
              <button class="btn-full" (click)="navigate('citas')">
                Ir a Citas Médicas
              </button>
            </div>
          } @else if (canAccess('agenda')) {
            <div class="quick-link-box">
              <button class="btn-full" (click)="navigate('agenda')">
                Ver Agenda Médica
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .hospital-hero {
      background: linear-gradient(135deg, #111e33 0%, #1c2e4a 60%, #2b1212 100%);
      border-radius: var(--radius-lg);
      padding: 2.25rem;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2rem;
      border-left: 6px solid #8B1E1E;
      box-shadow: var(--shadow-md);
    }

    .hero-content {
      max-width: 680px;
    }

    .hero-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: #f87171;
      letter-spacing: 1.5px;
      margin-bottom: 0.5rem;
    }

    .hero-title {
      font-size: 1.85rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 0.75rem;
      line-height: 1.2;
    }

    .hero-text {
      color: #cbd5e1;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .dark-btn {
      background: #1e293b;
      box-shadow: none;
      border: 1px solid #334155;
    }
    .dark-btn:hover {
      background: #334155;
    }

    .crimson-btn {
      background: #8B1E1E;
    }
    .crimson-btn:hover {
      background: #a32222;
    }

    .hero-logo-box {
      width: 140px;
      height: 140px;
      border-radius: 18px;
      background: #ffffff;
      padding: 10px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
      border: 3px solid #8B1E1E;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .hero-logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 1.25rem;
    }

    .kpi-card {
      background: #ffffff;
      border-radius: var(--radius-md);
      padding: 1.25rem;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: all 0.2s ease;
    }

    .kpi-card.clickable {
      cursor: pointer;
    }

    .kpi-card.clickable:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
      border-color: #8B1E1E;
    }

    .kpi-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .kpi-status-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
    }

    .active-tag,
    .available-tag,
    .pending-tag {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    .kpi-value {
      font-size: 1.95rem;
      font-weight: 800;
      color: var(--primary-navy);
      line-height: 1;
    }

    .kpi-label {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
      font-weight: 500;
    }

    .kpi-footer {
      font-size: 0.75rem;
      color: var(--text-muted);
      border-top: 1px solid #f1f5f9;
      padding-top: 0.5rem;
    }

    .text-danger {
      color: #b91c1c;
      font-weight: 600;
    }

    /* Overview Grid */
    .overview-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
    }

    .card {
      background: #ffffff;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      padding: 1.5rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #f1f5f9;
    }

    .card-title {
      font-size: 1.15rem;
      color: var(--primary-navy);
    }

    .card-subtitle {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .view-all-btn {
      background: transparent;
      color: #8B1E1E;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .view-all-btn:hover {
      text-decoration: underline;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .data-table th {
      text-align: left;
      padding: 0.65rem 0.75rem;
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      border-bottom: 1px solid var(--border-color);
    }

    .data-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #f1f5f9;
    }

    .module-chip {
      background: #f1f5f9;
      color: #334155;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-pill-alta,
    .status-pill-baja,
    .status-pill-react {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
      padding: 0.2rem 0.55rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.72rem;
    }

    .text-desc {
      color: #64748b;
      font-size: 0.8rem;
    }

    /* Summary list */
    .today-banner {
      background: #111e33;
      color: #ffffff;
      padding: 0.6rem 0.85rem;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      font-size: 0.8rem;
    }

    .today-tag {
      background: #8B1E1E;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.7rem;
    }

    .appointment-summary-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .app-item-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .baja-border {
      border-left: 3px solid #ef4444;
      opacity: 0.85;
    }

    .app-time-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #ffffff;
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      font-weight: 700;
      font-size: 0.8rem;
      line-height: 1.1;
    }

    .time-sub {
      font-size: 0.65rem;
      color: #64748b;
    }

    .app-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .patient-name {
      font-size: 0.85rem;
      color: #0f172a;
    }

    .doctor-spec {
      font-size: 0.75rem;
      color: #64748b;
    }

    .room-pill {
      font-size: 0.7rem;
      color: #8B1E1E;
      font-weight: 600;
    }

    .status-badge-active {
      font-size: 0.7rem;
      font-weight: 600;
      color: #991b1b;
      background: #fee2e2;
      border: 1px solid #fecaca;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }

    .status-badge-danger {
      font-size: 0.7rem;
      font-weight: 600;
      color: #991b1b;
      background: #fee2e2;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }

    .quick-link-box {
      margin-top: 1.25rem;
    }

    .btn-full {
      width: 100%;
      background: #111e33;
      color: #ffffff;
      padding: 0.65rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.82rem;
      transition: all 0.2s ease;
    }
    .btn-full:hover {
      background: #8B1E1E;
    }

    @media (max-width: 1024px) {
      .overview-grid {
        grid-template-columns: 1fr;
      }
      .hospital-hero {
        flex-direction: column;
        align-items: flex-start;
      }
      .hero-logo-box {
        align-self: center;
      }
    }
  `]
})
export class DashboardComponent {
  auth = inject(AuthService);
  hospitalService = inject(HospitalService);
  auditActionLabel = auditActionLabel;
  @Output() navigateTab = new EventEmitter<string>();

  todayFormatted: string = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  canAccess(tab: string): boolean {
    const roles: string[] = this.auth.user()?.roles ?? [];
    const allowed: Record<string, string[]> = {
      dashboard: ['admin', 'recepcion', 'medico_general', 'especialista', 'farmacia', 'nutricion', 'compras', 'enfermeria', 'cirugia', 'almacen'],
      pacientes: ['admin', 'recepcion', 'medico_general', 'especialista', 'enfermeria', 'cirugia'],
      medicos: ['admin', 'recepcion'],
      consultorios: ['admin', 'recepcion'],
      citas: ['admin', 'recepcion'],
      agenda: ['admin', 'recepcion', 'medico_general', 'especialista', 'cirugia'],
      consultas: ['medico_general', 'especialista', 'cirugia'],
      operaciones: ['especialista', 'cirugia'],
      almacenes: ['admin', 'farmacia', 'compras', 'almacen'],
      farmacia: ['admin', 'farmacia'],
      alimentos: ['admin', 'nutricion'],
      compras: ['admin', 'compras', 'almacen'],
      auditoria: ['admin'],
      usuarios: ['admin'],
      control: ['admin', 'recepcion', 'medico_general', 'especialista', 'farmacia', 'nutricion', 'compras', 'enfermeria', 'cirugia', 'almacen']
    };
    return allowed[tab]?.some(role => roles.includes(role)) ?? false;
  }

  navigate(tab: string) {
    if (!this.canAccess(tab)) return;
    this.navigateTab.emit(tab);
  }
}
