<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CeyeInstrument extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'code',
        'name',
        'category',
        'status',
        'last_sterilized_at',
        'current_operation_id',
    ];

    protected function casts(): array
    {
        return [
            'last_sterilized_at' => 'datetime',
        ];
    }
}
