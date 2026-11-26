import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ConsultationRecord,
  DispensationRecord,
  InventoryCategory,
  InventoryItem,
  MealOrderRecord,
  OperationRecord,
  PurchaseOrderRecord,
  SupplierRecord
} from '../models/operational-records.model';
import { Room } from '../models/room.model';
import { AuditLog } from '../models/audit-log.model';
import { spanishErrorMessage } from './spanish-error-message';

export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  room_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  shift: string;
  is_active: boolean;
  doctor?: { first_name: string; last_name: string; specialty: string };
  room?: { code: string; name: string };
}

export interface AvailabilityEntry extends Room {
  doctors: Array<{
    doctorId: string;
    doctorName: string;
    specialty: string;
    startTime: string;
    endTime: string;
    shift: string;
  }>;
  isAvailable: boolean;
  hasAssignedDoctor: boolean;
}

export interface RoomReservation {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

export interface AppointmentSuggestion {
  date: string;
  time: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  roomId: string;
  roomName: string;
  roomCode: string;
}

export interface DoctorHistory {
  doctor: { firstName: string; lastName: string; specialty: string };
  date: string;
  appointments: Array<{
    id: string; patientName: string; roomName: string; appointmentDate: string;
    appointmentTime: string; attendedAt: string | null; status?: string;
  }>;
  schedules: Array<{
    dayOfWeek: number; startTime: string; endTime: string; shift: string;
    roomName: string; recordedAt: string;
  }>;
  assignments?: Array<{
    id: string; shift: string; shiftLabel: string; roomName: string; changeReason?: string;
  }>;
}

export interface RoomAuditPage {
  data: AuditLog[];
  currentPage: number;
  lastPage: number;
}

export interface HospitalNotification {
  id: number;
  user_id: number | null;
  title: string;
  body: string;
  type: string;
  read_at: string | null;
  created_at: string;
}

export interface AreaStaffMember {
  id: number;
  name: string;
}

export interface DoctorAssignmentRecord {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  roomId: string;
  roomCode: string;
  roomName: string;
  date: string;
  shift: 'M' | 'T' | 'N';
  shiftName: string;
  shiftLabel: string;
  changeReason?: string;
  createdAt?: string;
}

export interface DemandMetrics {
  date: string;
  appointmentsByShift: { M: number; T: number; N: number };
  doctorsByShift: { M: number; T: number; N: number };
  highestDemand: 'M' | 'T' | 'N';
}

export interface DemandRotationResult {
  date: string;
  rotatedCount: number;
  demand: Record<string, number>;
  highestDemandShift: string;
  highestDemandLabel: string;
  log: string[];
  assignments: DoctorAssignmentRecord[];
}

export interface AreaStaff {
  farmacia: AreaStaffMember[];
  almacen: AreaStaffMember[];
  alimentos: AreaStaffMember[];
}

interface RecordsBootstrap {
  consultations: ConsultationRecord[];
  operations: OperationRecord[];
  inventory: InventoryItem[];
  dispensations: DispensationRecord[];
  mealOrders: MealOrderRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  suppliers?: SupplierRecord[];
  schedules: DoctorSchedule[];
  doctorAssignments?: DoctorAssignmentRecord[];
  notifications: HospitalNotification[];
}

@Injectable({ providedIn: 'root' })
export class OperationalRecordsService {
  readonly storageError = signal('');
  readonly consultations = signal<ConsultationRecord[]>([]);
  readonly operations = signal<OperationRecord[]>([]);
  readonly inventory = signal<InventoryItem[]>([]);
  readonly dispensations = signal<DispensationRecord[]>([]);
  readonly mealOrders = signal<MealOrderRecord[]>([]);
  readonly purchaseOrders = signal<PurchaseOrderRecord[]>([]);
  readonly suppliers = signal<SupplierRecord[]>([]);
  readonly schedules = signal<DoctorSchedule[]>([]);
  readonly doctorAssignments = signal<DoctorAssignmentRecord[]>([]);
  readonly notifications = signal<HospitalNotification[]>([]);
  readonly areaStaff = signal<AreaStaff>({ farmacia: [], almacen: [], alimentos: [] });
  private errorTimeout?: number;

  constructor(private readonly http: HttpClient) {}

