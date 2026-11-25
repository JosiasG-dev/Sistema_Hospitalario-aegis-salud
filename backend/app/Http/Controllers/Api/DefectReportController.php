<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DefectReport;
use App\Models\HospitalNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DefectReportController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(DefectReport::orderByDesc('created_at')->limit(500)->get()
            ->map(fn (DefectReport $defect): array => $this->payload($defect)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:180'],
            'description' => ['required', 'string', 'min:10', 'max:10000'],
            'impact' => ['required', Rule::in(['Sin impacto', 'Bajo', 'Moderado', 'Alto', 'Crítico'])],
            'priority' => ['required', Rule::in(['Baja', 'Media', 'Alta', 'Crítica'])],
        ]);
        $defect = DefectReport::create([
            'id' => 'BUG-'.strtoupper(Str::random(8)), ...$data,
            'status' => 'Abierto', 'reported_by' => $request->user()->id,
        ]);
        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Defecto',
            'action' => 'Reporte creado', 'entity_id' => $defect->id,
            'entity_name' => $defect->title, 'occurred_at' => now(),
        ]);
        HospitalNotification::create([
            'title' => 'Nuevo defecto reportado', 'body' => 'Se registró un reporte de calidad de software.',
            'type' => 'calidad',
        ]);

        return response()->json($this->payload($defect), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Abierto', 'En curso', 'Resuelto', 'No reproducible'])],
            'resolution' => ['required_if:status,Resuelto,No reproducible', 'nullable', 'string', 'min:5', 'max:10000'],
        ]);
        $defect = DefectReport::findOrFail($id);
        $defect->status = $data['status'];
        if (in_array($data['status'], ['Resuelto', 'No reproducible'], true)) {
            if (! isset($data['resolution'])) {
                throw ValidationException::withMessages(['resolution' => ['Describa el resultado o la solución aplicada.']]);
            }
            $defect->resolution = $data['resolution'];
            $defect->resolved_at = now();
            $defect->resolved_by = $request->user()->id;
            $defect->resolution_minutes = max(0, $defect->created_at->diffInMinutes(now()));
        } else {
            $defect->resolved_at = null;
            $defect->resolved_by = null;
            $defect->resolution_minutes = null;
        }
        $defect->save();
        AuditLog::create([
            'user_id' => $request->user()->id, 'entity_type' => 'Defecto',
            'action' => $data['status'], 'entity_id' => $defect->id,
            'entity_name' => $defect->title, 'details' => $defect->resolution,
            'occurred_at' => now(),
        ]);

        return response()->json($this->payload($defect));
    }

    private function payload(DefectReport $defect): array
    {
        return [
            'id' => $defect->id, 'title' => $defect->title, 'description' => $defect->description,
            'impact' => $defect->impact, 'priority' => $defect->priority, 'status' => $defect->status,
            'resolution' => $defect->resolution, 'resolutionMinutes' => $defect->resolution_minutes,
            'createdAt' => $defect->created_at?->toIso8601String(),
            'resolvedAt' => $defect->resolved_at?->toIso8601String(),
        ];
    }
}
