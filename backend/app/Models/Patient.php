<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Patient extends Model
{
    use SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'document_id',
        'first_name',
        'last_name',
        'birth_date',
        'gender',
        'phone',
        'email',
        'blood_type',
        'allergies',
        'emergency_contact',
        'admission_date',
        'status',
        'discharge_date',
        'discharge_reason',
        'discharge_notes',
        'temperature_c',
        'height_cm',
        'insurance_provider',
        'insurance_policy',
        'insurance_coverage_percent',
        'assigned_bed_id',
        'medical_discharge_at',
        'medical_discharge_by',
        'medical_discharge_notes',
        'administrative_discharge_at',
        'administrative_discharge_by',
        'triage_level',
        'discharge_requested_at',
        'discharge_requested_by',
        'discharge_request_notes',
    ];

    protected function casts(): array
    {
        return [
            'emergency_contact' => 'array',
            'birth_date' => 'date:Y-m-d',
            'admission_date' => 'date:Y-m-d',
            'discharge_date' => 'date:Y-m-d',
            'medical_discharge_at' => 'datetime',
            'administrative_discharge_at' => 'datetime',
            'discharge_requested_at' => 'datetime',
            'temperature_c' => 'float',
            'height_cm' => 'float',
            'insurance_coverage_percent' => 'float',
        ];
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function consultations(): HasMany
    {
        return $this->hasMany(Consultation::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function diagnosticOrders(): HasMany
    {
        return $this->hasMany(DiagnosticOrder::class);
    }

    public function kardexRecords(): HasMany
    {
        return $this->hasMany(NurseKardexRecord::class);
    }

    public function mealOrders(): HasMany
    {
        return $this->hasMany(MealOrder::class);
    }

    public function dispensations(): HasMany
    {
        return $this->hasMany(Dispensation::class);
    }
}
