<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HospitalNotification;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Services\BillingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BillingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Invoice::with(['patient', 'payments'])->orderByDesc('issued_at')->get()
            ->map(fn (Invoice $invoice): array => $this->payload($invoice)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'patientId' => ['required', 'exists:patients,id'],
            'description' => ['required', 'string', 'max:255'],
            'total' => ['required', 'numeric', 'gt:0', 'max:9999999999'],
            'discount' => ['nullable', 'numeric', 'min:0', 'lte:total'],
            'masterPassword' => ['nullable', 'string'],
        ]);
        $discount = (float) ($data['discount'] ?? 0);
        $isAdmin = $request->user()->role === 'admin';
        if ($discount > 0 && ! $isAdmin) {
            throw ValidationException::withMessages(['discount' => ['Solo Administración puede autorizar descuentos.']]);
        }
        if ($discount > 0 && ! Hash::check($data['masterPassword'] ?? '', $request->user()->password)) {
            throw ValidationException::withMessages(['masterPassword' => ['La contraseña de Administración no es válida.']]);
        }
        $patient = \App\Models\Patient::findOrFail($data['patientId']);
        $invoice = app(BillingService::class)->createPatientCharge(
            $patient,
            $data['description'],
            (float) $data['total'],
            (int) $request->user()->id,
            $discount,
        );
        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Cobro',
            'action' => 'Ficha de cobro creada', 'entity_id' => $invoice->id,
            'entity_name' => $invoice->description, 'occurred_at' => now(),
        ]);

        return response()->json($this->payload($invoice->load(['patient', 'payments'])), 201);
    }

    public function pay(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999'],
            'method' => ['required', Rule::in(['Efectivo', 'Tarjeta', 'Transferencia', 'Otro'])],
            'reference' => ['nullable', 'string', 'max:120'],
        ]);
        $invoice = DB::transaction(function () use ($request, $data, $id): Invoice {
            $invoice = Invoice::whereKey($id)->lockForUpdate()->firstOrFail();
            $paid = (float) $invoice->payments()->sum('amount');
            $balance = round((float) $invoice->patient_copay - $paid, 2);
            if ($invoice->status === 'Cancelada' || (float) $data['amount'] > $balance) {
                throw ValidationException::withMessages(['amount' => ['El pago excede el saldo pendiente o la ficha está cancelada.']]);
            }
            InvoicePayment::create([
                'id' => 'PAG-'.strtoupper(Str::random(8)), 'invoice_id' => $invoice->id,
                'amount' => $data['amount'], 'method' => $data['method'],
                'reference' => $data['reference'] ?? null, 'paid_at' => now(),
                'created_by' => $request->user()->id,
            ]);
            $newPaid = round($paid + (float) $data['amount'], 2);
            $invoice->status = $newPaid >= (float) $invoice->patient_copay ? 'Pagada' : 'Parcial';
            $invoice->save();
            return $invoice->fresh(['patient', 'payments']);
        });
        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Cobro',
            'action' => 'Pago registrado', 'entity_id' => $invoice->id,
            'entity_name' => $invoice->description, 'details' => $data['amount'].' '.$data['method'],
            'occurred_at' => now(),
        ]);
        HospitalNotification::create([
            'title' => 'Pago registrado', 'body' => 'Se registró un pago en una ficha de cobro.',
            'type' => 'cobros',
        ]);

        return response()->json($this->payload($invoice));
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'masterPassword' => ['required', 'string'],
            'reason' => ['required', 'string', 'min:10', 'max:500'],
        ]);
        if (! Hash::check($data['masterPassword'], $request->user()->password)) {
            throw ValidationException::withMessages(['masterPassword' => ['La contraseña de Administración no es válida.']]);
        }
        $invoice = DB::transaction(function () use ($id): Invoice {
            $invoice = Invoice::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($invoice->payments()->exists()) {
                throw ValidationException::withMessages([
                    'invoice' => ['No se puede cancelar una ficha con pagos registrados; use el proceso de reembolso.'],
                ]);
            }
            if ($invoice->status === 'Cancelada') {
                throw ValidationException::withMessages(['invoice' => ['La ficha ya está cancelada.']]);
            }
            $invoice->status = 'Cancelada';
            $invoice->save();
            return $invoice;
        });
        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Cobro',
            'action' => 'Ficha de cobro cancelada', 'entity_id' => $invoice->id,
            'entity_name' => $invoice->description, 'reason' => $data['reason'],
            'occurred_at' => now(),
        ]);

        return response()->json($this->payload($invoice->load(['patient', 'payments'])));
    }

    private function payload(Invoice $invoice): array
    {
        $payments = $invoice->payments ?? collect();
        $paid = (float) $payments->sum('amount');
        $total = (float) $invoice->total;
        $discount = (float) $invoice->discount;
        $insuranceCoverage = (float) $invoice->insurance_coverage;
        $patientCopay = (float) $invoice->patient_copay;
        return [
            'id' => $invoice->id, 'patientId' => $invoice->patient_id,
            'patientName' => trim(($invoice->patient?->first_name ?? '').' '.($invoice->patient?->last_name ?? '')),
            'description' => $invoice->description, 'total' => $total,
            'discount' => $discount, 'netTotal' => round($total - $discount, 2),
            'insuranceCoverage' => $insuranceCoverage, 'patientCopay' => $patientCopay,
            'paid' => $paid, 'balance' => round($patientCopay - $paid, 2),
            'status' => $invoice->status, 'issuedAt' => $invoice->issued_at?->format('Y-m-d'),
            'payments' => $payments->map(fn (InvoicePayment $payment): array => [
                'id' => $payment->id, 'amount' => (float) $payment->amount,
                'method' => $payment->method, 'reference' => $payment->reference,
                'paidAt' => $payment->paid_at?->toIso8601String(),
            ]),
        ];
    }
}
