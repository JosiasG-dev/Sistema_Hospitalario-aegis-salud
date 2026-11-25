<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('emergency_controls', function (Blueprint $table): void {
            $table->unsignedTinyInteger('id')->primary();
            $table->boolean('is_active')->default(false);
            $table->string('reason')->nullable();
            $table->foreignId('activated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('emergency_access_grants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('patient_id', 40);
            $table->string('reason', 500);
            $table->timestamp('expires_at')->index();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->foreign('patient_id')->references('id')->on('patients')->cascadeOnDelete();
            $table->index(['user_id', 'patient_id', 'revoked_at']);
        });

        Schema::create('temporary_role_grants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32);
            $table->string('reason', 500);
            $table->foreignId('granted_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('expires_at')->index();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'role', 'revoked_at']);
        });

        Schema::create('staff_absences', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('doctor_id', 40);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('reason', 500);
            $table->string('status', 24)->default('Registrada')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreign('doctor_id')->references('id')->on('doctors')->restrictOnDelete();
            $table->index(['doctor_id', 'starts_on', 'ends_on']);
        });

        Schema::create('invoices', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('patient_id', 40);
            $table->string('description', 255);
            $table->decimal('total', 12, 2);
            $table->string('status', 24)->default('Pendiente')->index();
            $table->date('issued_at');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
        });

        Schema::create('invoice_payments', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('invoice_id', 40);
            $table->decimal('amount', 12, 2);
            $table->string('method', 32);
            $table->string('reference', 120)->nullable();
            $table->dateTime('paid_at');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreign('invoice_id')->references('id')->on('invoices')->restrictOnDelete();
            $table->index(['invoice_id', 'paid_at']);
        });

        Schema::create('surgical_requisitions', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('operation_id', 40)->nullable();
            $table->string('inventory_item_id', 40);
            $table->unsignedInteger('quantity');
            $table->string('purpose', 500);
            $table->string('status', 24)->default('Solicitada')->index();
            $table->text('notes')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreign('operation_id')->references('id')->on('operations')->nullOnDelete();
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->restrictOnDelete();
        });

        Schema::create('defect_reports', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('title', 180);
            $table->text('description');
            $table->string('impact', 32);
            $table->string('priority', 24)->index();
            $table->string('status', 24)->default('Abierto')->index();
            $table->text('resolution')->nullable();
            $table->unsignedInteger('resolution_minutes')->nullable();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('defect_reports');
        Schema::dropIfExists('surgical_requisitions');
        Schema::dropIfExists('invoice_payments');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('staff_absences');
        Schema::dropIfExists('temporary_role_grants');
        Schema::dropIfExists('emergency_access_grants');
        Schema::dropIfExists('emergency_controls');
    }
};