  async refresh(): Promise<void> {
    try {
      const state = await firstValueFrom(this.http.get<RecordsBootstrap>('/api/bootstrap'));
      this.consultations.set(state.consultations);
      this.operations.set(state.operations);
      this.inventory.set(state.inventory);
      this.dispensations.set(state.dispensations);
      this.mealOrders.set(state.mealOrders);
      this.purchaseOrders.set(state.purchaseOrders);
      if (state.suppliers) {
        this.suppliers.set(state.suppliers);
      }
      this.schedules.set(state.schedules);
      if (state.doctorAssignments) {
        this.doctorAssignments.set(state.doctorAssignments);
      }
      this.notifications.set(state.notifications);
      this.clearError();
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron cargar los módulos desde la base de datos.');
    }
  }

  addConsultation(record: Omit<ConsultationRecord, 'id'>): Promise<boolean> {
    return this.mutate('POST', '/api/consultations', {
      patientId: record.patientId, doctorId: record.doctorId, consultationType: record.consultationType,
      specialty: record.specialty, scheduledAt: record.scheduledAt, reason: record.reason, notes: record.notes,
      diagnosis: record.diagnosis, vitals: record.vitals, treatmentPlan: record.treatmentPlan,
      specialtyData: record.specialtyData, nutritionDiet: record.nutritionDiet,
      nutritionOrder: record.nutritionOrder, nutritionInstructions: record.nutritionInstructions,
    });
  }

  addConsultationAddendum(id: string, notes: string): Promise<boolean> {
    return this.mutate('POST', `/api/consultations/${encodeURIComponent(id)}/addenda`, { notes });
  }

  setConsultationStatus(id: string, status: ConsultationRecord['status']): Promise<boolean> {
    return this.updateConsultation(id, { status });
  }

  updateConsultation(id: string, update: Partial<ConsultationRecord>): Promise<boolean> {
    return this.mutate('PATCH', `/api/consultations/${encodeURIComponent(id)}`, {
      diagnosis: update.diagnosis, vitals: update.vitals, treatmentPlan: update.treatmentPlan,
      specialtyData: update.specialtyData, nutritionDiet: update.nutritionDiet,
      nutritionOrder: update.nutritionOrder, nutritionInstructions: update.nutritionInstructions,
      status: update.status, notes: update.notes,
    });
  }

  addOperation(record: Omit<OperationRecord, 'id'>): Promise<boolean> {
    return this.mutate('POST', '/api/operations', {
      patientId: record.patientId, procedure: record.procedure, surgeonName: record.surgeonName,
      scheduledAt: record.scheduledAt, room: record.room,
    });
  }

  setOperationStatus(id: string, status: OperationRecord['status']): Promise<boolean> {
    return this.mutate('PATCH', `/api/operations/${encodeURIComponent(id)}`, { status });
  }

  addInventoryItem(record: Omit<InventoryItem, 'id'>): Promise<boolean> {
    return this.mutate('POST', '/api/inventory', {
      name: record.name, category: record.category, unit: record.unit, stock: record.stock,
      minimumStock: record.minimumStock, expirationDate: record.expirationDate || null,
      batchCode: record.batchCode || null, unitCost: record.unitCost,
      unitPrice: record.unitPrice, isControlled: record.isControlled,
    });
  }

  adjustStock(id: string, amount: number, lot?: {
    batchCode: string; expirationDate: string; unitCost: number;
  }): Promise<boolean> {
    return this.mutate('PATCH', `/api/inventory/${encodeURIComponent(id)}/stock`, { amount, ...lot });
  }

  dispense(record: {
    patientId: string;
    itemId: string;
    quantity: number;
    prescription: string;
    responsibleId?: number | null;
    prescriberEmail?: string;
    prescriberPassword?: string;
  }): Promise<boolean> {
    return this.mutate('POST', '/api/dispensations', record);
  }

  setDispensationStatus(
    id: string,
    status: 'Solicitada' | 'Surtida' | 'Autorizada' | 'Cancelada',
    extra?: { responsibleId?: number; prescriberEmail?: string; prescriberPassword?: string }
  ): Promise<boolean> {
    return this.mutate('PATCH', `/api/dispensations/${encodeURIComponent(id)}`, { status, ...extra });
  }

  async loadAreaStaff(): Promise<void> {
    try {
      this.areaStaff.set(await firstValueFrom(this.http.get<AreaStaff>('/api/area-staff')));
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron cargar los encargados de área.');
    }
  }

