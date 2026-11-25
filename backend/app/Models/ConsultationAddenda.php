<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class ConsultationAddenda extends Model
{
    protected $table = 'consultation_addenda';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'consultation_id',
        'doctor_id',
        'doctor_name',
        'notes',
    ];

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new LogicException('Las adendas clínicas son inmutables.');
        });

        static::deleting(function (): never {
            throw new LogicException('Las adendas clínicas son inmutables.');
        });
    }

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }
}
