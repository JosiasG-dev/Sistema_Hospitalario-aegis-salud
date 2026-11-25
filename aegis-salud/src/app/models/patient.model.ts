export interface Patient {
  id: string;
  medicalRecordNumber: string;
  documentId: string; // Cédula / DNI / CURP
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: 'Masculino' | 'Femenino' | 'Otro';
  phone: string;
  email: string;
  bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  allergies?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
  admissionDate: string; // Fecha de ingreso
  temperatureC: number | null;
  heightCm: number | null;
  status: 'Activo' | 'Dado de Alta' | 'Dado de Baja';
  dischargeDate?: string; // Fecha de alta médica o egreso
  dischargeReason?: string; // Motivo del alta médica o egreso
  dischargeNotes?: string; // Observaciones del alta médica o egreso
  insuranceProvider?: string;
  insurancePolicy?: string;
  insuranceCoveragePercent?: number;
  assignedBedId?: string;
  dischargeRequestedAt?: string;
  dischargeRequestNotes?: string;
  medicalDischargeAt?: string;
  administrativeDischargeAt?: string;
  canEdit?: boolean;
}
