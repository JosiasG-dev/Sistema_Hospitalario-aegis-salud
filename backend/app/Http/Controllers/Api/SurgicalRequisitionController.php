<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Models\SurgicalRequisition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SurgicalRequisitionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(SurgicalRequisition::with(['inventoryItem', 'operation'])
            ->orderByDesc('created_at')->get()->map(fn (SurgicalRequisition $item): array => $this->payload($item)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'operationId' => ['nullable', 'exists:operations,id'],
            'inventoryItemId' => ['required', 'exists:inventory_items,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'purpose' => ['required', 'string', 'min:5', 'max:500'],
        ]);
        $item = InventoryItem::findOrFail($data['inventoryItemId']);
        if ($item->category !== 'Insumos hospitalarios') {
            throw ValidationException::withMessages(['inventoryItemId' => ['Las requisiciones quirúrgicas solo admiten insumos hospitalarios.']]);
        }
        $requisition = SurgicalRequisition::create([
            'id' => 'REQ-'.strtoupper(Str::random(8)),
            'operation_id' => $data['operationId'] ?? null, 'inventory_item_id' => $item->id,
            'quantity' => $data['quantity'], 'purpose' => $data['purpose'],
            'status' => 'Solicitada', 'requested_by' => $request->user()->id,
        ]);
        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Requisición quirúrgica',
            'action' => 'Solicitud registrada', 'entity_id' => $requisition->id,
            'entity_name' => $item->name, 'details' => 'Cantidad: '.$requisition->quantity,
            'occurred_at' => now(),
        ]);

        return response()->json($this->payload($requisition->load(['inventoryItem', 'operation'])), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Aprobada', 'Entregada', 'Rechazada', 'Cancelada'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $requisition = DB::transaction(function () use ($request, $data, $id): SurgicalRequisition {
            $requisition = SurgicalRequisition::whereKey($id)->lockForUpdate()->firstOrFail();
            $allowed = match ($requisition->status) {
                'Solicitada' => in_array($data['status'], ['Aprobada', 'Rechazada', 'Cancelada'], true),
                'Aprobada' => in_array($data['status'], ['Entregada', 'Cancelada'], true),
                default => false,
            };
            if (! $allowed) {
                throw ValidationException::withMessages(['status' => ['Transición no válida para esta requisición.']]);
            }
            if ($data['status'] === 'Entregada') {
                $item = InventoryItem::whereKey($requisition->inventory_item_id)->lockForUpdate()->firstOrFail();
                if ($item->stock < $requisition->quantity) {
                    throw ValidationException::withMessages(['status' => ['No hay existencias suficientes para entregar el material.']]);
                }
                $item->decrement('stock', $requisition->quantity);
            }
            $requisition->status = $data['status'];
            $requisition->notes = $data['notes'] ?? $requisition->notes;
            $requisition->resolved_by = $request->user()->id;
            $requisition->save();
            return $requisition->load(['inventoryItem', 'operation']);
        });
        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Requisición quirúrgica',
            'action' => $data['status'], 'entity_id' => $requisition->id,
            'entity_name' => $requisition->inventoryItem?->name ?? 'Material quirúrgico',
            'details' => 'Cantidad: '.$requisition->quantity, 'occurred_at' => now(),
        ]);

        return response()->json($this->payload($requisition));
    }

    private function payload(SurgicalRequisition $item): array
    {
        return [
            'id' => $item->id, 'operationId' => $item->operation_id,
            'operation' => $item->operation?->procedure,
            'inventoryItemId' => $item->inventory_item_id,
            'itemName' => $item->inventoryItem?->name,
            'quantity' => $item->quantity, 'purpose' => $item->purpose,
            'status' => $item->status, 'notes' => $item->notes,
        ];
    }
}
