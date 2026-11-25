<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('doctors', function (Blueprint $table): void {
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
        });

        DB::table('doctors')->whereNotNull('email')->orderBy('id')->each(function (object $doctor): void {
            $userId = DB::table('users')->where('email', $doctor->email)
                ->whereIn('role', ['medico_general', 'especialista'])->value('id');
            if ($userId) {
                DB::table('doctors')->where('id', $doctor->id)->update(['user_id' => $userId]);
            }
        });

        Schema::table('appointments', function (Blueprint $table): void {
            $table->timestamp('attended_at')->nullable()->index();
            $table->foreignId('attended_by')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::create('doctor_schedule_history', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('schedule_id', 40)->index();
            $table->string('doctor_id', 40)->index();
            $table->string('room_id', 40)->index();
            $table->unsignedTinyInteger('day_of_week');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('shift', 32);
            $table->boolean('is_active');
            $table->string('action', 32);
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('recorded_at')->index();
            $table->timestamps();
            $table->foreign('doctor_id')->references('id')->on('doctors')->restrictOnDelete();
            $table->foreign('room_id')->references('id')->on('rooms')->restrictOnDelete();
        });

        DB::table('doctor_schedules')->orderBy('id')->each(function (object $schedule): void {
            DB::table('doctor_schedule_history')->insert([
                'id' => 'SCHH-'.substr(hash('sha256', $schedule->id), 0, 32),
                'schedule_id' => $schedule->id,
                'doctor_id' => $schedule->doctor_id,
                'room_id' => $schedule->room_id,
                'day_of_week' => $schedule->day_of_week,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'shift' => $schedule->shift,
                'is_active' => $schedule->is_active,
                'action' => 'Estado inicial',
                'recorded_by' => null,
                'recorded_at' => $schedule->created_at ?? now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        Schema::create('room_reservations', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('room_id', 40);
            $table->string('title', 120);
            $table->string('reason', 500);
            $table->dateTime('starts_at')->index();
            $table->dateTime('ends_at')->index();
            $table->string('status', 24)->default('Reservada')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreign('room_id')->references('id')->on('rooms')->restrictOnDelete();
            $table->index(['room_id', 'starts_at', 'ends_at', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_reservations');
        Schema::dropIfExists('doctor_schedule_history');

        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('attended_by');
            $table->dropColumn('attended_at');
        });

        Schema::table('doctors', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
