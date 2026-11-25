<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Doctor extends Model
{
    use SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'user_id',
        'license_number',
        'first_name',
        'last_name',
        'specialty',
        'department',
        'role_type',
        'phone',
        'email',
        'shift',
        'assigned_room_id',
        'registration_date',
        'status',
        'discharge_date',
        'discharge_reason',
    ];

    protected function casts(): array
    {
        return [
            'registration_date' => 'date:Y-m-d',
            'discharge_date' => 'date:Y-m-d',
        ];
    }

    public function assignedRoom(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'assigned_room_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(DoctorSchedule::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(DoctorAssignment::class);
    }

    public function absences(): HasMany
    {
        return $this->hasMany(StaffAbsence::class);
    }
}
