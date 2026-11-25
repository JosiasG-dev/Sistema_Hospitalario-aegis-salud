<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('dispensations', 'unit_price')
            || ! Schema::hasColumn('dispensations', 'prescribed_by')
            || ! Schema::hasColumn('dispensations', 'dispensed_by')) {
            Schema::table('dispensations', function (Blueprint $table): void {
                if (! Schema::hasColumn('dispensations', 'unit_price')) {
                    $table->decimal('unit_price', 12, 2)->default(0)->after('quantity');
                }
                if (! Schema::hasColumn('dispensations', 'prescribed_by')) {
                    $table->foreignId('prescribed_by')->nullable()->constrained('users')->nullOnDelete()->after('responsible');
                }
                if (! Schema::hasColumn('dispensations', 'dispensed_by')) {
                    $table->foreignId('dispensed_by')->nullable()->constrained('users')->nullOnDelete()->after('prescribed_by');
                }
            });
        }
        if (! Schema::hasTable('dispensation_batch_allocations')) {
            Schema::create('dispensation_batch_allocations', function (Blueprint $table): void {
                $table->id();
                $table->string('dispensation_id', 40);
                $table->string('inventory_batch_id', 40);
                $table->unsignedInteger('quantity');
                $table->decimal('unit_cost', 12, 2);
                $table->timestamps();
                $table->foreign('dispensation_id')->references('id')->on('dispensations')->restrictOnDelete();
                $table->foreign('inventory_batch_id')->references('id')->on('inventory_batches')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('dispensation_batch_allocations');

        if (Schema::hasTable('dispensations')) {
            Schema::table('dispensations', function (Blueprint $table): void {
                if (Schema::hasColumn('dispensations', 'dispensed_by')) {
                    $table->dropConstrainedForeignId('dispensed_by');
                }
                if (Schema::hasColumn('dispensations', 'prescribed_by')) {
                    $table->dropConstrainedForeignId('prescribed_by');
                }
                if (Schema::hasColumn('dispensations', 'unit_price')) {
                    $table->dropColumn('unit_price');
                }
            });
        }
    }
};
