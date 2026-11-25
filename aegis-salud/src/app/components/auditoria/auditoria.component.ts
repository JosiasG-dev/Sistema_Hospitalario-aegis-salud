import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HospitalService } from '../../services/hospital.service';
import { AuditLog, auditActionLabel } from '../../models/audit-log.model';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="audit-page operational-module">
      <header class="page-header module-heading">
        <div>
          <span class="module-kicker">TRAZABILIDAD Y COMPLIANCE HOSPITALARIO</span>
          <h2>Historial Institucional de Ingresos y Egresos</h2>
          <p>
            Registro cronológico de ingresos, egresos, cancelaciones y reingresos en Aegis Salud.
          </p>
        </div>
      </header>

      <div class="operational-summary" aria-label="Resumen de auditoría">
        <article class="operational-stat">
          <span>Eventos registrados</span>
          <strong>{{ hospitalService.auditLogs().length }}</strong>
        </article>
        <article class="operational-stat success">
          <span>Altas e ingresos</span>
          <strong>{{ altaCount }}</strong>
        </article>
        <article class="operational-stat attention">
          <span>Egresos y retiros</span>
          <strong>{{ bajaCount }}</strong>
        </article>
      </div>

      <!-- Filter Controls -->
      <div class="filter-bar module-panel">
        <div class="search-box">
          <input 
            type="text" 
            placeholder="Buscar por nombre, entidad, motivo..." 
            [(ngModel)]="searchQuery" 
            class="search-input" />
        </div>

        <div class="filter-chips">
          <button 
            class="filter-chip" 
            [class.active]="filterAction === 'TODOS'"
            (click)="filterAction = 'TODOS'">
            Todos los Eventos ({{ hospitalService.auditLogs().length }})
          </button>
          <button 
            class="filter-chip alta-chip" 
            [class.active]="filterAction === 'Alta'"
            (click)="filterAction = 'Alta'">
            Altas e ingresos
          </button>
          <button 
            class="filter-chip baja-chip" 
            [class.active]="filterAction === 'Baja'"
            (click)="filterAction = 'Baja'">
            Egresos y retiros
          </button>
        </div>
      </div>

      <!-- Audit Table -->
      <div class="audit-card module-panel">
        <div class="table-responsive">
          <table class="audit-table">
            <thead>
              <tr>
                <th>Código Evento</th>
                <th>Fecha y Hora</th>
                <th>Módulo Hospitalario</th>
                <th>Tipo de Acción</th>
                <th>Sujeto / Recurso</th>
                <th>Motivo de Baja / Causa</th>
                <th>Detalles Técnicos</th>
              </tr>
            </thead>
            <tbody>
              @for (log of filteredLogs; track log.id) {
                <tr [class.baja-row]="log.action === 'Baja'">
                  <td class="log-id">{{ log.id }}</td>
                  <td class="log-time">{{ log.timestamp }}</td>
                  <td>
                    <span class="module-chip">{{ log.entityType }}</span>
                  </td>
                  <td>
                    <span [ngClass]="{
                      'pill-alta': log.action === 'Alta',
                      'pill-baja': log.action === 'Baja',
                      'pill-react': log.action === 'Reactivación'
                    }">
                      {{ auditActionLabel(log) }}
                    </span>
                  </td>
                  <td class="entity-name">
                    <strong>{{ log.entityName }}</strong>
                    <span class="entity-code">ID: {{ log.entityId }}</span>
                  </td>
                  <td class="log-reason">
                    @if (log.reason) {
                      <span class="reason-highlight">{{ log.reason }}</span>
                    } @else {
                      <span class="muted-dash">-</span>
                    }
                  </td>
                  <td class="log-details">{{ log.details || '-' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-cell">No se encontraron registros de auditoría.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .audit-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
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

    .filter-chip.alta-chip.active {
      background: #059669;
      color: #ffffff;
    }

    .filter-chip.baja-chip.active {
      background: #8B1E1E;
      color: #ffffff;
    }

    .audit-card {
      background: #ffffff;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      overflow: hidden;
    }

    .table-responsive {
      overflow-x: auto;
    }

    .audit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .audit-table th {
      background: #f8fafc;
      color: #475569;
      padding: 0.85rem 1rem;
      text-align: left;
      font-weight: 700;
      border-bottom: 2px solid var(--border-color);
      white-space: nowrap;
    }

    .audit-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }

    .baja-row {
      background-color: #fff9f9;
    }

    .log-id {
      font-weight: 700;
      font-size: 0.75rem;
      color: #64748b;
    }

    .log-time {
      color: #475569;
      font-size: 0.8rem;
      white-space: nowrap;
    }

    .module-chip {
      background: #e2e8f0;
      color: #1e293b;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .pill-alta {
      background: #dcfce7;
      color: #15803d;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.72rem;
    }

    .pill-baja {
      background: #fee2e2;
      color: #991b1b;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.72rem;
    }

    .pill-react {
      background: #e0e7ff;
      color: #3730a3;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.72rem;
    }

    .entity-name {
      display: flex;
      flex-direction: column;
    }

    .entity-code {
      font-size: 0.7rem;
      color: #64748b;
    }

    .reason-highlight {
      color: #991b1b;
      font-weight: 600;
      background: #fef2f2;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
    }

    .muted-dash {
      color: #94a3b8;
    }

    .log-details {
      color: #475569;
      font-size: 0.8rem;
    }

    .empty-cell {
      text-align: center;
      padding: 3rem;
      color: #64748b;
    }
  `]
})
export class AuditoriaComponent {
  hospitalService = inject(HospitalService);
  auditActionLabel = auditActionLabel;

  searchQuery = '';
  filterAction: 'TODOS' | 'Alta' | 'Baja' = 'TODOS';

  get altaCount(): number {
    return this.hospitalService.auditLogs().filter(log => log.action === 'Alta').length;
  }

  get bajaCount(): number {
    return this.hospitalService.auditLogs().filter(log => log.action === 'Baja').length;
  }

  get filteredLogs(): AuditLog[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.hospitalService.auditLogs().filter(log => {
      const match =
        !q ||
        log.entityName.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q) ||
        (log.reason && log.reason.toLowerCase().includes(q)) ||
        (log.details && log.details.toLowerCase().includes(q));

      if (!match) return false;

      if (this.filterAction !== 'TODOS') {
        return log.action === this.filterAction;
      }
      return true;
    });
  }
}
