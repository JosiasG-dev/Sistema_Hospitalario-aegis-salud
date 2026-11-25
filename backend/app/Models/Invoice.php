<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id', 'patient_id', 'description', 'total', 'insurance_coverage',
        'patient_copay', 'discount', 'authorized_by_master', 'status', 'issued_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'decimal:2', 'insurance_coverage' => 'decimal:2',
            'patient_copay' => 'decimal:2', 'discount' => 'decimal:2',
            'authorized_by_master' => 'boolean', 'issued_at' => 'date:Y-m-d',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class);
    }
}
