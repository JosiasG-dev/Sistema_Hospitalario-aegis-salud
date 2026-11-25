import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HospitalService } from '../../services/hospital.service';
import { AuthService } from '../../services/auth.service';
import { OperationalRecordsService } from '../../services/operational-records.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="hospital-navbar">
      <div class="brand-container">
        <div class="logo-wrapper">
          <img src="assets/logo-cropped.jpg" alt="Logotipo de Aegis Salud" class="brand-logo" />
        </div>
        <div class="brand-text">
          <h1 class="hospital-title">Aegis Salud</h1>
          <span class="hospital-subtitle">Sistema Integral de Gestión y Control Hospitalario</span>
        </div>
      </div>

      <div class="navbar-right">
        <div class="status-pill active-badge">
          <span class="pulse-dot"></span>
          <span>Centro Médico Operativo</span>
        </div>

        <div class="quick-stats">
          <div class="stat-item">
            <span class="stat-number">{{ hospitalService.activePatientsCount() }}</span>
            <span class="stat-label">Pacientes</span>
          </div>
          <div class="divider"></div>
          <div class="stat-item">
            <span class="stat-number">{{ hospitalService.activeDoctorsCount() }}</span>
            <span class="stat-label">Médicos</span>
          </div>
          <div class="divider"></div>
          <div class="stat-item">
            <span class="stat-number">{{ hospitalService.availableRoomsCount() }}</span>
            <span class="stat-label">Consultorios</span>
          </div>
        </div>

        <div class="hospital-badge-box">
          <div class="notification-wrap">
            <button type="button" class="notification-button" (click)="toggleNotifications()"
              [attr.aria-expanded]="showNotifications" aria-label="Notificaciones">
              Notificaciones <span>{{ unreadNotifications }}</span>
            </button>
            @if (showNotifications) {
              <div class="notification-panel">
                <div class="notification-panel-header">
                  <h3>Notificaciones</h3>
                  <button type="button" class="mark-all-button" (click)="markAllRead()"
                    [disabled]="unreadNotifications === 0" aria-label="Marcar todas como vistas" title="Marcar todas como vistas">
                    &#10003;
                  </button>
                </div>
                @for (notification of records.notifications(); track notification.id) {
                  <button type="button" class="notification-item" [class.unread]="!notification.read_at"
                    (click)="markRead(notification.id)">
                    <strong>{{ notification.title }}</strong>
                    <span>{{ notification.body }}</span>
                    <small>{{ notification.created_at | date:'short' }}</small>
                  </button>
                } @empty {
                  <p>No hay notificaciones.</p>
                }
              </div>
            }
          </div>
          <div class="user-session">
            <span class="hospital-id-badge">{{ auth.user()?.name }} · {{ roleLabel }}</span>
            <button type="button" class="logout-button" (click)="auth.logout()">Cerrar sesión</button>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 999;
    }

    .hospital-navbar {
      height: 74px;
      background: linear-gradient(135deg, #111e33 0%, #192a47 100%);
      border-bottom: 3px solid #8B1E1E;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.75rem;
      color: #ffffff;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    }

    .brand-container {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .logo-wrapper {
      width: 56px;
      height: 56px;
      border-radius: 10px;
      background: #ffffff;
      padding: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      border: 2px solid #8B1E1E;
      overflow: hidden;
    }

    .brand-logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .hospital-title {
      font-size: 1.45rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      line-height: 1.1;
      margin: 0;
      white-space: nowrap;
    }

    .hospital-subtitle {
      font-size: 0.72rem;
      color: #94a3b8;
      font-weight: 500;
      letter-spacing: 0.3px;
    }

    .navbar-right {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .status-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(52, 211, 153, 0.4);
      color: #34d399;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.35rem 0.8rem;
      border-radius: 9999px;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      background-color: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse 1.8s infinite;
    }

    @keyframes pulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 7px rgba(16, 185, 129, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
      }
    }

    .quick-stats {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 0.35rem 1rem;
      border-radius: 10px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.1;
    }

    .stat-number {
      font-size: 0.95rem;
      font-weight: 700;
      color: #f8fafc;
    }

    .stat-label {
      font-size: 0.65rem;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .divider {
      width: 1px;
      height: 20px;
      background: rgba(255, 255, 255, 0.2);
    }

    .hospital-id-badge {
      font-size: 0.75rem;
      background: #8B1E1E;
      color: #ffffff;
      padding: 0.35rem 0.85rem;
      border-radius: 6px;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(139, 30, 30, 0.4);
    }

    .hospital-badge-box,.user-session { display: flex; align-items: center; gap: .5rem; }
    .notification-wrap { position: relative; }
    .notification-button,.logout-button {
      border: 1px solid #ffffff36; border-radius: .45rem; color: white; background: #ffffff12;
      padding: .45rem .6rem; cursor: pointer; font: inherit; font-size: .75rem;
    }
    .notification-button span { display: inline-grid; place-items: center; min-width: 1.2rem; height: 1.2rem; margin-left: .25rem; border-radius: 999px; background: #8b1e1e; }
    .notification-panel { position: absolute; z-index: 1001; top: calc(100% + .55rem); right: 0; width: min(22rem, 90vw); max-height: 24rem; overflow: auto; padding: .75rem; border: 1px solid #cbd5e1; border-radius: .7rem; background: white; color: #0f172a; box-shadow: 0 12px 30px #0f172a2a; }
    .notification-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .45rem; }
    .notification-panel h3 { margin: .25rem .25rem .6rem; font-size: 1rem; }
    .mark-all-button { width: 2rem; height: 2rem; border: 1px solid #10b981; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 1.1rem; font-weight: 900; cursor: pointer; }
    .mark-all-button:disabled { opacity: .45; cursor: default; }
    .notification-panel > p { padding: .5rem; color: #64748b; }
    .notification-item { display: grid; width: 100%; gap: .2rem; text-align: left; border: 0; border-top: 1px solid #e2e8f0; background: white; padding: .65rem .4rem; cursor: pointer; color: #334155; }
    .notification-item.unread { background: #f8fafc; font-weight: 800; color: #0f172a; }
    .notification-item.unread strong { font-weight: 900; }
    .notification-item:not(.unread) strong { font-weight: 500; }
    .notification-item span { font-size: .8rem; }
    .notification-item small { color: #64748b; }

    @media (max-width: 900px) {
      .quick-stats, .status-pill {
        display: none;
      }
    }

    @media (max-width: 768px) {
      .hospital-navbar {
        padding: 0 0.75rem;
      }

      .logo-wrapper {
        width: 46px;
        height: 46px;
      }

      .brand-container {
        gap: 0.65rem;
      }

      .hospital-title {
        font-size: 1.2rem;
      }

      .hospital-subtitle {
        display: none;
      }

      .hospital-badge-box { gap: .3rem; }
      .notification-button,.logout-button { font-size: .68rem; padding: .35rem; }
    }
  `]
})
export class NavbarComponent implements OnInit, OnDestroy {
  readonly hospitalService = inject(HospitalService);
  readonly auth = inject(AuthService);
  readonly records = inject(OperationalRecordsService);
  showNotifications = false;
  private refreshHandle?: number;
  private notificationTimeout?: number;

  get unreadNotifications(): number {
    return this.records.notifications().filter(notification => !notification.read_at).length;
  }

  get roleLabel(): string {
    const roles: Record<string, string> = {
      admin: 'Administración', recepcion: 'Recepción', medico_general: 'Medicina general',
      especialista: 'Especialista', farmacia: 'Farmacia', nutricion: 'Nutrición', compras: 'Compras',
      enfermeria: 'Enfermería', cirugia: 'Cirugía', almacen: 'Almacén',
    };
    return roles[this.auth.user()?.role ?? ''] ?? 'Personal';
  }

  ngOnInit(): void {
    this.refreshHandle = window.setInterval(() => void this.records.refreshNotifications(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshHandle !== undefined) window.clearInterval(this.refreshHandle);
    this.clearNotificationTimeout();
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.resetNotificationTimeout();
    } else {
      this.clearNotificationTimeout();
    }
  }

  closeNotifications(): void {
    this.showNotifications = false;
    this.clearNotificationTimeout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showNotifications) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-wrap')) this.closeNotifications();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeNotifications();
  }

  private resetNotificationTimeout(): void {
    this.clearNotificationTimeout();
    this.notificationTimeout = window.setTimeout(() => this.closeNotifications(), 5_000);
  }

  private clearNotificationTimeout(): void {
    if (this.notificationTimeout !== undefined) {
      window.clearTimeout(this.notificationTimeout);
      this.notificationTimeout = undefined;
    }
  }

  markRead(id: number): void {
    void this.records.markNotificationRead(id);
    this.resetNotificationTimeout();
  }

  async markAllRead(): Promise<void> {
    await this.records.markAllNotificationsRead();
    this.resetNotificationTimeout();
  }
}
