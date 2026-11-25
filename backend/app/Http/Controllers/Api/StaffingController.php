<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\HospitalNotification;
use App\Models\StaffAbsence;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StaffingController extends Controller
{
    public function absences(): JsonResponse
    {
        return response()->json(StaffAbsence::with('doctor')->orderByDesc('starts_on')->get()->map(
            fn (StaffAbsence $absence): array => $this->absencePayload($absence),
        ));
    }

    public function storeAbsence(Request $request): JsonResponse
    {
        $data = $request->validate([
            'doctorId' => ['required', 'exists:doctors,id'],
            'startsOn' => ['required', 'date'],
            'endsOn' => ['required', 'date', 'after_or_equal:startsOn'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);
        $overlap = StaffAbsence::where('doctor_id', $data['doctorId'])
            ->where('status', 'Registrada')->whereDate('starts_on', '<=', $data['endsOn'])
            ->whereDate('ends_on', '>=', $data['startsOn'])->exists();
        if ($overlap) {
            throw ValidationException::withMessages(['startsOn' => ['Ya existe una ausencia registrada para ese médico en esas fechas.']]);
        }
        $absence = StaffAbsence::create([
            'id' => 'ABS-'.strtoupper(Str::random(8)),
            'doctor_id' => $data['doctorId'], 'starts_on' => $data['startsOn'],
            'ends_on' => $data['endsOn'], 'reason' => $data['reason'],
            'status' => 'Registrada', 'created_by' => $request->user()->id,
        ]);
        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Personal',
            'action' => 'Ausencia registrada', 'entity_id' => $absence->id,
            'entity_name' => $absence->doctor->first_name.' '.$absence->doctor->last_name,
            'reason' => $absence->reason, 'occurred_at' => now(),
        ]);
        HospitalNotification::create([
            'title' => 'Ausencia de personal registrada',
            'body' => 'Se registró una ausencia; revise las opciones de cobertura en la agenda.',
            'type' => 'agenda',
        ]);

        return response()->json($this->absencePayload($absence->load('doctor')), 201);
    }

    public function replacementCandidates(Request $request): JsonResponse
    {
        $data = $request->validate([
            'absenceId' => ['required', 'exists:staff_absences,id'],
            'date' => ['required', 'date'],
            'startTime' => ['required', 'date_format:H:i'],
            'endTime' => ['required', 'date_format:H:i', 'after:startTime'],
        ]);
        $absence = StaffAbsence::with('doctor')->findOrFail($data['absenceId']);
        if ($absence->status !== 'Registrada' ||
            $data['date'] < $absence->starts_on->format('Y-m-d') ||
            $data['date'] > $absence->ends_on->format('Y-m-d')) {
            throw ValidationException::withMessages(['date' => ['La fecha debe pertenecer a una ausencia vigente.']]);
        }

        $day = Carbon::parse($data['date'])->dayOfWeekIso;
        $start = Carbon::parse('1970-01-01 '.$data['startTime']);
        $end = Carbon::parse('1970-01-01 '.$data['endTime']);
        $schedules = DoctorSchedule::with('doctor')
            ->where('is_active', true)->where('day_of_week', $day)
            ->where('start_time', '<=', $data['startTime'])
            ->where('end_time', '>=', $data['endTime'])
            ->whereHas('doctor', fn ($query) => $query
                ->where('status', 'Activo')
                ->where('role_type', $absence->doctor->role_type)
                ->where('department', $absence->doctor->department)
                ->where('id', '!=', $absence->doctor_id))
            ->get();
        $candidates = $schedules->filter(function (DoctorSchedule $schedule) use ($data, $start, $end): bool {
            $hasAbsence = StaffAbsence::where('doctor_id', $schedule->doctor_id)
                ->where('status', 'Registrada')->whereDate('starts_on', '<=', $data['date'])
                ->whereDate('ends_on', '>=', $data['date'])->exists();
            if ($hasAbsence) {
                return false;
            }
            return ! Appointment::where('doctor_id', $schedule->doctor_id)
                ->whereDate('appointment_date', $data['date'])->where('status', 'Programada')
                ->get(['appointment_time'])->contains(function (Appointment $appointment) use ($start, $end): bool {
                    $appointmentStart = Carbon::parse('1970-01-01 '.$appointment->appointment_time);
                    return $start->lt($appointmentStart->copy()->addMinutes(30)) &&
                        $end->gt($appointmentStart);
                });
        })->unique('doctor_id')->values()->map(fn (DoctorSchedule $schedule): array => [
            'doctorId' => $schedule->doctor_id,
            'name' => trim($schedule->doctor->first_name.' '.$schedule->doctor->last_name),
            'specialty' => $schedule->doctor->specialty,
            'role' => $schedule->doctor->role_type,
            'department' => $schedule->doctor->department,
            'roomId' => $schedule->room_id,
            'startTime' => substr($schedule->start_time, 0, 5),
            'endTime' => substr($schedule->end_time, 0, 5),
            'shift' => $schedule->shift,
        ]);

        return response()->json($candidates);
    }

    private function absencePayload(StaffAbsence $absence): array
    {
        return [
            'id' => $absence->id, 'doctorId' => $absence->doctor_id,
            'doctorName' => trim(($absence->doctor?->first_name ?? '').' '.($absence->doctor?->last_name ?? '')),
            'specialty' => $absence->doctor?->specialty,
            'startsOn' => $absence->starts_on->format('Y-m-d'),
            'endsOn' => $absence->ends_on->format('Y-m-d'),
            'reason' => $absence->reason, 'status' => $absence->status,
        ];
    }
}
