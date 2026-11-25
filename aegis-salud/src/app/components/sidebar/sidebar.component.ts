import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HospitalService } from '../../services/hospital.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="hospital-sidebar">
      <div class="sidebar-section-title">ADMINISTRACIÓN HOSPITALARIA</div>

      <nav class="nav-list">
        <button 
          class="nav-item" 
          *ngIf="canAccess('dashboard')"
          [class.active]="activeTab === 'dashboard'"
          (click)="onSelectTab('dashboard')">
          <span class="label">Panel General</span>
        </button>

        <button 
          class="nav-item" 
          *ngIf="canAccess('pacientes')"
          [class.active]="activeTab === 'pacientes'"
          (click)="onSelectTab('pacientes')">
          <span class="label">Pacientes</span>
          <span class="badge" title="Activos">{{ hospitalService.activePatientsCount() }}</span>
        </button>

        <button 
          class="nav-item" 
          *ngIf="canAccess('medicos')"
          [class.active]="activeTab === 'medicos'"
          (click)="onSelectTab('medicos')">
          <span class="label">Médicos</span>
          <span class="badge" title="Activos">{{ hospitalService.activeDoctorsCount() }}</span>
        </button>

        <button 
          class="nav-item" 
          *ngIf="canAccess('consultorios')"
          [class.active]="activeTab === 'consultorios'"
          (click)="onSelectTab('consultorios')">
          <span class="label">Consultorios</span>
          <span class="badge" title="Disponibles">{{ hospitalService.availableRoomsCount() }}</span>
        </button>

        <button 
          class="nav-item" 
          *ngIf="canAccess('citas')"
          [class.active]="activeTab === 'citas'"
          (click)="onSelectTab('citas')">
          <div class="label-group">
            <span class="label">Citas Médicas</span>
            <span class="sub-label">Gestión y Cancelaciones</span>
          </div>
          <span class="badge crimson-badge" title="Programadas">{{ hospitalService.activeAppointmentsCount() }}</span>
        </button>

        <button *ngIf="canAccess('agenda')" class="nav-item" [class.active]="activeTab === 'agenda'" (click)="onSelectTab('agenda')">
          <span class="label">Agenda y disponibilidad</span>
        </button>

        <button *ngIf="canAccess('consultas')" class="nav-item" [class.active]="activeTab === 'consultas'" (click)="onSelectTab('consultas')">
          <span class="label">Consultas</span>
        </button>

        <button *ngIf="canAccess('operaciones')" class="nav-item" [class.active]="activeTab === 'operaciones'" (click)="onSelectTab('operaciones')">
          <span class="label">Operaciones</span>
        </button>

        <button *ngIf="canAccess('almacenes')" class="nav-item" [class.active]="activeTab === 'almacenes'" (click)="onSelectTab('almacenes')">
          <span class="label">Almacenes</span>
        </button>

        <button *ngIf="canAccess('farmacia')" class="nav-item" [class.active]="activeTab === 'farmacia'" (click)="onSelectTab('farmacia')">
          <span class="label">Farmacia</span>
        </button>

        <button *ngIf="canAccess('alimentos')" class="nav-item" [class.active]="activeTab === 'alimentos'" (click)="onSelectTab('alimentos')">
          <span class="label">Alimentos</span>
        </button>

        <button *ngIf="canAccess('compras')" class="nav-item" [class.active]="activeTab === 'compras'" (click)="onSelectTab('compras')">
          <span class="label">Compras</span>
        </button>

        <ng-container *ngIf="canAccess('auditoria')">
          <div class="sidebar-divider"></div>
          <div class="sidebar-section-title">CONTROL Y TRAZABILIDAD</div>
        </ng-container>

        <button 
          class="nav-item" 
          *ngIf="canAccess('auditoria')"
          [class.active]="activeTab === 'auditoria'"
          (click)="onSelectTab('auditoria')">
          <span class="label">Historial de Movimientos</span>
          <span class="badge gray-badge">{{ hospitalService.auditLogs().length }}</span>
        </button>

        <button *ngIf="canAccess('usuarios')" class="nav-item" [class.active]="activeTab === 'usuarios'" (click)="onSelectTab('usuarios')">
          <span class="label">Usuarios y roles</span>
        </button>
        <button *ngIf="canAccess('control')" class="nav-item" [class.active]="activeTab === 'control'" (click)="onSelectTab('control')">
          <span class="label">Seguridad y control</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="hospital-shield-card">
          <div class="shield-tag">AEGIS HOSPITAL CORE</div>
          <div class="shield-desc">Sistema de gestión hospitalaria</div>
          <div class="version-tag">Aegis Salud v1.0.0</div>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .hospital-sidebar {
      flex: 0 0 260px;
      width: 260px;
      background: #0f172a;
      border-right: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 74px);
      position: sticky;
      top: 74px;
      align-self: flex-start;
      overflow-y: auto;
      padding: 1.25rem 0.85rem;
      user-select: none;
    }

    @media (max-width: 768px) {
      .hospital-sidebar {
        flex: 0 0 auto;
        width: 100%;
        height: auto;
        position: static;
        overflow: visible;
        padding: 0.75rem;
      }

      .nav-list {
        display: grid;
        flex: none;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.35rem;
      }

      .nav-item {
        min-width: 0;
        padding: 0.65rem;
      }

      .sidebar-section-title,
      .sidebar-divider {
        grid-column: 1 / -1;
      }

      .sidebar-footer {
        display: none;
      }
    }

    .sidebar-section-title {
      font-size: 0.68rem;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.8px;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.35rem;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      flex: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 0.85rem;
      border-radius: 8px;
      background: transparent;
      color: #94a3b8;
      font-size: 0.88rem;
      font-weight: 500;
      width: 100%;
      text-align: left;
      transition: all 0.2s ease;
      position: relative;
    }

    .nav-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #f1f5f9;
    }

    .nav-item.active {
      background: linear-gradient(90deg, rgba(139, 30, 30, 0.25) 0%, rgba(139, 30, 30, 0.1) 100%);
      color: #ffffff;
      font-weight: 600;
      border-left: 4px solid #8B1E1E;
    }

    .label-group {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .label {
      flex: 1;
    }

    .sub-label {
      font-size: 0.68rem;
      color: #8B1E1E;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.15rem 0.55rem;
      border-radius: 9999px;
      background: #1e293b;
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.2);
    }

    .crimson-badge {
      background: rgba(139, 30, 30, 0.3);
      color: #f87171;
      border: 1px solid rgba(248, 113, 113, 0.3);
    }

    .gray-badge {
      background: #334155;
      color: #cbd5e1;
      border: 1px solid #475569;
    }

    .sidebar-divider {
      height: 1px;
      background: #1e293b;
      margin: 1rem 0.5rem;
    }

    .sidebar-footer {
      padding-top: 1rem;
    }

    .hospital-shield-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 0.85rem;
      text-align: center;
    }

    .shield-tag {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 1px;
      color: #8B1E1E;
    }

    .shield-desc {
      font-size: 0.75rem;
      color: #94a3b8;
      margin: 0.2rem 0 0.4rem;
    }

    .version-tag {
      font-size: 0.65rem;
      color: #64748b;
    }
  `]
})
export class SidebarComponent {
  hospitalService = inject(HospitalService);
  @Input() activeTab: string = 'dashboard';
  @Input() roles: string[] = [];
  @Output() tabChange = new EventEmitter<string>();

  canAccess(tab: string): boolean {
    const roles: Record<string, string[]> = {
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
    return roles[tab]?.some(role => this.roles.includes(role)) ?? false;
  }

  onSelectTab(tab: string) {
    this.tabChange.emit(tab);
  }
}
