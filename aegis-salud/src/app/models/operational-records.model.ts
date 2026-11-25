export type InventoryCategory = 'Alimentos' | 'Insumos hospitalarios' | 'Medicamentos';

export interface ConsultationRecord {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId?: string;
  doctorName?: string;
  consultationType: 'general' | 'specialty';
  specialty?: string;
  scheduledAt: string;
  reason: string;
  notes: string;
  status: 'Programada' | 'En curso' | 'Finalizada' | 'Cancelada';
  diagnosis?: string;
  vitals?: Record<string, string>;
  treatmentPlan?: string;
  specialtyData?: Record<string, string>;
  nutritionDiet?: string;
  nutritionOrder?: string;
  nutritionInstructions?: string;
  allergies?: string;
  assignedBedId?: string;
  addenda?: Array<{ id: string; doctorName: string; notes: string; createdAt: string }>;
}

export interface OperationRecord {
  id: string;
  patientId: string;
  procedure: string;
  surgeonName: string;
  scheduledAt: string;
  room: string;
  status: 'Programada' | 'En curso' | 'Finalizada' | 'Cancelada';
  patientName?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  stock: number;
  minimumStock: number;
  expirationDate: string;
  unitCost: number;
  unitPrice: number;
  isControlled: boolean;
  availableStock?: number;
  batchCode?: string;
}

export interface DispensationRecord {
  id: string;
  patientId: string;
  itemId: string;
  quantity: number;
  prescription: string;
  responsible: string;
  dispensedAt: string;
  status?: 'Solicitada' | 'Surtida' | 'Autorizada' | 'Cancelada';
  itemName?: string;
  patientName?: string;
  unitPrice?: number;
  prescriberEmail?: string;
  prescriberPassword?: string;
  batches?: Array<{ code: string; expirationDate: string; quantity: number }>;
}

export interface MealOrderRecord {
  id: string;
  patientId: string;
  meal: 'Desayuno' | 'Comida' | 'Cena';
  diet: string;
  preparedFood?: string;
  deliveryDate: string;
  notes: string;
  status: 'Solicitada' | 'Pendiente' | 'Preparado' | 'Entregada' | 'Cancelada';
  patientName?: string;
  chargeAmount?: number;
  bed?: string;
  allergies?: string;
}

export interface SupplierRecord {
  id: string;
  name: string;
  category: InventoryCategory;
  contact_phone?: string;
  contact_email?: string;
}

export interface PurchaseOrderRecord {
  id: string;
  supplier: string;
  itemName: string;
  category: InventoryCategory;
  unit: string;
  quantity: number;
  unitCost: number;
  requestedAt: string;
  status: 'Solicitada' | 'Aprobada' | 'Por confirmar' | 'Recibida' | 'Cancelada';
  requestedByName?: string;
  requestedArea?: string;
}

export interface OperationalRecordsState {
  consultations: ConsultationRecord[];
  operations: OperationRecord[];
  inventory: InventoryItem[];
  dispensations: DispensationRecord[];
  mealOrders: MealOrderRecord[];
  purchaseOrders: PurchaseOrderRecord[];
}
