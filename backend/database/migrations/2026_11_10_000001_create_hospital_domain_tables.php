<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('role', 32)->default('recepcion')->index();
            $table->boolean('is_active')->default(true);
        });

        Schema::create('patients', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('document_id')->unique();
            $table->string('first_name');
            $table->string('last_name');
            $table->date('birth_date')->nullable();
            $table->string('gender', 24)->default('Otro');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('blood_type', 4)->nullable();
            $table->text('allergies')->nullable();
            $table->json('emergency_contact')->nullable();
            $table->date('admission_date');
            $table->string('status', 32)->default('Activo')->index();
            $table->date('discharge_date')->nullable();
            $table->string('discharge_reason')->nullable();
            $table->text('discharge_notes')->nullable();
            $table->timestamps();
        });

        Schema::create('doctors', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('license_number')->unique();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('specialty')->index();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('shift', 32)->default('Matutino');
            $table->string('assigned_room_id', 40)->nullable()->index();
            $table->date('registration_date');
            $table->string('status', 32)->default('Activo')->index();
            $table->date('discharge_date')->nullable();
            $table->string('discharge_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('rooms', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('floor')->nullable();
            $table->string('specialty')->default('Medicina General');
            $table->string('status', 32)->default('Disponible')->index();
            $table->json('equipment')->nullable();
            $table->unsignedSmallInteger('capacity')->default(1);
            $table->date('registration_date');
            $table->date('discharge_date')->nullable();
            $table->string('discharge_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('doctor_schedules', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('doctor_id', 40);
            $table->string('room_id', 40);
            $table->unsignedTinyInteger('day_of_week');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('shift', 32);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->foreign('doctor_id')->references('id')->on('doctors')->cascadeOnDelete();
            $table->foreign('room_id')->references('id')->on('rooms')->restrictOnDelete();
            $table->index(['room_id', 'day_of_week', 'start_time', 'end_time']);
        });

        Schema::create('appointments', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('patient_id', 40);
            $table->string('doctor_id', 40);
            $table->string('room_id', 40);
            $table->date('appointment_date')->index();
            $table->time('appointment_time');
            $table->string('reason');
            $table->string('status', 40)->default('Programada')->index();
            $table->date('creation_date');
            $table->date('discharge_date')->nullable();
            $table->string('discharge_reason')->nullable();
            $table->string('discharge_by')->nullable();
            $table->timestamps();
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
            $table->foreign('doctor_id')->references('id')->on('doctors')->restrictOnDelete();
            $table->foreign('room_id')->references('id')->on('rooms')->restrictOnDelete();
            $table->index(['doctor_id', 'appointment_date', 'appointment_time']);
            $table->index(['room_id', 'appointment_date', 'appointment_time']);
        });

        Schema::create('consultations', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('patient_id', 40);
            $table->string('doctor_id', 40)->nullable();
            $table->string('consultation_type', 24)->default('general');
            $table->string('specialty')->nullable();
            $table->dateTime('scheduled_at');
            $table->string('reason');
            $table->text('notes')->nullable();
            $table->string('status', 24)->default('Programada')->index();
            $table->text('diagnosis')->nullable();
            $table->json('vitals')->nullable();
            $table->text('treatment_plan')->nullable();
            $table->json('specialty_data')->nullable();
            $table->string('nutrition_diet')->nullable();
            $table->text('nutrition_order')->nullable();
            $table->text('nutrition_instructions')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
            $table->foreign('doctor_id')->references('id')->on('doctors')->nullOnDelete();
        });

        Schema::create('operations', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('patient_id', 40);
            $table->string('procedure');
            $table->string('surgeon_name');
            $table->dateTime('scheduled_at');
            $table->string('room');
            $table->string('status', 24)->default('Programada')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
        });

        Schema::create('inventory_items', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('name');
            $table->string('category', 48)->index();
            $table->string('unit', 32);
            $table->unsignedInteger('stock')->default(0);
            $table->unsignedInteger('minimum_stock')->default(0);
            $table->date('expiration_date')->nullable();
            $table->timestamps();
            $table->unique(['name', 'category']);
        });

        Schema::create('dispensations', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('patient_id', 40);
            $table->string('item_id', 40);
            $table->unsignedInteger('quantity');
            $table->string('prescription');
            $table->string('responsible');
            $table->dateTime('dispensed_at');
            $table->timestamps();
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
            $table->foreign('item_id')->references('id')->on('inventory_items')->restrictOnDelete();
        });

        Schema::create('meal_orders', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('patient_id', 40);
            $table->string('meal', 24);
            $table->string('diet');
            $table->date('delivery_date');
            $table->text('notes')->nullable();
            $table->string('status', 24)->default('Pendiente')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
        });

        Schema::create('purchase_orders', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('supplier');
            $table->string('item_name');
            $table->string('category', 48);
            $table->string('unit', 32);
            $table->unsignedInteger('quantity');
            $table->decimal('unit_cost', 12, 2);
            $table->date('requested_at');
            $table->string('status', 24)->default('Solicitada')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('body');
            $table->string('type', 32)->default('sistema');
            $table->timestamp('read_at')->nullable()->index();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('entity_type', 48);
            $table->string('action', 48);
            $table->string('entity_id', 40)->nullable()->index();
            $table->string('entity_name');
            $table->string('reason')->nullable();
            $table->text('details')->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('meal_orders');
        Schema::dropIfExists('dispensations');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('operations');
        Schema::dropIfExists('consultations');
        Schema::dropIfExists('appointments');
        Schema::dropIfExists('doctor_schedules');
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('doctors');
        Schema::dropIfExists('patients');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['role', 'is_active']);
        });
    }
};
