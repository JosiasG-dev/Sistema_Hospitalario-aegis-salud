<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('phone', 32)->nullable();
        });

        Schema::table('rooms', function (Blueprint $table): void {
            $table->string('room_type', 120)->default('Consulta');
        });

        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->decimal('unit_cost', 12, 2)->default(0);
        });
        DB::table('inventory_items')->orderBy('id')->chunkById(100, function ($items): void {
            foreach ($items as $item) {
                $latestBatchCost = DB::table('inventory_batches')
                    ->where('inventory_item_id', $item->id)
                    ->orderByDesc('created_at')->orderByDesc('id')
                    ->value('unit_cost');
                if ($latestBatchCost !== null) {
                    DB::table('inventory_items')->where('id', $item->id)
                        ->update(['unit_cost' => $latestBatchCost]);
                }
            }
        }, 'id');

        Schema::table('dispensations', function (Blueprint $table): void {
            $table->foreignId('responsible_user_id')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::create('room_nurse_assignments', function (Blueprint $table): void {
            $table->string('room_id', 40);
            $table->foreignId('nurse_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['room_id', 'nurse_id']);
            $table->foreign('room_id')->references('id')->on('rooms')->cascadeOnDelete();
        });

        Schema::create('area_staff_assignments', function (Blueprint $table): void {
            $table->id();
            $table->string('area', 24);
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['area', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('area_staff_assignments');
        Schema::dropIfExists('room_nurse_assignments');

        Schema::table('dispensations', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('responsible_user_id');
        });
        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->dropColumn('unit_cost');
        });
        Schema::table('rooms', function (Blueprint $table): void {
            $table->dropColumn('room_type');
        });
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('phone');
        });
    }
};