  addMealOrder(record: Omit<MealOrderRecord, 'id'>): Promise<boolean> {
    return this.mutate('POST', '/api/meal-orders', {
      patientId: record.patientId, meal: record.meal, diet: record.diet,
      deliveryDate: record.deliveryDate, notes: record.notes, chargeAmount: record.chargeAmount ?? 0,
    });
  }

  setMealOrderStatus(id: string, status: MealOrderRecord['status'], preparedFood?: string): Promise<boolean> {
    return this.mutate('PATCH', `/api/meal-orders/${encodeURIComponent(id)}`, {
      status,
      ...(preparedFood ? { preparedFood } : {}),
    });
  }

  addPurchaseOrder(record: Omit<PurchaseOrderRecord, 'id'>): Promise<boolean> {
    return this.mutate('POST', '/api/purchase-orders', {
      supplier: record.supplier, itemName: record.itemName, category: record.category,
      unit: record.unit, quantity: record.quantity, unitCost: record.unitCost, requestedAt: record.requestedAt,
    });
  }

  setPurchaseOrderStatus(id: string, status: PurchaseOrderRecord['status']): Promise<boolean> {
    return this.mutate('PATCH', `/api/purchase-orders/${encodeURIComponent(id)}`, { status });
  }

  getItemCategory(category: InventoryCategory): InventoryItem[] {
    return this.inventory().filter(item => item.category === category);
  }

  async getAvailability(date: string, startTime: string, endTime: string): Promise<AvailabilityEntry[] | null> {
    try {
      const query = new URLSearchParams({ date, start_time: startTime, end_time: endTime });
      return await firstValueFrom(this.http.get<AvailabilityEntry[]>(`/api/availability?${query}`));
    } catch (error: unknown) {
      this.setError(error, 'No se pudo consultar la disponibilidad para ese horario.');
      return null;
    }
  }

  async getAppointmentSuggestions(options: {
    patientId?: string;
    doctorId?: string;
    date?: string;
    startTime?: string;
  }): Promise<AppointmentSuggestion[]> {
    try {
      const params = new URLSearchParams();
      if (options.patientId) params.set('patientId', options.patientId);
      if (options.doctorId) params.set('doctorId', options.doctorId);
      if (options.date) params.set('date', options.date);
      if (options.startTime) params.set('start_time', options.startTime);
      return await firstValueFrom(this.http.get<AppointmentSuggestion[]>(`/api/appointment-suggestions?${params}`));
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron consultar los horarios alternativos.');
      return [];
    }
  }

  async getRoomReservations(from: string, to: string): Promise<RoomReservation[]> {
    try {
      const query = new URLSearchParams({ from, to });
      return await firstValueFrom(this.http.get<RoomReservation[]>(`/api/room-reservations?${query}`));
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron cargar las reservas de consultorios.');
      return [];
    }
  }

  createRoomReservation(reservation: {
    roomId: string; title: string; reason: string; startsAt: string; endsAt: string;
  }): Promise<boolean> {
    return this.mutate('POST', '/api/room-reservations', reservation);
  }

  cancelRoomReservation(id: string, reason: string): Promise<boolean> {
    return this.mutate('PATCH', `/api/room-reservations/${encodeURIComponent(id)}/cancel`, { reason });
  }

  async getDoctorHistory(doctorId: string, date: string): Promise<DoctorHistory | null> {
    try {
      const query = new URLSearchParams({ doctorId, date });
      return await firstValueFrom(this.http.get<DoctorHistory>(`/api/doctor-history?${query}`));
    } catch (error: unknown) {
      this.setError(error, 'No se pudo consultar el historial del médico.');
      return null;
    }
  }

  async getRoomAudit(page = 1): Promise<RoomAuditPage | null> {
    try {
      return await firstValueFrom(this.http.get<RoomAuditPage>(`/api/room-audit?page=${page}`));
    } catch (error: unknown) {
      this.setError(error, 'No se pudo consultar la bitácora de consultorios.');
      return null;
    }
  }

  async createSchedule(schedule: {
    doctorId: string; roomId: string; dayOfWeek: number; startTime: string;
    endTime: string; shift: string;
  }): Promise<boolean> {
    return this.mutate('POST', '/api/schedules', schedule);
  }

  async updateSchedule(id: string, schedule: Partial<{
    doctorId: string; roomId: string; dayOfWeek: number; startTime: string;
    endTime: string; shift: string;
  }>): Promise<boolean> {
    return this.mutate('PATCH', `/api/schedules/${encodeURIComponent(id)}`, schedule);
  }

