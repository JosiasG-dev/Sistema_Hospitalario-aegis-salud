<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DispensationBatchAllocation extends Model
{
    protected $fillable = [
        'dispensation_id',
        'inventory_batch_id',
        'quantity',
        'unit_cost',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'integer', 'unit_cost' => 'float'];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(InventoryBatch::class, 'inventory_batch_id');
    }
}
