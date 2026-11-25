<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->string('ip_address', 45)->nullable()->after('entity_name');
            $table->string('area', 64)->nullable()->after('ip_address');
        });

        Schema::table('patients', function (Blueprint $table): void {
            $table->softDeletes();
            $table->string('insurance_provider', 120)->nullable()->after('allergies');
            $table->string('insurance_policy', 80)->nullable()->after('insurance_provider');
            $table->decimal('insurance_coverage_percent', 5, 2)->default(80.00)->after('insurance_policy');
            $table->string('assigned_bed_id', 40)->nullable()->after('discharge_notes');
            $table->timestamp('medical_discharge_at')->nullable()->after('discharge_date');
            $table->foreignId('medical_discharge_by')->nullable()->constrained('users')->nullOnDelete()->after('medical_discharge_at');
            $table->text('medical_discharge_notes')->nullable()->after('medical_discharge_by');
            $table->timestamp('administrative_discharge_at')->nullable()->after('medical_discharge_notes');
            $table->foreignId('administrative_discharge_by')->nullable()->constrained('users')->nullOnDelete()->after('administrative_discharge_at');
            $table->string('triage_level', 24)->default('Estándar')->after('height_cm');
        });

        Schema::table('doctors', function (Blueprint $table): void {
            $table->softDeletes();
            $table->string('department', 64)->default('Consulta Externa')->after('specialty');
            $table->string('role_type', 32)->default('Médico General')->after('department');
        });

        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->softDeletes();
            $table->string('warehouse', 48)->default('Farmacia')->after('category');
            $table->decimal('unit_price', 12, 2)->default(0.00)->after('unit');
            $table->boolean('is_controlled')->default(false)->after('expiration_date');
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->softDeletes();
            $table->decimal('insurance_coverage', 12, 2)->default(0.00)->after('total');
            $table->decimal('patient_copay', 12, 2)->default(0.00)->after('insurance_coverage');
            $table->decimal('discount', 12, 2)->default(0.00)->after('patient_copay');
            $table->boolean('authorized_by_master')->default(false)->after('discount');
        });

        Schema::table('invoice_payments', function (Blueprint $table): void {
            $table->softDeletes();
        });

        Schema::create('inventory_batches', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('inventory_item_id', 40);
            $table->string('batch_code', 60);
            $table->date('expiration_date');
            $table->unsignedInteger('quantity')->default(0);
            $table->decimal('unit_cost', 12, 2)->default(0.00);
            $table->string('warehouse', 48)->default('Farmacia');
            $table->timestamps();
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->cascadeOnDelete();
            $table->index(['inventory_item_id', 'expiration_date']);
        });

        Schema::create('consultation_addenda', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('consultation_id', 40);
            $table->string('doctor_id', 40)->nullable();
            $table->string('doctor_name', 160);
            $table->text('notes');
            $table->timestamps();
            $table->foreign('consultation_id')->references('id')->on('consultations')->cascadeOnDelete();
        });

        Schema::create('diagnostic_orders', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('patient_id', 40);
            $table->string('doctor_id', 40)->nullable();
            $table->string('type', 32); // Laboratorio, Imagenología
            $table->string('study_name', 160);
            $table->string('status', 32)->default('Solicitado'); // Solicitado, En Proceso, Completado, Validado
            $table->text('results')->nullable();
            $table->string('file_path')->nullable();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->timestamps();
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
        });

        Schema::create('ceye_instruments', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('code', 40)->unique();
            $table->string('name', 160);
            $table->string('category', 64);
            $table->string('status', 32)->default('Disponible'); // Disponible, En Cirugía, En Esterilización
            $table->timestamp('last_sterilized_at')->nullable();
            $table->string('current_operation_id', 40)->nullable();
            $table->timestamps();
        });

        Schema::create('surgical_kits', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('name', 160);
            $table->text('description')->nullable();
            $table->json('items'); // [{item_id, quantity}]
            $table->timestamps();
        });

        Schema::create('nurse_kardex_records', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('patient_id', 40);
            $table->foreignId('nurse_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('nurse_name', 160);
            $table->decimal('temperature_c', 4, 2)->nullable();
            $table->string('blood_pressure', 20)->nullable();
            $table->unsignedSmallInteger('heart_rate')->nullable();
            $table->unsignedSmallInteger('respiratory_rate')->nullable();
            $table->unsignedSmallInteger('oxygen_saturation')->nullable();
            $table->string('medication_administered', 160)->nullable();
            $table->string('dose', 80)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
        });

        Schema::create('staff_shifts', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('doctor_id', 40)->nullable();
            $table->string('staff_name', 160);
            $table->string('role', 32);
            $table->string('department', 64);
            $table->string('shift', 32); // Matutino, Vespertino, Nocturno
            $table->date('date');
            $table->string('status', 24)->default('Programado'); // Programado, Presente, Ausente, Suplente
            $table->string('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_shifts');
        Schema::dropIfExists('nurse_kardex_records');
        Schema::dropIfExists('surgical_kits');
        Schema::dropIfExists('ceye_instruments');
        Schema::dropIfExists('diagnostic_orders');
        Schema::dropIfExists('consultation_addenda');
        Schema::dropIfExists('inventory_batches');

        Schema::table('invoice_payments', function (Blueprint $table): void {
            $table->dropSoftDeletes();
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn(['insurance_coverage', 'patient_copay', 'discount', 'authorized_by_master']);
        });

        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn(['warehouse', 'unit_price', 'is_controlled']);
        });

        Schema::table('doctors', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn(['department', 'role_type']);
        });

        Schema::table('patients', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn([
                'insurance_provider', 'insurance_policy', 'insurance_coverage_percent',
                'assigned_bed_id', 'medical_discharge_at', 'medical_discharge_by',
                'medical_discharge_notes', 'administrative_discharge_at',
                'administrative_discharge_by', 'triage_level'
            ]);
        });

        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->dropColumn(['ip_address', 'area']);
        });
    }
};
