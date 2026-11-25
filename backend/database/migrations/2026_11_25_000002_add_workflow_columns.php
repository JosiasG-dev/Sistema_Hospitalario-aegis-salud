<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meal_orders', function (Blueprint $table): void {
            $table->string('prepared_food', 255)->nullable()->after('diet');
            $table->timestamp('prepared_at')->nullable()->after('delivered_at');
            $table->foreignId('prepared_by')->nullable()->after('prepared_at')->constrained('users')->nullOnDelete();
        });

        Schema::table('dispensations', function (Blueprint $table): void {
            $table->string('status', 40)->default('Autorizada')->after('dispensed_at')->index();
            $table->foreignId('authorized_by')->nullable()->after('status')->constrained('users')->nullOnDelete();
            $table->timestamp('authorized_at')->nullable()->after('authorized_by');
        });

        Schema::table('patients', function (Blueprint $table): void {
            $table->timestamp('discharge_requested_at')->nullable()->after('triage_level');
            $table->foreignId('discharge_requested_by')->nullable()->after('discharge_requested_at')->constrained('users')->nullOnDelete();
            $table->text('discharge_request_notes')->nullable()->after('discharge_requested_by');
        });
    }

    public function down(): void
    {
        Schema::table('meal_orders', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('prepared_by');
            $table->dropColumn(['prepared_food', 'prepared_at']);
        });

        Schema::table('dispensations', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('authorized_by');
            $table->dropColumn(['status', 'authorized_at']);
        });

        Schema::table('patients', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('discharge_requested_by');
            $table->dropColumn(['discharge_requested_at', 'discharge_request_notes']);
        });
    }
};
