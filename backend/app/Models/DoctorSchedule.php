<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DoctorSchedule extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'doctor_id', 'room_id', 'day_of_week', 'start_time', 'end_time', 'shift', 'is_active'];

    protected function casts(): array
    {
        return ['day_of_week' => 'integer', 'is_active' => 'boolean'];
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
