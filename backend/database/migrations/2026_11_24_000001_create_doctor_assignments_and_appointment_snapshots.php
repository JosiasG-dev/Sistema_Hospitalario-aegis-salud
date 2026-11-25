<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctor_assignments', function (Blueprint $table): void {
            $table->string('id', 40)->primary();
            $table->string('doctor_id', 40);
            $table->string('room_id', 40);
            $table->date('date')->index();
            $table->string('shift', 1)->index(); // M, T, N
            $table->string('change_reason', 500)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('doctor_id')->references('id')->on('doctors')->cascadeOnDelete();
            $table->foreign('room_id')->references('id')->on('rooms')->restrictOnDelete();

            $table->unique(['room_id', 'date', 'shift'], 'uniq_room_date_shift');
            $table->unique(['doctor_id', 'date', 'shift'], 'uniq_doctor_date_shift');
            $table->index(['date', 'shift']);
            $table->index(['doctor_id', 'date']);
        });

        Schema::table('appointments', function (Blueprint $table): void {
            $table->string('shift', 1)->nullable()->index()->after('appointment_time');
            $table->string('room_name', 255)->nullable()->after('room_id');
        });

        // Backfill appointments snapshot
        DB::table('appointments')
            ->join('rooms', 'appointments.room_id', '=', 'rooms.id')
            ->select('appointments.id', 'appointments.appointment_time', 'rooms.code', 'rooms.name')
            ->orderBy('appointments.id')
            ->each(function ($app): void {
                $time = substr((string) $app->appointment_time, 0, 5);
                $shift = ($time < '14:00') ? 'M' : (($time < '20:00') ? 'T' : 'N');
                $roomName = $app->code . ' (' . $app->name . ')';

                DB::table('appointments')->where('id', $app->id)->update([
                    'shift' => $shift,
                    'room_name' => $roomName,
                ]);
            });

        // Seed initial doctor_assignments for active doctors for recent past (-7 days) and future (+30 days)
        $doctors = DB::table('doctors')->where('status', 'Activo')->get();
        $rooms = DB::table('rooms')->where('status', 'Disponible')->orderBy('code')->get();

        if ($doctors->isNotEmpty() && $rooms->isNotEmpty()) {
            $startDate = now()->subDays(7)->startOfDay();
            $endDate = now()->addDays(30)->startOfDay();

            for ($current = $startDate->copy(); $current->lte($endDate); $current->addDay()) {
                $dateStr = $current->toDateString();
                $roomIndex = 0;
                $usedRoomIdsByShift = ['M' => [], 'T' => [], 'N' => []];

                foreach ($doctors as $idx => $doctor) {
                    $rawShift = strtoupper(substr((string) ($doctor->shift ?? 'M'), 0, 1));
                    $shift = in_array($rawShift, ['M', 'T', 'N'], true) ? $rawShift : 'M';
                    if ($doctor->shift === 'Vespertino') $shift = 'T';
                    if ($doctor->shift === 'Nocturno') $shift = 'N';

                    // Assign assigned_room_id or pick an available room
                    $targetRoomId = $doctor->assigned_room_id;
                    if (! $targetRoomId || in_array($targetRoomId, $usedRoomIdsByShift[$shift], true)) {
                        $available = $rooms->first(fn ($r) => ! in_array($r->id, $usedRoomIdsByShift[$shift], true));
                        $targetRoomId = $available ? $available->id : $rooms[$roomIndex % $rooms->count()]->id;
                    }

                    if (! in_array($targetRoomId, $usedRoomIdsByShift[$shift], true)) {
                        $usedRoomIdsByShift[$shift][] = $targetRoomId;
                        $assignId = 'ASG-' . strtoupper(substr(md5($doctor->id . $dateStr . $shift), 0, 16));

                        DB::table('doctor_assignments')->updateOrInsert(
                            ['room_id' => $targetRoomId, 'date' => $dateStr, 'shift' => $shift],
                            [
                                'id' => $assignId,
                                'doctor_id' => $doctor->id,
                                'change_reason' => 'Asignación operativa de turno',
                                'created_by' => null,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]
                        );
                    }
                    $roomIndex++;
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_assignments');

        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropColumn(['shift', 'room_name']);
        });
    }
};
