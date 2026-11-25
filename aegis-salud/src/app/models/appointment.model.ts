export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientDocument: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  roomId: string;
  roomName: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  shift?: 'M' | 'T' | 'N';
  shiftName?: string;
  shiftLabel?: string;
  reason: string;
  status: 'Programada' | 'Atendida' | 'Completada' | 'Dada de Baja (Cancelada)';
  creationDate: string;
  attendedAt?: string;
  dischargeDate?: string; // Fecha de baja de la cita
  dischargeReason?: string; // Motivo de baja (Ej. Inasistencia, Solicitud del paciente, Traslado de área, etc.)
  dischargeBy?: string; // Operador o solicitante
}

