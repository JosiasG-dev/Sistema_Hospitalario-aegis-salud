<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DoctorScheduleHistory extends Model
{
    protected $table = 'doctor_schedule_history';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'schedule_id', 'doctor_id', 'room_id', 'day_of_week', 'start_time', 'end_time',
        'shift', 'is_active', 'action', 'recorded_by', 'recorded_at',
    ];

    protected function casts(): array
    {
        return ['day_of_week' => 'integer', 'is_active' => 'boolean', 'recorded_at' => 'datetime'];
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
