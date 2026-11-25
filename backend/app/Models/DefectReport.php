<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DefectReport extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id', 'title', 'description', 'impact', 'priority', 'status', 'resolution',
        'resolution_minutes', 'reported_by', 'resolved_by', 'resolved_at',
    ];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }
}
