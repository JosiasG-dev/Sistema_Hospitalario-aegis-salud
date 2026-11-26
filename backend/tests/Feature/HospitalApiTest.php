<?php

namespace Tests\Feature;

use App\Models\Doctor;
use App\Models\DoctorScheduleHistory;
use App\Models\DoctorSchedule;
use App\Models\Appointment;
use App\Models\InventoryItem;
use App\Models\MealOrder;
use App\Models\InventoryBatch;
use App\Models\NurseKardexRecord;
use App\Models\Patient;
use App\Models\PurchaseOrder;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class HospitalApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_user_can_log_in_and_receives_a_role_bound_token(): void
    {
        $this->createPatient();
        $user = User::factory()->create([
            'email' => 'admin@example.test',
            'password' => 'A-Long-Development-Password',
            'role' => 'admin',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'A-Long-Development-Password',
        ])->assertOk()->assertJsonPath('user.role', 'admin');

        $this->withToken($response->json('token'))
            ->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonStructure(['patients', 'doctors', 'rooms', 'consultations', 'schedules', 'notifications']);
        $this->assertDatabaseHas('audit_logs', ['entity_type' => 'Paciente', 'action' => 'Consulta de expediente']);
    }

    public function test_consultation_and_nutrition_order_are_persisted(): void
    {
        $user = User::factory()->create(['role' => 'medico_general']);
        $patient = $this->createPatient();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/consultations', [
                'patientId' => $patient->id,
                'consultationType' => 'general',
                'scheduledAt' => '2026-11-10T09:00:00',
                'reason' => 'Control de seguimiento',
                'diagnosis' => 'Diagnóstico demostrativo',
                'nutritionDiet' => 'Régimen indicado por el equipo tratante',
                'nutritionOrder' => 'Orden de alimentación de demostración',
            ])
            ->assertCreated()
            ->assertJsonPath('nutritionOrder', 'Orden de alimentación de demostración');

        $this->assertDatabaseHas('consultations', [
            'patient_id' => $patient->id,
            'consultation_type' => 'general',
            'nutrition_diet' => 'Régimen indicado por el equipo tratante',
        ]);
        $this->assertDatabaseHas('notifications', ['type' => 'nutricion']);
    }

    public function test_patient_intake_persists_measurements_and_generates_an_expedient_number(): void
    {
        $reception = User::factory()->create(['role' => 'recepcion']);

        $response = $this->actingAs($reception, 'sanctum')->postJson('/api/patients', [
            'documentId' => 'DOC-INTAKE-OK',
            'firstName' => 'Paciente',
            'lastName' => 'Ingreso válido',
            'birthDate' => '1990-01-01',
            'gender' => 'Otro',
            'temperatureC' => 42,
            'heightCm' => 0.01,
            'insuranceProvider' => 'Seguro de prueba',
            'insurancePolicy' => 'POL-001',
            'insuranceCoveragePercent' => 75,
        ])->assertCreated()
            ->assertJsonPath('temperatureC', 42)
            ->assertJsonPath('heightCm', 0.01)
            ->assertJsonPath('insuranceCoveragePercent', 75);

        $this->assertStringStartsWith('EXP-PAT-', $response->json('medicalRecordNumber'));
        $this->assertDatabaseHas('patients', [
            'id' => $response->json('id'),
            'temperature_c' => 42,
            'height_cm' => 0.01,
            'insurance_provider' => 'Seguro de prueba',
            'insurance_coverage_percent' => 75,
        ]);
    }

    public function test_patient_intake_rejects_invalid_temperature_and_height_without_saving(): void
    {
        $reception = User::factory()->create(['role' => 'recepcion']);
        $base = [
            'firstName' => 'Paciente',
            'lastName' => 'Ingreso inválido',
            'birthDate' => '1990-01-01',
            'gender' => 'Otro',
        ];

        foreach ([
            ['documentId' => 'DOC-INTAKE-T0', 'temperatureC' => 0, 'heightCm' => 170],
            ['documentId' => 'DOC-INTAKE-T42', 'temperatureC' => 42.01, 'heightCm' => 170],
            ['documentId' => 'DOC-INTAKE-H0', 'temperatureC' => 36.5, 'heightCm' => 0],
            ['documentId' => 'DOC-INTAKE-H300', 'temperatureC' => 36.5, 'heightCm' => 300.01],
            ['documentId' => 'DOC-INTAKE-AGE150', 'temperatureC' => 36.5, 'heightCm' => 170, 'birthDate' => now()->subYears(151)->toDateString()],
        ] as $measurements) {
            $payload = array_merge($base, $measurements);
            $this->actingAs($reception, 'sanctum')->postJson('/api/patients', $payload)->assertUnprocessable();
            $this->assertDatabaseMissing('patients', ['document_id' => $measurements['documentId']]);
        }
    }

    public function test_pharmacy_dispensing_decrements_stock_atomically_and_requires_role(): void
    {
        $pharmacyUser = User::factory()->create(['role' => 'farmacia']);
        $this->assignPharmacyStaff($pharmacyUser);
        $patient = $this->createPatient();
        $item = InventoryItem::create([
            'id' => 'INV-TEST-1', 'name' => 'Medicamento de prueba', 'category' => 'Medicamentos',
            'unit' => 'tableta', 'stock' => 5, 'minimum_stock' => 1,
            'unit_price' => 15,
        ]);
        InventoryBatch::create([
            'id' => 'LOT-TEST-1', 'inventory_item_id' => $item->id, 'batch_code' => 'LOTE-A',
            'expiration_date' => today()->addDays(30), 'quantity' => 5, 'unit_cost' => 3,
        ]);

        $admin = User::factory()->create(['role' => 'admin']);
        $dispensation = $this->actingAs($pharmacyUser, 'sanctum')
            ->postJson('/api/dispensations', [
                'patientId' => $patient->id,
                'itemId' => $item->id,
                'quantity' => 2,
                'prescription' => 'REC-TEST-1',
                'responsibleId' => $pharmacyUser->id,
            ])
            ->assertCreated()->json();

        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/dispensations/'.$dispensation['id'], ['status' => 'Autorizada'])
            ->assertOk()->assertJsonPath('status', 'Autorizada');

        $this->assertDatabaseHas('inventory_items', ['id' => $item->id, 'stock' => 3]);
        $this->assertDatabaseHas('inventory_batches', ['id' => 'LOT-TEST-1', 'quantity' => 3]);
        $this->assertDatabaseHas('dispensations', ['item_id' => $item->id, 'quantity' => 2]);
        $this->assertDatabaseHas('dispensation_batch_allocations', [
            'dispensation_id' => $dispensation['id'],
            'inventory_batch_id' => 'LOT-TEST-1',
            'quantity' => 2,
        ]);
        $this->assertDatabaseHas('invoices', [
            'patient_id' => $patient->id, 'total' => 30, 'patient_copay' => 30,
        ]);
        $this->postJson('/api/dispensations', [
            'patientId' => $patient->id, 'itemId' => $item->id, 'quantity' => 1,
            'prescription' => ' rec-test-1 ', 'responsibleId' => $pharmacyUser->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('prescription');

        $this->actingAs(User::factory()->create(['role' => 'recepcion']), 'sanctum')
            ->postJson('/api/dispensations', [
                'patientId' => $patient->id, 'itemId' => $item->id, 'quantity' => 1,
                'prescription' => 'REC-TEST-2', 'responsibleId' => $pharmacyUser->id,
            ])->assertForbidden();
    }

    public function test_dispensing_uses_fefo_and_rejects_expired_or_missing_batches(): void
    {
        $pharmacyUser = User::factory()->create(['role' => 'farmacia']);
        $this->assignPharmacyStaff($pharmacyUser);
        $patient = $this->createPatient();
        $item = InventoryItem::create([
            'id' => 'INV-FEFO-1', 'name' => 'Medicamento FEFO', 'category' => 'Medicamentos',
            'unit' => 'tableta', 'stock' => 5, 'minimum_stock' => 0, 'unit_price' => 2,
        ]);
        InventoryBatch::create([
            'id' => 'LOT-FEFO-SOON', 'inventory_item_id' => $item->id, 'batch_code' => 'LOTE-PROXIMO',
            'expiration_date' => today()->addDays(3), 'quantity' => 1, 'unit_cost' => 1,
        ]);
        InventoryBatch::create([
            'id' => 'LOT-FEFO-LATER', 'inventory_item_id' => $item->id, 'batch_code' => 'LOTE-POSTERIOR',
            'expiration_date' => today()->addDays(60), 'quantity' => 4, 'unit_cost' => 1.5,
        ]);

        $admin = User::factory()->create(['role' => 'admin']);
        $dispensation = $this->actingAs($pharmacyUser, 'sanctum')->postJson('/api/dispensations', [
            'patientId' => $patient->id, 'itemId' => $item->id, 'quantity' => 2,
            'prescription' => 'REC-FEFO-1', 'responsibleId' => $pharmacyUser->id,
        ])->assertCreated()->json();

        $this->actingAs($admin, 'sanctum')->patchJson('/api/dispensations/'.$dispensation['id'], [
            'status' => 'Autorizada',
        ])->assertOk();

        $this->assertDatabaseHas('inventory_batches', ['id' => 'LOT-FEFO-SOON', 'quantity' => 0]);
        $this->assertDatabaseHas('inventory_batches', ['id' => 'LOT-FEFO-LATER', 'quantity' => 3]);

        $expiredItem = InventoryItem::create([
            'id' => 'INV-EXPIRED-1', 'name' => 'Medicamento vencido', 'category' => 'Medicamentos',
            'unit' => 'tableta', 'stock' => 2, 'minimum_stock' => 0,
        ]);
        InventoryBatch::create([
            'id' => 'LOT-EXPIRED-1', 'inventory_item_id' => $expiredItem->id, 'batch_code' => 'LOTE-CADUCADO',
            'expiration_date' => today()->subDay(), 'quantity' => 2, 'unit_cost' => 1,
        ]);
        $expiredDispensation = $this->actingAs($pharmacyUser, 'sanctum')->postJson('/api/dispensations', [
            'patientId' => $patient->id, 'itemId' => $expiredItem->id, 'quantity' => 1,
            'prescription' => 'REC-EXP-1', 'responsibleId' => $pharmacyUser->id,
        ])->assertCreated()->json();
        $this->actingAs($admin, 'sanctum')->patchJson('/api/dispensations/'.$expiredDispensation['id'], [
            'status' => 'Autorizada',
        ])->assertUnprocessable();
        $this->assertDatabaseHas('inventory_items', ['id' => $expiredItem->id, 'stock' => 2]);
    }

    public function test_controlled_medication_requires_validated_prescriber_credentials(): void
    {
        $pharmacyUser = User::factory()->create(['role' => 'farmacia']);
        $this->assignPharmacyStaff($pharmacyUser);
        $doctor = User::factory()->create([
            'role' => 'medico_general', 'password' => 'Doctor-Secret-123',
        ]);
        $patient = $this->createPatient();
        $item = InventoryItem::create([
            'id' => 'INV-CONTROLLED-1', 'name' => 'Controlado', 'category' => 'Medicamentos',
            'unit' => 'ampolleta', 'stock' => 2, 'minimum_stock' => 0, 'is_controlled' => true,
        ]);
        InventoryBatch::create([
            'id' => 'LOT-CONTROLLED-1', 'inventory_item_id' => $item->id, 'batch_code' => 'LOTE-CONTROLADO',
            'expiration_date' => today()->addDays(30), 'quantity' => 2, 'unit_cost' => 5,
        ]);
        $payload = [
            'patientId' => $patient->id, 'itemId' => $item->id, 'quantity' => 1,
            'prescription' => 'REC-CONTROLADO-1', 'responsibleId' => $pharmacyUser->id,
        ];

        $this->actingAs($pharmacyUser, 'sanctum')
            ->postJson('/api/dispensations', $payload)->assertUnprocessable();
        $this->postJson('/api/dispensations', $payload + [
            'prescriberEmail' => $doctor->email, 'prescriberPassword' => 'incorrecta',
        ])->assertUnprocessable();
        $this->postJson('/api/dispensations', $payload + [
            'prescriberEmail' => $doctor->email, 'prescriberPassword' => 'Doctor-Secret-123',
        ])->assertCreated();

        $this->assertDatabaseHas('dispensations', [
            'item_id' => $item->id, 'prescribed_by' => $doctor->id,
            'dispensed_by' => $pharmacyUser->id,
        ]);
    }

    public function test_overlapping_doctor_schedule_is_rejected(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $doctor = Doctor::create([
            'id' => 'DOC-TEST-1', 'license_number' => 'LIC-TEST-1', 'first_name' => 'Médico',
            'last_name' => 'Prueba', 'specialty' => 'Medicina General', 'shift' => 'Matutino',
            'registration_date' => today(), 'status' => 'Activo',
        ]);
        $room = Room::create([
            'id' => 'ROOM-TEST-1', 'code' => 'ROOM-T1', 'name' => 'Consultorio prueba',
            'specialty' => 'General', 'status' => 'Disponible', 'equipment' => [], 'capacity' => 1,
            'registration_date' => today(),
        ]);

        $scheduleResponse = $this->actingAs($admin, 'sanctum')->postJson('/api/schedules', [
            'doctorId' => $doctor->id, 'roomId' => $room->id, 'dayOfWeek' => 1,
            'startTime' => '08:00', 'endTime' => '12:00', 'shift' => 'Matutino',
        ])->assertCreated();
        $this->assertDatabaseHas('doctor_schedule_history', [
            'schedule_id' => $scheduleResponse->json('id'),
            'action' => 'Asignación',
        ]);

        $this->postJson('/api/schedules', [
            'doctorId' => $doctor->id, 'roomId' => $room->id, 'dayOfWeek' => 1,
            'startTime' => '11:00', 'endTime' => '15:00', 'shift' => 'Matutino',
        ])->assertUnprocessable();
    }

    public function test_doctor_can_record_only_own_attendance_and_admin_can_review_historical_visits(): void
    {
        $doctorUser = User::factory()->create(['role' => 'medico_general']);
        $admin = User::factory()->create(['role' => 'admin']);
        $doctor = $this->createDoctor('DOC-ATTEND-1', 'LIC-ATTEND-1', 'Medicina General');
        $doctor->update(['user_id' => $doctorUser->id]);
        $otherDoctor = $this->createDoctor('DOC-ATTEND-2', 'LIC-ATTEND-2', 'Cardiología');
        $patient = $this->createPatient();
        $room = $this->createRoom('ROOM-ATTEND-1');
        $yesterday = today()->subDay();
        $appointment = Appointment::create([
            'id' => 'APP-ATTEND-1', 'patient_id' => $patient->id, 'doctor_id' => $doctor->id,
            'room_id' => $room->id, 'appointment_date' => $yesterday, 'appointment_time' => '10:00',
            'reason' => 'Consulta de seguimiento', 'status' => 'Programada', 'creation_date' => today(),
        ]);
        DoctorScheduleHistory::create([
            'id' => 'SCHH-ATTEND-1', 'schedule_id' => 'SCH-ATTEND-1', 'doctor_id' => $doctor->id,
            'room_id' => $room->id, 'day_of_week' => $yesterday->dayOfWeekIso,
            'start_time' => '08:00', 'end_time' => '16:00', 'shift' => 'Matutino',
            'is_active' => true, 'action' => 'Asignación', 'recorded_by' => $admin->id,
            'recorded_at' => $yesterday->copy()->setTime(8, 0),
        ]);
        $otherAppointment = Appointment::create([
            'id' => 'APP-ATTEND-2', 'patient_id' => $patient->id, 'doctor_id' => $otherDoctor->id,
            'room_id' => $room->id, 'appointment_date' => $yesterday, 'appointment_time' => '11:00',
            'reason' => 'Otra consulta', 'status' => 'Programada', 'creation_date' => today(),
        ]);

        $this->actingAs($doctorUser, 'sanctum')->postJson('/api/appointments/'.$appointment->id.'/attend')
            ->assertOk()->assertJsonPath('status', 'Atendida')->assertJsonPath('roomId', $room->id);
        $this->postJson('/api/appointments/'.$otherAppointment->id.'/attend')->assertForbidden();
        $futureAppointment = Appointment::create([
            'id' => 'APP-ATTEND-FUTURE', 'patient_id' => $patient->id, 'doctor_id' => $doctor->id,
            'room_id' => $room->id, 'appointment_date' => today()->addDay(), 'appointment_time' => '10:00',
            'reason' => 'Consulta futura', 'status' => 'Programada', 'creation_date' => today(),
        ]);
        $this->postJson('/api/appointments/'.$futureAppointment->id.'/attend')->assertUnprocessable();
        $this->assertDatabaseHas('appointments', [
            'id' => $appointment->id, 'status' => 'Atendida', 'attended_by' => $doctorUser->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'entity_id' => $appointment->id, 'action' => 'Paciente atendido',
        ]);

        $history = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/doctor-history?doctorId='.$doctor->id.'&date='.$yesterday->toDateString())
            ->assertOk()->json();
        $this->assertSame('Paciente Prueba', $history['appointments'][0]['patientName']);
        $this->assertSame($room->code.' — '.$room->name, $history['appointments'][0]['roomName']);
        $this->assertSame('08:00', $history['schedules'][0]['startTime']);
    }

    public function test_consultorio_reservations_reject_overlaps_and_appear_in_availability(): void
    {
        $reception = User::factory()->create(['role' => 'recepcion']);
        $room = $this->createRoom('ROOM-RESERVATION-1');
        $startsAt = now()->addDays(3)->setTime(9, 0)->format('Y-m-d H:i:s');
        $endsAt = now()->addDays(3)->setTime(10, 0)->format('Y-m-d H:i:s');
        $reservation = $this->actingAs($reception, 'sanctum')->postJson('/api/room-reservations', [
            'roomId' => $room->id, 'title' => 'Jornada médica', 'reason' => 'Uso programado de demostración',
            'startsAt' => $startsAt, 'endsAt' => $endsAt,
        ])->assertCreated()->json();

        $this->postJson('/api/room-reservations', [
            'roomId' => $room->id, 'title' => 'Reserva duplicada', 'reason' => 'Horario ya ocupado',
            'startsAt' => now()->addDays(3)->setTime(9, 30)->format('Y-m-d H:i:s'),
            'endsAt' => now()->addDays(3)->setTime(10, 30)->format('Y-m-d H:i:s'),
        ])->assertUnprocessable();
        $availability = $this->getJson('/api/availability?date='.substr($startsAt, 0, 10).'&start_time=09:00&end_time=09:30')
            ->assertOk()->json();
        $this->assertFalse(collect($availability)->firstWhere('id', $room->id)['isAvailable']);
        $this->assertDatabaseHas('audit_logs', [
            'entity_id' => $room->id, 'action' => 'Reserva creada',
        ]);

        $this->patchJson('/api/room-reservations/'.$reservation['id'].'/cancel', ['reason' => 'Cambio de agenda'])
            ->assertOk()->assertJsonPath('status', 'Cancelada');
        $this->getJson('/api/room-audit')->assertForbidden();
        $admin = User::factory()->create(['role' => 'admin']);
        $audit = $this->actingAs($admin, 'sanctum')->getJson('/api/room-audit')
            ->assertOk()->json();
        $this->assertSame(1, $audit['currentPage']);
        $this->assertContains('Reserva cancelada', array_column($audit['data'], 'action'));
    }

    public function test_receiving_an_approved_purchase_adds_stock_once(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create(['role' => 'compras']);
        $order = PurchaseOrder::create([
            'id' => 'PO-TEST-1', 'supplier' => 'Proveedor de prueba', 'item_name' => 'Guantes de prueba',
            'category' => 'Insumos hospitalarios', 'unit' => 'caja', 'quantity' => 4,
            'unit_cost' => 12.50, 'requested_at' => today(), 'status' => 'Solicitada',
        ]);
        $this->actingAs($buyer, 'sanctum')->patchJson('/api/purchase-orders/'.$order->id, ['status' => 'Aprobada'])->assertOk();
        $this->patchJson('/api/purchase-orders/'.$order->id, ['status' => 'Por confirmar'])->assertOk();
        $this->actingAs($admin, 'sanctum')->patchJson('/api/purchase-orders/'.$order->id, ['status' => 'Recibida'])->assertOk();
        $this->patchJson('/api/purchase-orders/'.$order->id, ['status' => 'Recibida'])->assertOk();

        $this->assertDatabaseHas('inventory_items', [
            'name' => 'Guantes de prueba', 'category' => 'Insumos hospitalarios', 'stock' => 4,
        ]);
    }

    public function test_nutrition_role_cannot_change_clinical_diagnosis(): void
    {
        $nutrition = User::factory()->create(['role' => 'nutricion']);
        $patient = $this->createPatient();
        $consultation = \App\Models\Consultation::create([
            'id' => 'CON-TEST-1', 'patient_id' => $patient->id, 'consultation_type' => 'general',
            'scheduled_at' => now(), 'reason' => 'Consulta de prueba', 'diagnosis' => 'Diagnóstico protegido',
            'status' => 'Programada',
        ]);

        $this->actingAs($nutrition, 'sanctum')
            ->patchJson('/api/consultations/'.$consultation->id, ['diagnosis' => 'Cambio no autorizado'])
            ->assertForbidden();

        $this->assertDatabaseHas('consultations', ['id' => $consultation->id, 'diagnosis' => 'Diagnóstico protegido']);
    }

    public function test_administrative_and_nutrition_profiles_never_receive_clinical_notes(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $nutrition = User::factory()->create(['role' => 'nutricion']);
        $patient = $this->createPatient();
        $patient->update(['allergies' => 'Alergia de prueba', 'assigned_bed_id' => 'CAMA-01']);
        $consultation = \App\Models\Consultation::create([
            'id' => 'CON-PRIVACY-1', 'patient_id' => $patient->id, 'consultation_type' => 'general',
            'scheduled_at' => now(), 'reason' => 'Síntomas de ejemplo que no deben filtrarse',
            'notes' => 'Nota clínica confidencial', 'diagnosis' => 'Diagnóstico confidencial',
            'nutrition_diet' => 'Hiposódica', 'nutrition_order' => 'Dieta indicada para prueba',
            'status' => 'Programada',
        ]);
        MealOrder::create([
            'id' => 'ALI-PRIVACY-1', 'patient_id' => $patient->id, 'meal' => 'Comida',
            'diet' => 'Blanda', 'delivery_date' => today(), 'notes' => 'Diagnóstico confidencial',
            'status' => 'Pendiente',
        ]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/consultations')->assertForbidden();
        $adminBootstrap = $this->getJson('/api/bootstrap')->assertOk()->json();
        $this->assertSame([], $adminBootstrap['consultations']);
        $this->assertArrayNotHasKey('allergies', $adminBootstrap['patients'][0]);
        $this->getJson('/api/patients/'.$patient->id.'/record')
            ->assertOk()->assertJsonMissingPath('allergies')->assertJsonMissingPath('temperatureC');

        $nutritionPayload = $this->actingAs($nutrition, 'sanctum')
            ->getJson('/api/consultations')->assertOk()->json()[0];
        $this->assertSame($consultation->id, $nutritionPayload['id']);
        $this->assertSame('Hiposódica', $nutritionPayload['nutritionDiet']);
        $this->assertArrayNotHasKey('diagnosis', $nutritionPayload);
        $this->assertArrayNotHasKey('notes', $nutritionPayload);
        $this->assertArrayNotHasKey('reason', $nutritionPayload);

        foreach ([$admin, $nutrition] as $user) {
            $mealPayload = $this->actingAs($user, 'sanctum')
                ->getJson('/api/meal-orders')->assertOk()->json()[0];
            $this->assertSame('CAMA-01', $mealPayload['bed']);
            $this->assertArrayNotHasKey('notes', $mealPayload);
            if ($user->role === 'admin') {
                $this->assertArrayNotHasKey('allergies', $mealPayload);
            } else {
                $this->assertSame('Alergia de prueba', $mealPayload['allergies']);
            }
        }
    }

    public function test_consultation_content_is_immutable_and_corrections_are_addenda(): void
    {
        $doctor = User::factory()->create(['role' => 'medico_general']);
        $patient = $this->createPatient();
        $consultation = \App\Models\Consultation::create([
            'id' => 'CON-IMMUTABLE-1', 'patient_id' => $patient->id, 'consultation_type' => 'general',
            'scheduled_at' => now(), 'reason' => 'Control', 'diagnosis' => 'Diagnóstico original',
            'notes' => 'Nota original', 'status' => 'Programada',
        ]);

        $this->actingAs($doctor, 'sanctum')
            ->patchJson('/api/consultations/'.$consultation->id, ['diagnosis' => 'Diagnóstico alterado'])
            ->assertForbidden();
        $this->postJson('/api/consultations/'.$consultation->id.'/addenda', [
            'notes' => 'Aclaración: se mantiene íntegra la nota original.',
        ])->assertCreated();

        $this->assertDatabaseHas('consultations', ['id' => $consultation->id, 'diagnosis' => 'Diagnóstico original']);
        $this->assertDatabaseHas('consultation_addenda', [
            'consultation_id' => $consultation->id,
            'notes' => 'Aclaración: se mantiene íntegra la nota original.',
        ]);
    }

    public function test_patient_discharge_requires_clinical_and_administrative_approval(): void
    {
        $doctor = User::factory()->create(['role' => 'medico_general']);
        $admin = User::factory()->create([
            'role' => 'admin', 'password' => 'Hospital-Admin-Secret',
        ]);
        $patient = $this->createPatient();

        $this->actingAs($admin, 'sanctum')->postJson('/api/patients/'.$patient->id.'/administrative-discharge', [
            'masterPassword' => 'Hospital-Admin-Secret',
        ])->assertUnprocessable();
        $medResponse = $this->actingAs($doctor, 'sanctum')->postJson('/api/patients/'.$patient->id.'/medical-discharge', [
            'notes' => 'Paciente estable, se entregaron indicaciones de salida.',
        ])->assertOk();
        $this->assertNotNull($medResponse->json('dischargeDate'));
        $this->assertEquals('Alta Médica Autorizada', $medResponse->json('dischargeReason'));
        $this->actingAs($admin, 'sanctum')->postJson('/api/patients/'.$patient->id.'/administrative-discharge', [
            'masterPassword' => 'incorrecta',
        ])->assertUnprocessable();

        \App\Models\Invoice::create([
            'id' => 'FAC-DISCHARGE-1', 'patient_id' => $patient->id, 'description' => 'Cuenta pendiente',
            'total' => 200, 'status' => 'Pendiente', 'issued_at' => today(),
        ]);
        $this->postJson('/api/patients/'.$patient->id.'/administrative-discharge', [
            'masterPassword' => 'Hospital-Admin-Secret',
        ])->assertUnprocessable();

        \App\Models\Invoice::where('patient_id', $patient->id)->update(['status' => 'Pagada']);
        $this->postJson('/api/patients/'.$patient->id.'/administrative-discharge', [
            'masterPassword' => 'Hospital-Admin-Secret',
        ])->assertOk()->assertJsonPath('status', 'Dado de Alta');
        $this->assertDatabaseHas('patients', ['id' => $patient->id, 'status' => 'Dado de Alta']);
    }

    public function test_patient_editing_respects_role_and_care_assignment(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $reception = User::factory()->create(['role' => 'recepcion']);
        $nurse = User::factory()->create(['role' => 'enfermeria']);
        $doctor = User::factory()->create(['role' => 'medico_general']);
        $patient = $this->createPatient();
        $otherPatient = $this->createPatient();
        \App\Models\Consultation::create([
            'id' => 'CON-EDIT-ASSIGNMENT', 'patient_id' => $patient->id, 'consultation_type' => 'general',
            'scheduled_at' => now(), 'reason' => 'Consulta de asignación', 'created_by' => $doctor->id,
            'status' => 'Programada',
        ]);
        NurseKardexRecord::create([
            'id' => 'KDX-EDIT-ASSIGNMENT', 'patient_id' => $patient->id, 'nurse_id' => $nurse->id,
            'nurse_name' => $nurse->name, 'notes' => 'Servicio asignado',
        ]);

        $this->actingAs($admin, 'sanctum')->putJson('/api/patients/'.$patient->id, [
            'firstName' => 'Nombre actualizado',
            'insuranceProvider' => 'Aseguradora actualizada',
            'confirmPassword' => 'password',
        ])->assertOk()->assertJsonMissingPath('allergies');
        $this->assertDatabaseHas('patients', [
            'id' => $patient->id, 'first_name' => 'Nombre actualizado',
            'insurance_provider' => 'Aseguradora actualizada',
        ]);
        $this->putJson('/api/patients/'.$patient->id, ['allergies' => 'Dato clínico', 'confirmPassword' => 'password'])
            ->assertForbidden();
        $this->actingAs($reception, 'sanctum')->putJson('/api/patients/'.$patient->id, [
            'insuranceProvider' => 'Seguro recepción',
            'insuranceCoveragePercent' => 75,
            'temperatureC' => 0,
            'confirmPassword' => 'password',
        ])->assertUnprocessable();
        $this->putJson('/api/patients/'.$patient->id, [
            'insuranceProvider' => 'Seguro recepción',
            'insuranceCoveragePercent' => 75,
            'temperatureC' => 37,
            'heightCm' => 170,
            'confirmPassword' => 'password',
        ])->assertOk();

        $this->actingAs($nurse, 'sanctum')->putJson('/api/patients/'.$patient->id, [
            'phone' => '5550001234', 'allergies' => 'Alergia actualizada', 'confirmPassword' => 'password',
        ])->assertOk()->assertJsonPath('allergies', 'Alergia actualizada');
        $this->putJson('/api/patients/'.$otherPatient->id, ['phone' => '5559998888', 'confirmPassword' => 'password'])
            ->assertForbidden();
        $this->assertDatabaseHas('patients', [
            'id' => $patient->id, 'phone' => '5550001234', 'allergies' => 'Alergia actualizada',
        ]);

        $this->actingAs($doctor, 'sanctum')->putJson('/api/patients/'.$patient->id, [
            'allergies' => 'Alergia médica actualizada', 'confirmPassword' => 'password',
        ])->assertOk();
        $this->putJson('/api/patients/'.$otherPatient->id, ['allergies' => 'Cambio no autorizado', 'confirmPassword' => 'password'])
            ->assertForbidden();
    }

    public function test_only_administration_and_reception_can_edit_doctors(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $reception = User::factory()->create(['role' => 'recepcion']);
        $nurse = User::factory()->create(['role' => 'enfermeria']);
        $doctor = $this->createDoctor('DOC-EDIT-1', 'LIC-EDIT-1', 'Cardiología');
        $payload = [
            'licenseNumber' => 'LIC-EDIT-2',
            'firstName' => 'Nombre',
            'lastName' => 'Actualizado',
            'specialty' => 'Cardiología',
            'phone' => '5551234567',
            'email' => 'doctor.updated@example.test',
            'shift' => 'Vespertino',
            'assignedRoomId' => null,
            'confirmPassword' => 'password',
        ];

        $this->actingAs($admin, 'sanctum')->putJson('/api/doctors/'.$doctor->id, $payload)
            ->assertOk()->assertJsonPath('lastName', 'Actualizado');
        $payload['licenseNumber'] = 'LIC-EDIT-3';
        $payload['firstName'] = 'Recepción';
        $this->actingAs($reception, 'sanctum')->putJson('/api/doctors/'.$doctor->id, $payload)
            ->assertOk()->assertJsonPath('firstName', 'Recepción');
        $this->actingAs($nurse, 'sanctum')->putJson('/api/doctors/'.$doctor->id, $payload)
            ->assertForbidden();

        $this->assertDatabaseHas('doctors', [
            'id' => $doctor->id, 'license_number' => 'LIC-EDIT-3', 'first_name' => 'Recepción',
        ]);
    }

    public function test_only_admin_can_link_a_unique_medical_login_to_a_doctor_profile(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $reception = User::factory()->create(['role' => 'recepcion']);
        $account = User::factory()->create(['role' => 'medico_general']);
        $unrelatedAccount = User::factory()->create(['role' => 'farmacia']);
        $doctor = $this->createDoctor('DOC-LINK-1', 'LIC-LINK-1', 'Medicina General');
        $anotherDoctor = $this->createDoctor('DOC-LINK-2', 'LIC-LINK-2', 'Cardiología');
        $payload = [
            'licenseNumber' => 'LIC-LINK-1',
            'firstName' => 'Médico',
            'lastName' => 'Vinculado',
            'specialty' => 'Medicina General',
            'shift' => 'Matutino',
            'email' => 'doctor.profile@example.test',
            'userId' => $account->id,
            'confirmPassword' => 'password',
        ];

        $this->actingAs($admin, 'sanctum')->getJson('/api/doctor-accounts?doctorId='.$doctor->id)
            ->assertOk()->assertJsonFragment(['id' => $account->id, 'canLink' => true])
            ->assertJsonFragment(['email' => $unrelatedAccount->email, 'canLink' => false]);
        $this->putJson('/api/doctors/'.$doctor->id, $payload)
            ->assertOk()->assertJsonPath('userId', $account->id);
        $this->putJson('/api/doctors/'.$anotherDoctor->id, [
            ...$payload, 'licenseNumber' => 'LIC-LINK-2',
        ])->assertUnprocessable();
        $this->actingAs($reception, 'sanctum')->putJson('/api/doctors/'.$doctor->id, $payload)
            ->assertForbidden();

        $this->assertDatabaseHas('doctors', ['id' => $doctor->id, 'user_id' => $account->id]);
        $this->assertDatabaseMissing('doctors', ['id' => $anotherDoctor->id, 'user_id' => $account->id]);
    }

    public function test_admin_can_assign_two_pharmacy_staff_and_must_keep_area_roles_valid(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $pharmacyOne = User::factory()->create(['role' => 'farmacia']);
        $pharmacyTwo = User::factory()->create(['role' => 'farmacia']);
        $warehouse = User::factory()->create(['role' => 'almacen']);
        $nutrition = User::factory()->create(['role' => 'nutricion']);

        $this->actingAs($admin, 'sanctum')->putJson('/api/area-staff', [
            'pharmacyIds' => [$pharmacyOne->id, $pharmacyTwo->id],
            'warehouseIds' => [$warehouse->id],
            'foodIds' => [$nutrition->id],
        ])->assertOk()->assertJsonCount(2, 'farmacia');

        $this->putJson('/api/area-staff', [
            'pharmacyIds' => [$pharmacyOne->id],
            'warehouseIds' => [$warehouse->id],
            'foodIds' => [$nutrition->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('pharmacyIds');

        $this->patchJson('/api/users/'.$pharmacyOne->id, ['isActive' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('isActive');
    }

    public function test_admin_can_edit_worker_name_email_and_contact_phone(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $worker = User::factory()->create(['role' => 'almacen']);

        $this->actingAs($admin, 'sanctum')->patchJson('/api/users/'.$worker->id, [
            'name' => 'Encargado de Prueba',
            'email' => 'encargado.updated@example.test',
            'phone' => '5551234567',
        ])->assertOk()
            ->assertJsonPath('name', 'Encargado de Prueba')
            ->assertJsonPath('email', 'encargado.updated@example.test')
            ->assertJsonPath('phone', '5551234567');

        $this->assertDatabaseHas('users', [
            'id' => $worker->id, 'name' => 'Encargado de Prueba',
            'email' => 'encargado.updated@example.test', 'phone' => '5551234567',
        ]);
    }

    public function test_admin_can_assign_active_nurses_to_rooms_and_save_room_categories(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $nurse = User::factory()->create(['role' => 'enfermeria']);

        $room = $this->actingAs($admin, 'sanctum')->postJson('/api/rooms', [
            'code' => 'ROOM-NURSE-1', 'name' => 'Área de urgencias', 'floor' => 'Piso 1',
            'specialty' => 'Medicina de Urgencias', 'roomType' => 'Urgencias',
            'status' => 'Disponible', 'capacity' => 2, 'equipment' => [],
            'nurseIds' => [$nurse->id],
            'confirmPassword' => 'password',
        ])->assertCreated()->assertJsonPath('roomType', 'Urgencias')->assertJsonPath('nurseIds.0', $nurse->id);

        $this->assertDatabaseHas('room_nurse_assignments', [
            'room_id' => $room->json('id'), 'nurse_id' => $nurse->id,
        ]);
    }

    public function test_inventory_items_store_unit_cost_for_food_and_supplies(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $item = $this->actingAs($admin, 'sanctum')->postJson('/api/inventory', [
            'name' => 'Gasa de prueba', 'category' => 'Insumos hospitalarios', 'unit' => 'paquete',
            'stock' => 4, 'minimumStock' => 1, 'unitCost' => 27.5,
        ])->assertCreated()->assertJsonPath('unitCost', 27.5);

        $this->assertDatabaseHas('inventory_items', [
            'id' => $item->json('id'), 'unit_cost' => 27.5,
        ]);
    }

    public function test_same_patient_cannot_receive_overlapping_appointments(): void
    {
        $reception = User::factory()->create(['role' => 'recepcion']);
        $patient = $this->createPatient();
        $doctorOne = $this->createDoctor('DOC-APPT-DUP-1', 'LIC-APPT-DUP-1', 'Medicina General');
        $doctorTwo = $this->createDoctor('DOC-APPT-DUP-2', 'LIC-APPT-DUP-2', 'Cardiología');
        $roomOne = $this->createRoom('ROOM-APPT-DUP-1');
        $roomTwo = $this->createRoom('ROOM-APPT-DUP-2');
        $date = today()->addDay();

        foreach ([[$doctorOne, $roomOne], [$doctorTwo, $roomTwo]] as [$doctor, $room]) {
            DoctorSchedule::create([
                'id' => 'SCH-'.$doctor->id, 'doctor_id' => $doctor->id, 'room_id' => $room->id,
                'day_of_week' => $date->dayOfWeekIso, 'start_time' => '08:00:00',
                'end_time' => '16:00:00', 'shift' => 'Matutino', 'is_active' => true,
            ]);
        }

        $this->actingAs($reception, 'sanctum')->postJson('/api/appointments', [
            'patientId' => $patient->id, 'doctorId' => $doctorOne->id, 'roomId' => $roomOne->id,
            'appointmentDate' => $date->toDateString(), 'appointmentTime' => '10:00', 'reason' => 'Consulta de prueba',
        ])->assertCreated();

        $this->postJson('/api/appointments', [
            'patientId' => $patient->id, 'doctorId' => $doctorTwo->id, 'roomId' => $roomTwo->id,
            'appointmentDate' => $date->toDateString(), 'appointmentTime' => '10:15', 'reason' => 'Consulta duplicada',
        ])->assertUnprocessable()->assertJsonValidationErrors('patientId');
    }

    public function test_emergency_record_access_requires_active_red_code_and_is_audited(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $doctor = User::factory()->create(['role' => 'medico_general']);
        $nurse = User::factory()->create(['role' => 'enfermeria']);
        $patient = $this->createPatient();

        $this->actingAs($nurse, 'sanctum')
            ->getJson('/api/patients/'.$patient->id.'/record')
            ->assertOk()->assertJsonMissingPath('temperatureC')->assertJsonMissingPath('allergies');

        $this->actingAs($admin, 'sanctum')->putJson('/api/security/code-red', [
            'isActive' => true, 'reason' => 'Emergencia clínica simulada', 'durationMinutes' => 30,
        ])->assertOk()->assertJsonPath('isActive', true);

        $this->actingAs($nurse, 'sanctum')->postJson('/api/security/emergency-access', [
            'patientId' => $patient->id, 'reason' => 'Atención urgente simulada y necesaria para el paciente',
        ])->assertForbidden();
        $this->actingAs($doctor, 'sanctum')->postJson('/api/security/emergency-access', [
            'patientId' => 'EXP-'.$patient->id, 'reason' => 'Atención urgente simulada y necesaria para el paciente',
        ])->assertCreated();
        $this->actingAs($doctor, 'sanctum')->getJson('/api/patients/'.$patient->id.'/record')
            ->assertOk()->assertJsonPath('id', $patient->id);
        $this->assertDatabaseHas('audit_logs', ['entity_id' => $patient->id, 'action' => 'Consulta de expediente']);

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/security/code-red', ['isActive' => false])
            ->assertOk()->assertJsonPath('isActive', false);
        $this->actingAs($nurse, 'sanctum')->getJson('/api/patients/'.$patient->id.'/record')
            ->assertOk()->assertJsonMissingPath('temperatureC')->assertJsonMissingPath('allergies');
    }

    public function test_temporary_role_grant_allows_and_revocation_removes_route_access(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $staff = User::factory()->create(['role' => 'enfermeria']);
        $grant = $this->actingAs($admin, 'sanctum')->postJson('/api/security/temporary-roles', [
            'userId' => $staff->id, 'role' => 'compras',
            'reason' => 'Cobertura temporal de una ausencia programada',
            'durationMinutes' => 60,
        ])->assertCreated()->json('id');

        $this->actingAs($staff, 'sanctum')->getJson('/api/purchase-orders')->assertOk();
        $this->actingAs($admin, 'sanctum')->deleteJson('/api/security/temporary-roles/'.$grant)->assertOk();
        $this->actingAs($staff, 'sanctum')->getJson('/api/purchase-orders')->assertForbidden();
    }

    public function test_absence_suggestions_only_include_available_same_specialty_staff(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $absentDoctor = $this->createDoctor('DOC-ABSENT', 'LIC-ABSENT', 'Cardiología');
        $availableDoctor = $this->createDoctor('DOC-AVAILABLE', 'LIC-AVAILABLE', 'Cardiología');
        $otherSpecialty = $this->createDoctor('DOC-OTHER', 'LIC-OTHER', 'Neurología');
        $room = $this->createRoom('ROOM-STAFF-1');
        foreach ([$availableDoctor, $otherSpecialty] as $doctor) {
            DoctorSchedule::create([
                'id' => 'SCH-'.$doctor->id, 'doctor_id' => $doctor->id, 'room_id' => $room->id,
                'day_of_week' => 1, 'start_time' => '08:00:00', 'end_time' => '16:00:00',
                'shift' => 'Matutino', 'is_active' => true,
            ]);
        }
        $absenceId = $this->actingAs($admin, 'sanctum')->postJson('/api/staff-absences', [
            'doctorId' => $absentDoctor->id, 'startsOn' => '2026-11-16', 'endsOn' => '2026-11-16',
            'reason' => 'Incapacidad de demostración',
        ])->assertCreated()->json('id');

        $response = $this->getJson('/api/replacement-candidates?'.http_build_query([
            'absenceId' => $absenceId, 'date' => '2026-11-16', 'startTime' => '09:00', 'endTime' => '09:30',
        ]))->assertOk();

        $this->assertSame([$availableDoctor->id], collect($response->json())->pluck('doctorId')->all());
    }

    public function test_invoice_payments_support_partial_payment_and_reject_overpayment(): void
    {
        $reception = User::factory()->create(['role' => 'recepcion']);
        $patient = $this->createPatient();
        $invoiceId = $this->actingAs($reception, 'sanctum')->postJson('/api/invoices', [
            'patientId' => $patient->id, 'description' => 'Ficha de demostración', 'total' => 100,
        ])->assertCreated()->json('id');

        $this->postJson('/api/invoices/'.$invoiceId.'/payments', [
            'amount' => 40, 'method' => 'Efectivo',
        ])->assertOk()->assertJsonPath('status', 'Parcial')->assertJsonPath('balance', 60);
        $this->postJson('/api/invoices/'.$invoiceId.'/payments', [
            'amount' => 61, 'method' => 'Tarjeta',
        ])->assertUnprocessable();
        $this->postJson('/api/invoices/'.$invoiceId.'/payments', [
            'amount' => 60, 'method' => 'Transferencia',
        ])->assertOk()->assertJsonPath('status', 'Pagada')->assertJsonPath('balance', 0);

        $this->assertDatabaseHas('invoices', ['id' => $invoiceId, 'status' => 'Pagada']);
        $this->assertDatabaseCount('invoice_payments', 2);
    }

    public function test_invoice_uses_insurance_coverage_and_requires_master_authorization_for_discount(): void
    {
        $reception = User::factory()->create(['role' => 'recepcion']);
        $admin = User::factory()->create([
            'role' => 'admin', 'password' => 'Hospital-Admin-Secret',
        ]);
        $insuredPatient = $this->createPatient();
        $insuredPatient->update([
            'insurance_provider' => 'Seguro de prueba',
            'insurance_coverage_percent' => 80,
        ]);

        $invoice = $this->actingAs($reception, 'sanctum')->postJson('/api/invoices', [
            'patientId' => $insuredPatient->id,
            'description' => 'Atención de prueba',
            'total' => 100,
        ])->assertCreated()
            ->assertJsonPath('insuranceCoverage', 80)
            ->assertJsonPath('patientCopay', 20)
            ->assertJsonPath('balance', 20)
            ->json();

        $this->postJson('/api/invoices/'.$invoice['id'].'/payments', [
            'amount' => 20, 'method' => 'Efectivo',
        ])->assertOk()->assertJsonPath('status', 'Pagada');

        $uninsuredPatient = $this->createPatient();
        $this->actingAs($admin, 'sanctum')->postJson('/api/invoices', [
            'patientId' => $uninsuredPatient->id, 'description' => 'Descuento de prueba',
            'total' => 100, 'discount' => 10, 'masterPassword' => 'incorrecta',
        ])->assertUnprocessable();
        $this->postJson('/api/invoices', [
            'patientId' => $uninsuredPatient->id, 'description' => 'Descuento autorizado',
            'total' => 100, 'discount' => 10, 'masterPassword' => 'Hospital-Admin-Secret',
        ])->assertCreated()->assertJsonPath('discount', 10)
            ->assertJsonPath('netTotal', 90)->assertJsonPath('patientCopay', 90);

        $cancelled = $this->postJson('/api/invoices', [
            'patientId' => $uninsuredPatient->id, 'description' => 'Ficha para cancelar', 'total' => 50,
        ])->assertCreated()->json();
        $this->patchJson('/api/invoices/'.$cancelled['id'].'/cancel', [
            'masterPassword' => 'Hospital-Admin-Secret',
            'reason' => 'Corrección de una ficha duplicada.',
        ])->assertOk()->assertJsonPath('status', 'Cancelada');
        $this->patchJson('/api/invoices/'.$invoice['id'].'/cancel', [
            'masterPassword' => 'Hospital-Admin-Secret',
            'reason' => 'No se permite cancelar pagos ya registrados.',
        ])->assertUnprocessable();
    }

    public function test_food_delivery_generates_one_patient_charge_and_cannot_be_reopened(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $nutrition = User::factory()->create(['role' => 'nutricion']);
        $patient = $this->createPatient();
        $meal = MealOrder::create([
            'id' => 'ALI-CHARGE-1', 'patient_id' => $patient->id, 'meal' => 'Comida',
            'diet' => 'Blanda', 'delivery_date' => today(), 'charge_amount' => 85,
            'status' => 'Pendiente',
        ]);

        $this->actingAs($nutrition, 'sanctum')->patchJson('/api/meal-orders/'.$meal->id, [
            'status' => 'Preparado',
            'preparedFood' => 'Arroz blanco',
        ])->assertOk()->assertJsonPath('status', 'Preparado')->assertJsonMissingPath('notes');
        $this->patchJson('/api/meal-orders/'.$meal->id, ['status' => 'Entregada'])->assertForbidden();

        $this->actingAs($admin, 'sanctum')->patchJson('/api/meal-orders/'.$meal->id, [
            'status' => 'Entregada',
        ])->assertOk();
        $this->patchJson('/api/meal-orders/'.$meal->id, ['status' => 'Entregada'])->assertOk();
        $this->patchJson('/api/meal-orders/'.$meal->id, ['status' => 'Pendiente'])->assertUnprocessable();

        $this->assertDatabaseHas('meal_orders', [
            'id' => $meal->id, 'status' => 'Entregada', 'charge_amount' => 85, 'prepared_food' => 'Arroz blanco',
        ]);
        $this->assertDatabaseHas('invoices', [
            'patient_id' => $patient->id, 'description' => 'Alimentación Comida · '.$meal->id, 'total' => 85,
        ]);
        $this->assertSame(1, \App\Models\Invoice::where('patient_id', $patient->id)->count());
    }

    public function test_surgical_requisition_delivery_decrements_inventory_once(): void
    {
        $surgeon = User::factory()->create(['role' => 'cirugia']);
        $warehouse = User::factory()->create(['role' => 'almacen']);
        $item = InventoryItem::create([
            'id' => 'INV-REQ-1', 'name' => 'Material quirúrgico de prueba',
            'category' => 'Insumos hospitalarios', 'unit' => 'pieza', 'stock' => 3, 'minimum_stock' => 0,
        ]);
        $requisitionId = $this->actingAs($surgeon, 'sanctum')->postJson('/api/surgical-requisitions', [
            'inventoryItemId' => $item->id, 'quantity' => 2, 'purpose' => 'Procedimiento quirúrgico de prueba',
        ])->assertCreated()->json('id');

        $this->actingAs($warehouse, 'sanctum')
            ->patchJson('/api/surgical-requisitions/'.$requisitionId, ['status' => 'Aprobada'])->assertOk();
        $this->patchJson('/api/surgical-requisitions/'.$requisitionId, ['status' => 'Entregada'])->assertOk();
        $this->patchJson('/api/surgical-requisitions/'.$requisitionId, ['status' => 'Entregada'])->assertUnprocessable();

        $this->assertDatabaseHas('inventory_items', ['id' => $item->id, 'stock' => 1]);
        $this->assertDatabaseHas('surgical_requisitions', ['id' => $requisitionId, 'status' => 'Entregada']);
    }

    public function test_defect_resolution_records_outcome_and_elapsed_time(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $defectId = $this->actingAs($admin, 'sanctum')->postJson('/api/defects', [
            'title' => 'Error de prueba', 'description' => 'Descripción verificable del defecto de prueba.',
            'impact' => 'Moderado', 'priority' => 'Media',
        ])->assertCreated()->json('id');

        $this->patchJson('/api/defects/'.$defectId, [
            'status' => 'Resuelto', 'resolution' => 'Se corrigió y se verificó con una prueba.',
        ])->assertOk()->assertJsonPath('status', 'Resuelto');

        $this->assertDatabaseHas('defect_reports', [
            'id' => $defectId, 'status' => 'Resuelto',
            'resolution' => 'Se corrigió y se verificó con una prueba.',
        ]);
        $this->assertNotNull(\App\Models\DefectReport::findOrFail($defectId)->resolution_minutes);
    }

    private function createPatient(): Patient
    {
        return Patient::create([
            'id' => 'PAT-TEST-'.fake()->unique()->numerify('####'),
            'document_id' => 'DOC-'.fake()->unique()->numerify('####'),
            'first_name' => 'Paciente', 'last_name' => 'Prueba', 'gender' => 'Otro',
            'admission_date' => today(), 'status' => 'Activo',
        ]);
    }

    private function createDoctor(string $id, string $license, string $specialty): Doctor
    {
        return Doctor::create([
            'id' => $id, 'license_number' => $license, 'first_name' => 'Médico',
            'last_name' => $id, 'specialty' => $specialty, 'shift' => 'Matutino',
            'department' => str_contains($specialty, 'Cardiología') ? 'Cardiología' : 'Neurología',
            'role_type' => str_contains($specialty, 'Cardiología') ? 'Médico Especialista' : 'Médico General',
            'registration_date' => today(), 'status' => 'Activo',
        ]);
    }

    private function createRoom(string $id): Room
    {
        return Room::create([
            'id' => $id, 'code' => $id, 'name' => 'Consultorio de prueba',
            'specialty' => 'General', 'status' => 'Disponible', 'equipment' => [], 'capacity' => 1,
            'registration_date' => today(),
        ]);
    }

    private function assignPharmacyStaff(User $primary): void
    {
        $second = User::factory()->create(['role' => 'farmacia']);
        DB::table('area_staff_assignments')->insert([
            ['area' => 'farmacia', 'user_id' => $primary->id, 'created_at' => now(), 'updated_at' => now()],
            ['area' => 'farmacia', 'user_id' => $second->id, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
