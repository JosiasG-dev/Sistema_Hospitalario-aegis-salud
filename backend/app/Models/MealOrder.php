<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealOrder extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'patient_id', 'meal', 'diet', 'prepared_food', 'delivery_date', 'notes', 'status', 'created_by',
        'charge_amount', 'charged_invoice_id', 'delivered_at', 'prepared_at', 'prepared_by',
    ];

    protected function casts(): array
    {
        return [
            'delivery_date' => 'date:Y-m-d',
            'charge_amount' => 'float',
            'delivered_at' => 'datetime',
            'prepared_at' => 'datetime',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
