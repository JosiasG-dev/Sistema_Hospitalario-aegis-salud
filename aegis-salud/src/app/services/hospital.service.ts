import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Patient } from '../models/patient.model';
import { Doctor } from '../models/doctor.model';
import { Room } from '../models/room.model';
import { Appointment } from '../models/appointment.model';
import { AuditLog } from '../models/audit-log.model';
import { spanishErrorMessage } from './spanish-error-message';

interface HospitalBootstrap {
  patients: Patient[];
  doctors: Doctor[];
  rooms: Room[];
  appointments: Appointment[];
  auditLogs: AuditLog[];
}

export interface DoctorAccount {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  canLink: boolean;
  linkedTo: string | null;
}

export interface NurseAccount {
  id: number;
  name: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class HospitalService {
  readonly error = signal('');
  readonly patients = signal<Patient[]>([]);
  readonly doctors = signal<Doctor[]>([]);
  readonly rooms = signal<Room[]>([]);
  readonly appointments = signal<Appointment[]>([]);
  readonly auditLogs = signal<AuditLog[]>([]);

  readonly activePatientsCount = computed(() => this.patients().filter(patient => patient.status === 'Activo').length);
  readonly dischargedPatientsCount = computed(() => this.patients().filter(patient => patient.status === 'Dado de Baja').length);
  readonly activeDoctorsCount = computed(() => this.doctors().filter(doctor => doctor.status === 'Activo').length);
  readonly availableRoomsCount = computed(() => this.rooms().filter(room => room.status === 'Disponible').length);
  readonly activeAppointmentsCount = computed(() => this.appointments().filter(appointment => appointment.status === 'Programada').length);
  readonly dischargedAppointmentsCount = computed(() => this.appointments().filter(appointment => appointment.status === 'Dada de Baja (Cancelada)').length);
  private errorTimeout?: number;

  constructor(private readonly http: HttpClient) {}

  async refresh(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<HospitalBootstrap>('/api/bootstrap'));
      this.patients.set(data.patients);
      this.doctors.set(data.doctors);
      this.rooms.set(data.rooms);
      this.appointments.set(data.appointments);
      this.auditLogs.set(data.auditLogs);
      this.clearError();
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron cargar los datos compartidos del hospital.');
    }
  }

  async addPatient(patient: Omit<Patient, 'id' | 'medicalRecordNumber' | 'status' | 'admissionDate'>): Promise<boolean> {
    return this.mutate('POST', '/api/patients', {
      documentId: patient.documentId, firstName: patient.firstName, lastName: patient.lastName,
      birthDate: patient.birthDate || null, gender: patient.gender, phone: patient.phone,
      email: patient.email, bloodType: patient.bloodType, allergies: patient.allergies,
      temperatureC: patient.temperatureC, heightCm: patient.heightCm,
      insuranceProvider: patient.insuranceProvider, insurancePolicy: patient.insurancePolicy,
      insuranceCoveragePercent: patient.insuranceCoveragePercent,
      emergencyContact: patient.emergencyContact,
    });
  }

  async updatePatient(id: string, patient: Partial<Patient> & { confirmPassword?: string }): Promise<boolean> {
    return this.mutate('PUT', `/api/patients/${encodeURIComponent(id)}`, {
      documentId: patient.documentId, firstName: patient.firstName, lastName: patient.lastName,
      birthDate: patient.birthDate, gender: patient.gender, phone: patient.phone,
      email: patient.email, bloodType: patient.bloodType, allergies: patient.allergies,
      temperatureC: patient.temperatureC, heightCm: patient.heightCm,
      insuranceProvider: patient.insuranceProvider, insurancePolicy: patient.insurancePolicy,
      insuranceCoveragePercent: patient.insuranceCoveragePercent,
      emergencyContact: patient.emergencyContact,
      confirmPassword: patient.confirmPassword,
    });
  }

  async requestDischarge(id: string, notes?: string): Promise<boolean> {
    return this.mutate('POST', `/api/patients/${encodeURIComponent(id)}/request-discharge`, { notes });
  }

  async requestMedicalDischarge(id: string, notes: string): Promise<boolean> {
    return this.mutate('POST', `/api/patients/${encodeURIComponent(id)}/medical-discharge`, { notes });
  }

  async completeAdministrativeDischarge(id: string, masterPassword: string): Promise<boolean> {
    return this.mutate('POST', `/api/patients/${encodeURIComponent(id)}/administrative-discharge`, { masterPassword });
  }

  async reactivatePatient(id: string): Promise<boolean> {
    return this.mutate('PATCH', `/api/patients/${encodeURIComponent(id)}/status`, { status: 'Activo' });
  }

  async addDoctor(doctor: Omit<Doctor, 'id' | 'status' | 'registrationDate'>): Promise<boolean> {
    return this.mutate('POST', '/api/doctors', {
      licenseNumber: doctor.licenseNumber, firstName: doctor.firstName, lastName: doctor.lastName,
      specialty: doctor.specialty, phone: doctor.phone, email: doctor.email, shift: doctor.shift,
      assignedRoomId: doctor.assignedRoomId || null, userId: doctor.userId,
    });
  }

  async updateDoctor(id: string, doctor: Omit<Doctor, 'id' | 'status' | 'registrationDate'> & { confirmPassword?: string }): Promise<boolean> {
    return this.mutate('PUT', `/api/doctors/${encodeURIComponent(id)}`, {
      licenseNumber: doctor.licenseNumber, firstName: doctor.firstName, lastName: doctor.lastName,
      specialty: doctor.specialty, phone: doctor.phone, email: doctor.email, shift: doctor.shift,
      assignedRoomId: doctor.assignedRoomId || null, userId: doctor.userId,
      confirmPassword: doctor.confirmPassword,
    });
  }

  async getDoctorAccounts(doctorId?: string): Promise<DoctorAccount[]> {
    try {
      const query = doctorId ? `?doctorId=${encodeURIComponent(doctorId)}` : '';
      return await firstValueFrom(this.http.get<DoctorAccount[]>(`/api/doctor-accounts${query}`));
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron cargar las cuentas médicas disponibles.');
      return [];
    }
  }

  async getNurseAccounts(): Promise<NurseAccount[]> {
    try {
      return await firstValueFrom(this.http.get<NurseAccount[]>('/api/nurse-accounts'));
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron cargar las cuentas activas de Enfermería.');
      return [];
    }
  }

  async dischargeDoctor(id: string, reason: string, confirmPassword?: string): Promise<boolean> {
    return this.mutate('PATCH', `/api/doctors/${encodeURIComponent(id)}/status`, {
      status: 'Dado de Baja', dischargeReason: reason, confirmPassword,
    });
  }

  async reactivateDoctor(id: string): Promise<boolean> {
    return this.mutate('PATCH', `/api/doctors/${encodeURIComponent(id)}/status`, { status: 'Activo' });
  }

  async addRoom(room: Omit<Room, 'id' | 'registrationDate'> & { confirmPassword?: string }): Promise<boolean> {
    return this.mutate('POST', '/api/rooms', room);
  }

  async updateRoom(id: string, room: Partial<Room> & { confirmPassword?: string }): Promise<boolean> {
    return this.mutate('PUT', `/api/rooms/${encodeURIComponent(id)}`, room);
  }

  async dischargeRoom(id: string, reason: string, confirmPassword?: string): Promise<boolean> {
    return this.mutate('PATCH', `/api/rooms/${encodeURIComponent(id)}/status`, {
      status: 'Dado de Baja', dischargeReason: reason, confirmPassword,
    });
  }

  async reactivateRoom(id: string): Promise<boolean> {
    return this.mutate('PATCH', `/api/rooms/${encodeURIComponent(id)}/status`, { status: 'Disponible' });
  }

  async createAppointment(appointment: Omit<Appointment, 'id' | 'status' | 'creationDate'>): Promise<boolean> {
    return this.mutate('POST', '/api/appointments', {
      patientId: appointment.patientId, doctorId: appointment.doctorId, roomId: appointment.roomId,
      appointmentDate: appointment.appointmentDate, appointmentTime: appointment.appointmentTime,
      reason: appointment.reason,
    });
  }

  async updateAppointment(appointmentId: string, appointment: {
    patientId: string;
    doctorId: string;
    roomId?: string;
    appointmentDate: string;
    appointmentTime: string;
    reason: string;
    confirmPassword: string;
  }): Promise<boolean> {
    return this.mutate('PUT', `/api/appointments/${encodeURIComponent(appointmentId)}`, appointment);
  }

  async dischargeAppointmentPatient(appointmentId: string, reason: string, cancelledBy = 'Recepción Hospitalaria', confirmPassword?: string): Promise<boolean> {
    return this.mutate('PATCH', `/api/appointments/${encodeURIComponent(appointmentId)}/status`, {
      status: 'Dada de Baja (Cancelada)', dischargeReason: reason, dischargeBy: cancelledBy, confirmPassword,
    });
  }

  async reactivateAppointment(appointmentId: string): Promise<boolean> {
    return this.mutate('PATCH', `/api/appointments/${encodeURIComponent(appointmentId)}/status`, { status: 'Programada' });
  }

  async attendAppointment(appointmentId: string): Promise<boolean> {
    return this.mutate('POST', `/api/appointments/${encodeURIComponent(appointmentId)}/attend`, {});
  }

  clearError(): void {
    this.error.set('');
    if (this.errorTimeout !== undefined) {
      window.clearTimeout(this.errorTimeout);
      this.errorTimeout = undefined;
    }
  }

  reportError(message: string): void {
    this.error.set(message);
    if (this.errorTimeout !== undefined) window.clearTimeout(this.errorTimeout);
    this.errorTimeout = window.setTimeout(() => this.clearError(), 10_000);
  }

  private async mutate(method: 'POST' | 'PUT' | 'PATCH', url: string, body: unknown): Promise<boolean> {
    try {
      await firstValueFrom(this.http.request(method, url, { body }));
      await this.refresh();
      return !this.error();
    } catch (error: unknown) {
      this.setError(error, 'No se pudo guardar el cambio. Revise sus permisos y los datos ingresados.');
      return false;
    }
  }

  private setError(error: unknown, fallback: string): void {
    this.error.set(spanishErrorMessage(error, fallback));
    if (this.errorTimeout !== undefined) window.clearTimeout(this.errorTimeout);
    this.errorTimeout = window.setTimeout(() => this.clearError(), 10_000);
  }
}
