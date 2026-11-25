export interface AuditLog {
  id: string;
  timestamp: string;
  entityType: string;
  action: string;
  entityId: string;
  entityName: string;
  reason?: string;
  details?: string;
  ipAddress?: string;
  area?: string;
  userName?: string;
}

export function auditActionLabel(log: AuditLog): string {
  if (log.entityType !== 'Paciente') return log.action;

  if (log.action === 'Alta') return 'Ingreso';
  if (log.action === 'Reactivación') return 'Reingreso';
  if (log.action === 'Baja') {
    if (log.reason === 'Fallecimiento') return 'Defunción';
    if (log.reason?.startsWith('Alta Médica')) return 'Alta médica';
    return 'Egreso';
  }

  return log.action;
}
