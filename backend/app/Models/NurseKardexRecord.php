<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NurseKardexRecord extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'patient_id',
        'nurse_id',
        'nurse_name',
        'temperature_c',
        'blood_pressure',
        'heart_rate',
        'respiratory_rate',
        'oxygen_saturation',
        'medication_administered',
        'dose',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'temperature_c' => 'float',
            'heart_rate' => 'integer',
            'respiratory_rate' => 'integer',
            'oxygen_saturation' => 'integer',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function nurse(): BelongsTo
    {
        return $this->belongsTo(User::class, 'nurse_id');
    }
}
