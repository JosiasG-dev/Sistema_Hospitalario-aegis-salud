<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Consultation extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'patient_id',
        'doctor_id',
        'consultation_type',
        'specialty',
        'scheduled_at',
        'reason',
        'notes',
        'status',
        'diagnosis',
        'vitals',
        'treatment_plan',
        'specialty_data',
        'nutrition_diet',
        'nutrition_order',
        'nutrition_instructions',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'vitals' => 'array',
            'specialty_data' => 'array',
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

    public function addenda(): HasMany
    {
        return $this->hasMany(ConsultationAddenda::class);
    }
}
