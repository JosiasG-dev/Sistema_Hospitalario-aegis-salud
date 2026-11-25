export interface Room {
  id: string;
  code: string; // Ej: CONS-101
  name: string; // Ej: Consultorio de Cardiología A
  floor: string; // Ej: Piso 1, Ala Norte
  specialty: string;
  roomType: string;
  nurseIds?: number[];
  nurses?: Array<{ id: number; name: string }>;
  status: 'Disponible' | 'Ocupado' | 'En Mantenimiento' | 'Dado de Baja';
  equipment: string[];
  capacity?: number;
  registrationDate: string; // Fecha de alta
  dischargeDate?: string; // Fecha de baja
  dischargeReason?: string; // Motivo de baja
}
