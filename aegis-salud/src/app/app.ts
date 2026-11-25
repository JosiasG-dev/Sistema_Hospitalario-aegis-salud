import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PacientesComponent } from './components/pacientes/pacientes.component';
import { MedicosComponent } from './components/medicos/medicos.component';
import { ConsultoriosComponent } from './components/consultorios/consultorios.component';
import { CitasComponent } from './components/citas/citas.component';
import { AuditoriaComponent } from './components/auditoria/auditoria.component';
import { ConsultasComponent } from './components/consultas/consultas.component';
import { AlmacenesComponent } from './components/almacenes/almacenes.component';
import { OperacionesComponent } from './components/operaciones/operaciones.component';
import { FarmaciaComponent } from './components/farmacia/farmacia.component';
import { AlimentosComponent } from './components/alimentos/alimentos.component';
import { ComprasComponent } from './components/compras/compras.component';
import { LoginComponent } from './components/login/login.component';
import { AuthService } from './services/auth.service';
import { OperationalRecordsService } from './services/operational-records.service';
import { HospitalService } from './services/hospital.service';
import { AgendaComponent } from './components/agenda/agenda.component';
import { UsuariosComponent } from './components/usuarios/usuarios.component';
import { FormDraftService } from './services/form-draft.service';
import { ControlComponent } from './components/control/control.component';

type AppTab =
  | 'dashboard' | 'pacientes' | 'medicos' | 'consultorios' | 'citas' | 'auditoria' | 'agenda'
  | 'consultas' | 'operaciones' | 'almacenes' | 'farmacia' | 'alimentos' | 'compras' | 'usuarios' | 'control';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    SidebarComponent,
    DashboardComponent,
    PacientesComponent,
    MedicosComponent,
    ConsultoriosComponent,
    CitasComponent,
    AuditoriaComponent,
    ConsultasComponent,
    AlmacenesComponent,
    OperacionesComponent,
    FarmaciaComponent,
    AlimentosComponent,
    ComprasComponent,
    LoginComponent,
    AgendaComponent,
    UsuariosComponent,
    ControlComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly currentTab = signal<AppTab>('dashboard');
  readonly auth = inject(AuthService);
  readonly records = inject(OperationalRecordsService);
  readonly hospital = inject(HospitalService);
  readonly drafts = inject(FormDraftService);

  constructor() {
    effect(() => {
      if (this.auth.user()) {
        this.currentTab.set('dashboard');
        void this.hospital.refresh();
        void this.records.refresh();
      }
    });
    void this.auth.initialize();
  }

  setTab(tab: string): void {
    const roles: string[] = this.auth.user()?.roles ?? [];
    const allowed: Record<AppTab, string[]> = {
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
      control: ['admin', 'recepcion', 'medico_general', 'especialista', 'farmacia', 'nutricion', 'compras', 'enfermeria', 'cirugia', 'almacen'],
    };
    if (!Object.hasOwn(allowed, tab) || !allowed[tab as AppTab].some(role => roles.includes(role))) return;
    this.currentTab.set(tab as AppTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
