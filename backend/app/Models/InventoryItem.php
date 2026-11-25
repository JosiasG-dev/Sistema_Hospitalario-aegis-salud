<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryItem extends Model
{
    use SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'category',
        'warehouse',
        'unit',
        'unit_price',
        'unit_cost',
        'stock',
        'minimum_stock',
        'expiration_date',
        'is_controlled',
    ];

    protected function casts(): array
    {
        return [
            'stock' => 'integer',
            'minimum_stock' => 'integer',
            'unit_price' => 'float',
            'unit_cost' => 'float',
            'is_controlled' => 'boolean',
            'expiration_date' => 'date:Y-m-d',
        ];
    }

    public function batches(): HasMany
    {
        return $this->hasMany(InventoryBatch::class);
    }
}