  async markNotificationRead(id: number): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`/api/notifications/${id}/read`, {}));
      await this.refresh();
    } catch (error: unknown) {
      this.setError(error, 'No se pudo marcar la notificación como leída.');
    }
  }

  async markAllNotificationsRead(): Promise<void> {
    try {
      await firstValueFrom(this.http.patch('/api/notifications/read-all', {}));
      await this.refreshNotifications();
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron marcar todas las notificaciones como vistas.');
    }
  }

  async refreshNotifications(): Promise<void> {
    try {
      const notifications = await firstValueFrom(this.http.get<HospitalNotification[]>('/api/notifications'));
      this.notifications.set(notifications);
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron actualizar las notificaciones.');
    }
  }

  private async mutate(method: 'POST' | 'PATCH', url: string, body: unknown): Promise<boolean> {
    try {
      await firstValueFrom(this.http.request(method, url, { body }));
      await this.refresh();
      return !this.storageError();
    } catch (error: unknown) {
      this.setError(error, 'No se pudo guardar el cambio. Revise sus permisos y los datos ingresados.');
      return false;
    }
  }

  async fetchDoctorAssignments(params: {
    startDate?: string; endDate?: string; doctorId?: string; shift?: string;
  }): Promise<DoctorAssignmentRecord[]> {
    try {
      const query = new URLSearchParams();
      if (params.startDate) query.set('start_date', params.startDate);
      if (params.endDate) query.set('end_date', params.endDate);
      if (params.doctorId) query.set('doctor_id', params.doctorId);
      if (params.shift) query.set('shift', params.shift);
      const result = await firstValueFrom(this.http.get<DoctorAssignmentRecord[]>(`/api/doctor-assignments?${query}`));
      this.doctorAssignments.set(result);
      return result;
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron cargar las asignaciones de médicos.');
      return [];
    }
  }

  async storeDoctorAssignment(data: {
    doctorId: string; roomId: string; date: string; shift: 'M' | 'T' | 'N'; changeReason?: string;
  }): Promise<boolean> {
    return this.mutate('POST', '/api/doctor-assignments', {
      doctorId: data.doctorId,
      roomId: data.roomId,
      doctor_id: data.doctorId,
      room_id: data.roomId,
      date: data.date,
      shift: data.shift,
      changeReason: data.changeReason,
      change_reason: data.changeReason,
    });
  }

  async rotateDoctorAssignments(data: { date: string; reason?: string }): Promise<DemandRotationResult | null> {
    try {
      const result = await firstValueFrom(
        this.http.post<DemandRotationResult>('/api/doctor-assignments/rotate-demand', data)
      );
      await this.refresh();
      return result;
    } catch (error: unknown) {
      this.setError(error, 'No se pudo ejecutar la rotación por demanda.');
      return null;
    }
  }

  async getDemandMetrics(date: string): Promise<DemandMetrics | null> {
    try {
      return await firstValueFrom(
        this.http.get<DemandMetrics>(`/api/doctor-assignments/demand-metrics?date=${encodeURIComponent(date)}`)
      );
    } catch (error: unknown) {
      this.setError(error, 'No se pudieron obtener las métricas de demanda.');
      return null;
    }
  }

  async getAssignmentForDoctor(doctorId: string, date: string): Promise<DoctorAssignmentRecord | null> {
    const cached = this.doctorAssignments().find(a => a.doctorId === doctorId && a.date === date);
    if (cached) return cached;
    try {
      const query = new URLSearchParams({ doctor_id: doctorId, start_date: date, end_date: date });
      const result = await firstValueFrom(
        this.http.get<DoctorAssignmentRecord[]>(`/api/doctor-assignments?${query}`)
      );
      return result[0] ?? null;
    } catch {
      return null;
    }
  }

  clearError(): void {
    this.storageError.set('');
    if (this.errorTimeout !== undefined) {
      window.clearTimeout(this.errorTimeout);
      this.errorTimeout = undefined;
    }
  }

  private setError(error: unknown, fallback: string): void {
    this.storageError.set(spanishErrorMessage(error, fallback));
    if (this.errorTimeout !== undefined) window.clearTimeout(this.errorTimeout);
    this.errorTimeout = window.setTimeout(() => this.clearError(), 10_000);
  }
}
