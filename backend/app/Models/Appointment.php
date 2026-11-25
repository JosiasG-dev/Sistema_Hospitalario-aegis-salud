<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Appointment extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'patient_id', 'doctor_id', 'room_id', 'room_name', 'shift', 'appointment_date', 'appointment_time', 'reason', 'status',
        'creation_date', 'discharge_date', 'discharge_reason', 'discharge_by',
        'attended_at', 'attended_by',
    ];

    protected function casts(): array
    {
        return [
            'appointment_date' => 'date:Y-m-d',
            'creation_date' => 'date:Y-m-d',
            'discharge_date' => 'date:Y-m-d',
            'attended_at' => 'datetime',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }
}
