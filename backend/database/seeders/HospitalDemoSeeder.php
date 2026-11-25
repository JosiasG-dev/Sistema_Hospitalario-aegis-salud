<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class HospitalDemoSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('patients')->upsert([
            [
                'id' => 'PAT-DEMO-001', 'document_id' => 'DEMO-PAT-001', 'first_name' => 'Paciente',
                'last_name' => 'Demostración Uno', 'birth_date' => '1990-01-01', 'gender' => 'Otro',
                'phone' => '', 'email' => '', 'blood_type' => 'O+', 'allergies' => '',
                'emergency_contact' => json_encode(['name' => '', 'phone' => '', 'relation' => '']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.60, 'height_cm' => 170.00,
                'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-002', 'document_id' => 'DEMO-PAT-002', 'first_name' => 'María',
                'last_name' => 'Ficticia López', 'birth_date' => '1987-06-14', 'gender' => 'Femenino',
                'phone' => '5550000002', 'email' => 'paciente2@example.test', 'blood_type' => 'A+', 'allergies' => 'Ninguna conocida',
                'emergency_contact' => json_encode(['name' => 'Contacto ficticio', 'phone' => '5550000102', 'relation' => 'Familiar']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.50, 'height_cm' => 165.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-003', 'document_id' => 'DEMO-PAT-003', 'first_name' => 'Carlos',
                'last_name' => 'Ficticio Ruiz', 'birth_date' => '1975-03-22', 'gender' => 'Masculino',
                'phone' => '5550000003', 'email' => 'paciente3@example.test', 'blood_type' => 'B+', 'allergies' => '',
                'emergency_contact' => json_encode(['name' => 'Contacto ficticio', 'phone' => '5550000103', 'relation' => 'Familiar']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.70, 'height_cm' => 178.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-004', 'document_id' => 'DEMO-PAT-004', 'first_name' => 'Lucía',
                'last_name' => 'Ficticia Torres', 'birth_date' => '2001-09-05', 'gender' => 'Femenino',
                'phone' => '5550000004', 'email' => 'paciente4@example.test', 'blood_type' => 'AB+', 'allergies' => 'Penicilina',
                'emergency_contact' => json_encode(['name' => 'Contacto ficticio', 'phone' => '5550000104', 'relation' => 'Familiar']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.40, 'height_cm' => 162.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-005', 'document_id' => 'DEMO-PAT-005', 'first_name' => 'Jorge',
                'last_name' => 'Ficticio Mendoza', 'birth_date' => '1968-11-18', 'gender' => 'Masculino',
                'phone' => '5550000005', 'email' => 'paciente5@example.test', 'blood_type' => 'O-', 'allergies' => '',
                'emergency_contact' => json_encode(['name' => 'Contacto ficticio', 'phone' => '5550000105', 'relation' => 'Familiar']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.80, 'height_cm' => 175.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-006', 'document_id' => 'DEMO-PAT-006', 'first_name' => 'Sofía',
                'last_name' => 'Ramírez Vega', 'birth_date' => '1994-04-12', 'gender' => 'Femenino',
                'phone' => '5519482011', 'email' => 'sofia.ramirez@example.test', 'blood_type' => 'A+', 'allergies' => 'Sulfas',
                'emergency_contact' => json_encode(['name' => 'Elena Vega', 'phone' => '5519482099', 'relation' => 'Madre']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.50, 'height_cm' => 163.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-007', 'document_id' => 'DEMO-PAT-007', 'first_name' => 'Mateo',
                'last_name' => 'Hernández Cruz', 'birth_date' => '1982-08-29', 'gender' => 'Masculino',
                'phone' => '5528391044', 'email' => 'mateo.hernandez@example.test', 'blood_type' => 'O+', 'allergies' => 'Ninguna conocida',
                'emergency_contact' => json_encode(['name' => 'Laura Cruz', 'phone' => '5528391090', 'relation' => 'Esposa']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.70, 'height_cm' => 176.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-008', 'document_id' => 'DEMO-PAT-008', 'first_name' => 'Valentina',
                'last_name' => 'Castillo Morales', 'birth_date' => '2003-01-19', 'gender' => 'Femenino',
                'phone' => '5537104822', 'email' => 'valentina.castillo@example.test', 'blood_type' => 'B-', 'allergies' => 'Mariscos',
                'emergency_contact' => json_encode(['name' => 'Ricardo Castillo', 'phone' => '5537104801', 'relation' => 'Padre']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.40, 'height_cm' => 160.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-009', 'document_id' => 'DEMO-PAT-009', 'first_name' => 'Andrés',
                'last_name' => 'Salazar Ortega', 'birth_date' => '1959-12-03', 'gender' => 'Masculino',
                'phone' => '5541928374', 'email' => 'andres.salazar@example.test', 'blood_type' => 'A-', 'allergies' => 'Ibuprofeno',
                'emergency_contact' => json_encode(['name' => 'Patricia Salazar', 'phone' => '5541928300', 'relation' => 'Hija']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.90, 'height_cm' => 171.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-010', 'document_id' => 'DEMO-PAT-010', 'first_name' => 'Camila',
                'last_name' => 'Delgado Fuentes', 'birth_date' => '1997-07-25', 'gender' => 'Femenino',
                'phone' => '5562019384', 'email' => 'camila.delgado@example.test', 'blood_type' => 'O+', 'allergies' => '',
                'emergency_contact' => json_encode(['name' => 'Marco Delgado', 'phone' => '5562019311', 'relation' => 'Hermano']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.60, 'height_cm' => 167.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-011', 'document_id' => 'DEMO-PAT-011', 'first_name' => 'Diego',
                'last_name' => 'Ibarra Soto', 'birth_date' => '1991-10-08', 'gender' => 'Masculino',
                'phone' => '5574920183', 'email' => 'diego.ibarra@example.test', 'blood_type' => 'AB-', 'allergies' => 'Látex',
                'emergency_contact' => json_encode(['name' => 'Mónica Soto', 'phone' => '5574920122', 'relation' => 'Madre']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.55, 'height_cm' => 180.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-012', 'document_id' => 'DEMO-PAT-012', 'first_name' => 'Renata',
                'last_name' => 'Aguilar Ponce', 'birth_date' => '1979-02-14', 'gender' => 'Femenino',
                'phone' => '5581029384', 'email' => 'renata.aguilar@example.test', 'blood_type' => 'B+', 'allergies' => 'Penicilina',
                'emergency_contact' => json_encode(['name' => 'Luis Ponce', 'phone' => '5581029399', 'relation' => 'Esposo']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.75, 'height_cm' => 164.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-013', 'document_id' => 'DEMO-PAT-013', 'first_name' => 'Sebastián',
                'last_name' => 'Ríos Montes', 'birth_date' => '2010-05-30', 'gender' => 'Masculino',
                'phone' => '5591827364', 'email' => 'sebastian.rios@example.test', 'blood_type' => 'O+', 'allergies' => 'Polen',
                'emergency_contact' => json_encode(['name' => 'Claudia Montes', 'phone' => '5591827301', 'relation' => 'Madre']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.60, 'height_cm' => 154.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-014', 'document_id' => 'DEMO-PAT-014', 'first_name' => 'Fernanda',
                'last_name' => 'Guerrero Chávez', 'birth_date' => '1985-11-11', 'gender' => 'Femenino',
                'phone' => '5510293847', 'email' => 'fernanda.guerrero@example.test', 'blood_type' => 'A+', 'allergies' => 'Ninguna conocida',
                'emergency_contact' => json_encode(['name' => 'Héctor Guerrero', 'phone' => '5510293800', 'relation' => 'Padre']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.45, 'height_cm' => 169.00, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'PAT-DEMO-015', 'document_id' => 'DEMO-PAT-015', 'first_name' => 'Emiliano',
                'last_name' => 'Vargas Luna', 'birth_date' => '1972-09-21', 'gender' => 'Masculino',
                'phone' => '5521938475', 'email' => 'emiliano.vargas@example.test', 'blood_type' => 'O-', 'allergies' => 'Aspirina',
                'emergency_contact' => json_encode(['name' => 'Rosa Luna', 'phone' => '5521938411', 'relation' => 'Hermana']),
                'admission_date' => now()->toDateString(), 'status' => 'Activo',
                'temperature_c' => 36.85, 'height_cm' => 174.00, 'created_at' => now(), 'updated_at' => now(),
            ],
        ], ['id'], ['temperature_c', 'height_cm', 'updated_at']);

        DB::table('rooms')->upsert([
            [
                'id' => 'ROOM-DEMO-01', 'code' => 'CONS-DEMO-01', 'name' => 'Consultorio demostrativo',
                'floor' => 'Piso 1', 'specialty' => 'Medicina General', 'status' => 'Disponible',
                'room_type' => 'Consulta',
                'equipment' => json_encode(['Camilla', 'Monitor']), 'capacity' => 1,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-02', 'code' => 'CONS-DEMO-02', 'name' => 'Consultorio de especialidades demostrativo',
                'floor' => 'Piso 2', 'specialty' => 'Especialidades', 'status' => 'Disponible',
                'room_type' => 'Especialidades',
                'equipment' => json_encode(['Camilla', 'Electrocardiógrafo']), 'capacity' => 1,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-03', 'code' => 'CONS-DEMO-03', 'name' => 'Consultorio de Pediatría',
                'floor' => 'Piso 2', 'specialty' => 'Pediatría', 'status' => 'Disponible',
                'room_type' => 'Pediatría',
                'equipment' => json_encode(['Camilla', 'Balanza']), 'capacity' => 1,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-04', 'code' => 'CONS-DEMO-04', 'name' => 'Consultorio de Cirugía',
                'floor' => 'Piso 3', 'specialty' => 'Cirugía', 'status' => 'Disponible',
                'room_type' => 'Cirugía',
                'equipment' => json_encode(['Mesa quirúrgica', 'Monitor']), 'capacity' => 2,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-05', 'code' => 'CONS-DEMO-05', 'name' => 'Consultorio de Urgencias',
                'floor' => 'Planta baja', 'specialty' => 'Urgencias', 'status' => 'Disponible',
                'room_type' => 'Urgencias',
                'equipment' => json_encode(['Camilla', 'Desfibrilador']), 'capacity' => 2,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-06', 'code' => 'IMG-101', 'name' => 'Sala de Imagenología y Ultrasonido',
                'floor' => 'Planta baja - Ala Norte', 'specialty' => 'Radiología', 'status' => 'Disponible',
                'room_type' => 'Imagenología',
                'equipment' => json_encode(['Ecógrafo Doppler', 'Negatoscopio', 'Equipo de Rayos X']), 'capacity' => 1,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-07', 'code' => 'PROC-201', 'name' => 'Sala de Procedimientos Menores',
                'floor' => 'Piso 2 - Ala Sur', 'specialty' => 'Dermatología', 'status' => 'Disponible',
                'room_type' => 'Procedimientos',
                'equipment' => json_encode(['Lámpara quirúrgica portátil', 'Equipo de sutura', 'Autoclave']), 'capacity' => 1,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-08', 'code' => 'QUIR-301', 'name' => 'Quirófano Ambulatorio Central',
                'floor' => 'Piso 3 - Bloque Quirúrgico', 'specialty' => 'Cirugía General', 'status' => 'Disponible',
                'room_type' => 'Quirófano',
                'equipment' => json_encode(['Mesa quirúrgica hidráulica', 'Máquina de anestesia', 'Monitor multiparámetro']), 'capacity' => 3,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-09', 'code' => 'HOSP-401', 'name' => 'Pabellón de Hospitalización Corta Estancia',
                'floor' => 'Piso 4 - Ala Este', 'specialty' => 'Medicina Interna', 'status' => 'Disponible',
                'room_type' => 'Hospitalización',
                'equipment' => json_encode(['Cama hospitalaria eléctrica', 'Toma de oxígeno', 'Bomba de infusión']), 'capacity' => 4,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-10', 'code' => 'UCI-402', 'name' => 'Unidad de Cuidados Intermedios',
                'floor' => 'Piso 4 - Ala Oeste', 'specialty' => 'Anestesiología', 'status' => 'Disponible',
                'room_type' => 'Terapia Intensiva',
                'equipment' => json_encode(['Ventilador mecánico', 'Desfibrilador bifásico', 'Monitor invasivo']), 'capacity' => 2,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-11', 'code' => 'CONS-204', 'name' => 'Consultorio de Oftalmología Avanzada',
                'floor' => 'Piso 2 - Ala Norte', 'specialty' => 'Oftalmología', 'status' => 'Disponible',
                'room_type' => 'Especialidades',
                'equipment' => json_encode(['Lámpara de hendidura', 'Foróptero', 'Tonómetro']), 'capacity' => 1,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-12', 'code' => 'CONS-205', 'name' => 'Consultorio de Ginecología y Obstetricia',
                'floor' => 'Piso 2 - Ala Este', 'specialty' => 'Ginecología y Obstetricia', 'status' => 'Disponible',
                'room_type' => 'Especialidades',
                'equipment' => json_encode(['Mesa ginecológica', 'Colposcopio', 'Ultrasonido obstétrico']), 'capacity' => 1,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'ROOM-DEMO-13', 'code' => 'CONS-106', 'name' => 'Consultorio de Traumatología y Ortopedia',
                'floor' => 'Piso 1 - Ala Sur', 'specialty' => 'Traumatología y Ortopedia', 'status' => 'Disponible',
                'room_type' => 'Consulta',
                'equipment' => json_encode(['Camilla ortopédica', 'Negatoscopio LED', 'Sierra de yeso']), 'capacity' => 1,
                'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now(),
            ],
        ], ['id'], ['updated_at']);

        foreach ([[
            'id' => 'ROOM-DEMO-03', 'code' => 'CONS-DEMO-03', 'name' => 'Consultorio de Pediatría',
            'floor' => 'Piso 2', 'specialty' => 'Pediatría', 'room_type' => 'Pediatría',
            'status' => 'Disponible', 'equipment' => json_encode(['Camilla', 'Balanza']), 'capacity' => 1,
        ], [
            'id' => 'ROOM-DEMO-04', 'code' => 'CONS-DEMO-04', 'name' => 'Consultorio de Cirugía',
            'floor' => 'Piso 3', 'specialty' => 'Cirugía', 'room_type' => 'Cirugía',
            'status' => 'Disponible', 'equipment' => json_encode(['Mesa quirúrgica', 'Monitor']), 'capacity' => 2,
        ]] as $room) {
            unset($room['id']);
            DB::table('rooms')->updateOrInsert(
                ['code' => $room['code']],
                [...$room, 'registration_date' => now()->toDateString(), 'created_at' => now(), 'updated_at' => now()],
            );
        }

        $staffAssignments = [
            ['area' => 'farmacia', 'email' => 'farmacia@aegissalud.test'],
            ['area' => 'farmacia', 'email' => 'farmacia2@aegissalud.test'],
            ['area' => 'almacen', 'email' => 'almacen@aegissalud.test'],
            ['area' => 'alimentos', 'email' => 'nutricion@aegissalud.test'],
        ];
        $staffByArea = [];
        foreach ($staffAssignments as $assignment) {
            $staffByArea[$assignment['area']][] = $assignment['email'];
        }
        foreach ($staffByArea as $area => $emails) {
            if (DB::table('area_staff_assignments')->where('area', $area)->exists()) {
                continue;
            }
            $rows = [];
            foreach ($emails as $email) {
                $userId = DB::table('users')->where('email', $email)->value('id');
                if ($userId) {
                    $rows[] = [
                        'area' => $area, 'user_id' => $userId, 'created_at' => now(), 'updated_at' => now(),
                    ];
                }
            }
            if ($rows) DB::table('area_staff_assignments')->insert($rows);
        }

        DB::table('doctors')->upsert([
            [
                'id' => 'DOC-DEMO-01', 'license_number' => 'DEMO-MED-001', 'first_name' => 'Médico',
                'last_name' => 'Demostración', 'specialty' => 'Medicina General', 'phone' => '',
                'user_id' => DB::table('users')->where('email', 'medicina@aegissalud.test')->where('role', 'medico_general')->value('id'),
                'email' => 'medicina@aegissalud.test', 'shift' => 'Matutino', 'assigned_room_id' => 'ROOM-DEMO-01',
                'registration_date' => now()->toDateString(), 'status' => 'Activo',
                'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-02', 'license_number' => 'DEMO-MED-002', 'first_name' => 'Especialista',
                'last_name' => 'Demostración', 'specialty' => 'Cardiología', 'phone' => '',
                'user_id' => DB::table('users')->where('email', 'especialista@aegissalud.test')->where('role', 'especialista')->value('id'),
                'email' => 'especialista@aegissalud.test', 'shift' => 'Vespertino', 'assigned_room_id' => 'ROOM-DEMO-02',
                'registration_date' => now()->toDateString(), 'status' => 'Activo',
                'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-03', 'license_number' => 'DEMO-MED-003', 'first_name' => 'Diana',
                'last_name' => 'Ficticia Méndez', 'specialty' => 'Pediatría', 'phone' => '5550001003',
                'user_id' => null, 'email' => 'pediatra.demo@example.test', 'shift' => 'Matutino',
                'assigned_room_id' => 'ROOM-DEMO-03', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-04', 'license_number' => 'DEMO-MED-004', 'first_name' => 'Roberto',
                'last_name' => 'Ficticio Navarro', 'specialty' => 'Cirugía', 'phone' => '5550001004',
                'user_id' => null, 'email' => 'cirujano.demo@example.test', 'shift' => 'Matutino',
                'assigned_room_id' => 'ROOM-DEMO-04', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-05', 'license_number' => 'DEMO-MED-005', 'first_name' => 'Alejandra',
                'last_name' => 'Ficticia Paredes', 'specialty' => 'Medicina Interna', 'phone' => '5550001005',
                'user_id' => null, 'email' => 'medicina2.demo@example.test', 'shift' => 'Diurno',
                'assigned_room_id' => 'ROOM-DEMO-05', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-06', 'license_number' => 'CED-8492011', 'first_name' => 'Mariana',
                'last_name' => 'Valdez Ríos', 'specialty' => 'Dermatología', 'phone' => '5548129301',
                'user_id' => null, 'email' => 'mariana.valdez@aegissalud.test', 'shift' => 'Matutino',
                'assigned_room_id' => 'ROOM-DEMO-07', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-07', 'license_number' => 'CED-7319402', 'first_name' => 'Fernando',
                'last_name' => 'Ortega Salinas', 'specialty' => 'Oftalmología', 'phone' => '5539201847',
                'user_id' => null, 'email' => 'fernando.ortega@aegissalud.test', 'shift' => 'Vespertino',
                'assigned_room_id' => 'ROOM-DEMO-11', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-08', 'license_number' => 'CED-9104823', 'first_name' => 'Gabriela',
                'last_name' => 'Núñez Cárdenas', 'specialty' => 'Ginecología y Obstetricia', 'phone' => '5527183940',
                'user_id' => null, 'email' => 'gabriela.nunez@aegissalud.test', 'shift' => 'Matutino',
                'assigned_room_id' => 'ROOM-DEMO-12', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-09', 'license_number' => 'CED-6582914', 'first_name' => 'Ricardo',
                'last_name' => 'Peña Domínguez', 'specialty' => 'Traumatología y Ortopedia', 'phone' => '5518472930',
                'user_id' => null, 'email' => 'ricardo.pena@aegissalud.test', 'shift' => 'Vespertino',
                'assigned_room_id' => 'ROOM-DEMO-13', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-10', 'license_number' => 'CED-5491025', 'first_name' => 'Lucero',
                'last_name' => 'Campos Herrera', 'specialty' => 'Radiología', 'phone' => '5563920184',
                'user_id' => null, 'email' => 'lucero.campos@aegissalud.test', 'shift' => 'Matutino',
                'assigned_room_id' => 'ROOM-DEMO-06', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-11', 'license_number' => 'CED-4829106', 'first_name' => 'Héctor',
                'last_name' => 'Bautista León', 'specialty' => 'Anestesiología', 'phone' => '5571029384',
                'user_id' => null, 'email' => 'hector.bautista@aegissalud.test', 'shift' => 'Nocturno',
                'assigned_room_id' => 'ROOM-DEMO-10', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-12', 'license_number' => 'CED-3910487', 'first_name' => 'Paulina',
                'last_name' => 'Escobar Mejía', 'specialty' => 'Neurología Clínica', 'phone' => '5582930192',
                'user_id' => null, 'email' => 'paulina.escobar@aegissalud.test', 'shift' => 'Vespertino',
                'assigned_room_id' => 'ROOM-DEMO-09', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'id' => 'DOC-DEMO-13', 'license_number' => 'CED-2849108', 'first_name' => 'Rodrigo',
                'last_name' => 'Molina Zavala', 'specialty' => 'Cirugía General', 'phone' => '5594820173',
                'user_id' => null, 'email' => 'rodrigo.molina@aegissalud.test', 'shift' => 'Matutino',
                'assigned_room_id' => 'ROOM-DEMO-08', 'registration_date' => now()->toDateString(),
                'status' => 'Activo', 'created_at' => now(), 'updated_at' => now(),
            ],
        ], ['id'], ['updated_at']);

        foreach ([[
            'id' => 'DOC-DEMO-03', 'license_number' => 'DEMO-MED-003', 'first_name' => 'Diana',
            'last_name' => 'Ficticia Méndez', 'specialty' => 'Pediatría', 'phone' => '5550001003',
            'email' => 'pediatra.demo@example.test', 'shift' => 'Matutino', 'assigned_room_code' => 'CONS-DEMO-03',
        ], [
            'id' => 'DOC-DEMO-04', 'license_number' => 'DEMO-MED-004', 'first_name' => 'Roberto',
            'last_name' => 'Ficticio Navarro', 'specialty' => 'Cirugía', 'phone' => '5550001004',
            'email' => 'cirujano.demo@example.test', 'shift' => 'Matutino', 'assigned_room_code' => 'CONS-DEMO-04',
        ], [
            'id' => 'DOC-DEMO-05', 'license_number' => 'DEMO-MED-005', 'first_name' => 'Alejandra',
            'last_name' => 'Ficticia Paredes', 'specialty' => 'Medicina Interna', 'phone' => '5550001005',
            'email' => 'medicina2.demo@example.test', 'shift' => 'Diurno', 'assigned_room_id' => 'ROOM-DEMO-05',
        ]] as $doctor) {
            $assignedRoomId = isset($doctor['assigned_room_code'])
                ? DB::table('rooms')->where('code', $doctor['assigned_room_code'])->value('id')
                : $doctor['assigned_room_id'];
            unset($doctor['assigned_room_code'], $doctor['assigned_room_id']);
            $existingId = DB::table('doctors')->where('license_number', $doctor['license_number'])->value('id');
            $values = [...$doctor, 'user_id' => null, 'registration_date' => now()->toDateString(),
                'assigned_room_id' => $assignedRoomId, 'status' => 'Activo',
                'created_at' => now(), 'updated_at' => now()];
            unset($values['id']);
            if ($existingId) {
                DB::table('doctors')->where('id', $existingId)->update($values);
            } else {
                DB::table('doctors')->insert([...$values, 'id' => $doctor['id']]);
            }
        }

        $doctorId = DB::table('doctors')->where('id', 'DOC-DEMO-01')->value('id');
        $roomId = DB::table('rooms')->where('id', 'ROOM-DEMO-01')->value('id');
        $specialistRoomId = DB::table('rooms')->where('id', 'ROOM-DEMO-02')->value('id');
        $specialistId = DB::table('doctors')->where('id', 'DOC-DEMO-02')->value('id');
        if ($doctorId && $roomId) {
            foreach (range(1, 7) as $day) {
                DB::table('doctor_schedules')->updateOrInsert(
                    ['id' => 'SCH-DEMO-01-'.$day],
                    [
                        'doctor_id' => $doctorId, 'room_id' => $roomId, 'day_of_week' => $day,
                        'start_time' => '07:00:00', 'end_time' => '19:00:00', 'shift' => 'Diurno',
                        'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
                    ],
                );
            }
        }
        if ($specialistId && $specialistRoomId) {
            foreach (range(1, 7) as $day) {
                DB::table('doctor_schedules')->updateOrInsert(
                    ['id' => 'SCH-DEMO-02-'.$day],
                    [
                        'doctor_id' => $specialistId, 'room_id' => $specialistRoomId, 'day_of_week' => $day,
                        'start_time' => '07:00:00', 'end_time' => '19:00:00', 'shift' => 'Diurno',
                        'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
                    ],
                );
            }
        }

        $demoSchedules = [
            ['DEMO-MED-003', 'CONS-DEMO-03', 'Pediatría'],
            ['DEMO-MED-004', 'CONS-DEMO-04', 'Cirugía'],
            ['DEMO-MED-005', 'ROOM-DEMO-05', 'Medicina Interna'],
        ];
        foreach ($demoSchedules as $scheduleIndex => [$license, $roomKey, $specialty]) {
            $doctorId = DB::table('doctors')->where('license_number', $license)->value('id');
            $roomId = str_starts_with($roomKey, 'CONS-')
                ? DB::table('rooms')->where('code', $roomKey)->value('id')
                : DB::table('rooms')->where('id', $roomKey)->value('id');
            if (! $doctorId || ! $roomId) continue;
            foreach (range(1, 7) as $day) {
                DB::table('doctor_schedules')->updateOrInsert(
                    ['id' => 'SCH-DEMO-'.($scheduleIndex + 3).'-'.$day],
                    [
                        'doctor_id' => $doctorId, 'room_id' => $roomId, 'day_of_week' => $day,
                        'start_time' => '07:00:00', 'end_time' => '19:00:00', 'shift' => 'Diurno',
                        'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
                    ],
                );
            }
        }

        // ── Doctor Assignments (daily snapshot: today -31 to +31 days) ──────────
        $allDoctorIds = DB::table('doctors')->where('status', 'Activo')->pluck('id')->toArray();
        $allRoomIds   = DB::table('rooms')->where('status', 'Disponible')->pluck('id')->toArray();
        $shifts       = ['M', 'T', 'N'];
        $startDate    = now()->subDays(31)->toDateString();
        $endDate      = now()->addDays(31)->toDateString();

        $existingAssignments = DB::table('doctor_assignments')
            ->whereBetween('date', [$startDate, $endDate])
            ->get(['doctor_id', 'room_id', 'date', 'shift']);

        $usedSlots           = []; // "date|shift|room_id" => true
        $existingDoctorDates = []; // "doctor_id|date" => true
        foreach ($existingAssignments as $row) {
            $usedSlots["{$row->date}|{$row->shift}|{$row->room_id}"] = true;
            $existingDoctorDates["{$row->doctor_id}|{$row->date}"] = true;
        }

        $assignIdx = 0;
        if (count($allRoomIds) > 0) {
            for ($dayOffset = -31; $dayOffset <= 31; $dayOffset++) {
                $date = now()->addDays($dayOffset)->toDateString();
                $shuffledRooms = $allRoomIds;
                shuffle($shuffledRooms);
                $roomCursor = 0;

                foreach ($allDoctorIds as $did) {
                    if (isset($existingDoctorDates["$did|$date"])) {
                        $assignIdx++;
                        continue;
                    }

                    $shift = $shifts[$assignIdx % 3];
                    $roomId = null;
                    for ($t = 0; $t < count($shuffledRooms); $t++) {
                        $candidate = $shuffledRooms[$roomCursor % count($shuffledRooms)];
                        $roomCursor++;
                        $slotKey = "$date|$shift|$candidate";
                        if (!isset($usedSlots[$slotKey])) {
                            $roomId = $candidate;
                            $usedSlots[$slotKey] = true;
                            break;
                        }
                    }
                    if (!$roomId) {
                        $assignIdx++;
                        continue;
                    }

                    $existingDoctorDates["$did|$date"] = true;
                    DB::table('doctor_assignments')->insertOrIgnore([
                        'id'            => 'ASGN-DEMO-'.$date.'-'.$did,
                        'doctor_id'     => $did,
                        'room_id'       => $roomId,
                        'date'          => $date,
                        'shift'         => $shift,
                        'change_reason' => 'Asignación inicial de demo',
                        'created_by'    => null,
                        'created_at'    => now(),
                        'updated_at'    => now(),
                    ]);
                    $assignIdx++;
                }
            }
        }

        $inventory = [
            ['id' => 'ITEM-DEMO-001', 'name' => 'Paracetamol 500 mg', 'category' => 'Medicamentos', 'warehouse' => 'Farmacia', 'unit' => 'tableta', 'unit_price' => 12, 'unit_cost' => 7, 'stock' => 150, 'minimum_stock' => 20, 'expiration_date' => now()->addYear()->toDateString()],
            ['id' => 'ITEM-DEMO-002', 'name' => 'Amoxicilina 500 mg', 'category' => 'Medicamentos', 'warehouse' => 'Farmacia', 'unit' => 'cápsula', 'unit_price' => 18, 'unit_cost' => 10, 'stock' => 90, 'minimum_stock' => 15, 'expiration_date' => now()->addMonths(10)->toDateString()],
            ['id' => 'ITEM-DEMO-003', 'name' => 'Guantes estériles', 'category' => 'Insumos hospitalarios', 'warehouse' => 'Almacén', 'unit' => 'par', 'unit_price' => 25, 'unit_cost' => 16, 'stock' => 300, 'minimum_stock' => 50, 'expiration_date' => now()->addYears(2)->toDateString()],
            ['id' => 'ITEM-DEMO-004', 'name' => 'Jeringa desechable 5 ml', 'category' => 'Insumos hospitalarios', 'warehouse' => 'Almacén', 'unit' => 'pieza', 'unit_price' => 8, 'unit_cost' => 4, 'stock' => 500, 'minimum_stock' => 100, 'expiration_date' => now()->addYears(2)->toDateString()],
            ['id' => 'ITEM-DEMO-005', 'name' => 'Fruta fresca surtida', 'category' => 'Alimentos', 'warehouse' => 'Alimentos', 'unit' => 'kg', 'unit_price' => 45, 'unit_cost' => 32, 'stock' => 80, 'minimum_stock' => 10, 'expiration_date' => now()->addDays(7)->toDateString()],
            ['id' => 'ITEM-DEMO-006', 'name' => 'Dieta líquida demostrativa', 'category' => 'Alimentos', 'warehouse' => 'Alimentos', 'unit' => 'porción', 'unit_price' => 35, 'unit_cost' => 22, 'stock' => 120, 'minimum_stock' => 20, 'expiration_date' => now()->addDays(5)->toDateString()],
        ];
        foreach ($inventory as $item) {
            DB::table('inventory_items')->updateOrInsert(
                ['id' => $item['id']],
                [...$item, 'is_controlled' => false, 'created_at' => now(), 'updated_at' => now()],
            );
        }
    }
}
