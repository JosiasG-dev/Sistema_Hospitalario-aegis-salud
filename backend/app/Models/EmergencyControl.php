<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmergencyControl extends Model
{
    protected $fillable = ['id', 'is_active', 'reason', 'activated_by', 'activated_at', 'expires_at'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'activated_at' => 'datetime', 'expires_at' => 'datetime'];
    }
}
