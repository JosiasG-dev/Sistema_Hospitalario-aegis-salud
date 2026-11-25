<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HospitalNotification extends Model
{
    protected $table = 'notifications';

    protected $fillable = ['user_id', 'title', 'body', 'type', 'read_at'];

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }
}
