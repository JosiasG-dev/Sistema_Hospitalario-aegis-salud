<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;
use LogicException;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'entity_type',
        'action',
        'entity_id',
        'entity_name',
        'ip_address',
        'area',
        'reason',
        'details',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (AuditLog $log): void {
            $actor = Auth::user();
            if ($log->ip_address === null) {
                $log->ip_address = Request::ip();
            }
            if ($log->area === null) {
                $log->area = $actor?->role
                    ?? ($log->user_id ? User::whereKey($log->user_id)->value('role') : null);
            }
        });

        static::updating(function (): never {
            throw new LogicException('Los registros de auditoría son inmutables.');
        });

        static::deleting(function (): never {
            throw new LogicException('Los registros de auditoría son inmutables.');
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
