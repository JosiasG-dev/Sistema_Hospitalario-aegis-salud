<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Doctor;
use App\Models\DoctorAssignment;
use App\Models\Patient;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DoctorAssignmentsAndRotationTest extends TestCase
{
    use RefreshDatabase;

    private function createAdmin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    private function createReception(): User
    {
        return User::factory()->create(['role' => 'recepcion']);
    }

    private function createDoctor(string $id = 'DOC-1', string $room = 'ROOM-1', string $shift = 'Matutino'): Doctor
    {
        return Doctor::create([
            'id' => $id,
            'license_number' => 'LIC-'.$id,
            'first_name' => 'Dr. '.$id,
            'last_name' => 'Apellido',
            'specialty' => 'Medicina General',
            'shift' => $shift,
            'assigned_room_id' => $room,
            'registration_date' => today(),
            'status' => 'Activo',
        ]);
    }

    private function createRoom(string $id = 'ROOM-1', string $code = 'CONS-01'): Room
    {
        return Room::create([
            'id' => $id,
            'code' => $code,
            'name' => 'Consultorio '.$code,
            'floor' => 'Piso 1',
            'specialty' => 'General',
            'status' => 'Disponible',
            'equipment' => [],
            'capacity' => 1,
            'registration_date' => today(),
        ]);
    }

    private function createPatient(string $id = 'PAT-1'): Patient
    {
        return Patient::create([
            'id' => $id,
            'document_id' => 'DOC-'.$id,
            'first_name' => 'Paciente',
            'last_name' => $id,
            'birth_date' => '1995-05-10',
            'gender' => 'Masculino',
            'phone' => '5551234567',
            'email' => "patient{$id}@example.test",
            'blood_type' => 'O+',
            'admission_date' => today(),
            'status' => 'Activo',
        ]);
    }

    public function test_admin_can_assign_doctor_to_room_and_shift(): void
    {
        $admin = $this->createAdmin();
        $room = $this->createRoom();
        $doctor = $this->createDoctor('DOC-ASSIGN-1', $room->id);
        $date = today()->addDay()->toDateString();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/doctor-assignments', [
            'doctorId' => $doctor->id,
            'roomId' => $room->id,
            'date' => $date,
            'shift' => 'M',
            'changeReason' => 'Asignación de turno matutino',
        ])->assertCreated();

        $this->assertDatabaseHas('doctor_assignments', [
            'doctor_id' => $doctor->id,
            'room_id' => $room->id,
            'date' => $date,
            'shift' => 'M',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'Asignación Médica',
            'entity_id' => $doctor->id,
        ]);
    }

    public function test_admin_can_assign_doctor_using_snake_case_keys(): void
    {
        $admin = $this->createAdmin();
        $room = $this->createRoom('ROOM-SNAKE-1', 'CONS-SNAKE');
        $doctor = $this->createDoctor('DOC-SNAKE-1', $room->id);
        $date = today()->toDateString();

        $this->actingAs($admin, 'sanctum')->postJson('/api/doctor-assignments', [
            'doctor_id' => $doctor->id,
            'room_id' => $room->id,
            'date' => $date,
            'shift' => 'T',
            'change_reason' => 'Asignación vespertina con snake_case',
        ])->assertCreated();

        $this->assertDatabaseHas('doctor_assignments', [
            'doctor_id' => $doctor->id,
            'room_id' => $room->id,
            'date' => $date,
            'shift' => 'T',
        ]);
    }

    public function test_two_doctors_cannot_be_in_same_room_on_same_date_and_shift(): void
    {
        $admin = $this->createAdmin();
        $room = $this->createRoom();
        $doctor1 = $this->createDoctor('DOC-CONFLICT-1', $room->id);
        $doctor2 = $this->createDoctor('DOC-CONFLICT-2', $room->id);
        $date = today()->addDay()->toDateString();

        $this->actingAs($admin, 'sanctum')->postJson('/api/doctor-assignments', [
            'doctorId' => $doctor1->id,
            'roomId' => $room->id,
            'date' => $date,
            'shift' => 'M',
        ])->assertCreated();

        $this->postJson('/api/doctor-assignments', [
            'doctorId' => $doctor2->id,
            'roomId' => $room->id,
            'date' => $date,
            'shift' => 'M',
        ])->assertUnprocessable()->assertJsonValidationErrors('roomId');
    }

    public function test_appointment_stores_immutable_snapshot_of_shift_and_room(): void
    {
        $reception = $this->createReception();
        $room1 = $this->createRoom('ROOM-SNAP-1', 'CONS-SNAP-1');
        $room2 = $this->createRoom('ROOM-SNAP-2', 'CONS-SNAP-2');
        $doctor = $this->createDoctor('DOC-SNAP-1', $room1->id, 'Matutino');
        $patient = $this->createPatient('PAT-SNAP-1');
        $date = today()->addDay()->toDateString();

        // Assign doctor to room1 in Morning
        DoctorAssignment::create([
            'id' => 'ASG-SNAP-1',
            'doctor_id' => $doctor->id,
            'room_id' => $room1->id,
            'date' => $date,
            'shift' => 'M',
            'changeReason' => 'Asignación original',
        ]);

        $appResponse = $this->actingAs($reception, 'sanctum')->postJson('/api/appointments', [
            'patientId' => $patient->id,
            'doctorId' => $doctor->id,
            'appointmentDate' => $date,
            'appointmentTime' => '10:00',
            'reason' => 'Consulta snapshot test',
        ])->assertCreated();

        $appId = $appResponse->json('id');

        $this->assertDatabaseHas('appointments', [
            'id' => $appId,
            'room_id' => $room1->id,
            'shift' => 'M',
        ]);

        // Reassign doctor to room2 in Afternoon for a future operation
        DoctorAssignment::where('id', 'ASG-SNAP-1')->update([
            'room_id' => $room2->id,
            'shift' => 'T',
        ]);

        // The appointment snapshot in DB and API must still point to room1 and shift M!
        $appointment = Appointment::find($appId);
        $this->assertSame($room1->id, $appointment->room_id);
        $this->assertSame('M', $appointment->shift);
        $this->assertStringContainsString('CONS-SNAP-1', $appointment->room_name);
    }

    public function test_dynamic_rotation_by_demand_rebalances_doctors_to_high_demand_shift(): void
    {
        $admin = $this->createAdmin();
        $room1 = $this->createRoom('ROOM-ROT-1', 'CONS-ROT-1');
        $room2 = $this->createRoom('ROOM-ROT-2', 'CONS-ROT-2');
        $doctor1 = $this->createDoctor('DOC-ROT-1', $room1->id, 'Matutino');
        $doctor2 = $this->createDoctor('DOC-ROT-2', $room2->id, 'Nocturno');
        $patient = $this->createPatient('PAT-ROT-1');
        $date = today()->addDay()->toDateString();

        DoctorAssignment::create([
            'id' => 'ASG-ROT-1',
            'doctor_id' => $doctor1->id,
            'room_id' => $room1->id,
            'date' => $date,
            'shift' => 'M',
        ]);

        DoctorAssignment::create([
            'id' => 'ASG-ROT-2',
            'doctor_id' => $doctor2->id,
            'room_id' => $room2->id,
            'date' => $date,
            'shift' => 'N',
        ]);

        // Create appointments in Morning (high demand)
        Appointment::create([
            'id' => 'APP-ROT-1',
            'patient_id' => $patient->id,
            'doctor_id' => $doctor1->id,
            'room_id' => $room1->id,
            'room_name' => 'CONS-ROT-1',
            'shift' => 'M',
            'appointment_date' => $date,
            'appointment_time' => '09:00',
            'reason' => 'Demanda matutina 1',
            'status' => 'Programada',
            'creation_date' => today(),
        ]);

        Appointment::create([
            'id' => 'APP-ROT-2',
            'patient_id' => $patient->id,
            'doctor_id' => $doctor1->id,
            'room_id' => $room1->id,
            'room_name' => 'CONS-ROT-1',
            'shift' => 'M',
            'appointment_date' => $date,
            'appointment_time' => '10:00',
            'reason' => 'Demanda matutina 2',
            'status' => 'Programada',
            'creation_date' => today(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/doctor-assignments/rotate-demand', [
            'date' => $date,
            'reason' => 'Alta concentración de pacientes en turno matutino',
        ])->assertOk();

        $this->assertSame('M', $response->json('highestDemandShift'));
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'Asignación Médica',
            'action' => 'Rotación por Demanda de Pacientes',
        ]);
    }
}
