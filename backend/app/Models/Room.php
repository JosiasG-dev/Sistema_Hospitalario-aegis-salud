<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Room extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'code', 'name', 'floor', 'specialty', 'room_type', 'status', 'equipment', 'capacity', 'registration_date',
        'discharge_date', 'discharge_reason',
    ];

    protected function casts(): array
    {
        return ['equipment' => 'array', 'capacity' => 'integer', 'registration_date' => 'date:Y-m-d', 'discharge_date' => 'date:Y-m-d'];
    }

    public function nurses(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'room_nurse_assignments', 'room_id', 'nurse_id')
            ->withTimestamps();
    }
}
