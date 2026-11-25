export interface Doctor {
  id: string;
  userId?: number | null;
  licenseNumber: string; // Cédula Profesional
  firstName: string;
  lastName: string;
  specialty: string;
  phone: string;
  email: string;
  shift: 'Matutino' | 'Vespertino' | 'Nocturno' | 'Guardia Completa';
  assignedRoomId?: string; // Consultorio asignado
  registrationDate: string; // Fecha de alta
  status: 'Activo' | 'Dado de Baja';
  dischargeDate?: string;
  dischargeReason?: string;
}

