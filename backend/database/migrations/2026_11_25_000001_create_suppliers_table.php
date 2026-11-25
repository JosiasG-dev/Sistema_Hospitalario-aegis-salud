<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('name', 160)->unique();
            $table->string('category', 64);
            $table->string('contact_phone', 40)->nullable();
            $table->string('contact_email', 160)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $now = now();
        $suppliers = [
            // Medicamentos (4)
            ['id' => 'SUP-MED-01', 'name' => 'Farmacéutica Nacional del Valle S.A. de C.V.', 'category' => 'Medicamentos', 'contact_phone' => '55-4100-2210', 'contact_email' => 'ventas@fnvalle.mx'],
            ['id' => 'SUP-MED-02', 'name' => 'Distribuidora Médica San Lucas', 'category' => 'Medicamentos', 'contact_phone' => '55-4200-8830', 'contact_email' => 'pedidos@sanlucasmed.mx'],
            ['id' => 'SUP-MED-03', 'name' => 'Laboratorios BioSalud México', 'category' => 'Medicamentos', 'contact_phone' => '55-4310-9940', 'contact_email' => 'hospitales@biosalud.mx'],
            ['id' => 'SUP-MED-04', 'name' => 'PharmaLogística Integral', 'category' => 'Medicamentos', 'contact_phone' => '55-4420-1150', 'contact_email' => 'abasto@pharmalogistica.mx'],

            // Alimentos (4)
            ['id' => 'SUP-ALI-01', 'name' => 'Nutrición y Dietas Hospitalarias del Centro', 'category' => 'Alimentos', 'contact_phone' => '55-5100-3320', 'contact_email' => 'dietas@nutricentro.mx'],
            ['id' => 'SUP-ALI-02', 'name' => 'Alimentos Frescos La Huerta S.A.', 'category' => 'Alimentos', 'contact_phone' => '55-5200-4430', 'contact_email' => 'pedidos@lahuerta.mx'],
            ['id' => 'SUP-ALI-03', 'name' => 'Lácteos y Proteínas Nutritivas del Norte', 'category' => 'Alimentos', 'contact_phone' => '55-5310-5540', 'contact_email' => 'institucional@proteinasnorte.mx'],
            ['id' => 'SUP-ALI-04', 'name' => 'Abastecedora Gastronómica Clínica', 'category' => 'Alimentos', 'contact_phone' => '55-5420-6650', 'contact_email' => 'contacto@gastroclinica.mx'],

            // Insumos hospitalarios (4)
            ['id' => 'SUP-INS-01', 'name' => 'Insumos Quirúrgicos Aegis MedTech', 'category' => 'Insumos hospitalarios', 'contact_phone' => '55-6100-7710', 'contact_email' => 'quirurgicos@aegismedtech.mx'],
            ['id' => 'SUP-INS-02', 'name' => 'Equipos y Material de Curación ProHospital', 'category' => 'Insumos hospitalarios', 'contact_phone' => '55-6200-8820', 'contact_email' => 'ventas@prohospital.mx'],
            ['id' => 'SUP-INS-03', 'name' => 'Esterilización y Desechables del Pacífico', 'category' => 'Insumos hospitalarios', 'contact_phone' => '55-6310-9930', 'contact_email' => 'suministros@esteripacifico.mx'],
            ['id' => 'SUP-INS-04', 'name' => 'Soluciones Biomédicas y Mobiliario Clínico', 'category' => 'Insumos hospitalarios', 'contact_phone' => '55-6420-1040', 'contact_email' => 'cotizaciones@solbiomedicas.mx'],
        ];

        foreach ($suppliers as $supplier) {
            DB::table('suppliers')->insertOrIgnore([
                ...$supplier,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
