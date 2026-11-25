<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Patient;
use Illuminate\Support\Str;

class BillingService
{
    public function createPatientCharge(
        Patient $patient,
        string $description,
        float $total,
        int $userId,
        float $discount = 0,
    ): Invoice {
        $netTotal = round($total - $discount, 2);
        $coveragePercent = $patient->insurance_provider
            ? (float) $patient->insurance_coverage_percent
            : 0;
        $insuranceCoverage = round($netTotal * $coveragePercent / 100, 2);
        $patientCopay = round($netTotal - $insuranceCoverage, 2);

        return Invoice::create([
            'id' => 'FAC-'.strtoupper(Str::random(8)),
            'patient_id' => $patient->id,
            'description' => $description,
            'total' => $total,
            'insurance_coverage' => $insuranceCoverage,
            'patient_copay' => $patientCopay,
            'discount' => $discount,
            'authorized_by_master' => $discount > 0,
            'status' => $patientCopay === 0.0 ? 'Pagada' : 'Pendiente',
            'issued_at' => today(),
            'created_by' => $userId,
        ]);
    }
}
