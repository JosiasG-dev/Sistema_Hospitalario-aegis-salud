<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Dispensation extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'patient_id', 'item_id', 'quantity', 'unit_price', 'prescription',
        'responsible', 'responsible_user_id', 'prescribed_by', 'dispensed_by', 'dispensed_at',
        'status', 'authorized_by', 'authorized_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'float',
            'dispensed_at' => 'datetime',
            'authorized_at' => 'datetime',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'item_id');
    }

    public function batchAllocations(): HasMany
    {
        return $this->hasMany(DispensationBatchAllocation::class);
    }
}
