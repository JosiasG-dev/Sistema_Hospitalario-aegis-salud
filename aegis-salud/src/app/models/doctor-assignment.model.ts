export interface DoctorAssignment {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  roomId: string;
  roomCode: string;
  roomName: string;
  date: string; // YYYY-MM-DD
  shift: 'M' | 'T' | 'N';
  shiftName: string; // Mañana, Tarde, Noche
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

export interface RotationResult {
  date: string;
  rotatedCount: number;
  demand: { M: number; T: number; N: number };
  highestDemandShift: 'M' | 'T' | 'N';
  highestDemandLabel: string;
  log: string[];
  assignments: DoctorAssignment[];
}
