const FIELD_LABELS: Record<string, string> = {
  appointmentDate: 'fecha de la cita',
  appointmentTime: 'hora de la cita',
  appointment_date: 'fecha de la cita',
  appointment_time: 'hora de la cita',
  prescription: 'folio de receta',
  responsibleId: 'encargado de Farmacia',
  birthDate: 'fecha de nacimiento',
  birth_date: 'fecha de nacimiento',
  bloodType: 'tipo de sangre',
  blood_type: 'tipo de sangre',
  capacity: 'capacidad',
  code: 'código',
  doctorId: 'médico',
  doctor_id: 'médico',
  end_time: 'hora de término',
  ends_at: 'fecha de término',
  documentId: 'documento de identidad',
  document_id: 'documento de identidad',
  email: 'correo electrónico',
  endsAt: 'fecha de término',
  firstName: 'nombre',
  first_name: 'nombre',
  floor: 'ubicación',
  heightCm: 'estatura',
  height_cm: 'estatura',
  lastName: 'apellidos',
  last_name: 'apellidos',
  licenseNumber: 'cédula profesional',
  license_number: 'cédula profesional',
  minimumStock: 'existencia mínima',
  minimum_stock: 'existencia mínima',
  name: 'nombre',
  password: 'contraseña',
  password_confirmation: 'confirmación de contraseña',
  patientId: 'paciente',
  patient_id: 'paciente',
  phone: 'teléfono',
  quantity: 'cantidad',
  reason: 'motivo',
  roomId: 'consultorio',
  room_id: 'consultorio',
  specialty: 'especialidad',
  start_time: 'hora de inicio',
  starts_at: 'fecha de inicio',
  startsAt: 'fecha de inicio',
  stock: 'existencia',
  temperatureC: 'temperatura',
  temperature_c: 'temperatura',
  title: 'título'
};

function fieldLabel(attribute: string): string {
  const key = attribute.replace(/[^a-zA-Z0-9_]/g, '');
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return 'este campo';
}

function translate(message: string): string | undefined {
  const required = message.match(/^The (.+?) field is required\.?$/i);
  if (required) return `El campo ${fieldLabel(required[1])} es obligatorio.`;

  const email = message.match(/^The (.+?) field must be a valid email address\.?$/i);
  if (email) return `El campo ${fieldLabel(email[1])} debe contener un correo electrónico válido.`;

  const taken = message.match(/^The (.+?) has already been taken\.?$/i);
  if (taken) return `El valor de ${fieldLabel(taken[1])} ya está registrado.`;

  const exists = message.match(/^The selected (.+?) is invalid\.?$/i);
  if (exists) return `La opción seleccionada para ${fieldLabel(exists[1])} no es válida.`;

  const numeric = message.match(/^The (.+?) field must be a number\.?$/i);
  if (numeric) return `El campo ${fieldLabel(numeric[1])} debe ser numérico.`;

  const date = message.match(/^The (.+?) field is not a valid date\.?$/i);
  if (date) return `El campo ${fieldLabel(date[1])} debe contener una fecha válida.`;

  if (/^the .+ field must be at least .+ characters?\.?$/i.test(message)) {
    return 'Uno de los campos no cumple con la longitud mínima requerida.';
  }
  if (/^the .+ field must not be greater than .+ characters?\.?$/i.test(message)) {
    return 'Uno de los campos supera la longitud máxima permitida.';
  }
  return undefined;
}

export function spanishErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('error' in error)) return fallback;

  const body = (error as {
    error?: { message?: unknown; errors?: Record<string, unknown> }
  }).error;
  const firstValidationError = body?.errors ? Object.values(body.errors)[0] : undefined;
  const rawMessage = Array.isArray(firstValidationError) ? firstValidationError[0] : firstValidationError;
  const message = typeof rawMessage === 'string'
    ? rawMessage
    : typeof body?.message === 'string' ? body.message : '';

  if (!message) return fallback;
  if (/^ese folio de receta ya fue registrado\.?$/i.test(message)) return message;
  if (/^(Seleccione uno de los dos encargados activos de Farmacia|La cuenta de Farmacia solo puede registrar dispensaciones a nombre de su titular)\.?$/i.test(message)) return message;
  if (/^Retire primero esta cuenta de la asignación de área antes de (cambiar su rol|desactivarla)\.?$/i.test(message)) return message;
  if (/[áéíóúñ¿¡]/i.test(message) || /^(El |La |Los |Las |No se |Debe |Debes )/i.test(message)) return message;
  return translate(message) ?? fallback;
}
