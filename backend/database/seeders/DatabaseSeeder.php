<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('Demo accounts may only be seeded in local or testing environments.');
        }

        $password = (string) env('AEGIS_DEMO_PASSWORD');
        if (strlen($password) < 8) {
            throw new \RuntimeException('Set AEGIS_DEMO_PASSWORD to a value of at least 8 characters in backend/.env before seeding.');
        }

        foreach ([
            ['Administrador Aegis', 'admin@aegissalud.test', 'admin'],
            ['Recepción Aegis', 'recepcion@aegissalud.test', 'recepcion'],
            ['Medicina General Aegis', 'medicina@aegissalud.test', 'medico_general'],
            ['Especialista Aegis', 'especialista@aegissalud.test', 'especialista'],
            ['Farmacia Aegis', 'farmacia@aegissalud.test', 'farmacia'],
            ['Farmacia Aegis Dos', 'farmacia2@aegissalud.test', 'farmacia'],
            ['Nutrición Aegis', 'nutricion@aegissalud.test', 'nutricion'],
            ['Compras Aegis', 'compras@aegissalud.test', 'compras'],
            ['Enfermería Aegis', 'enfermeria@aegissalud.test', 'enfermeria'],
            ['Cirugía Aegis', 'cirugia@aegissalud.test', 'cirugia'],
            ['Almacén Aegis', 'almacen@aegissalud.test', 'almacen'],
            ['Encargado de Almacén Aegis', 'encargado.almacen@aegissalud.test', 'almacen'],
        ] as [$name, $email, $role]) {
            User::updateOrCreate(
                ['email' => $email],
                ['name' => $name, 'password' => $password, 'role' => $role, 'is_active' => true],
            );
        }

        $this->call(HospitalDemoSeeder::class);
    }
}
