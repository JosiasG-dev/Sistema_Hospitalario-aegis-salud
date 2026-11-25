<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryBatch extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'inventory_item_id',
        'batch_code',
        'expiration_date',
        'quantity',
        'unit_cost',
        'warehouse',
    ];

    protected function casts(): array
    {
        return [
            'expiration_date' => 'date:Y-m-d',
            'quantity' => 'integer',
            'unit_cost' => 'float',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }
}
