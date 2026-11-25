<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DoctorAssignment extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'doctor_id',
        'room_id',
        'date',
        'shift',
        'change_reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
        ];
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function shiftLabel(string $shift): string
    {
        return match (strtoupper($shift)) {
            'M' => 'Mañana (08:00 – 14:00)',
            'T' => 'Tarde (14:00 – 20:00)',
            'N' => 'Noche (20:00 – 08:00)',
            default => $shift,
        };
    }

    public static function shiftShortName(string $shift): string
    {
        return match (strtoupper($shift)) {
            'M' => 'Mañana',
            'T' => 'Tarde',
            'N' => 'Noche',
            default => $shift,
        };
    }

    public static function shiftTimeRange(string $shift): array
    {
        return match (strtoupper($shift)) {
            'M' => ['start' => '08:00', 'end' => '13:59', 'appointment_max' => '13:30'],
            'T' => ['start' => '14:00', 'end' => '19:59', 'appointment_max' => '19:30'],
            'N' => ['start' => '20:00', 'end' => '23:59', 'appointment_max' => '23:30'],
            default => ['start' => '08:00', 'end' => '18:00', 'appointment_max' => '17:30'],
        };
    }

    public static function timeToShift(string $time): string
    {
        $hm = substr($time, 0, 5);
        if ($hm >= '08:00' && $hm < '14:00') {
            return 'M';
        }
        if ($hm >= '14:00' && $hm < '20:00') {
            return 'T';
        }
        return 'N';
    }
}
