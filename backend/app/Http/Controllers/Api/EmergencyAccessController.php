<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\EmergencyAccessGrant;
use App\Models\EmergencyControl;
use App\Models\HospitalNotification;
use App\Models\Patient;
use App\Models\TemporaryRoleGrant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EmergencyAccessController extends Controller
{
    public function control(): JsonResponse
    {
        $control = EmergencyControl::firstOrCreate(['id' => 1], ['is_active' => false]);

        return response()->json([
            'isActive' => $this->isCodeRedActive($control),
            'reason' => $control->reason,
            'activatedAt' => $control->activated_at,
            'expiresAt' => $control->expires_at,
        ]);
    }

    public function patientChoices(): JsonResponse
    {
        return response()->json(Patient::orderBy('last_name')->orderBy('first_name')->get()
            ->map(fn (Patient $patient): array => [
                'id' => $patient->id, 'firstName' => $patient->first_name,
                'lastName' => $patient->last_name, 'status' => $patient->status,
            ]));
    }

    public function setControl(Request $request): JsonResponse
    {
        $data = $request->validate([
            'isActive' => ['required', 'boolean'],
            'reason' => ['required_if:isActive,true', 'nullable', 'string', 'min:10', 'max:500'],
            'durationMinutes' => ['required_if:isActive,true', 'nullable', 'integer', 'between:5,120'],
        ]);

        $control = DB::transaction(function () use ($request, $data): EmergencyControl {
            $control = EmergencyControl::firstOrCreate(['id' => 1], ['is_active' => false]);
            $control->is_active = $data['isActive'];
            $control->reason = $data['isActive'] ? $data['reason'] : null;
            $control->activated_by = $data['isActive'] ? $request->user()->id : null;
            $control->activated_at = $data['isActive'] ? now() : null;
            $control->expires_at = $data['isActive'] ? now()->addMinutes($data['durationMinutes']) : null;
            $control->save();

            return $control;
        });

        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Seguridad',
            'action' => $control->is_active ? 'Activación de código rojo' : 'Desactivación de código rojo',
            'entity_name' => 'Código rojo', 'reason' => $control->reason,
            'details' => $control->expires_at?->toIso8601String(), 'occurred_at' => now(),
        ]);
        HospitalNotification::create([
            'title' => $control->is_active ? 'Código rojo activado' : 'Código rojo desactivado',
            'body' => $control->is_active
                ? 'El acceso de emergencia está activo hasta '.$control->expires_at?->format('H:i').'.'
                : 'El acceso de emergencia fue desactivado por administración.',
            'type' => 'seguridad',
        ]);

        return $this->control();
    }

    public function requestAccess(Request $request): JsonResponse
    {
        abort_if($request->user()->role === 'admin', 403, 'La elevación de emergencia está reservada al personal médico.');
        abort_unless($request->user()->activeRoles()->intersect(['medico_general', 'especialista'])->isNotEmpty(), 403);
        $data = $request->validate([
            'patientId' => ['required', 'string', 'max:50'],
            'reason' => ['required', 'string', 'min:20', 'max:500'],
        ]);
        $patientId = str_starts_with(strtoupper($data['patientId']), 'EXP-')
            ? substr($data['patientId'], 4)
            : $data['patientId'];
        $patient = Patient::find($patientId);
        if (! $patient) {
            throw ValidationException::withMessages(['patientId' => ['No se encontró el expediente indicado.']]);
        }
        $control = EmergencyControl::find(1);
        if (! $control || ! $this->isCodeRedActive($control)) {
            AuditLog::create([
                'user_id' => $request->user()->id, 'entity_type' => 'Seguridad',
                'action' => 'Acceso de emergencia rechazado', 'entity_id' => $patient->id,
                'entity_name' => 'Expediente solicitado', 'reason' => $data['reason'],
                'details' => 'Código rojo inactivo; rol: '.$request->user()->role, 'occurred_at' => now(),
            ]);
            $this->notifyAdministrators(
                'Solicitud de acceso de emergencia rechazada',
                'Un usuario solicitó acceso de emergencia con el código rojo inactivo.',
            );
            throw ValidationException::withMessages([
                'emergency' => ['El código rojo no está activo; no se otorgó acceso al expediente.'],
            ]);
        }

        $grant = EmergencyAccessGrant::create([
            'user_id' => $request->user()->id,
            'patient_id' => $patient->id,
            'reason' => $data['reason'],
            'expires_at' => now()->addMinutes(30),
        ]);
        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Seguridad',
            'action' => 'Acceso de emergencia otorgado', 'entity_id' => $patient->id,
            'entity_name' => 'Expediente de paciente', 'reason' => $data['reason'],
            'details' => 'Vence: '.$grant->expires_at->toIso8601String(), 'occurred_at' => now(),
        ]);
        $this->notifyAdministrators(
            'Acceso de emergencia otorgado',
            'Un usuario obtuvo acceso temporal a un expediente; revise la bitácora.',
        );

        return response()->json([
            'id' => $grant->id,
            'patientId' => $grant->patient_id,
            'medicalRecordNumber' => 'EXP-'.$grant->patient_id,
            'expiresAt' => $grant->expires_at,
        ], 201);
    }

    public function grants(): JsonResponse
    {
        return response()->json(
            EmergencyAccessGrant::with(['user:id,name,email', 'patient:id,first_name,last_name'])
                ->orderByDesc('created_at')->limit(200)->get()
                ->map(fn (EmergencyAccessGrant $grant): array => [
                    'id' => $grant->id,
                    'user' => $grant->user?->name,
                    'patient' => trim(($grant->patient?->first_name ?? '').' '.($grant->patient?->last_name ?? '')),
                    'reason' => $grant->reason,
                    'expiresAt' => $grant->expires_at,
                    'revokedAt' => $grant->revoked_at,
                    'active' => ! $grant->revoked_at && $grant->expires_at->isFuture(),
                ]),
        );
    }

    public function temporaryRoleGrants(): JsonResponse
    {
        return response()->json(TemporaryRoleGrant::with(['user:id,name,email', 'grantedBy:id,name'])
            ->orderByDesc('created_at')->limit(200)->get()->map(fn (TemporaryRoleGrant $grant): array => [
                'id' => $grant->id, 'userId' => $grant->user_id, 'user' => $grant->user?->name,
                'role' => $grant->role, 'reason' => $grant->reason, 'grantedBy' => $grant->grantedBy?->name,
                'expiresAt' => $grant->expires_at, 'revokedAt' => $grant->revoked_at,
                'active' => ! $grant->revoked_at && $grant->expires_at->isFuture(),
            ]));
    }

    public function storeTemporaryRoleGrant(Request $request): JsonResponse
    {
        $data = $request->validate([
            'userId' => ['required', 'exists:users,id'],
            'role' => ['required', \Illuminate\Validation\Rule::in([
                'recepcion', 'medico_general', 'especialista', 'farmacia', 'nutricion',
                'compras', 'enfermeria', 'cirugia', 'almacen',
            ])],
            'reason' => ['required', 'string', 'min:15', 'max:500'],
            'durationMinutes' => ['required', 'integer', 'between:5,480'],
        ]);
        $target = User::findOrFail($data['userId']);
        if ($target->role === $data['role']) {
            throw ValidationException::withMessages(['role' => ['La cuenta ya tiene ese rol de forma permanente.']]);
        }
        $grant = TemporaryRoleGrant::create([
            'user_id' => $target->id, 'role' => $data['role'], 'reason' => $data['reason'],
            'granted_by' => $request->user()->id, 'expires_at' => now()->addMinutes($data['durationMinutes']),
        ]);
        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Seguridad',
            'action' => 'Privilegio temporal otorgado', 'entity_id' => (string) $target->id,
            'entity_name' => $target->name, 'reason' => $data['reason'],
            'details' => $data['role'].'; vence '.$grant->expires_at->toIso8601String(), 'occurred_at' => now(),
        ]);
        HospitalNotification::create([
            'user_id' => $target->id, 'title' => 'Permiso temporal asignado',
            'body' => 'Se otorgó el rol temporal '.$data['role'].' hasta '.$grant->expires_at->format('H:i').'.',
            'type' => 'seguridad',
        ]);

        return response()->json(['id' => $grant->id, 'expiresAt' => $grant->expires_at], 201);
    }

    public function revokeTemporaryRoleGrant(Request $request, int $id): JsonResponse
    {
        $grant = TemporaryRoleGrant::findOrFail($id);
        if (! $grant->revoked_at) {
            $grant->revoked_at = now();
            $grant->save();
            AuditLog::create([
                'user_id' => $request->user()->id, 'entity_type' => 'Seguridad',
                'action' => 'Privilegio temporal revocado', 'entity_id' => (string) $grant->user_id,
                'entity_name' => $grant->user?->name ?? 'Usuario',
                'details' => $grant->role, 'occurred_at' => now(),
            ]);
            HospitalNotification::create([
                'user_id' => $grant->user_id, 'title' => 'Permiso temporal revocado',
                'body' => 'Se revocó el rol temporal '.$grant->role.'.',
                'type' => 'seguridad',
            ]);
        }

        return response()->json(['revoked' => true]);
    }

    public function patientRecord(Request $request, string $id): JsonResponse
    {
        $patient = Patient::findOrFail($id);
        $roles = $request->user()->activeRoles()->all();
        $role = $request->user()->role;
        $clinicalAccess = $role !== 'admin'
            && (bool) array_intersect(['medico_general', 'especialista', 'cirugia'], $roles);
        $grant = EmergencyAccessGrant::where('user_id', $request->user()->id)
            ->where('patient_id', $patient->id)->whereNull('revoked_at')
            ->where('expires_at', '>', now())->latest()->first();
        $control = EmergencyControl::find(1);
        $emergencyAccess = $role !== 'admin'
            && $grant && $control && $this->isCodeRedActive($control)
            && $request->user()->activeRoles()->intersect(['medico_general', 'especialista'])->isNotEmpty();

        $limitedAccess = (bool) array_intersect(['admin', 'recepcion', 'farmacia', 'nutricion', 'enfermeria'], $roles);
        if (! $clinicalAccess && ! $emergencyAccess && ! $limitedAccess) {
            AuditLog::create([
                'user_id' => $request->user()->id, 'entity_type' => 'Paciente',
                'action' => 'Acceso al expediente denegado', 'entity_id' => $patient->id,
                'entity_name' => 'Expediente restringido', 'details' => 'Área: '.$role,
                'occurred_at' => now(),
            ]);
            $this->notifyAdministrators(
                'Intento de acceso fuera del área',
                'Se registró y bloqueó una consulta de expediente fuera del área autorizada.',
            );
            abort(403, 'Su rol no tiene acceso a este expediente. Solicite acceso de emergencia solo ante un código rojo activo.');
        }

        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Paciente',
            'action' => 'Consulta de expediente', 'entity_id' => $patient->id,
            'entity_name' => trim($patient->first_name.' '.$patient->last_name),
            'details' => 'Área: '.$role.($emergencyAccess ? '; acceso de emergencia' : ''),
            'occurred_at' => now(),
        ]);

        if (! $clinicalAccess && ! $emergencyAccess) {
            $limitedPayload = [
                'id' => $patient->id, 'firstName' => $patient->first_name,
                'lastName' => $patient->last_name, 'status' => $patient->status,
            ];
            if (in_array('nutricion', $roles, true)) {
                $limitedPayload['allergies'] = $patient->allergies;
                $limitedPayload['assignedBedId'] = $patient->assigned_bed_id;
            }

            return response()->json($limitedPayload);
        }

        return response()->json([
            'id' => $patient->id, 'medicalRecordNumber' => 'EXP-'.$patient->id,
            'documentId' => $patient->document_id, 'firstName' => $patient->first_name,
            'lastName' => $patient->last_name, 'birthDate' => $patient->birth_date?->format('Y-m-d'),
            'gender' => $patient->gender, 'phone' => $patient->phone, 'email' => $patient->email,
            'bloodType' => $patient->blood_type, 'allergies' => $patient->allergies,
            'temperatureC' => $patient->temperature_c, 'heightCm' => $patient->height_cm,
            'emergencyContact' => $patient->emergency_contact,
            'admissionDate' => $patient->admission_date?->format('Y-m-d'),
            'status' => $patient->status, 'dischargeDate' => $patient->discharge_date?->format('Y-m-d'),
            'dischargeReason' => $patient->discharge_reason,
        ]);
    }

    private function isCodeRedActive(EmergencyControl $control): bool
    {
        return $control->is_active && ($control->expires_at?->isFuture() ?? false);
    }

    private function notifyAdministrators(string $title, string $body): void
    {
        User::where('role', 'admin')->where('is_active', true)->pluck('id')->each(
            fn (int $userId) => HospitalNotification::create([
                'user_id' => $userId, 'title' => $title, 'body' => $body, 'type' => 'seguridad',
            ]),
        );
    }
}
