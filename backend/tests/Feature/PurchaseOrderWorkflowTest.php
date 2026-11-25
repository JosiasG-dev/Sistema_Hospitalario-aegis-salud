<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseOrderWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_area_manager_can_request_merchandise_with_valid_supplier_and_admin_cannot_create_orders(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $almacen = User::factory()->create(['role' => 'almacen', 'name' => 'Encargado Almacén']);
        $enfermeria = User::factory()->create(['role' => 'enfermeria', 'name' => 'Jefa Enfermería']);

        $adminOrder = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/purchase-orders', [
                'supplier' => 'Insumos Quirúrgicos Aegis MedTech',
                'itemName' => 'Gasas estériles',
                'category' => 'Insumos hospitalarios',
                'unit' => 'caja',
                'quantity' => 10,
                'unitCost' => 45.00,
                'requestedAt' => today()->toDateString(),
            ])
            ->assertCreated()
            ->json();

        $this->assertSame('Aprobada', $adminOrder['status']);

        // Unknown free-text supplier must be rejected
        $this->actingAs($almacen, 'sanctum')
            ->postJson('/api/purchase-orders', [
                'supplier' => 'Proveedor Inventado Libre',
                'itemName' => 'Gasas estériles',
                'category' => 'Insumos hospitalarios',
                'unit' => 'caja',
                'quantity' => 10,
                'unitCost' => 45.00,
                'requestedAt' => today()->toDateString(),
            ])
            ->assertUnprocessable();

        // Supplier from another category must be rejected
        $this->actingAs($almacen, 'sanctum')
            ->postJson('/api/purchase-orders', [
                'supplier' => 'Alimentos Frescos La Huerta S.A.',
                'itemName' => 'Gasas estériles',
                'category' => 'Insumos hospitalarios',
                'unit' => 'caja',
                'quantity' => 10,
                'unitCost' => 45.00,
                'requestedAt' => today()->toDateString(),
            ])
            ->assertUnprocessable();

        // Valid area request by enfermeria
        $created = $this->actingAs($enfermeria, 'sanctum')
            ->postJson('/api/purchase-orders', [
                'supplier' => 'Insumos Quirúrgicos Aegis MedTech',
                'itemName' => 'Cubrebocas N95',
                'category' => 'Insumos hospitalarios',
                'unit' => 'caja',
                'quantity' => 20,
                'unitCost' => 120.00,
                'requestedAt' => today()->toDateString(),
            ])
            ->assertCreated()
            ->json();

        $this->assertSame('Solicitada', $created['status']);
        $this->assertSame('Enfermería', $created['requestedArea']);

        // Almacen cannot self-approve a Solicitada request
        $this->actingAs($almacen, 'sanctum')
            ->patchJson('/api/purchase-orders/'.$created['id'], ['status' => 'Aprobada'])
            ->assertForbidden();

        // Admin approves, almacen registers purchase (Por confirmar), cannot finalize directly, admin confirms final Recibida
        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/purchase-orders/'.$created['id'], ['status' => 'Aprobada'])
            ->assertOk()
            ->assertJsonPath('status', 'Aprobada');

        $this->actingAs($almacen, 'sanctum')
            ->patchJson('/api/purchase-orders/'.$created['id'], ['status' => 'Por confirmar'])
            ->assertOk()
            ->assertJsonPath('status', 'Por confirmar');

        $this->actingAs($almacen, 'sanctum')
            ->patchJson('/api/purchase-orders/'.$created['id'], ['status' => 'Recibida'])
            ->assertForbidden();

        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/purchase-orders/'.$created['id'], ['status' => 'Recibida'])
            ->assertOk()
            ->assertJsonPath('status', 'Recibida');

        $this->assertDatabaseHas('inventory_items', [
            'name' => 'Cubrebocas N95',
            'category' => 'Insumos hospitalarios',
            'stock' => 20,
        ]);
    }
}
