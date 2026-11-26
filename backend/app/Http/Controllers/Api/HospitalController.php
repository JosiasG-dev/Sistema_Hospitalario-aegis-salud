<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePatientRequest;
use App\Http\Requests\UpdatePatientRequest;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Consultation;
use App\Models\Dispensation;
use App\Models\Doctor;
use App\Models\DoctorAssignment;
use App\Models\DoctorScheduleHistory;
use App\Models\DoctorSchedule;
use App\Models\HospitalNotification;
use App\Models\InventoryItem;
use App\Models\InventoryBatch;
use App\Models\Invoice;
use App\Models\MealOrder;
use App\Models\Operation;
use App\Models\Patient;
use App\Models\PurchaseOrder;
use App\Models\Room;
use App\Models\RoomReservation;
use App\Models\Supplier;
use App\Models\User;
use App\Services\BillingService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class HospitalController extends Controller
{
    private const ALLOWED_UNITS = [
        'pieza', 'unidad', 'par', 'caja', 'paquete', 'rollo', 'bolsa', 'sobre',
        'tableta', 'cápsula', 'frasco', 'ampolleta', 'kg', 'g', 'litro', 'ml', 'porción',
    ];

    public function bootstrap(Request $request): JsonResponse
    {
        $role = $request->user()->role;
        $roles = $request->user()->activeRoles()->all();
        $canSeePatientList = (bool) array_intersect($roles, ['admin', 'recepcion', 'medico_general', 'especialista', 'farmacia', 'nutricion', 'enfermeria', 'cirugia']);
        $canSeeHospitalDirectory = (bool) array_intersect($roles, ['admin', 'recepcion', 'medico_general', 'especialista', 'cirugia']);
        $canSeeConsultations = $request->user()->role !== 'admin'
            && (bool) array_intersect($roles, ['medico_general', 'especialista', 'nutricion', 'cirugia']);
        $canSeeInventory = (bool) array_intersect($roles, ['admin', 'farmacia', 'compras', 'almacen', 'especialista', 'cirugia']);
        $fullPatientAccess = $request->user()->role !== 'admin'
            && (bool) array_intersect($roles, ['recepcion', 'medico_general', 'especialista', 'cirugia']);
        $patientItems = $canSeePatientList ? Patient::orderByDesc('created_at')->get() : collect();
        $editablePatientIds = $this->editablePatientIds($request->user());
        $this->auditPatientCollection($request, $patientItems, 'bootstrap');

        return response()->json([
            'patients' => $canSeePatientList
                ? $patientItems->map(fn (Patient $item) => $this->patientListPayload($item, $fullPatientAccess, $request->user(), $editablePatientIds))
                : [],
            'doctors' => $canSeeHospitalDirectory
                ? Doctor::orderBy('last_name')->get()->map(fn (Doctor $item) => $this->doctorPayload($item, $role === 'admin')) : [],
            'rooms' => $canSeeHospitalDirectory
                ? Room::with('nurses')->orderBy('code')->get()->map(fn (Room $item) => $this->roomPayload($item)) : [],
            'appointments' => $canSeeHospitalDirectory
                ? $this->appointmentsForUser($request)->map(
                    fn (Appointment $item) => $this->appointmentPayload($item, $request->user()->role === 'admin'),
                ) : [],
            'consultations' => $canSeeConsultations
                ? Consultation::with(['patient', 'doctor'])->orderByDesc('scheduled_at')->get()->map(fn (Consultation $item) => $this->consultationPayload($item, in_array('nutricion', $roles, true) && ! (bool) array_intersect($roles, ['admin', 'medico_general', 'especialista', 'cirugia']))) : [],
            'operations' => $request->user()->role !== 'admin' && (bool) array_intersect($roles, ['especialista', 'cirugia'])
                ? Operation::with('patient')->orderByDesc('scheduled_at')->get()->map(fn (Operation $item) => $this->operationPayload($item)) : [],
            'inventory' => $canSeeInventory
                ? InventoryItem::orderBy('category')->orderBy('name')->get()->map(fn (InventoryItem $item) => $this->inventoryPayload($item)) : [],
            'dispensations' => (bool) array_intersect($roles, ['admin', 'farmacia'])
                ? Dispensation::with(['patient', 'item', 'batchAllocations.batch'])->orderByDesc('dispensed_at')->get()
                    ->map(fn (Dispensation $item) => $this->dispensationPayload($item)) : [],
            'mealOrders' => (bool) array_intersect($roles, ['admin', 'nutricion'])
                ? MealOrder::with('patient')->orderByDesc('delivery_date')->get()->map(
                    fn (MealOrder $item) => $this->mealPayload(
                        $item,
                        $role === 'admin' || in_array('nutricion', $roles, true),
                        $role !== 'admin' && in_array('nutricion', $roles, true),
                    ),
                ) : [],
            'purchaseOrders' => (bool) array_intersect($roles, ['admin', 'compras', 'almacen', 'farmacia', 'nutricion', 'enfermeria'])
                ? PurchaseOrder::with('creator')
                    ->when(
                        ! array_intersect($roles, ['admin', 'compras', 'almacen']),
                        fn ($q) => $q->where('created_by', $request->user()->id)
                    )
                    ->orderByDesc('requested_at')
                    ->get()
                    ->map(fn (PurchaseOrder $item) => $this->purchasePayload($item))
                : [],
            'suppliers' => (bool) array_intersect($roles, ['admin', 'compras', 'almacen', 'farmacia', 'nutricion', 'enfermeria'])
                ? Supplier::where('is_active', true)->orderBy('category')->orderBy('name')->get(['id', 'name', 'category', 'contact_phone', 'contact_email'])
                : [],
            'schedules' => (bool) array_intersect($roles, ['admin', 'recepcion', 'medico_general', 'especialista', 'cirugia'])
                ? DoctorSchedule::with(['doctor', 'room'])->where('is_active', true)->orderBy('day_of_week')->orderBy('start_time')->get() : [],
            'doctorAssignments' => (bool) array_intersect($roles, ['admin', 'recepcion', 'medico_general', 'especialista', 'cirugia'])
                ? DoctorAssignment::with(['doctor', 'room'])->whereBetween('date', [today()->subDays(31), today()->addDays(31)])->orderBy('date')->orderBy('shift')->get()->map(fn (DoctorAssignment $item) => $this->doctorAssignmentPayload($item)) : [],
            'staffAbsences' => in_array($role, ['admin', 'recepcion'], true)
                ? \App\Models\StaffAbsence::with('doctor')->orderByDesc('starts_on')->get() : [],
            'invoices' => [],
            'surgicalRequisitions' => in_array($role, ['admin', 'almacen', 'especialista', 'cirugia'], true)
                ? \App\Models\SurgicalRequisition::with(['inventoryItem', 'operation'])->orderByDesc('created_at')->get() : [],
            'defects' => $role === 'admin'
                ? \App\Models\DefectReport::orderByDesc('created_at')->limit(500)->get() : [],
            'notifications' => $this->notificationsFor($request),
            'auditLogs' => in_array('admin', $roles, true)
                ? AuditLog::with('user')->orderByDesc('occurred_at')->limit(500)->get()->map(fn (AuditLog $item) => $this->auditPayload($item)) : [],
        ]);
    }

    private function notifyAdministrators(string $title, string $body): void
    {
        User::where('role', 'admin')->where('is_active', true)->pluck('id')->each(
            fn (int $userId) => HospitalNotification::create([
                'user_id' => $userId, 'title' => $title, 'body' => $body, 'type' => 'seguridad',
            ]),
        );
    }

    public function patients(Request $request): JsonResponse
    {
        $roles = $request->user()->activeRoles()->all();
        $full = $request->user()->role !== 'admin'
            && (bool) array_intersect($roles, ['recepcion', 'medico_general', 'especialista', 'cirugia']);
        $patients = Patient::orderByDesc('created_at')->get();
        $editablePatientIds = $this->editablePatientIds($request->user());
        $this->auditPatientCollection($request, $patients, 'lista de pacientes');

        return response()->json($patients->map(
            fn (Patient $item) => $this->patientListPayload($item, $full, $request->user(), $editablePatientIds),
        ));
    }

    public function storePatient(StorePatientRequest $request): JsonResponse
    {
        $data = $request->validated();
        $patient = Patient::create([
            'id' => $this->id('PAT'),
            'document_id' => $data['documentId'],
            'first_name' => $data['firstName'],
            'last_name' => $data['lastName'],
            'birth_date' => $data['birthDate'] ?? null,
            'gender' => $data['gender'],
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'blood_type' => $data['bloodType'] ?? null,
            'allergies' => $data['allergies'] ?? null,
            'emergency_contact' => $data['emergencyContact'] ?? null,
            'temperature_c' => $data['temperatureC'],
            'height_cm' => $data['heightCm'],
            'insurance_provider' => $data['insuranceProvider'] ?? null,
            'insurance_policy' => $data['insurancePolicy'] ?? null,
            'insurance_coverage_percent' => empty($data['insuranceProvider'])
                ? 0
                : ($data['insuranceCoveragePercent'] ?? 80),
            'admission_date' => today(),
            'status' => 'Activo',
        ]);
        $this->audit($request, 'Paciente', 'Ingreso', $patient->id, $patient->first_name.' '.$patient->last_name);
        $this->notify($request, 'Nuevo ingreso de paciente', 'Se registró un paciente en el sistema.', 'pacientes');

        $payload = $request->user()->role === 'admin'
            ? $this->patientBasicPayload($patient)
            : $this->patientPayload($patient);

        return response()->json($payload, 201);
    }

    public function updatePatient(UpdatePatientRequest $request, string $id): JsonResponse
    {
        $patient = Patient::findOrFail($id);
        $roles = $request->user()->activeRoles();
        $hasReceptionAccess = $request->user()->role !== 'admin' && $roles->contains('recepcion');
        if ($request->user()->role !== 'admin' && ! $hasReceptionAccess) {
            $assigned = $roles->intersect(['medico_general', 'especialista'])->isNotEmpty()
                ? $patient->consultations()->where('created_by', $request->user()->id)->exists()
                : ($roles->contains('enfermeria')
                    && $patient->kardexRecords()->where('nurse_id', $request->user()->id)->exists());
            abort_unless($assigned, 403, 'Solo puede editar pacientes bajo su atención o servicio asignado.');
        }

        $data = $request->validated();
        $this->assertUserPassword($request, $data['confirmPassword'] ?? null);
        unset($data['confirmPassword']);
        $mapping = [
            'documentId' => 'document_id', 'firstName' => 'first_name',
            'lastName' => 'last_name', 'birthDate' => 'birth_date',
            'gender' => 'gender', 'phone' => 'phone', 'email' => 'email',
            'bloodType' => 'blood_type', 'allergies' => 'allergies',
            'emergencyContact' => 'emergency_contact', 'temperatureC' => 'temperature_c',
            'heightCm' => 'height_cm', 'insuranceProvider' => 'insurance_provider',
            'insurancePolicy' => 'insurance_policy',
            'insuranceCoveragePercent' => 'insurance_coverage_percent',
        ];
        $attributes = [];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $data)) {
                $attributes[$column] = $data[$input];
            }
        }
        if (array_key_exists('insuranceProvider', $data)) {
            if (empty($data['insuranceProvider'])) {
                $attributes['insurance_coverage_percent'] = 0;
            } elseif (! array_key_exists('insuranceCoveragePercent', $data)) {
                $attributes['insurance_coverage_percent'] = $patient->insurance_provider
                    ? $patient->insurance_coverage_percent
                    : 80;
            }
        }
        $patient->fill($attributes);
        $patient->save();
        $this->audit(
            $request, 'Paciente', 'Actualización de datos', $patient->id,
            $patient->first_name.' '.$patient->last_name, null,
            'Campos actualizados: '.implode(', ', array_keys($data)),
        );

        if ($request->user()->role === 'admin') {
            return response()->json($this->patientBasicPayload($patient));
        }
        if ($roles->contains('enfermeria') && ! $hasReceptionAccess) {
            return response()->json($this->patientListPayload($patient, false, $request->user(), [$patient->id]));
        }

        return response()->json($this->patientPayload($patient));
    }

    public function updatePatientStatus(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Activo'])],
        ]);
        $patient = Patient::findOrFail($id);
        $patient->status = 'Activo';
        $patient->save();
        $this->audit($request, 'Paciente', 'Reingreso', $patient->id, $patient->first_name.' '.$patient->last_name);

        return response()->json($request->user()->role === 'admin'
            ? $this->patientBasicPayload($patient)
            : $this->patientPayload($patient));
    }

    public function medicalDischarge(Request $request, string $id): JsonResponse
    {
        abort_if($request->user()->role === 'admin', 403, 'El alta médica requiere un rol clínico.');
        abort_unless($request->user()->activeRoles()->intersect(['medico_general', 'especialista'])->isNotEmpty(), 403);
        $data = $request->validate(['notes' => ['required', 'string', 'min:10', 'max:2000']]);
        $patient = Patient::findOrFail($id);
        if ($patient->status !== 'Activo') {
            throw ValidationException::withMessages(['patient' => ['Solo se puede dar alta médica a un paciente ingresado.']]);
        }
        $patient->medical_discharge_at = now();
        $patient->medical_discharge_by = $request->user()->id;
        $patient->medical_discharge_notes = $data['notes'];
        $patient->discharge_date = today();
        $patient->discharge_reason = 'Alta Médica Autorizada';
        $patient->discharge_notes = $data['notes'];
        $patient->save();
        $this->audit($request, 'Paciente', 'Alta médica autorizada', $patient->id, $patient->first_name.' '.$patient->last_name, $data['notes']);
        $this->notifyAdministrators('Alta médica autorizada', 'Un paciente está pendiente de autorización administrativa.');

        return response()->json($this->patientBasicPayload($patient));
    }

    public function requestDischarge(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403, 'Solo Administración puede solicitar el alta médica.');
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $patient = Patient::findOrFail($id);
        if ($patient->status !== 'Activo') {
            throw ValidationException::withMessages(['patient' => ['Solo se puede solicitar el alta a un paciente ingresado.']]);
        }
        $patient->discharge_requested_at = now();
        $patient->discharge_requested_by = $request->user()->id;
        $patient->discharge_request_notes = $data['notes'] ?? 'Solicitud de alta administrativa pendiente de confirmación médica.';
        $patient->save();
        $this->audit($request, 'Paciente', 'Solicitud de alta médica', $patient->id, $patient->first_name.' '.$patient->last_name, $patient->discharge_request_notes);
        $this->notify($request, 'Solicitud de alta médica', "Administración solicita confirmar el alta médica de {$patient->first_name} {$patient->last_name}.", 'personal');

        return response()->json($this->patientBasicPayload($patient));
    }

    public function administrativeDischarge(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403, 'Solo Administración puede autorizar el alta administrativa.');
        $data = $request->validate(['masterPassword' => ['required', 'string']]);
        if (! Hash::check($data['masterPassword'], $request->user()->password)) {
            throw ValidationException::withMessages(['masterPassword' => ['La contraseña de Administración no es válida.']]);
        }
        $patient = Patient::findOrFail($id);
        if (! $patient->medical_discharge_at) {
            throw ValidationException::withMessages(['patient' => ['El médico debe autorizar primero el alta médica.']]);
        }
        if (\App\Models\Invoice::where('patient_id', $patient->id)->where('status', '!=', 'Pagada')->exists()) {
            throw ValidationException::withMessages(['patient' => ['No se puede completar el alta mientras existan saldos pendientes.']]);
        }
        $patient->administrative_discharge_at = now();
        $patient->administrative_discharge_by = $request->user()->id;
        $patient->discharge_date = today();
        $patient->status = 'Dado de Alta';
        $patient->save();
        Appointment::where('patient_id', $patient->id)->where('status', 'Programada')->update([
            'status' => 'Dada de Baja (Cancelada)',
            'discharge_date' => today(),
            'discharge_reason' => 'Cancelación automática por alta hospitalaria',
            'discharge_by' => 'Sistema Aegis Salud',
        ]);
        $this->audit($request, 'Paciente', 'Alta administrativa completada', $patient->id, $patient->first_name.' '.$patient->last_name);

        return response()->json($this->patientBasicPayload($patient));
    }

    public function doctors(Request $request): JsonResponse
    {
        return response()->json(Doctor::orderBy('last_name')->get()->map(
            fn (Doctor $item) => $this->doctorPayload($item, $request->user()->role === 'admin'),
        ));
    }

    public function doctorAccounts(Request $request): JsonResponse
    {
        $data = $request->validate(['doctorId' => ['nullable', 'exists:doctors,id']]);
        $doctor = isset($data['doctorId']) ? Doctor::findOrFail($data['doctorId']) : null;
        $accounts = User::orderBy('email')->get(['id', 'name', 'email', 'role', 'is_active']);
        $linkedDoctors = Doctor::whereNotNull('user_id')->get(['id', 'user_id', 'first_name', 'last_name'])->keyBy('user_id');

        return response()->json($accounts->map(function (User $account) use ($doctor, $linkedDoctors): array {
            $linkedDoctor = $linkedDoctors->get($account->id);
            return [
                'id' => $account->id,
                'name' => $account->name,
                'email' => $account->email,
                'role' => $account->role,
                'isActive' => $account->is_active,
                'canLink' => $account->is_active
                    && in_array($account->role, ['medico_general', 'especialista'], true)
                    && (! $linkedDoctor || $linkedDoctor->id === $doctor?->id),
                'linkedTo' => $linkedDoctor
                    ? trim($linkedDoctor->first_name.' '.$linkedDoctor->last_name)
                    : null,
            ];
        }));
    }

    public function nurseAccounts(): JsonResponse
    {
        return response()->json(User::where('role', 'enfermeria')->where('is_active', true)
            ->orderBy('name')->get(['id', 'name', 'email']));
    }

    public function areaStaff(): JsonResponse
    {
        $assignments = DB::table('area_staff_assignments')
            ->join('users', 'users.id', '=', 'area_staff_assignments.user_id')
            ->where('users.is_active', true)
            ->orderBy('users.name')
            ->get([
                'area_staff_assignments.area', 'users.id', 'users.name',
            ]);

        return response()->json([
            'farmacia' => $assignments->where('area', 'farmacia')->values(),
            'almacen' => $assignments->where('area', 'almacen')->values(),
            'alimentos' => $assignments->where('area', 'alimentos')->values(),
        ]);
    }

    public function updateAreaStaff(Request $request): JsonResponse
    {
        $data = $request->validate([
            'pharmacyIds' => ['required', 'array', 'size:2'],
            'pharmacyIds.*' => ['required', 'integer', 'distinct', Rule::exists('users', 'id')
                ->where(fn ($query) => $query->where('role', 'farmacia')->where('is_active', true))],
            'warehouseIds' => ['required', 'array', 'min:1'],
            'warehouseIds.*' => ['required', 'integer', 'distinct', Rule::exists('users', 'id')
                ->where(fn ($query) => $query->where('role', 'almacen')->where('is_active', true))],
            'foodIds' => ['required', 'array', 'min:1'],
            'foodIds.*' => ['required', 'integer', 'distinct', Rule::exists('users', 'id')
                ->where(fn ($query) => $query->where('role', 'nutricion')->where('is_active', true))],
        ]);

        DB::transaction(function () use ($data): void {
            foreach ([
                'farmacia' => $data['pharmacyIds'],
                'almacen' => $data['warehouseIds'],
                'alimentos' => $data['foodIds'],
            ] as $area => $userIds) {
                DB::table('area_staff_assignments')->where('area', $area)->delete();
                DB::table('area_staff_assignments')->insert(array_map(
                    fn (int $userId): array => [
                        'area' => $area, 'user_id' => $userId, 'created_at' => now(), 'updated_at' => now(),
                    ],
                    $userIds,
                ));
            }
        });

        return $this->areaStaff();
    }

    public function storeDoctor(Request $request): JsonResponse
    {
        $data = $request->validate([
            'licenseNumber' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ .-]+$/u', 'unique:doctors,license_number'],
            'firstName' => ['required', 'string', 'max:100', 'regex:/^[\pL\pM\s.\'-]+$/u'],
            'lastName' => ['required', 'string', 'max:120', 'regex:/^[\pL\pM\s.\'-]+$/u'],
            'specialty' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:32', 'regex:/^[0-9+() .-]+$/'],
            'email' => ['nullable', 'email', 'max:160'],
            'userId' => [
                'sometimes', 'nullable', 'integer',
                Rule::exists('users', 'id')->where(fn ($query) => $query
                    ->whereIn('role', ['medico_general', 'especialista'])->where('is_active', true)),
                Rule::unique('doctors', 'user_id'),
            ],
            'shift' => ['required', Rule::in(['Matutino', 'Vespertino', 'Nocturno', 'Guardia Completa'])],
            'assignedRoomId' => ['nullable', 'exists:rooms,id'],
        ]);
        $doctor = Doctor::create([
            'id' => $this->id('DOC'), 'license_number' => $data['licenseNumber'],
            'first_name' => $data['firstName'], 'last_name' => $data['lastName'],
            'specialty' => $data['specialty'], 'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null, 'shift' => $data['shift'],
            'user_id' => array_key_exists('userId', $data)
                ? $data['userId'] : $this->doctorAccountId($data['email'] ?? null),
            'assigned_room_id' => $data['assignedRoomId'] ?? null, 'registration_date' => today(), 'status' => 'Activo',
        ]);
        if ($doctor->assigned_room_id) {
            $shiftCode = in_array(strtoupper(substr((string) $doctor->shift, 0, 1)), ['M', 'T', 'N'], true)
                ? strtoupper(substr((string) $doctor->shift, 0, 1))
                : ($doctor->shift === 'Vespertino' ? 'T' : ($doctor->shift === 'Nocturno' ? 'N' : 'M'));
            for ($d = today(); $d->lte(today()->addDays(14)); $d->addDay()) {
                DoctorAssignment::updateOrCreate(
                    ['room_id' => $doctor->assigned_room_id, 'date' => $d->toDateString(), 'shift' => $shiftCode],
                    [
                        'id' => 'ASG-' . strtoupper(substr(md5($doctor->id . $d->toDateString() . $shiftCode), 0, 16)),
                        'doctor_id' => $doctor->id,
                        'change_reason' => 'Asignación obligatoria inicial de consultorio y turno',
                        'created_by' => $request->user()?->id,
                    ]
                );
            }
        }
        $this->audit($request, 'Médico', 'Alta', $doctor->id, $doctor->first_name.' '.$doctor->last_name);
        $this->notify($request, 'Nuevo médico registrado', 'Se agregó un perfil médico al directorio.', 'personal');

        return response()->json($this->doctorPayload($doctor, true), 201);
    }

    public function updateDoctor(Request $request, string $id): JsonResponse
    {
        $doctor = Doctor::findOrFail($id);
        abort_if($request->user()->role !== 'admin' && $request->has('userId'), 403, 'Solo Administración puede vincular cuentas a perfiles médicos.');
        $data = $request->validate([
            'licenseNumber' => [
                'required', 'string', 'max:64',
                Rule::unique('doctors', 'license_number')->ignore($doctor->id, 'id'),
            ],
            'firstName' => ['required', 'string', 'max:100', 'regex:/^[\pL\pM\s.\'-]+$/u'],
            'lastName' => ['required', 'string', 'max:120', 'regex:/^[\pL\pM\s.\'-]+$/u'],
            'specialty' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:32', 'regex:/^[0-9+() .-]+$/'],
            'email' => ['nullable', 'email', 'max:160'],
            'userId' => [
                'sometimes', 'nullable', 'integer',
                Rule::exists('users', 'id')->where(fn ($query) => $query
                    ->whereIn('role', ['medico_general', 'especialista'])
                    ->where(fn ($accountQuery) => $accountQuery->where('is_active', true)
                        ->orWhere('id', $doctor->user_id))),
                Rule::unique('doctors', 'user_id')->ignore($doctor->id, 'id'),
            ],
            'shift' => ['required', Rule::in(['Matutino', 'Vespertino', 'Nocturno', 'Guardia Completa'])],
            'assignedRoomId' => ['nullable', 'exists:rooms,id'],
            'confirmPassword' => ['required', 'string'],
        ]);
        $this->assertUserPassword($request, $data['confirmPassword']);
        $doctor->fill([
            'license_number' => $data['licenseNumber'],
            'first_name' => $data['firstName'],
            'last_name' => $data['lastName'],
            'specialty' => $data['specialty'],
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'user_id' => array_key_exists('userId', $data)
                ? $data['userId'] : $this->doctorAccountId($data['email'] ?? null, $doctor->id),
            'shift' => $data['shift'],
            'assigned_room_id' => $data['assignedRoomId'] ?? null,
        ]);
        $doctor->save();
        $this->audit(
            $request, 'Médico', 'Actualización de datos', $doctor->id,
            $doctor->first_name.' '.$doctor->last_name,
            null, 'Campos actualizados: '.implode(', ', array_keys($data)),
        );

        return response()->json($this->doctorPayload($doctor, $request->user()->role === 'admin'));
    }

    public function updateDoctorStatus(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Activo', 'Dado de Baja'])],
            'dischargeReason' => ['nullable', 'string', 'max:255'],
            'confirmPassword' => ['nullable', 'string'],
        ]);
        $doctor = Doctor::findOrFail($id);
        if ($data['status'] === 'Dado de Baja') {
            $this->assertUserPassword($request, $data['confirmPassword'] ?? null);
            if (empty(trim((string) ($data['dischargeReason'] ?? '')))) {
                throw ValidationException::withMessages([
                    'dischargeReason' => ['Debe indicar el motivo de la baja del médico.'],
                ]);
            }
            $hasActiveAppointments = Appointment::where('doctor_id', $id)
                ->where('status', 'Programada')
                ->whereDate('appointment_date', '>=', today())
                ->exists();
            if ($hasActiveAppointments) {
                throw ValidationException::withMessages([
                    'status' => ['No se puede dar de baja al médico porque tiene citas programadas activas. Cancele o reasigne sus citas primero.'],
                ]);
            }
        }
        $doctor->status = $data['status'];
        $doctor->discharge_date = $data['status'] === 'Dado de Baja' ? today() : null;
        $doctor->discharge_reason = $data['status'] === 'Dado de Baja' ? ($data['dischargeReason'] ?? null) : null;
        $doctor->save();
        if ($data['status'] === 'Dado de Baja') {
            DoctorSchedule::where('doctor_id', $id)->where('is_active', true)->get()->each(function (DoctorSchedule $schedule) use ($request): void {
                $schedule->is_active = false;
                $schedule->save();
                $this->recordScheduleSnapshot($schedule, $request, 'Médico dado de baja');
            });
        }
        $this->audit($request, 'Médico', $data['status'] === 'Activo' ? 'Reactivación' : 'Baja', $doctor->id, $doctor->first_name.' '.$doctor->last_name);

        return response()->json($this->doctorPayload($doctor, true));
    }

    public function rooms(): JsonResponse
    {
        return response()->json(Room::with('nurses')->orderBy('code')->get()->map(fn (Room $item) => $this->roomPayload($item)));
    }

    public function storeRoom(Request $request): JsonResponse
    {
        $data = $this->validateRoom($request, true);
        $this->assertUserPassword($request, $data['confirm_password'] ?? null);
        unset($data['confirm_password']);
        $nurseIds = $data['nurse_ids'] ?? [];
        unset($data['nurse_ids']);
        $room = Room::create([
            'id' => $this->id('ROOM'), ...$data, 'registration_date' => today(),
            'equipment' => $data['equipment'] ?? [], 'capacity' => $data['capacity'] ?? 1,
        ]);
        $room->nurses()->sync($nurseIds);
        $room->load('nurses');
        $this->audit($request, 'Consultorio', 'Alta', $room->id, $room->code.' - '.$room->name);
        $this->notify($request, 'Nuevo consultorio registrado', 'Se agregó un espacio de atención al directorio.', 'consultorios');

        return response()->json($this->roomPayload($room), 201);
    }

    public function updateRoom(Request $request, string $id): JsonResponse
    {
        $room = Room::findOrFail($id);
        $data = $this->validateRoom($request, false, $room);
        $this->assertUserPassword($request, $data['confirm_password'] ?? null);
        unset($data['confirm_password']);
        $nurseIds = $data['nurse_ids'] ?? null;
        unset($data['nurse_ids']);
        $room->fill($data)->save();
        if ($nurseIds !== null) {
            $room->nurses()->sync($nurseIds);
        }
        $room->load('nurses');
        $this->audit($request, 'Consultorio', 'Modificación', $room->id, $room->code.' - '.$room->name);
        $this->notify($request, 'Consultorio actualizado', 'Se modificaron los detalles de un consultorio.', 'consultorios');

        return response()->json($this->roomPayload($room));
    }

    public function updateRoomStatus(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Disponible', 'Ocupado', 'En Mantenimiento', 'Dado de Baja'])],
            'dischargeReason' => ['nullable', 'string', 'max:255'],
            'confirmPassword' => ['nullable', 'string'],
        ]);
        if ($data['status'] === 'Dado de Baja') {
            $this->assertUserPassword($request, $data['confirmPassword'] ?? null);
        }
        $room = Room::findOrFail($id);
        $room->status = $data['status'];
        $room->discharge_date = $data['status'] === 'Dado de Baja' ? today() : null;
        $room->discharge_reason = $data['status'] === 'Dado de Baja' ? ($data['dischargeReason'] ?? null) : null;
        $room->save();
        if ($data['status'] === 'Dado de Baja') {
            DoctorSchedule::where('room_id', $id)->where('is_active', true)->get()->each(function (DoctorSchedule $schedule) use ($request): void {
                $schedule->is_active = false;
                $schedule->save();
                $this->recordScheduleSnapshot($schedule, $request, 'Consultorio dado de baja');
            });
        }
        $this->audit($request, 'Consultorio', 'Estado actualizado', $room->id, $room->code.' - '.$room->name, $data['dischargeReason'] ?? null);

        return response()->json($this->roomPayload($room));
    }

    public function roomReservations(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);
        return response()->json(RoomReservation::with('room')
            ->where('status', 'Reservada')
            ->where('starts_at', '<', Carbon::parse($data['to'])->endOfDay())
            ->where('ends_at', '>', Carbon::parse($data['from'])->startOfDay())
            ->orderBy('starts_at')->get()->map(fn (RoomReservation $item) => $this->roomReservationPayload($item)));
    }

    public function storeRoomReservation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'roomId' => ['required', 'exists:rooms,id'],
            'title' => ['required', 'string', 'max:120'],
            'reason' => ['required', 'string', 'max:500'],
            'startsAt' => ['required', 'date', 'after:now'],
            'endsAt' => ['required', 'date', 'after:startsAt'],
        ]);
        $room = Room::findOrFail($data['roomId']);
        abort_if($room->status !== 'Disponible', 422, 'El consultorio no está disponible para reservar.');
        $reservationStart = Carbon::parse($data['startsAt']);
        $reservationEnd = Carbon::parse($data['endsAt']);
        $scheduleConflict = DoctorSchedule::where('room_id', $room->id)
            ->where('is_active', true)
            ->where('day_of_week', $reservationStart->dayOfWeekIso)
            ->where('start_time', '<', $reservationEnd->format('H:i:s'))
            ->where('end_time', '>', $reservationStart->format('H:i:s'))
            ->exists();
        $conflict = RoomReservation::where('room_id', $room->id)->where('status', 'Reservada')
            ->where('starts_at', '<', $data['endsAt'])->where('ends_at', '>', $data['startsAt'])->exists();
        $appointmentConflict = Appointment::where('room_id', $room->id)->where('status', 'Programada')
            ->where('appointment_date', Carbon::parse($data['startsAt'])->toDateString())
            ->get()->contains(function (Appointment $appointment) use ($data): bool {
                $appointmentStart = Carbon::parse($appointment->appointment_date->format('Y-m-d').' '.$appointment->appointment_time);
                $appointmentEnd = $appointmentStart->copy()->addMinutes(30);
                return $appointmentStart->lt(Carbon::parse($data['endsAt']))
                    && $appointmentEnd->gt(Carbon::parse($data['startsAt']));
            });
        if ($conflict || $appointmentConflict || $scheduleConflict) {
            throw ValidationException::withMessages(['startsAt' => ['El consultorio ya tiene una reserva o cita en ese horario.']]);
        }

        $reservation = RoomReservation::create([
            'id' => $this->id('RRS'), 'room_id' => $room->id, 'title' => $data['title'],
            'reason' => $data['reason'], 'starts_at' => $data['startsAt'], 'ends_at' => $data['endsAt'],
            'status' => 'Reservada', 'created_by' => $request->user()->id,
        ]);
        $this->audit($request, 'Consultorio', 'Reserva creada', $room->id, $room->code.' - '.$room->name,
            $data['reason'], $data['title'].' · '.$reservation->starts_at->format('Y-m-d H:i').'–'.$reservation->ends_at->format('H:i'));

        return response()->json($this->roomReservationPayload($reservation->load('room')), 201);
    }

    public function cancelRoomReservation(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']]);
        $reservation = RoomReservation::with('room')->findOrFail($id);
        abort_if($reservation->status !== 'Reservada', 422, 'La reserva ya no está activa.');
        $reservation->status = 'Cancelada';
        $reservation->save();
        $this->audit($request, 'Consultorio', 'Reserva cancelada', $reservation->room_id,
            $reservation->room->code.' - '.$reservation->room->name, $data['reason'],
            $reservation->title.' · '.$reservation->starts_at->format('Y-m-d H:i'));

        return response()->json($this->roomReservationPayload($reservation));
    }

    public function roomAudit(): JsonResponse
    {
        $page = AuditLog::with('user')->where('entity_type', 'Consultorio')
            ->orderByDesc('occurred_at')->paginate(50);
        return response()->json([
            'data' => $page->getCollection()->map(fn (AuditLog $item) => $this->auditPayload($item))->values(),
            'currentPage' => $page->currentPage(),
            'lastPage' => $page->lastPage(),
        ]);
    }

    public function schedules(): JsonResponse
    {
        return response()->json(DoctorSchedule::with(['doctor', 'room'])->orderBy('day_of_week')->orderBy('start_time')->get());
    }

    public function storeSchedule(Request $request): JsonResponse
    {
        $data = $this->validateSchedule($request);
        $this->assertScheduleAvailable($data);
        $schedule = DoctorSchedule::create(['id' => $this->id('SCH'), ...$data, 'is_active' => true]);
        $this->recordScheduleSnapshot($schedule, $request, 'Asignación');
        $this->audit($request, 'Agenda médica', 'Asignación', $schedule->id, $schedule->doctor_id.' → '.$schedule->room_id);
        $this->notify($request, 'Cambio de agenda médica', 'Se asignó un horario y consultorio a un médico.', 'agenda');

        return response()->json($schedule->load(['doctor', 'room']), 201);
    }

    public function updateSchedule(Request $request, string $id): JsonResponse
    {
        $schedule = DoctorSchedule::findOrFail($id);
        $data = $this->validateSchedule($request, false, $schedule);
        $this->assertScheduleAvailable($data, $id);
        $schedule->fill($data)->save();
        $this->recordScheduleSnapshot($schedule, $request, 'Modificación');
        $this->audit($request, 'Agenda médica', 'Modificación', $schedule->id, $schedule->doctor_id.' → '.$schedule->room_id);
        $this->notify($request, 'Cambio de horario o consultorio', 'Se modificó una asignación de la agenda médica.', 'agenda');

        return response()->json($schedule->load(['doctor', 'room']));
    }

    public function doctorAssignments(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date', $request->query('date', today()->subDays(31)->toDateString()));
        $endDate = $request->query('end_date', $request->query('date', today()->addDays(31)->toDateString()));

        $query = DoctorAssignment::with(['doctor', 'room'])
            ->whereBetween('date', [$startDate, $endDate])
            ->orderBy('date')
            ->orderBy('shift');

        if ($request->filled('doctor_id')) {
            $query->where('doctor_id', $request->query('doctor_id'));
        }
        if ($request->filled('shift')) {
            $query->where('shift', $request->query('shift'));
        }

        return response()->json($query->get()->map(fn (DoctorAssignment $item) => $this->doctorAssignmentPayload($item)));
    }

    public function storeDoctorAssignment(Request $request): JsonResponse
    {
        if ($request->has('doctor_id') && ! $request->has('doctorId')) {
            $request->merge(['doctorId' => $request->input('doctor_id')]);
        }
        if ($request->has('room_id') && ! $request->has('roomId')) {
            $request->merge(['roomId' => $request->input('room_id')]);
        }
        if ($request->has('change_reason') && ! $request->has('changeReason')) {
            $request->merge(['changeReason' => $request->input('change_reason')]);
        }

        $data = $request->validate([
            'doctorId' => ['required', 'exists:doctors,id'],
            'roomId' => ['required', 'exists:rooms,id'],
            'date' => ['required', 'date', 'after_or_equal:yesterday'],
            'shift' => ['required', Rule::in(['M', 'T', 'N', 'm', 't', 'n', 'Matutino', 'Vespertino', 'Nocturno'])],
            'changeReason' => ['nullable', 'string', 'max:500'],
        ]);

        $rawShift = strtoupper(substr($data['shift'], 0, 1));
        $shift = in_array($rawShift, ['M', 'T', 'N'], true) ? $rawShift : 'M';
        if (str_starts_with(strtolower($data['shift']), 'vesp')) $shift = 'T';
        if (str_starts_with(strtolower($data['shift']), 'noct')) $shift = 'N';

        $doctor = Doctor::findOrFail($data['doctorId']);
        $room = Room::findOrFail($data['roomId']);

        abort_if($doctor->status !== 'Activo', 422, 'El médico seleccionado no está activo.');
        abort_if($room->status === 'Dado de Baja', 422, 'El consultorio seleccionado está dado de baja.');

        // Integrity Rule: No two doctors in the same room on the same date and shift
        $roomConflict = DoctorAssignment::where('date', $data['date'])
            ->where('shift', $shift)
            ->where('room_id', $room->id)
            ->where('doctor_id', '!=', $doctor->id)
            ->first();
        if ($roomConflict) {
            $otherDoctor = $roomConflict->doctor ? $roomConflict->doctor->first_name . ' ' . $roomConflict->doctor->last_name : $roomConflict->doctor_id;
            throw ValidationException::withMessages([
                'roomId' => ["El consultorio {$room->code} ya está asignado al Dr. {$otherDoctor} en el turno " . DoctorAssignment::shiftShortName($shift) . " de esta fecha."],
            ]);
        }

        $doctorConflict = DoctorAssignment::where('date', $data['date'])
            ->where('shift', $shift)
            ->where('doctor_id', $doctor->id)
            ->where('room_id', '!=', $room->id)
            ->first();

        $previous = DoctorAssignment::where('date', $data['date'])
            ->where('doctor_id', $doctor->id)
            ->first();

        $changeReason = $data['changeReason'] ?? 'Asignación administrativa de turno y consultorio';

        $details = $previous
            ? "Reasignación: Turno anterior " . DoctorAssignment::shiftShortName($previous->shift) . " ({$previous->room?->code}) → Nuevo Turno " . DoctorAssignment::shiftShortName($shift) . " ({$room->code}). Motivo: {$changeReason}"
            : "Asignación inicial: Turno " . DoctorAssignment::shiftShortName($shift) . " en consultorio {$room->code}. Motivo: {$changeReason}";

        if ($doctorConflict) {
            $doctorConflict->room_id = $room->id;
            $doctorConflict->change_reason = $changeReason;
            $doctorConflict->created_by = $request->user()?->id;
            $doctorConflict->save();
            $assignment = $doctorConflict;
        } elseif ($previous && $previous->shift !== $shift) {
            $previous->shift = $shift;
            $previous->room_id = $room->id;
            $previous->change_reason = $changeReason;
            $previous->created_by = $request->user()?->id;
            $previous->save();
            $assignment = $previous;
        } else {
            $assignId = 'ASG-' . strtoupper(substr(md5($doctor->id . $data['date'] . $shift . microtime()), 0, 16));
            $assignment = DoctorAssignment::updateOrCreate(
                ['room_id' => $room->id, 'date' => $data['date'], 'shift' => $shift],
                [
                    'id' => $assignId,
                    'doctor_id' => $doctor->id,
                    'change_reason' => $changeReason,
                    'created_by' => $request->user()?->id,
                ]
            );
        }

        $this->audit(
            $request,
            'Asignación Médica',
            'Rotación de Consultorio/Turno',
            $doctor->id,
            $doctor->first_name . ' ' . $doctor->last_name,
            $changeReason,
            $details
        );

        $this->notify($request, 'Asignación de turno actualizada', "Se actualizó la asignación del Dr. {$doctor->first_name} {$doctor->last_name} para el día {$data['date']}.", 'agenda');

        return response()->json($this->doctorAssignmentPayload($assignment->load(['doctor', 'room'])), 201);
    }

    public function rotateDoctorAssignments(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date' => ['required', 'date', 'after_or_equal:today'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $date = $data['date'];
        $baseReason = $data['reason'] ?? 'Ajuste dinámico por flujo y afluencia de pacientes';

        $appointments = Appointment::whereDate('appointment_date', $date)
            ->where('status', 'Programada')
            ->get();

        $countsByShift = ['M' => 0, 'T' => 0, 'N' => 0];
        foreach ($appointments as $app) {
            $time = substr((string) $app->appointment_time, 0, 5);
            $shift = DoctorAssignment::timeToShift($time);
            $countsByShift[$shift]++;
        }

        arsort($countsByShift);
        $highestDemandShift = array_key_first($countsByShift);

        $activeDoctors = Doctor::where('status', 'Activo')->get();
        $availableRooms = Room::where('status', 'Disponible')->orderBy('code')->get();

        $currentAssignments = DoctorAssignment::with(['doctor', 'room'])
            ->where('date', $date)
            ->get();

        $assignedDoctorIds = $currentAssignments->pluck('doctor_id')->all();
        $unassignedDoctors = $activeDoctors->whereNotIn('id', $assignedDoctorIds)->values();

        $rotatedCount = 0;
        $detailsLog = [];

        $occupiedRooms = ['M' => [], 'T' => [], 'N' => []];
        foreach ($currentAssignments as $asg) {
            $occupiedRooms[$asg->shift][] = $asg->room_id;
        }

        $candidatesToRotate = $currentAssignments->filter(function ($asg) use ($highestDemandShift, $countsByShift) {
            return $asg->shift !== $highestDemandShift && $countsByShift[$asg->shift] < $countsByShift[$highestDemandShift];
        });

        foreach ($candidatesToRotate as $asg) {
            $freeRoom = $availableRooms->first(fn ($r) => ! in_array($r->id, $occupiedRooms[$highestDemandShift], true));
            if ($freeRoom && $countsByShift[$highestDemandShift] > $countsByShift[$asg->shift]) {
                $oldShiftName = DoctorAssignment::shiftShortName($asg->shift);
                $newShiftName = DoctorAssignment::shiftShortName($highestDemandShift);
                $oldRoomCode = $asg->room?->code ?? $asg->room_id;
                $newRoomCode = $freeRoom->code;

                $occupiedRooms[$asg->shift] = array_diff($occupiedRooms[$asg->shift], [$asg->room_id]);
                $occupiedRooms[$highestDemandShift][] = $freeRoom->id;

                $changeReason = "Rotación por demanda: {$baseReason} (Demanda {$newShiftName}: {$countsByShift[$highestDemandShift]} citas vs {$oldShiftName}: {$countsByShift[$asg->shift]} citas)";

                $asg->shift = $highestDemandShift;
                $asg->room_id = $freeRoom->id;
                $asg->change_reason = $changeReason;
                $asg->created_by = $request->user()?->id;
                $asg->save();

                $doctor = $asg->doctor;
                $this->audit(
                    $request,
                    'Asignación Médica',
                    'Rotación por Demanda de Pacientes',
                    $doctor->id,
                    $doctor->first_name . ' ' . $doctor->last_name,
                    $changeReason,
                    "Reasignado de Turno {$oldShiftName} ({$oldRoomCode}) a Turno {$newShiftName} ({$newRoomCode}). {$baseReason}"
                );

                $detailsLog[] = "Dr. {$doctor->first_name} {$doctor->last_name} rotado a Turno {$newShiftName} ({$newRoomCode})";
                $rotatedCount++;
                break;
            }
        }

        foreach ($unassignedDoctors as $doctor) {
            foreach ([$highestDemandShift, 'M', 'T', 'N'] as $shiftCandidate) {
                $freeRoom = $availableRooms->first(fn ($r) => ! in_array($r->id, $occupiedRooms[$shiftCandidate], true));
                if ($freeRoom) {
                    $occupiedRooms[$shiftCandidate][] = $freeRoom->id;
                    $assignId = 'ASG-' . strtoupper(substr(md5($doctor->id . $date . $shiftCandidate . microtime()), 0, 16));
                    $shiftName = DoctorAssignment::shiftShortName($shiftCandidate);

                    DoctorAssignment::create([
                        'id' => $assignId,
                        'doctor_id' => $doctor->id,
                        'room_id' => $freeRoom->id,
                        'date' => $date,
                        'shift' => $shiftCandidate,
                        'change_reason' => "Asignación obligatoria activa por demanda en turno {$shiftName}",
                        'created_by' => $request->user()?->id,
                    ]);

                    $this->audit(
                        $request,
                        'Asignación Médica',
                        'Asignación por Demanda',
                        $doctor->id,
                        $doctor->first_name . ' ' . $doctor->last_name,
                        $baseReason,
                        "Asignado a Turno {$shiftName} ({$freeRoom->code}) por balanceo de demanda."
                    );
                    $rotatedCount++;
                    break;
                }
            }
        }

        $allAssignments = DoctorAssignment::with(['doctor', 'room'])
            ->where('date', $date)
            ->orderBy('shift')
            ->get();

        return response()->json([
            'date' => $date,
            'rotatedCount' => $rotatedCount,
            'demand' => $countsByShift,
            'highestDemandShift' => $highestDemandShift,
            'highestDemandLabel' => DoctorAssignment::shiftLabel($highestDemandShift),
            'log' => $detailsLog,
            'assignments' => $allAssignments->map(fn ($item) => $this->doctorAssignmentPayload($item)),
        ]);
    }

    public function assignmentDemandMetrics(Request $request): JsonResponse
    {
        $date = $request->query('date', today()->toDateString());
        $appointments = Appointment::whereDate('appointment_date', $date)
            ->where('status', 'Programada')
            ->get();

        $metrics = ['M' => 0, 'T' => 0, 'N' => 0];
        foreach ($appointments as $app) {
            $shift = DoctorAssignment::timeToShift((string) $app->appointment_time);
            $metrics[$shift]++;
        }

        $assignedCount = [
            'M' => DoctorAssignment::where('date', $date)->where('shift', 'M')->count(),
            'T' => DoctorAssignment::where('date', $date)->where('shift', 'T')->count(),
            'N' => DoctorAssignment::where('date', $date)->where('shift', 'N')->count(),
        ];

        return response()->json([
            'date' => $date,
            'appointmentsByShift' => $metrics,
            'doctorsByShift' => $assignedCount,
            'highestDemand' => array_keys($metrics, max($metrics))[0] ?? 'M',
        ]);
    }

    public function availability(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date' => ['required', 'date'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
        ]);
        $day = Carbon::parse($data['date'])->dayOfWeekIso;
        $schedules = DoctorSchedule::with(['doctor', 'room'])
            ->where('is_active', true)->where('day_of_week', $day)
            ->where('start_time', '<', $data['end_time'])->where('end_time', '>', $data['start_time'])
            ->get();
        $rangeStart = Carbon::parse('1970-01-01 '.$data['start_time']);
        $rangeEnd = Carbon::parse('1970-01-01 '.$data['end_time']);
        $occupiedRoomIds = Appointment::whereDate('appointment_date', $data['date'])
            ->where('status', 'Programada')->get(['room_id', 'appointment_time'])
            ->filter(function (Appointment $appointment) use ($rangeStart, $rangeEnd): bool {
                $appointmentStart = Carbon::parse('1970-01-01 '.$appointment->appointment_time);
                $appointmentEnd = $appointmentStart->copy()->addMinutes(30);
                return $rangeStart->lt($appointmentEnd) && $rangeEnd->gt($appointmentStart);
            })->pluck('room_id')->all();
        $assignedRoomIds = $schedules->pluck('room_id')->unique();
        $reservedRoomIds = RoomReservation::where('status', 'Reservada')
            ->where('starts_at', '<', Carbon::parse($data['date'].' '.$data['end_time']))
            ->where('ends_at', '>', Carbon::parse($data['date'].' '.$data['start_time']))
            ->pluck('room_id')->all();
        $rooms = Room::where('status', 'Disponible')->orderBy('code')->get();
        $results = $rooms->map(function (Room $room) use ($schedules, $occupiedRoomIds, $reservedRoomIds, $assignedRoomIds): array {
            $roomSchedules = $schedules->where('room_id', $room->id)->values();
            return [
                ...$this->roomPayload($room),
                'doctors' => $roomSchedules->map(fn (DoctorSchedule $schedule) => [
                    'doctorId' => $schedule->doctor_id,
                    'doctorName' => $schedule->doctor?->first_name.' '.$schedule->doctor?->last_name,
                    'specialty' => $schedule->doctor?->specialty,
                    'startTime' => substr($schedule->start_time, 0, 5),
                    'endTime' => substr($schedule->end_time, 0, 5),
                    'shift' => $schedule->shift,
                ]),
                'isAvailable' => ! in_array($room->id, $occupiedRoomIds, true)
                    && ! in_array($room->id, $reservedRoomIds, true),
                'hasAssignedDoctor' => $assignedRoomIds->contains($room->id),
            ];
        });

        return response()->json($results);
    }

    public function appointmentSuggestions(Request $request): JsonResponse
    {
        $data = $request->validate([
            'patientId' => ['nullable', 'exists:patients,id'],
            'doctorId' => ['nullable', 'exists:doctors,id'],
            'date' => ['nullable', 'date'],
            'start_time' => ['nullable', 'date_format:H:i'],
        ]);

        $startDate = isset($data['date']) && $data['date'] >= today()->toDateString()
            ? Carbon::parse($data['date'])->startOfDay()
            : today()->startOfDay();
        $preferredTime = isset($data['start_time']) ? $data['start_time'] : '08:00';
        $preferredDoctorId = $data['doctorId'] ?? null;
        $patientId = $data['patientId'] ?? null;
        $suggestions = [];

        for ($dayOffset = 0; $dayOffset < 14 && count($suggestions) < 30; $dayOffset++) {
            $date = $startDate->copy()->addDays($dayOffset);
            $dayOfWeek = $date->dayOfWeekIso;
            $schedules = DoctorSchedule::with(['doctor', 'room'])
                ->where('is_active', true)->where('day_of_week', $dayOfWeek)
                ->when($preferredDoctorId, fn ($query) => $query->where('doctor_id', $preferredDoctorId))
                ->get();

            foreach ($schedules as $schedule) {
                if ($schedule->doctor?->status !== 'Activo' || $schedule->room?->status !== 'Disponible') continue;
                $startMinutes = $dayOffset === 0
                    ? max((int) substr($preferredTime, 0, 2) * 60 + (int) substr($preferredTime, 3, 2), (int) substr((string) $schedule->start_time, 0, 2) * 60)
                    : (int) substr((string) $schedule->start_time, 0, 2) * 60;
                $scheduleStart = (int) substr((string) $schedule->start_time, 0, 2) * 60 + (int) substr((string) $schedule->start_time, 3, 2);
                $scheduleEnd = (int) substr((string) $schedule->end_time, 0, 2) * 60 + (int) substr((string) $schedule->end_time, 3, 2);

                for ($minutes = max($startMinutes, $scheduleStart); $minutes + 30 <= $scheduleEnd && count($suggestions) < 30; $minutes += 30) {
                    $time = sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
                    $start = Carbon::parse($date->toDateString().' '.$time);
                    $end = $start->copy()->addMinutes(30);

                    $occupied = Appointment::whereDate('appointment_date', $date)
                        ->where('status', 'Programada')
                        ->where(function ($query) use ($schedule, $patientId) {
                            $query->where('doctor_id', $schedule->doctor_id)
                                ->orWhere('room_id', $schedule->room_id);
                            if ($patientId) $query->orWhere('patient_id', $patientId);
                        })->get(['appointment_time', 'appointment_date', 'patient_id', 'doctor_id', 'room_id']);
                    $hasConflict = $occupied->contains(function (Appointment $appointment) use ($start, $end, $schedule, $patientId): bool {
                        $existingStart = Carbon::parse($appointment->appointment_date->format('Y-m-d').' '.$appointment->appointment_time);
                        $existingEnd = $existingStart->copy()->addMinutes(30);
                        return $start->lt($existingEnd) && $end->gt($existingStart)
                            && ($appointment->patient_id === $patientId
                                || $appointment->doctor_id === $schedule->doctor_id
                                || $appointment->room_id === $schedule->room_id);
                    });
                    $reserved = RoomReservation::where('room_id', $schedule->room_id)
                        ->where('status', 'Reservada')->where('starts_at', '<', $end)->where('ends_at', '>', $start)->exists();
                    if ($hasConflict || $reserved) continue;

                    $suggestions[] = [
                        'date' => $date->toDateString(),
                        'time' => $time,
                        'doctorId' => $schedule->doctor_id,
                        'doctorName' => $schedule->doctor->first_name.' '.$schedule->doctor->last_name,
                        'specialty' => $schedule->doctor->specialty,
                        'roomId' => $schedule->room_id,
                        'roomName' => $schedule->room->name,
                        'roomCode' => $schedule->room->code,
                    ];
                }
            }
        }

        return response()->json($suggestions);
    }

    public function appointments(Request $request): JsonResponse
    {
        return response()->json($this->appointmentsForUser($request)
            ->map(fn (Appointment $item) => $this->appointmentPayload($item, $request->user()->role === 'admin')));
    }

    public function attendAppointment(Request $request, string $id): JsonResponse
    {
        $doctor = $this->doctorForUser($request->user());
        abort_unless($doctor, 403, 'La cuenta no está vinculada a un perfil médico.');
        $appointment = Appointment::with(['patient', 'doctor', 'room'])->findOrFail($id);
        abort_unless($appointment->doctor_id === $doctor->id, 403, 'Solo puede registrar la atención de sus propias citas.');
        $scheduledAt = Carbon::parse($appointment->appointment_date->format('Y-m-d').' '.$appointment->appointment_time);
        abort_if($scheduledAt->isFuture(), 422, 'No se puede registrar como atendida antes de la hora programada.');
        abort_if($appointment->status !== 'Programada', 422, 'La cita ya no está pendiente de atención.');
        $appointment->status = 'Atendida';
        $appointment->attended_at = now();
        $appointment->attended_by = $request->user()->id;
        $appointment->save();
        $this->audit($request, 'Atención médica', 'Paciente atendido', $appointment->id,
            $appointment->patient->first_name.' '.$appointment->patient->last_name,
            null, 'Médico: '.$doctor->first_name.' '.$doctor->last_name.' · Consultorio: '.$appointment->room->code
                .' · '. $appointment->appointment_date->format('Y-m-d').' '.substr((string) $appointment->appointment_time, 0, 5));

        return response()->json($this->appointmentPayload($appointment, false));
    }

    public function doctorHistory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'doctorId' => ['required', 'exists:doctors,id'],
            'date' => ['required', 'date'],
        ]);
        $date = Carbon::parse($data['date']);
        $doctor = Doctor::findOrFail($data['doctorId']);
        $appointments = Appointment::with(['patient', 'room'])
            ->where('doctor_id', $doctor->id)->whereDate('appointment_date', $date)
            ->whereIn('status', ['Atendida', 'Programada'])->orderBy('appointment_time')->get()
            ->map(fn (Appointment $item) => [
                'id' => $item->id, 'patientName' => $item->patient->first_name.' '.$item->patient->last_name,
                'roomName' => $item->room_name ?: ($item->room ? $item->room->code.' — '.$item->room->name : ''),
                'appointmentDate' => $item->appointment_date->format('Y-m-d'),
                'appointmentTime' => substr((string) $item->appointment_time, 0, 5),
                'attendedAt' => $item->attended_at?->format('Y-m-d H:i:s'),
                'status' => $item->status,
            ]);
        $schedules = DoctorScheduleHistory::with('room')->where('doctor_id', $doctor->id)
            ->where('recorded_at', '<=', $date->copy()->endOfDay())
            ->orderByDesc('recorded_at')->get()->unique('schedule_id')->where('is_active', true)->values()
            ->map(fn (DoctorScheduleHistory $item) => [
                'dayOfWeek' => $item->day_of_week, 'startTime' => substr($item->start_time, 0, 5),
                'endTime' => substr($item->end_time, 0, 5), 'shift' => $item->shift,
                'roomName' => $item->room->code.' — '.$item->room->name,
                'recordedAt' => $item->recorded_at->format('Y-m-d H:i:s'),
            ]);
        $assignments = DoctorAssignment::with('room')
            ->where('doctor_id', $doctor->id)
            ->whereDate('date', $date)
            ->orderBy('shift')
            ->get()
            ->map(fn (DoctorAssignment $item) => [
                'id' => $item->id,
                'shift' => $item->shift,
                'shiftLabel' => DoctorAssignment::shiftLabel($item->shift),
                'roomName' => $item->room ? $item->room->code.' — '.$item->room->name : '',
                'changeReason' => $item->change_reason,
            ]);

        return response()->json([
            'doctor' => $this->doctorPayload($doctor, true), 'date' => $date->toDateString(),
            'appointments' => $appointments, 'schedules' => $schedules, 'assignments' => $assignments,
        ]);
    }

    public function storeAppointment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'patientId' => ['required', 'exists:patients,id'],
            'doctorId' => ['required', 'exists:doctors,id'],
            'roomId' => ['sometimes', 'nullable', 'exists:rooms,id'],
            'appointmentDate' => ['required', 'date', 'after_or_equal:today'],
            'appointmentTime' => ['required', 'date_format:H:i'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $doctor = Doctor::findOrFail($data['doctorId']);
        abort_if($doctor->status !== 'Activo', 422, 'El médico seleccionado no está activo.');

        $assignment = DoctorAssignment::with('room')
            ->where('doctor_id', $doctor->id)
            ->where('date', $data['appointmentDate'])
            ->first();

        if ($assignment) {
            $targetRoomId = $assignment->room_id;
            $targetShift = $assignment->shift;
            $roomName = $assignment->room ? $assignment->room->code . ' (' . $assignment->room->name . ')' : '';

            $range = DoctorAssignment::shiftTimeRange($targetShift);
            $time = $data['appointmentTime'];
            if ($time < $range['start'] || $time > $range['appointment_max']) {
                throw ValidationException::withMessages([
                    'appointmentTime' => ["La hora seleccionada ({$time}) está fuera del turno asignado al médico para este día (" . DoctorAssignment::shiftLabel($targetShift) . ")."],
                ]);
            }
        } else {
            $targetRoomId = $data['roomId'] ?? $doctor->assigned_room_id;
            if (! $targetRoomId) {
                throw ValidationException::withMessages([
                    'doctorId' => ['El médico no tiene consultorio ni turno asignado para esta fecha. Favor de configurarlo en Agenda.'],
                ]);
            }
            $targetRoom = Room::findOrFail($targetRoomId);
            $targetShift = DoctorAssignment::timeToShift($data['appointmentTime']);
            $roomName = $targetRoom->code . ' (' . $targetRoom->name . ')';

            $assignId = 'ASG-' . strtoupper(substr(md5($doctor->id . $data['appointmentDate'] . $targetShift . microtime()), 0, 16));
            DoctorAssignment::updateOrCreate(
                ['room_id' => $targetRoomId, 'date' => $data['appointmentDate'], 'shift' => $targetShift],
                [
                    'id' => $assignId,
                    'doctor_id' => $doctor->id,
                    'change_reason' => 'Asignación automática al programar cita',
                    'created_by' => $request->user()?->id,
                ]
            );
        }

        $data['roomId'] = $targetRoomId;
        $this->assertAppointmentAvailable($data);
        $appointment = Appointment::create([
            'id' => $this->id('APP'), 'patient_id' => $data['patientId'], 'doctor_id' => $data['doctorId'],
            'room_id' => $targetRoomId, 'room_name' => $roomName, 'shift' => $targetShift,
            'appointment_date' => $data['appointmentDate'],
            'appointment_time' => $data['appointmentTime'], 'reason' => $data['reason'],
            'status' => 'Programada', 'creation_date' => today(),
        ]);
        $this->audit($request, 'Cita Médica', 'Programación', $appointment->id, $appointment->reason);
        $this->notify($request, 'Nueva cita médica', 'Se agregó una cita a la agenda.', 'citas');

        return response()->json($this->appointmentPayload($appointment->load(['patient', 'doctor', 'room'])), 201);
    }

    public function updateAppointment(Request $request, string $id): JsonResponse
    {
        $appointment = Appointment::findOrFail($id);
        if ($appointment->status !== 'Programada') {
            throw ValidationException::withMessages(['status' => ['Solo se pueden editar citas en estado Programada.']]);
        }
        $data = $request->validate([
            'patientId' => ['required', 'exists:patients,id'],
            'doctorId' => ['required', 'exists:doctors,id'],
            'roomId' => ['sometimes', 'nullable', 'exists:rooms,id'],
            'appointmentDate' => ['required', 'date', 'after_or_equal:today'],
            'appointmentTime' => ['required', 'date_format:H:i'],
            'reason' => ['required', 'string', 'max:255'],
            'confirmPassword' => ['required', 'string'],
        ]);
        $this->assertUserPassword($request, $data['confirmPassword']);

        $doctor = Doctor::findOrFail($data['doctorId']);
        abort_if($doctor->status !== 'Activo', 422, 'El médico seleccionado no está activo.');

        $assignment = DoctorAssignment::with('room')
            ->where('doctor_id', $doctor->id)
            ->where('date', $data['appointmentDate'])
            ->first();

        if ($assignment) {
            $targetRoomId = $assignment->room_id;
            $targetShift = $assignment->shift;
            $roomName = $assignment->room ? $assignment->room->code . ' (' . $assignment->room->name . ')' : '';
            $range = DoctorAssignment::shiftTimeRange($targetShift);
            $time = $data['appointmentTime'];
            if ($time < $range['start'] || $time > $range['appointment_max']) {
                throw ValidationException::withMessages([
                    'appointmentTime' => ["La hora seleccionada ({$time}) está fuera del turno asignado al médico para este día (" . DoctorAssignment::shiftLabel($targetShift) . ")."],
                ]);
            }
        } else {
            $targetRoomId = $data['roomId'] ?? $doctor->assigned_room_id;
            if (! $targetRoomId) {
                throw ValidationException::withMessages([
                    'doctorId' => ['El médico no tiene consultorio ni turno asignado para esta fecha. Favor de configurarlo en Agenda.'],
                ]);
            }
            $targetRoom = Room::findOrFail($targetRoomId);
            $targetShift = DoctorAssignment::timeToShift($data['appointmentTime']);
            $roomName = $targetRoom->code . ' (' . $targetRoom->name . ')';
        }

        $data['roomId'] = $targetRoomId;
        $this->assertAppointmentAvailable($data, $appointment->id);
        $appointment->fill([
            'patient_id' => $data['patientId'],
            'doctor_id' => $data['doctorId'],
            'room_id' => $targetRoomId,
            'room_name' => $roomName,
            'shift' => $targetShift,
            'appointment_date' => $data['appointmentDate'],
            'appointment_time' => $data['appointmentTime'],
            'reason' => $data['reason'],
        ])->save();
        $this->audit($request, 'Cita Médica', 'Modificación', $appointment->id, $appointment->reason);

        return response()->json($this->appointmentPayload($appointment->load(['patient', 'doctor', 'room'])));
    }

    public function updateAppointmentStatus(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Programada', 'Dada de Baja (Cancelada)'])],
            'dischargeReason' => ['nullable', 'string', 'max:255'],
            'dischargeBy' => ['nullable', 'string', 'max:120'],
            'confirmPassword' => ['nullable', 'string'],
        ]);
        if ($data['status'] === 'Dada de Baja (Cancelada)') {
            $this->assertUserPassword($request, $data['confirmPassword'] ?? null);
        }
        $appointment = Appointment::findOrFail($id);
        if ($data['status'] === 'Programada') {
            $this->assertAppointmentAvailable([
                'patientId' => $appointment->patient_id,
                'doctorId' => $appointment->doctor_id,
                'roomId' => $appointment->room_id,
                'appointmentDate' => $appointment->appointment_date->format('Y-m-d'),
                'appointmentTime' => substr((string) $appointment->appointment_time, 0, 5),
            ], $appointment->id);
        }
        $appointment->status = $data['status'];
        $appointment->discharge_date = $data['status'] === 'Programada' ? null : today();
        $appointment->discharge_reason = $data['status'] === 'Programada' ? null : ($data['dischargeReason'] ?? null);
        $appointment->discharge_by = $data['status'] === 'Programada' ? null : ($data['dischargeBy'] ?? $request->user()->name);
        $appointment->save();
        $this->audit($request, 'Cita Médica', $data['status'] === 'Programada' ? 'Restablecimiento' : 'Cancelación', $appointment->id, $appointment->reason, $data['dischargeReason'] ?? null);

        return response()->json($this->appointmentPayload($appointment->load(['patient', 'doctor', 'room'])));
    }

    public function consultations(Request $request): JsonResponse
    {
        abort_if($request->user()->role === 'admin', 403, 'El perfil administrativo no tiene acceso a notas clínicas.');
        $nutritionOnly = $request->user()->role === 'nutricion'
            && $request->user()->activeRoles()->intersect(['medico_general', 'especialista'])->isEmpty();
        $query = Consultation::with(['patient', 'doctor', 'addenda']);
        if ($nutritionOnly) {
            $query->where(fn ($builder) => $builder->whereNotNull('nutrition_diet')
                ->orWhereNotNull('nutrition_order')->orWhereNotNull('nutrition_instructions'));
        }
        return response()->json($query->orderByDesc('scheduled_at')->get()->map(
            fn (Consultation $item) => $this->consultationPayload($item, $nutritionOnly),
        ));
    }

    public function storeConsultation(Request $request): JsonResponse
    {
        abort_if($request->user()->role === 'admin', 403, 'El perfil administrativo no puede crear notas clínicas.');
        $data = $request->validate([
            'patientId' => ['required', 'exists:patients,id'],
            'doctorId' => ['nullable', 'exists:doctors,id'],
            'doctorName' => ['nullable', 'string', 'max:200'],
            'consultationType' => ['required', Rule::in(['general', 'specialty'])],
            'specialty' => ['nullable', 'string', 'max:120'],
            'scheduledAt' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:4000'],
            'diagnosis' => ['nullable', 'string', 'max:4000'],
            'vitals' => ['nullable', 'array'],
            'treatmentPlan' => ['nullable', 'string', 'max:4000'],
            'specialtyData' => ['nullable', 'array'],
            'nutritionDiet' => ['nullable', 'string', 'max:120'],
            'nutritionOrder' => ['nullable', 'string', 'max:4000'],
            'nutritionInstructions' => ['nullable', 'string', 'max:4000'],
        ]);
        $doctor = isset($data['doctorId']) ? Doctor::findOrFail($data['doctorId']) : null;
        $consultation = Consultation::create([
            'id' => $this->id('CON'), 'patient_id' => $data['patientId'], 'doctor_id' => $doctor?->id,
            'consultation_type' => $data['consultationType'], 'specialty' => $data['specialty'] ?? $doctor?->specialty,
            'scheduled_at' => $data['scheduledAt'], 'reason' => $data['reason'], 'notes' => $data['notes'] ?? null,
            'diagnosis' => $data['diagnosis'] ?? null, 'vitals' => $data['vitals'] ?? null,
            'treatment_plan' => $data['treatmentPlan'] ?? null, 'specialty_data' => $data['specialtyData'] ?? null,
            'nutrition_diet' => $data['nutritionDiet'] ?? null, 'nutrition_order' => $data['nutritionOrder'] ?? null,
            'nutrition_instructions' => $data['nutritionInstructions'] ?? null,
            'status' => 'Programada', 'created_by' => $request->user()->id,
        ]);
        $this->audit($request, 'Consulta', 'Registro', $consultation->id, $consultation->reason);
        $this->notify($request, 'Nueva consulta médica', 'Se registró una consulta de atención.', 'consultas');
        if (! empty($data['nutritionOrder']) || ! empty($data['nutritionDiet'])) {
            $this->notify($request, 'Nueva orden de alimentación', 'Se registró una indicación de alimentación para un paciente.', 'nutricion');
        }

        return response()->json($this->consultationPayload($consultation->load(['patient', 'doctor', 'addenda'])), 201);
    }

    public function updateConsultation(Request $request, string $id): JsonResponse
    {
        abort_if($request->user()->role === 'admin', 403, 'El perfil administrativo no puede modificar notas clínicas.');
        $consultation = Consultation::findOrFail($id);
        $clinicalRoles = $request->user()->activeRoles()->intersect(['medico_general', 'especialista', 'cirugia']);
        $allowedFields = $clinicalRoles->isNotEmpty()
            ? ['status']
            : ['nutritionDiet', 'nutritionOrder', 'nutritionInstructions'];
        if (array_diff(array_keys($request->all()), $allowedFields)) {
            abort(403, 'Las notas clínicas guardadas son inmutables; agregue una adenda para corregirlas.');
        }
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['Programada', 'En curso', 'Finalizada', 'Cancelada'])],
            'nutritionDiet' => ['sometimes', 'nullable', 'string', 'max:120'],
            'nutritionOrder' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'nutritionInstructions' => ['sometimes', 'nullable', 'string', 'max:4000'],
        ]);
        if (array_diff(array_keys($data), $allowedFields)) {
            abort(403, 'El perfil de nutrición solo puede actualizar indicaciones de alimentación.');
        }
        $mapping = [
            'status' => 'status',
            'nutritionDiet' => 'nutrition_diet', 'nutritionOrder' => 'nutrition_order',
            'nutritionInstructions' => 'nutrition_instructions',
        ];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $data)) {
                $consultation->{$column} = $data[$input];
            }
        }
        $consultation->save();
        $this->audit($request, 'Consulta', 'Actualización', $consultation->id, $consultation->reason);
        if (isset($data['nutritionOrder']) || isset($data['nutritionDiet'])) {
            $this->notify($request, 'Nueva orden de alimentación', 'Se actualizó el régimen de alimentación de un paciente.', 'nutricion');
        }

        return response()->json($this->consultationPayload($consultation->load(['patient', 'doctor', 'addenda'])));
    }

    public function addConsultationAddendum(Request $request, string $id): JsonResponse
    {
        abort_if($request->user()->role === 'admin', 403, 'El perfil administrativo no puede modificar notas clínicas.');
        abort_unless($request->user()->activeRoles()->intersect(['medico_general', 'especialista'])->isNotEmpty(), 403);
        $data = $request->validate(['notes' => ['required', 'string', 'min:5', 'max:4000']]);
        $consultation = Consultation::findOrFail($id);
        $addendum = $consultation->addenda()->create([
            'id' => $this->id('ADD'),
            'doctor_id' => $consultation->doctor_id,
            'doctor_name' => $request->user()->name,
            'notes' => $data['notes'],
        ]);
        $this->audit($request, 'Consulta', 'Adenda clínica', $consultation->id, $consultation->reason, $data['notes']);

        return response()->json($addendum, 201);
    }

    public function operations(): JsonResponse
    {
        return response()->json(Operation::with('patient')->orderByDesc('scheduled_at')->get()->map(fn (Operation $item) => $this->operationPayload($item)));
    }

    public function storeOperation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'patientId' => ['required', 'exists:patients,id'], 'procedure' => ['required', 'string', 'max:255'],
            'surgeonName' => ['required', 'string', 'max:200'], 'scheduledAt' => ['required', 'date'],
            'room' => ['required', 'string', 'max:120'],
        ]);
        $operation = Operation::create([
            'id' => $this->id('OP'), 'patient_id' => $data['patientId'], 'procedure' => $data['procedure'],
            'surgeon_name' => $data['surgeonName'], 'scheduled_at' => $data['scheduledAt'],
            'room' => $data['room'], 'status' => 'Programada', 'created_by' => $request->user()->id,
        ]);
        $this->audit($request, 'Operación', 'Programación', $operation->id, $operation->procedure);
        $this->notify($request, 'Nueva operación programada', 'Se agregó un procedimiento a la agenda quirúrgica.', 'operaciones');

        return response()->json($this->operationPayload($operation->load('patient')), 201);
    }

    public function updateOperation(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['Programada', 'En curso', 'Finalizada', 'Cancelada'])]]);
        $operation = Operation::findOrFail($id);
        $operation->update($data);
        $this->audit($request, 'Operación', 'Actualización', $operation->id, $operation->procedure);

        return response()->json($this->operationPayload($operation->load('patient')));
    }

    public function inventory(): JsonResponse
    {
        return response()->json(InventoryItem::orderBy('category')->orderBy('name')->get()->map(fn (InventoryItem $item) => $this->inventoryPayload($item)));
    }

    public function storeInventoryItem(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'], 'category' => ['required', Rule::in(['Alimentos', 'Insumos hospitalarios', 'Medicamentos'])],
            'unit' => ['required', 'string', 'max:32', Rule::in(self::ALLOWED_UNITS)], 'stock' => ['required', 'integer', 'min:0'],
            'minimumStock' => ['required', 'integer', 'min:0'], 'expirationDate' => ['nullable', 'date'],
            'batchCode' => ['nullable', 'string', 'max:60'],
            'unitCost' => ['required', 'numeric', 'min:0', 'max:9999999999'],
            'unitPrice' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'warehouse' => ['nullable', 'string', 'max:48'],
            'isControlled' => ['sometimes', 'boolean'],
        ]);
        if ($data['category'] === 'Medicamentos' && $data['stock'] > 0) {
            validator($data, [
                'batchCode' => ['required', 'string', 'max:60'],
                'expirationDate' => ['required', 'date', 'after_or_equal:today'],
                'unitCost' => ['required', 'numeric', 'min:0'],
            ])->validate();
        }
        $item = DB::transaction(function () use ($data): InventoryItem {
            $item = InventoryItem::create([
                'id' => $this->id('INV'), 'name' => trim($data['name']), 'category' => $data['category'],
                'unit' => $data['unit'], 'stock' => $data['stock'], 'minimum_stock' => $data['minimumStock'],
                'expiration_date' => $data['expirationDate'] ?? null,
                'unit_cost' => $data['unitCost'],
                'unit_price' => $data['unitPrice'] ?? 0,
                'warehouse' => $data['warehouse'] ?? 'Farmacia',
                'is_controlled' => $data['isControlled'] ?? false,
            ]);
            if ($data['category'] === 'Medicamentos' && $data['stock'] > 0) {
                InventoryBatch::create([
                    'id' => $this->id('LOT'), 'inventory_item_id' => $item->id,
                    'batch_code' => $data['batchCode'], 'expiration_date' => $data['expirationDate'],
                    'quantity' => $data['stock'], 'unit_cost' => $data['unitCost'],
                    'warehouse' => $data['warehouse'] ?? 'Farmacia',
                ]);
            }
            return $item;
        });
        $this->audit($request, 'Inventario', 'Registro', $item->id, $item->name);

        return response()->json($this->inventoryPayload($item), 201);
    }

    public function adjustInventory(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'not_in:0'],
            'batchCode' => ['nullable', 'string', 'max:60'],
            'expirationDate' => ['nullable', 'date', 'after_or_equal:today'],
            'unitCost' => ['nullable', 'numeric', 'min:0'],
        ]);
        $item = DB::transaction(function () use ($id, $data): InventoryItem {
            $item = InventoryItem::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($item->stock + $data['amount'] < 0) {
                throw ValidationException::withMessages(['amount' => ['El ajuste no puede dejar existencias negativas.']]);
            }
            if ($item->category === 'Medicamentos') {
                if ($data['amount'] > 0) {
                    if (empty($data['batchCode']) || empty($data['expirationDate']) || ! isset($data['unitCost'])) {
                        throw ValidationException::withMessages([
                            'batchCode' => ['Para recibir medicamentos indique lote, caducidad y costo unitario.'],
                        ]);
                    }
                    if (InventoryBatch::where('inventory_item_id', $item->id)
                        ->where('batch_code', $data['batchCode'])->exists()) {
                        throw ValidationException::withMessages([
                            'batchCode' => ['Ese código de lote ya está registrado para este artículo.'],
                        ]);
                    }
                    InventoryBatch::create([
                        'id' => $this->id('LOT'), 'inventory_item_id' => $item->id,
                        'batch_code' => $data['batchCode'], 'expiration_date' => $data['expirationDate'],
                        'quantity' => $data['amount'], 'unit_cost' => $data['unitCost'],
                        'warehouse' => $item->warehouse,
                    ]);
                } else {
                    $remaining = abs($data['amount']);
                    $batches = InventoryBatch::where('inventory_item_id', $item->id)
                        ->whereDate('expiration_date', '>=', today())->where('quantity', '>', 0)
                        ->orderBy('expiration_date')->orderBy('id')->lockForUpdate()->get();
                    if ($batches->sum('quantity') < $remaining) {
                        throw ValidationException::withMessages([
                            'amount' => ['El ajuste supera el saldo de lotes vigentes; no se modificó el inventario.'],
                        ]);
                    }
                    foreach ($batches as $batch) {
                        if ($remaining === 0) {
                            break;
                        }
                        $decrement = min($remaining, $batch->quantity);
                        $batch->decrement('quantity', $decrement);
                        $remaining -= $decrement;
                    }
                }
            }
            $item->stock += $data['amount'];
            $item->save();
            return $item;
        });
        $this->audit($request, 'Inventario', 'Ajuste', $item->id, $item->name, null, 'Variación: '.$data['amount']);

        return response()->json($this->inventoryPayload($item));
    }

    public function dispensations(): JsonResponse
    {
        return response()->json(Dispensation::with(['patient', 'item', 'batchAllocations.batch'])
            ->orderByDesc('dispensed_at')->get()->map(fn (Dispensation $item) => $this->dispensationPayload($item)));
    }

    public function storeDispensation(Request $request): JsonResponse
    {
        $isAdmin = $request->user()->role === 'admin';
        $data = $request->validate([
            'patientId' => ['required', 'exists:patients,id'], 'itemId' => ['required', 'exists:inventory_items,id'],
            'quantity' => ['required', 'integer', 'min:1'], 'prescription' => ['required', 'string', 'max:120'],
            'responsibleId' => [$isAdmin ? 'nullable' : 'required', 'integer', 'exists:users,id'],
            'prescriberEmail' => ['nullable', 'email', 'max:255'],
            'prescriberPassword' => ['nullable', 'string', 'max:255'],
        ]);
        $duplicatePrescription = Dispensation::whereRaw('LOWER(TRIM(prescription)) = ?', [
            mb_strtolower(trim($data['prescription'])),
        ])->exists();
        if ($duplicatePrescription) {
            throw ValidationException::withMessages([
                'prescription' => ['Ese folio de receta ya fue registrado.'],
            ]);
        }

        $responsible = null;
        if (! empty($data['responsibleId'])) {
            $responsible = User::whereKey($data['responsibleId'])
                ->where('role', 'farmacia')->where('is_active', true)->first();
            $isAssignedResponsible = $responsible && DB::table('area_staff_assignments')
                ->where('area', 'farmacia')->where('user_id', $responsible->id)->exists();
            if (! $isAssignedResponsible) {
                throw ValidationException::withMessages([
                    'responsibleId' => ['Seleccione uno de los dos encargados activos de Farmacia.'],
                ]);
            }
            if ($request->user()->role === 'farmacia' && $request->user()->id !== $responsible->id) {
                throw ValidationException::withMessages([
                    'responsibleId' => ['La cuenta de Farmacia solo puede registrar dispensaciones a nombre de su titular.'],
                ]);
            }
        }

        $item = InventoryItem::findOrFail($data['itemId']);
        if ($item->category !== 'Medicamentos' || $item->stock < $data['quantity']) {
            throw ValidationException::withMessages(['quantity' => ['El medicamento no está disponible en cantidad suficiente.']]);
        }

        $prescriber = null;
        if ($item->is_controlled && ! $isAdmin) {
            $prescriber = User::where('email', $data['prescriberEmail'] ?? '')
                ->where('is_active', true)->first();
            if (! $prescriber
                || $prescriber->role === 'admin'
                || $prescriber->activeRoles()->intersect(['medico_general', 'especialista'])->isEmpty()
                || ! Hash::check($data['prescriberPassword'] ?? '', $prescriber->password)) {
                throw ValidationException::withMessages([
                    'prescriberEmail' => ['Se requiere una segunda autorización válida de un médico activo.'],
                ]);
            }
        }

        $status = $isAdmin ? 'Solicitada' : 'Surtida';
        $dispensation = Dispensation::create([
            'id' => $this->id('FAR'), 'patient_id' => $data['patientId'], 'item_id' => $item->id,
            'quantity' => $data['quantity'], 'unit_price' => $item->unit_price,
            'prescription' => trim($data['prescription']),
            'responsible' => $responsible?->name ?? 'Pendiente de asignar en Farmacia',
            'responsible_user_id' => $responsible?->id,
            'prescribed_by' => $prescriber?->id,
            'dispensed_by' => $isAdmin ? null : $request->user()->id,
            'dispensed_at' => now(),
            'status' => $status,
        ]);

        if ($isAdmin) {
            $this->audit($request, 'Farmacia', 'Solicitud de medicamento', $dispensation->id, $item->name);
            $this->notify($request, 'Nuevo pedido de medicamento', "Administración solicitó {$dispensation->quantity} unidad(es) de {$item->name} (Receta {$dispensation->prescription}).", 'farmacia');
        } else {
            $this->audit($request, 'Farmacia', 'Dispensación preparada', $dispensation->id, $item->name);
            $this->notifyAdministrators('Dispensación pendiente de autorización', "{$request->user()->name} preparó {$dispensation->quantity} unidad(es) de {$item->name} (Receta {$dispensation->prescription}).");
        }

        return response()->json($this->dispensationPayload($dispensation->load(['patient', 'item', 'batchAllocations.batch'])), 201);
    }

    public function updateDispensation(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Solicitada', 'Surtida', 'Autorizada', 'Cancelada'])],
            'responsibleId' => ['nullable', 'integer', 'exists:users,id'],
            'prescriberEmail' => ['nullable', 'email', 'max:255'],
            'prescriberPassword' => ['nullable', 'string', 'max:255'],
        ]);
        $role = $request->user()->role;

        [$dispensation, $item] = DB::transaction(function () use ($request, $data, $id, $role): array {
            $dispensation = Dispensation::with(['item', 'patient'])->whereKey($id)->lockForUpdate()->firstOrFail();
            $item = InventoryItem::whereKey($dispensation->item_id)->lockForUpdate()->firstOrFail();

            if ($dispensation->status === $data['status']) {
                return [$dispensation, $item];
            }

            if ($data['status'] === 'Surtida') {
                abort_unless($role === 'farmacia', 403, 'Solo el encargado de Farmacia puede surtir el medicamento.');
                if ($dispensation->status !== 'Solicitada') {
                    throw ValidationException::withMessages(['status' => ['Solo se pueden surtir pedidos solicitados.']]);
                }
                $responsible = User::whereKey($data['responsibleId'] ?? $request->user()->id)
                    ->where('role', 'farmacia')->where('is_active', true)->first();
                $isAssigned = $responsible && DB::table('area_staff_assignments')
                    ->where('area', 'farmacia')->where('user_id', $responsible->id)->exists();
                if (! $isAssigned || $responsible->id !== $request->user()->id) {
                    throw ValidationException::withMessages(['responsibleId' => ['Debe confirmar la entrega con su cuenta activa de Farmacia.']]);
                }
                $prescriber = $dispensation->prescribed_by ? User::find($dispensation->prescribed_by) : null;
                if ($item->is_controlled && ! $prescriber) {
                    $prescriber = User::where('email', $data['prescriberEmail'] ?? '')->where('is_active', true)->first();
                    if (! $prescriber
                        || $prescriber->role === 'admin'
                        || $prescriber->activeRoles()->intersect(['medico_general', 'especialista'])->isEmpty()
                        || ! Hash::check($data['prescriberPassword'] ?? '', $prescriber->password)) {
                        throw ValidationException::withMessages(['prescriberEmail' => ['Se requiere una segunda autorización válida de un médico activo.']]);
                    }
                    $dispensation->prescribed_by = $prescriber->id;
                }
                $dispensation->responsible = $responsible->name;
                $dispensation->responsible_user_id = $responsible->id;
                $dispensation->dispensed_by = $request->user()->id;
                $dispensation->dispensed_at = now();
                $dispensation->status = 'Surtida';
                $dispensation->save();

                return [$dispensation, $item];
            }

            if (in_array($data['status'], ['Autorizada', 'Cancelada'], true)) {
                abort_unless($role === 'admin', 403, 'Solo Administración puede autorizar o cancelar la entrega de medicamentos.');
                if (! in_array($dispensation->status, ['Solicitada', 'Surtida'], true)) {
                    throw ValidationException::withMessages(['status' => ['Esta dispensación ya fue finalizada o cancelada.']]);
                }
                if ($data['status'] === 'Cancelada') {
                    $dispensation->status = 'Cancelada';
                    $dispensation->authorized_by = $request->user()->id;
                    $dispensation->authorized_at = now();
                    $dispensation->save();
                    return [$dispensation, $item];
                }
                if ($dispensation->status !== 'Surtida') {
                    throw ValidationException::withMessages(['status' => ['Farmacia debe surtir primero el medicamento antes de autorizar la entrega.']]);
                }

                if ($item->category !== 'Medicamentos' || $item->stock < $dispensation->quantity) {
                    throw ValidationException::withMessages(['quantity' => ['El medicamento no está disponible en cantidad suficiente.']]);
                }
                $batches = InventoryBatch::where('inventory_item_id', $item->id)
                    ->whereDate('expiration_date', '>=', today())->where('quantity', '>', 0)
                    ->orderBy('expiration_date')->orderBy('id')->lockForUpdate()->get();
                if ($batches->sum('quantity') < $dispensation->quantity) {
                    throw ValidationException::withMessages([
                        'quantity' => ['No hay lotes vigentes suficientes para surtir esta receta.'],
                    ]);
                }
                $item->decrement('stock', $dispensation->quantity);
                $remaining = $dispensation->quantity;
                foreach ($batches as $batch) {
                    if ($remaining === 0) {
                        break;
                    }
                    $allocated = min($remaining, $batch->quantity);
                    $batch->decrement('quantity', $allocated);
                    $dispensation->batchAllocations()->create([
                        'inventory_batch_id' => $batch->id,
                        'quantity' => $allocated,
                        'unit_cost' => $batch->unit_cost,
                    ]);
                    $remaining -= $allocated;
                }
                $total = round($item->unit_price * $dispensation->quantity, 2);
                if ($total > 0) {
                    $patient = Patient::whereKey($dispensation->patient_id)->lockForUpdate()->firstOrFail();
                    app(BillingService::class)->createPatientCharge(
                        $patient,
                        'Dispensación '.$item->name.' · '.$dispensation->id,
                        $total,
                        (int) $request->user()->id,
                    );
                }
                $dispensation->status = 'Autorizada';
                $dispensation->authorized_by = $request->user()->id;
                $dispensation->authorized_at = now();
                $dispensation->save();

                return [$dispensation, $item];
            }

            throw ValidationException::withMessages(['status' => ['Transición de estado no válida.']]);
        });

        if ($data['status'] === 'Surtida') {
            $this->audit($request, 'Farmacia', 'Medicamento surtido', $dispensation->id, $item->name);
            $this->notifyAdministrators('Medicamento listo para autorizar', "Farmacia surtió {$dispensation->quantity} unidad(es) de {$item->name} (Receta {$dispensation->prescription}).");
        } elseif ($data['status'] === 'Autorizada') {
            $this->audit($request, 'Farmacia', 'Dispensación autorizada', $dispensation->id, $item->name);
        } elseif ($data['status'] === 'Cancelada') {
            $this->audit($request, 'Farmacia', 'Dispensación cancelada', $dispensation->id, $item->name);
        }

        return response()->json($this->dispensationPayload($dispensation->load(['patient', 'item', 'batchAllocations.batch'])));
    }

    public function mealOrders(Request $request): JsonResponse
    {
        $roles = $request->user()->activeRoles();
        $restricted = $request->user()->role === 'admin'
            || $roles->intersect(['medico_general', 'especialista', 'cirugia'])->isEmpty();
        $includeAllergies = $request->user()->role !== 'admin' && $roles->contains('nutricion');
        return response()->json(MealOrder::with('patient')->orderByDesc('delivery_date')->get()
            ->map(fn (MealOrder $item) => $this->mealPayload($item, $restricted, $includeAllergies)));
    }

    public function storeMealOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'patientId' => ['required', 'exists:patients,id'], 'meal' => ['required', Rule::in(['Desayuno', 'Comida', 'Cena'])],
            'diet' => ['required', 'string', 'max:160'], 'deliveryDate' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'chargeAmount' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
        ]);
        $isNutrition = $request->user()->role === 'nutricion';
        $initialStatus = $isNutrition ? 'Solicitada' : 'Pendiente';
        $meal = MealOrder::create([
            'id' => $this->id('ALI'), ...$this->snakeKeys($data), 'status' => $initialStatus,
            'charge_amount' => $data['chargeAmount'] ?? 0,
            'created_by' => $request->user()->id,
        ]);
        $this->audit($request, 'Alimentos', 'Orden', $meal->id, $meal->diet);
        if ($isNutrition) {
            $this->notifyAdministrators('Nueva solicitud de alimentos', "{$request->user()->name} solicitó autorización para preparar dieta {$meal->diet} ({$meal->meal}).");
        } else {
            $this->notify($request, 'Nuevo pedido de alimentos', "Se registró pedido de dieta {$meal->diet} ({$meal->meal}) para preparación.", 'nutricion');
        }

        $restricted = $request->user()->role === 'admin'
            || $request->user()->activeRoles()->intersect(['medico_general', 'especialista', 'cirugia'])->isEmpty();
        $includeAllergies = $request->user()->role !== 'admin'
            && $request->user()->activeRoles()->contains('nutricion');
        return response()->json($this->mealPayload($meal->load('patient'), $restricted, $includeAllergies), 201);
    }

    public function updateMealOrder(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Solicitada', 'Pendiente', 'Preparado', 'Entregada', 'Cancelada'])],
            'preparedFood' => ['nullable', 'string', 'max:255'],
        ]);
        $role = $request->user()->role;

        [$meal, $invoice, $changed] = DB::transaction(function () use ($request, $data, $id, $role): array {
            $meal = MealOrder::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($meal->status === $data['status']) {
                return [$meal, null, false];
            }

            if ($data['status'] === 'Pendiente') {
                abort_unless($role === 'admin', 403, 'Solo Administración puede confirmar una solicitud de alimentos.');
                if ($meal->status !== 'Solicitada') {
                    throw ValidationException::withMessages(['status' => ['Solo se pueden confirmar órdenes solicitadas.']]);
                }
                $meal->status = 'Pendiente';
                $meal->save();
                return [$meal, null, true];
            }

            if ($data['status'] === 'Preparado') {
                abort_unless(in_array($role, ['nutricion', 'admin'], true), 403, 'Solo Nutrición puede marcar el alimento como preparado.');
                if ($meal->status !== 'Pendiente') {
                    throw ValidationException::withMessages(['status' => ['La orden debe estar confirmada (Pendiente) para prepararse.']]);
                }
                $meal->status = 'Preparado';
                $meal->prepared_food = trim((string) ($data['preparedFood'] ?? '')) ?: $meal->diet;
                $meal->prepared_at = now();
                $meal->prepared_by = $request->user()->id;
                $meal->save();
                return [$meal, null, true];
            }

            if (in_array($data['status'], ['Entregada', 'Cancelada'], true)) {
                abort_unless($role === 'admin', 403, 'Solo Administración puede autorizar la entrega o cancelar una orden de alimentos.');
                if (in_array($meal->status, ['Entregada', 'Cancelada'], true)) {
                    throw ValidationException::withMessages(['status' => ['Una entrega finalizada o cancelada no se puede reabrir ni modificar.']]);
                }
                if ($data['status'] === 'Entregada' && ! in_array($meal->status, ['Preparado', 'Pendiente'], true)) {
                    throw ValidationException::withMessages(['status' => ['El alimento debe ser preparado antes de autorizar la entrega.']]);
                }
                $meal->status = $data['status'];
                $invoice = null;
                if ($data['status'] === 'Entregada') {
                    $meal->delivered_at = now();
                    if ($meal->charge_amount > 0) {
                        $patient = Patient::whereKey($meal->patient_id)->lockForUpdate()->firstOrFail();
                        $invoice = app(BillingService::class)->createPatientCharge(
                            $patient,
                            'Alimentación '.$meal->meal.' · '.$meal->id,
                            (float) $meal->charge_amount,
                            (int) $request->user()->id,
                        );
                        $meal->charged_invoice_id = $invoice->id;
                    }
                }
                $meal->save();
                return [$meal, $invoice, true];
            }

            throw ValidationException::withMessages(['status' => ['Transición de estado no válida.']]);
        });
        if ($changed) {
            if ($invoice) {
                $this->audit(
                    $request, 'Cobro', 'Cargo por alimentación', $invoice->id,
                    $invoice->description, null, 'Ficha de cobro: '.$invoice->id,
                );
            }
            $this->audit(
                $request, 'Alimentos', 'Estado de entrega actualizado', $meal->id,
                $meal->meal.' · '.$meal->patient_id, null, 'Estado: '.$meal->status,
            );
            if ($meal->status === 'Preparado') {
                $this->notifyAdministrators('Alimento preparado por autorizar', "Nutrición preparó: {$meal->prepared_food} (Dieta: {$meal->diet}). Pendiente de autorización final.");
            } elseif ($meal->status === 'Entregada') {
                $this->notify($request, 'Entrega de alimentos autorizada', 'Administración autorizó la entrega y se generó el cargo aplicable.', 'alimentos');
            }
        }
        $roles = $request->user()->activeRoles();
        $restricted = $request->user()->role === 'admin'
            || $roles->intersect(['medico_general', 'especialista', 'cirugia'])->isEmpty();

        return response()->json($this->mealPayload(
            $meal->load('patient'),
            $restricted,
            $request->user()->role !== 'admin' && $roles->contains('nutricion'),
        ));
    }

    public function suppliers(): JsonResponse
    {
        return response()->json(
            Supplier::where('is_active', true)
                ->orderBy('category')
                ->orderBy('name')
                ->get(['id', 'name', 'category', 'contact_phone', 'contact_email'])
        );
    }

    public function purchaseOrders(): JsonResponse
    {
        return response()->json(PurchaseOrder::with('creator')->orderByDesc('requested_at')->get()->map(fn (PurchaseOrder $item) => $this->purchasePayload($item)));
    }

    public function storePurchaseOrder(Request $request): JsonResponse
    {
        $isAdmin = $request->user()->role === 'admin';

        $data = $request->validate([
            'supplier' => ['required', 'string', 'max:160', Rule::exists('suppliers', 'name')->where('is_active', true)],
            'itemName' => ['required', 'string', 'max:160'],
            'category' => ['required', Rule::in(['Alimentos', 'Insumos hospitalarios', 'Medicamentos'])],
            'unit' => ['required', 'string', 'max:32', Rule::in(self::ALLOWED_UNITS)], 'quantity' => ['required', 'integer', 'min:1'],
            'unitCost' => ['required', 'numeric', 'min:0'], 'requestedAt' => ['required', 'date'],
        ]);

        $supplier = Supplier::where('name', $data['supplier'])->where('is_active', true)->firstOrFail();
        if ($supplier->category !== $data['category']) {
            throw ValidationException::withMessages([
                'supplier' => ["El proveedor seleccionado pertenece a la categoría {$supplier->category} y no a {$data['category']}."],
            ]);
        }

        $order = PurchaseOrder::create([
            'id' => $this->id('COM'), 'supplier' => $data['supplier'], 'item_name' => $data['itemName'],
            'category' => $data['category'], 'unit' => $data['unit'], 'quantity' => $data['quantity'],
            'unit_cost' => $data['unitCost'], 'requested_at' => $data['requestedAt'],
            'status' => $isAdmin ? 'Aprobada' : 'Solicitada', 'created_by' => $request->user()->id,
        ]);

        if ($isAdmin) {
            $this->notify($request, 'Nuevo pedido de Administración para Almacén', "Administración ordenó {$order->quantity} {$order->unit} de {$order->item_name} ({$order->category}).", 'almacen');
        } else {
            $this->notifyAdministrators(
                'Nueva solicitud de mercancía',
                "{$request->user()->name} solicitó {$order->quantity} {$order->unit} de {$order->item_name} ({$order->category})."
            );
        }

        return response()->json($this->purchasePayload($order->load('creator')), 201);
    }

    public function updatePurchaseOrder(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['Solicitada', 'Aprobada', 'Por confirmar', 'Recibida', 'Cancelada'])]]);
        $roles = $request->user()->activeRoles()->all();

        $order = DB::transaction(function () use ($id, $data, $roles): PurchaseOrder {
            $order = PurchaseOrder::with('creator')->whereKey($id)->lockForUpdate()->firstOrFail();
            if ($order->status === $data['status']) {
                return $order;
            }
            if ($order->status === 'Solicitada' && in_array($data['status'], ['Aprobada', 'Cancelada'], true)) {
                abort_unless(
                    (bool) array_intersect($roles, ['admin', 'compras']),
                    403,
                    'Solo el administrador puede autorizar o rechazar solicitudes de mercancía.'
                );
            }
            if ($data['status'] === 'Por confirmar') {
                abort_unless(
                    (bool) array_intersect($roles, ['admin', 'compras', 'almacen']),
                    403,
                    'Solo almacén, compras o administración pueden registrar la compra/recepción.'
                );
            }
            if ($data['status'] === 'Recibida') {
                abort_unless(
                    in_array('admin', $roles, true),
                    403,
                    'Solo Administración puede confirmar y finalizar un pedido.'
                );
            }
            if ($data['status'] === 'Cancelada' && $order->status !== 'Solicitada') {
                abort_unless(
                    (bool) array_intersect($roles, ['admin', 'compras']),
                    403,
                    'Solo Administración puede cancelar este pedido.'
                );
            }
            $validTransition = match ($order->status) {
                'Solicitada' => in_array($data['status'], ['Aprobada', 'Cancelada'], true),
                'Aprobada' => in_array($data['status'], ['Por confirmar', 'Cancelada'], true),
                'Por confirmar' => in_array($data['status'], ['Recibida', 'Cancelada'], true),
                default => false,
            };
            if (! $validTransition) {
                throw ValidationException::withMessages(['status' => ['Transición no válida para esta compra.']]);
            }
            if ($data['status'] === 'Recibida') {
                $inventory = InventoryItem::where('name', $order->item_name)
                    ->where('category', $order->category)->where('unit', $order->unit)->lockForUpdate()->first();
                if ($inventory) {
                    $inventory->increment('stock', $order->quantity);
                } else {
                    InventoryItem::create([
                        'id' => $this->id('INV'), 'name' => $order->item_name, 'category' => $order->category,
                        'unit' => $order->unit, 'stock' => $order->quantity, 'minimum_stock' => 0,
                    ]);
                }
            }
            $order->status = $data['status'];
            $order->save();
            return $order;
        });
        if ($data['status'] === 'Por confirmar') {
            $this->notifyAdministrators('Pedido listo para confirmación final', "Almacén registró {$order->quantity} {$order->unit} de {$order->item_name}. Pendiente de confirmación por Administración.");
        } elseif ($data['status'] === 'Recibida') {
            $this->notify($request, 'Compra confirmada', 'Administración confirmó la recepción de '.$order->item_name.' y actualizó el inventario.', 'compras');
        }

        return response()->json($this->purchasePayload($order->load('creator')));
    }

    public function notifications(Request $request): JsonResponse
    {
        return response()->json($this->notificationsFor($request));
    }

    public function markNotificationRead(Request $request, int $id): JsonResponse
    {
        $notification = HospitalNotification::whereKey($id)
            ->where(fn ($query) => $query->whereNull('user_id')->orWhere('user_id', $request->user()->id))
            ->firstOrFail();
        $notification->read_at = now();
        $notification->save();

        return response()->json($notification);
    }

    public function markAllNotificationsRead(Request $request): JsonResponse
    {
        $updated = HospitalNotification::whereNull('read_at')
            ->where(fn ($query) => $query->whereNull('user_id')->orWhere('user_id', $request->user()->id))
            ->update(['read_at' => now()]);

        return response()->json(['updated' => $updated]);
    }

    public function users(): JsonResponse
    {
        return response()->json(User::orderBy('name')->get(['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at']));
    }

    public function storeUser(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160', 'regex:/^[\pL\pM\s.\'-]+$/u'],
            'email' => ['required', 'email', 'max:160', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:32', 'regex:/^[0-9+() .-]+$/'],
            'password' => ['required', 'string', 'min:12', 'confirmed'],
            'role' => ['required', Rule::in(['admin', 'recepcion', 'medico_general', 'especialista', 'farmacia', 'nutricion', 'compras', 'enfermeria', 'cirugia', 'almacen'])],
        ]);
        $user = User::create([...$data, 'password' => Hash::make($data['password']), 'is_active' => true]);

        return response()->json($user->only(['id', 'name', 'email', 'phone', 'role', 'is_active']), 201);
    }

    public function updateUser(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:160', 'regex:/^[\pL\pM\s.\'-]+$/u'],
            'email' => ['sometimes', 'required', 'email', 'max:160', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32', 'regex:/^[0-9+() .-]+$/'],
            'role' => ['sometimes', Rule::in(['admin', 'recepcion', 'medico_general', 'especialista', 'farmacia', 'nutricion', 'compras', 'enfermeria', 'cirugia', 'almacen'])],
            'isActive' => ['sometimes', 'boolean'],
        ]);
        if ($user->id === $request->user()->id && ($data['isActive'] ?? true) === false) {
            throw ValidationException::withMessages(['isActive' => ['No puede desactivar su propia cuenta.']]);
        }
        if (array_key_exists('role', $data) && $data['role'] !== $user->role
            && DB::table('area_staff_assignments')->where('user_id', $user->id)->exists()) {
            throw ValidationException::withMessages(['role' => ['Retire primero esta cuenta de la asignación de área antes de cambiar su rol.']]);
        }
        if (($data['isActive'] ?? true) === false
            && DB::table('area_staff_assignments')->where('user_id', $user->id)->exists()) {
            throw ValidationException::withMessages(['isActive' => ['Retire primero esta cuenta de la asignación de área antes de desactivarla.']]);
        }
        if (array_key_exists('name', $data)) $user->name = $data['name'];
        if (array_key_exists('email', $data)) $user->email = $data['email'];
        if (array_key_exists('phone', $data)) $user->phone = $data['phone'];
        if (array_key_exists('role', $data)) $user->role = $data['role'];
        if (array_key_exists('isActive', $data)) $user->is_active = $data['isActive'];
        $user->save();
        if (! $user->is_active) $user->tokens()->delete();

        return response()->json($user->only(['id', 'name', 'email', 'phone', 'role', 'is_active']));
    }

    private function validateRoom(Request $request, bool $required, ?Room $room = null): array
    {
        $presence = $required ? 'required' : 'sometimes';
        $data = $request->validate([
            'code' => [$presence, 'string', 'max:64', Rule::unique('rooms', 'code')->ignore($room?->id, 'id')],
            'name' => [$presence, 'string', 'max:160'],
            'floor' => [$presence, 'string', 'max:120'],
            'specialty' => [$presence, 'string', 'max:120'],
            'roomType' => [$presence, 'string', 'max:120'],
            'nurseIds' => ['sometimes', 'array', 'max:50'],
            'nurseIds.*' => ['required', 'integer', 'distinct', Rule::exists('users', 'id')
                ->where(fn ($query) => $query->where('role', 'enfermeria')->where('is_active', true))],
            'status' => ['sometimes', Rule::in(['Disponible', 'Ocupado', 'En Mantenimiento', 'Dado de Baja'])],
            'equipment' => ['sometimes', 'array', 'max:100'],
            'equipment.*' => ['string', 'max:120'],
            'capacity' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'confirmPassword' => ['required', 'string'],
        ]);

        return $this->snakeKeys($data);
    }

    private function validateSchedule(Request $request, bool $required = true, ?DoctorSchedule $schedule = null): array
    {
        $presence = $required ? 'required' : 'sometimes';
        $data = $request->validate([
            'doctorId' => [$presence, 'exists:doctors,id'],
            'roomId' => [$presence, 'exists:rooms,id'],
            'dayOfWeek' => [$presence, 'integer', 'between:1,7'],
            'startTime' => [$presence, 'date_format:H:i'],
            'endTime' => [$presence, 'date_format:H:i', 'after:startTime'],
            'shift' => [$presence, Rule::in(['Matutino', 'Vespertino', 'Nocturno', 'Guardia Completa'])],
            'isActive' => ['sometimes', 'boolean'],
        ]);

        return $this->snakeKeys($data);
    }

    private function assertScheduleAvailable(array $data, ?string $ignoreId = null): void
    {
        foreach (['doctor_id', 'room_id', 'day_of_week', 'start_time', 'end_time'] as $required) {
            if (! array_key_exists($required, $data)) {
                $schedule = $ignoreId ? DoctorSchedule::findOrFail($ignoreId) : null;
                if ($schedule) $data[$required] = $schedule->{$required};
            }
        }
        $doctor = Doctor::findOrFail($data['doctor_id']);
        $room = Room::findOrFail($data['room_id']);
        abort_if($doctor->status !== 'Activo', 422, 'El médico no está activo.');
        abort_if($room->status !== 'Disponible', 422, 'El consultorio no está disponible.');
        $overlap = DoctorSchedule::where('is_active', true)->where('day_of_week', $data['day_of_week'])
            ->where('start_time', '<', $data['end_time'])->where('end_time', '>', $data['start_time'])
            ->where(fn ($query) => $query->where('doctor_id', $data['doctor_id'])->orWhere('room_id', $data['room_id']))
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))->exists();
        if ($overlap) {
            throw ValidationException::withMessages(['schedule' => ['El médico o consultorio ya tiene una asignación en ese horario.']]);
        }
    }

    private function assertAppointmentAvailable(array $data, ?string $ignoreId = null): void
    {
        $doctor = Doctor::findOrFail($data['doctorId']);
        $room = Room::findOrFail($data['roomId']);
        $patient = Patient::findOrFail($data['patientId']);
        abort_if($doctor->status !== 'Activo' || $room->status !== 'Disponible' || $patient->status !== 'Activo', 422, 'Paciente, médico o consultorio no disponible.');
        $day = Carbon::parse($data['appointmentDate'])->dayOfWeekIso;
        $start = $data['appointmentTime'];
        $end = Carbon::createFromFormat('H:i', $start)->addMinutes(30)->format('H:i:s');
        $hasSchedule = DoctorSchedule::where('doctor_id', $doctor->id)->where('room_id', $room->id)
            ->where('day_of_week', $day)->where('is_active', true)
            ->where('start_time', '<=', $start)->where('end_time', '>=', $end)->exists();
        $matchesFixedRoom = $doctor->assigned_room_id === $room->id
            && ! DoctorSchedule::where('doctor_id', $doctor->id)->where('is_active', true)->exists();
        $hasAssignment = DoctorAssignment::where('doctor_id', $doctor->id)->where('room_id', $room->id)
            ->where('date', $data['appointmentDate'])->exists();
        if (! $hasSchedule && ! $matchesFixedRoom && ! $hasAssignment) {
            throw ValidationException::withMessages(['appointmentTime' => ['El médico no tiene ese consultorio asignado durante el horario seleccionado.']]);
        }
        $requestedStart = Carbon::createFromFormat('H:i', $start);
        $requestedEnd = $requestedStart->copy()->addMinutes(30);
        $reservationConflict = RoomReservation::where('room_id', $room->id)
            ->where('status', 'Reservada')
            ->where('starts_at', '<', Carbon::parse($data['appointmentDate'].' '.$requestedEnd->format('H:i:s')))
            ->where('ends_at', '>', Carbon::parse($data['appointmentDate'].' '.$requestedStart->format('H:i:s')))
            ->exists();
        if ($reservationConflict) {
            throw ValidationException::withMessages(['roomId' => ['El consultorio está reservado para ese horario.']]);
        }
        $patientConflict = Appointment::whereDate('appointment_date', $data['appointmentDate'])
            ->where('patient_id', $patient->id)->where('status', 'Programada')
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->get()
            ->contains(function (Appointment $existing) use ($requestedStart, $requestedEnd): bool {
                $existingStart = Carbon::parse($existing->appointment_time);
                $existingEnd = $existingStart->copy()->addMinutes(30);
                return $requestedStart->lt($existingEnd) && $requestedEnd->gt($existingStart);
            });
        if ($patientConflict) {
            throw ValidationException::withMessages(['patientId' => ['El paciente ya tiene una cita en ese horario.']]);
        }
        $conflict = Appointment::whereDate('appointment_date', $data['appointmentDate'])
            ->where('status', 'Programada')
            ->where(fn ($query) => $query->where('doctor_id', $doctor->id)->orWhere('room_id', $room->id))
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->get()
            ->contains(function (Appointment $existing) use ($requestedStart, $requestedEnd): bool {
                $existingStart = Carbon::parse($existing->appointment_time);
                $existingEnd = $existingStart->copy()->addMinutes(30);
                return $requestedStart->lt($existingEnd) && $requestedEnd->gt($existingStart);
            });
        if ($conflict) {
            throw ValidationException::withMessages(['appointmentTime' => ['El médico o consultorio ya tiene una cita a esa hora.']]);
        }
    }

    private function auditPatientCollection(Request $request, $patients, string $source): void
    {
        foreach ($patients as $patient) {
            $this->audit(
                $request, 'Paciente', 'Consulta de expediente', $patient->id,
                $patient->first_name.' '.$patient->last_name, null,
                'Área: '.$request->user()->role.'; fuente: '.$source,
            );
        }
    }

    private function editablePatientIds(User $user): ?array
    {
        $roles = $user->activeRoles();
        if ($user->role === 'admin' || $roles->contains('recepcion')) {
            return null;
        }
        if ($roles->intersect(['medico_general', 'especialista'])->isNotEmpty()) {
            return Consultation::where('created_by', $user->id)->pluck('patient_id')->unique()->all();
        }
        if ($roles->contains('enfermeria')) {
            return \App\Models\NurseKardexRecord::where('nurse_id', $user->id)
                ->pluck('patient_id')->unique()->all();
        }

        return [];
    }

    private function patientListPayload(
        Patient $patient,
        bool $fullAccess,
        User $user,
        ?array $editablePatientIds,
    ): array {
        $payload = $fullAccess ? $this->patientPayload($patient) : $this->patientBasicPayload($patient);
        $canEdit = $editablePatientIds === null || in_array($patient->id, $editablePatientIds, true);
        if ($canEdit && $user->role === 'enfermeria' && ! $fullAccess) {
            $payload += [
                'phone' => $patient->phone,
                'email' => $patient->email,
                'allergies' => $patient->allergies,
                'emergencyContact' => $patient->emergency_contact,
            ];
        }
        $payload['canEdit'] = $canEdit;

        return $payload;
    }

    private function audit(Request $request, string $type, string $action, ?string $id, string $name, ?string $reason = null, ?string $details = null): void
    {
        AuditLog::create([
            'user_id' => $request->user()?->id, 'entity_type' => $type, 'action' => $action,
            'entity_id' => $id, 'entity_name' => $name, 'reason' => $reason, 'details' => $details,
            'occurred_at' => now(),
        ]);
    }

    private function doctorForUser(User $user): ?Doctor
    {
        return Doctor::where('user_id', $user->id)->first();
    }

    private function doctorAccountId(?string $email, ?string $ignoreDoctorId = null): ?int
    {
        if (! $email) {
            return null;
        }
        return User::where('email', $email)->whereIn('role', ['medico_general', 'especialista'])
            ->where('is_active', true)
            ->when($ignoreDoctorId, fn ($query) => $query->whereNotIn(
                'id',
                Doctor::where('id', '!=', $ignoreDoctorId)->whereNotNull('user_id')->select('user_id'),
            ), fn ($query) => $query->whereNotIn(
                'id',
                Doctor::whereNotNull('user_id')->select('user_id'),
            ))->value('id');
    }

    private function appointmentsForUser(Request $request)
    {
        $query = Appointment::with(['patient', 'doctor', 'room']);
        if ($request->user()->activeRoles()->intersect(['admin', 'recepcion'])->isEmpty()) {
            $doctor = $this->doctorForUser($request->user());
            if (! $doctor) {
                return collect();
            }
            $query->where('doctor_id', $doctor->id);
        }
        return $query->orderByDesc('appointment_date')->orderByDesc('appointment_time')->get();
    }

    private function recordScheduleSnapshot(DoctorSchedule $schedule, Request $request, string $action): void
    {
        DoctorScheduleHistory::create([
            'id' => $this->id('SCHH'),
            'schedule_id' => $schedule->id,
            'doctor_id' => $schedule->doctor_id,
            'room_id' => $schedule->room_id,
            'day_of_week' => $schedule->day_of_week,
            'start_time' => $schedule->start_time,
            'end_time' => $schedule->end_time,
            'shift' => $schedule->shift,
            'is_active' => $schedule->is_active,
            'action' => $action,
            'recorded_by' => $request->user()->id,
            'recorded_at' => now(),
        ]);
    }

    private function notify(Request $request, string $title, string $body, string $type): void
    {
        HospitalNotification::create(['user_id' => null, 'title' => $title, 'body' => $body, 'type' => $type]);
    }

    private function notificationsFor(Request $request): array
    {
        return HospitalNotification::where(fn ($query) => $query->whereNull('user_id')->orWhere('user_id', $request->user()->id))
            ->orderByDesc('created_at')->limit(100)->get()->toArray();
    }

    private function assertUserPassword(Request $request, ?string $password, string $field = 'confirmPassword'): void
    {
        if (! $password || ! Hash::check($password, $request->user()->password)) {
            throw ValidationException::withMessages([
                $field => ['La contraseña de confirmación no es válida.'],
            ]);
        }
    }

    private function id(string $prefix): string
    {
        return $prefix.'-'.strtoupper(Str::random(8));
    }

    private function snakeKeys(array $data): array
    {
        $result = [];
        foreach ($data as $key => $value) {
            $result[Str::snake($key)] = $value;
        }

        return $result;
    }

    private function patientPayload(Patient $item): array
    {
        return [
            'id' => $item->id, 'documentId' => $item->document_id, 'firstName' => $item->first_name,
            'medicalRecordNumber' => 'EXP-'.$item->id,
            'lastName' => $item->last_name, 'birthDate' => $item->birth_date?->format('Y-m-d'),
            'gender' => $item->gender, 'phone' => $item->phone, 'email' => $item->email,
            'bloodType' => $item->blood_type, 'allergies' => $item->allergies,
            'temperatureC' => $item->temperature_c, 'heightCm' => $item->height_cm,
            'emergencyContact' => $item->emergency_contact, 'admissionDate' => $item->admission_date?->format('Y-m-d'),
            'insuranceProvider' => $item->insurance_provider, 'insurancePolicy' => $item->insurance_policy,
            'insuranceCoveragePercent' => $item->insurance_coverage_percent,
            'assignedBedId' => $item->assigned_bed_id,
            'dischargeRequestedAt' => $item->discharge_requested_at?->toIso8601String(),
            'dischargeRequestNotes' => $item->discharge_request_notes,
            'medicalDischargeAt' => $item->medical_discharge_at?->toIso8601String(),
            'administrativeDischargeAt' => $item->administrative_discharge_at?->toIso8601String(),
            'status' => $item->status, 'dischargeDate' => $item->discharge_date?->format('Y-m-d'),
            'dischargeReason' => $item->discharge_reason, 'dischargeNotes' => $item->discharge_notes,
        ];
    }

    private function doctorPayload(Doctor $item, bool $includeUserId = false): array
    {
        $payload = [
            'id' => $item->id, 'licenseNumber' => $item->license_number, 'firstName' => $item->first_name,
            'lastName' => $item->last_name, 'specialty' => $item->specialty, 'phone' => $item->phone,
            'email' => $item->email, 'shift' => $item->shift, 'assignedRoomId' => $item->assigned_room_id,
            'registrationDate' => $item->registration_date?->format('Y-m-d'), 'status' => $item->status,
            'dischargeDate' => $item->discharge_date?->format('Y-m-d'), 'dischargeReason' => $item->discharge_reason,
        ];
        if ($includeUserId) {
            $payload['userId'] = $item->user_id;
        }
        return $payload;
    }

    private function roomPayload(Room $item): array
    {
        $nurses = $item->relationLoaded('nurses') ? $item->nurses : $item->nurses()->get();
        return [
            'id' => $item->id, 'code' => $item->code, 'name' => $item->name, 'floor' => $item->floor,
            'specialty' => $item->specialty, 'roomType' => $item->room_type,
            'nurseIds' => $nurses->pluck('id')->map(fn ($id) => (int) $id)->values(),
            'nurses' => $nurses->map(fn (User $nurse): array => ['id' => $nurse->id, 'name' => $nurse->name])->values(),
            'status' => $item->status, 'equipment' => $item->equipment ?? [],
            'capacity' => $item->capacity, 'registrationDate' => $item->registration_date?->format('Y-m-d'),
            'dischargeDate' => $item->discharge_date?->format('Y-m-d'), 'dischargeReason' => $item->discharge_reason,
        ];
    }

    private function roomReservationPayload(RoomReservation $item): array
    {
        return [
            'id' => $item->id, 'roomId' => $item->room_id,
            'roomName' => $item->room?->code.' — '.$item->room?->name,
            'title' => $item->title, 'reason' => $item->reason,
            'startsAt' => $item->starts_at?->toIso8601String(),
            'endsAt' => $item->ends_at?->toIso8601String(), 'status' => $item->status,
        ];
    }

    private function appointmentPayload(Appointment $item, bool $administrative = false): array
    {
        $shiftCode = $item->shift ?: DoctorAssignment::timeToShift((string) $item->appointment_time);
        $payload = [
            'id' => $item->id, 'patientId' => $item->patient_id,
            'patientName' => trim(($item->patient?->first_name ?? '').' '.($item->patient?->last_name ?? '')),
            'patientDocument' => $item->patient?->document_id ?? '', 'doctorId' => $item->doctor_id,
            'doctorName' => trim(($item->doctor?->first_name ?? '').' '.($item->doctor?->last_name ?? '')),
            'doctorSpecialty' => $item->doctor?->specialty ?? '', 'roomId' => $item->room_id,
            'roomName' => $item->room_name ?: ($item->room ? $item->room->code.' ('.$item->room->name.')' : ''),
            'shift' => $shiftCode,
            'shiftName' => DoctorAssignment::shiftShortName($shiftCode),
            'shiftLabel' => DoctorAssignment::shiftLabel($shiftCode),
            'appointmentDate' => $item->appointment_date?->format('Y-m-d'),
            'appointmentTime' => substr((string) $item->appointment_time, 0, 5),
            'status' => $item->status, 'creationDate' => $item->creation_date?->format('Y-m-d'),
            'dischargeDate' => $item->discharge_date?->format('Y-m-d'), 'dischargeReason' => $item->discharge_reason,
            'dischargeBy' => $item->discharge_by, 'attendedAt' => $item->attended_at?->toIso8601String(),
        ];
        if (! $administrative) {
            $payload['reason'] = $item->reason;
            $payload['dischargeReason'] = $item->discharge_reason;
        }

        return $payload;
    }

    private function doctorAssignmentPayload(DoctorAssignment $item): array
    {
        return [
            'id' => $item->id,
            'doctorId' => $item->doctor_id,
            'doctorName' => $item->doctor ? trim($item->doctor->first_name . ' ' . $item->doctor->last_name) : '',
            'doctorSpecialty' => $item->doctor?->specialty ?? '',
            'roomId' => $item->room_id,
            'roomCode' => $item->room?->code ?? '',
            'roomName' => $item->room ? $item->room->code . ' (' . $item->room->name . ')' : '',
            'date' => $item->date?->format('Y-m-d'),
            'shift' => $item->shift,
            'shiftName' => DoctorAssignment::shiftShortName($item->shift),
            'shiftLabel' => DoctorAssignment::shiftLabel($item->shift),
            'changeReason' => $item->change_reason,
            'createdAt' => $item->created_at?->toIso8601String(),
        ];
    }

    private function consultationPayload(Consultation $item, bool $nutritionOnly = false): array
    {
        if ($nutritionOnly) {
            return [
                'id' => $item->id, 'patientId' => $item->patient_id,
                'patientName' => trim(($item->patient?->first_name ?? '').' '.($item->patient?->last_name ?? '')),
                'scheduledAt' => $item->scheduled_at?->toIso8601String(),
                'assignedBedId' => $item->patient?->assigned_bed_id,
                'allergies' => $item->patient?->allergies,
                'nutritionDiet' => $item->nutrition_diet, 'nutritionOrder' => $item->nutrition_order,
                'nutritionInstructions' => $item->nutrition_instructions,
            ];
        }
        return [
            'id' => $item->id, 'patientId' => $item->patient_id,
            'patientName' => trim(($item->patient?->first_name ?? '').' '.($item->patient?->last_name ?? '')),
            'doctorId' => $item->doctor_id, 'doctorName' => $item->doctor ? trim($item->doctor->first_name.' '.$item->doctor->last_name) : '',
            'consultationType' => $item->consultation_type, 'specialty' => $item->specialty,
            'scheduledAt' => $item->scheduled_at?->toIso8601String(), 'reason' => $item->reason, 'notes' => $item->notes,
            'status' => $item->status, 'diagnosis' => $item->diagnosis, 'vitals' => $item->vitals,
            'treatmentPlan' => $item->treatment_plan, 'specialtyData' => $item->specialty_data,
            'nutritionDiet' => $item->nutrition_diet, 'nutritionOrder' => $item->nutrition_order,
            'nutritionInstructions' => $item->nutrition_instructions,
            'addenda' => $item->addenda->map(fn ($addendum) => [
                'id' => $addendum->id, 'doctorName' => $addendum->doctor_name,
                'notes' => $addendum->notes, 'createdAt' => $addendum->created_at?->toIso8601String(),
            ]),
        ];
    }

    private function patientBasicPayload(Patient $item): array
    {
        return [
            'id' => $item->id, 'documentId' => $item->document_id, 'firstName' => $item->first_name,
            'lastName' => $item->last_name, 'medicalRecordNumber' => 'EXP-'.$item->id,
            'phone' => $item->phone, 'email' => $item->email,
            'emergencyContact' => $item->emergency_contact,
            'insuranceProvider' => $item->insurance_provider,
            'insurancePolicy' => $item->insurance_policy,
            'insuranceCoveragePercent' => $item->insurance_coverage_percent,
            'assignedBedId' => $item->assigned_bed_id,
            'dischargeRequestedAt' => $item->discharge_requested_at?->toIso8601String(),
            'dischargeRequestNotes' => $item->discharge_request_notes,
            'medicalDischargeAt' => $item->medical_discharge_at?->toIso8601String(),
            'administrativeDischargeAt' => $item->administrative_discharge_at?->toIso8601String(),
            'status' => $item->status,
            'dischargeDate' => $item->discharge_date?->format('Y-m-d'),
            'dischargeReason' => $item->discharge_reason,
            'dischargeNotes' => $item->discharge_notes,
        ];
    }

    private function operationPayload(Operation $item): array
    {
        return [
            'id' => $item->id, 'patientId' => $item->patient_id,
            'patientName' => trim(($item->patient?->first_name ?? '').' '.($item->patient?->last_name ?? '')),
            'procedure' => $item->procedure, 'surgeonName' => $item->surgeon_name,
            'scheduledAt' => $item->scheduled_at?->toIso8601String(), 'room' => $item->room, 'status' => $item->status,
        ];
    }

    private function inventoryPayload(InventoryItem $item): array
    {
        return [
            'id' => $item->id, 'name' => $item->name, 'category' => $item->category, 'unit' => $item->unit,
            'stock' => $item->stock, 'minimumStock' => $item->minimum_stock,
            'expirationDate' => $item->expiration_date?->format('Y-m-d'),
            'unitCost' => (float) $item->unit_cost,
            'unitPrice' => (float) $item->unit_price, 'isControlled' => $item->is_controlled,
            'availableStock' => $item->category === 'Medicamentos'
                ? (int) $item->batches()->whereDate('expiration_date', '>=', today())
                    ->where('quantity', '>', 0)->sum('quantity')
                : (int) $item->stock,
        ];
    }

    private function dispensationPayload(Dispensation $item): array
    {
        return [
            'id' => $item->id, 'patientId' => $item->patient_id,
            'patientName' => trim(($item->patient?->first_name ?? '').' '.($item->patient?->last_name ?? '')),
            'itemId' => $item->item_id, 'itemName' => $item->item?->name ?? '',
            'quantity' => $item->quantity, 'prescription' => $item->prescription,
            'responsible' => $item->responsible, 'dispensedAt' => $item->dispensed_at?->toIso8601String(),
            'status' => $item->status ?? 'Autorizada',
            'unitPrice' => (float) $item->unit_price,
            'batches' => $item->batchAllocations?->map(fn ($allocation): array => [
                'code' => $allocation->batch?->batch_code,
                'expirationDate' => $allocation->batch?->expiration_date?->format('Y-m-d'),
                'quantity' => $allocation->quantity,
            ])->values() ?? [],
        ];
    }

    private function mealPayload(MealOrder $item, bool $restricted = false, bool $includeAllergies = true): array
    {
        $payload = [
            'id' => $item->id, 'patientId' => $item->patient_id,
            'patientName' => trim(($item->patient?->first_name ?? '').' '.($item->patient?->last_name ?? '')),
            'bed' => $item->patient?->assigned_bed_id,
            'meal' => $item->meal, 'diet' => $item->diet,
            'preparedFood' => $item->prepared_food,
            'deliveryDate' => $item->delivery_date?->format('Y-m-d'),
            'status' => $item->status,
        ];
        if ($includeAllergies) {
            $payload['allergies'] = $item->patient?->allergies;
        }
        if (! $restricted) {
            $payload['notes'] = $item->notes;
        }

        return $payload;
    }

    private function purchasePayload(PurchaseOrder $item): array
    {
        $areaLabels = [
            'almacen' => 'Almacén',
            'compras' => 'Compras',
            'farmacia' => 'Farmacia',
            'nutricion' => 'Nutrición y Alimentos',
            'enfermeria' => 'Enfermería',
            'admin' => 'Administración',
        ];
        $role = $item->creator?->role;

        return [
            'id' => $item->id, 'supplier' => $item->supplier, 'itemName' => $item->item_name,
            'category' => $item->category, 'unit' => $item->unit, 'quantity' => $item->quantity,
            'unitCost' => (float) $item->unit_cost, 'requestedAt' => $item->requested_at?->format('Y-m-d'),
            'status' => $item->status,
            'requestedByName' => $item->creator?->name,
            'requestedArea' => $role ? ($areaLabels[$role] ?? $role) : null,
        ];
    }

    private function auditPayload(AuditLog $item): array
    {
        return [
            'id' => (string) $item->id, 'timestamp' => $item->occurred_at?->format('Y-m-d H:i:s'),
            'entityType' => $item->entity_type, 'action' => $item->action, 'entityId' => $item->entity_id,
            'entityName' => $item->entity_name, 'reason' => $item->reason, 'details' => $item->details,
            'ipAddress' => $item->ip_address, 'area' => $item->area, 'userName' => $item->user?->name,
        ];
    }
}
