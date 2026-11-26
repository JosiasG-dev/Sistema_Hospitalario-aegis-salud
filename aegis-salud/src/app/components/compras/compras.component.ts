import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryCategory, PurchaseOrderRecord, SupplierRecord } from '../../models/operational-records.model';
import { MEASUREMENT_UNITS } from '../../models/units';
import { OperationalRecordsService } from '../../services/operational-records.service';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { FormDraftService } from '../../services/form-draft.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <section class="module-page operational-module">
      <header class="module-heading">
        <div>
          <span class="module-kicker">ABASTECIMIENTO</span>
          <h2>{{ isAdmin ? 'Autorización de Solicitudes de Mercancía' : 'Solicitudes de Mercancía y Compras' }}</h2>
          <p>
            {{ isAdmin
              ? 'Revisa y autoriza las solicitudes de mercancía enviadas por los encargados de cada área.'
              : 'Envía solicitudes de mercancía al administrador seleccionando un proveedor autorizado por categoría.' }}
          </p>
        </div>
      </header>
      <div class="operational-summary" aria-label="Resumen de compras">
        <article class="operational-stat">
          <span>Solicitudes registradas</span>
          <strong>{{ records.purchaseOrders().length }}</strong>
        </article>
        <article class="operational-stat attention">
          <span>Pendientes de autorización</span>
          <strong>{{ requestedOrdersCount }}</strong>
        </article>
        <article class="operational-stat">
          <span>Aprobadas por recibir</span>
          <strong>{{ approvedOrdersCount }}</strong>
        </article>
        <article class="operational-stat success">
          <span>Compras recibidas</span>
          <strong>{{ receivedOrdersCount }}</strong>
        </article>
      </div>
      <div class="module-alert">
        @if (isAdmin) {
          <strong>Modo Administrador:</strong> Administración tiene la primera y la última palabra: puede generar pedidos directos a Almacén, autorizar solicitudes entrantes y confirmar finalmente los pedidos registrados por Almacén.
        } @else {
          Almacén y Compras toman los pedidos aprobados, registran su compra/entrega y los envían a Administración para su confirmación final.
        }
      </div>

      <form class="module-panel" appFormDraft="compras:nueva" appFormValidation [appFormValidationError]="records.storageError()" (appFormValidationDismiss)="records.clearError()" (ngSubmit)="create()">
        <h3>{{ isAdmin ? 'Realizar pedido a Almacén' : 'Solicitar mercancía' }}</h3>
          <div class="module-form-grid">
            <div class="module-field">
              <label for="purchase-category">Categoría *</label>
              <select id="purchase-category" [(ngModel)]="form.category" name="category" required (ngModelChange)="onCategoryChange()">
                <option value="Alimentos">Alimentos</option>
                <option value="Insumos hospitalarios">Insumos hospitalarios</option>
                <option value="Medicamentos">Medicamentos</option>
              </select>
            </div>
            <div class="module-field">
              <label for="purchase-supplier">Proveedor autorizado *</label>
              <select id="purchase-supplier" [(ngModel)]="form.supplier" name="supplier" required>
                <option value="" disabled>Seleccione un proveedor...</option>
                @for (sup of availableSuppliers; track sup.id) {
                  <option [value]="sup.name">{{ sup.name }}</option>
                }
              </select>
            </div>
            <div class="module-field">
              <label for="purchase-item">Artículo *</label>
              <input id="purchase-item" [(ngModel)]="form.itemName" name="itemName" maxlength="120" required />
            </div>
            <div class="module-field">
              <label for="purchase-unit">Unidad de medida *</label>
              <select id="purchase-unit" [(ngModel)]="form.unit" name="unit" required>
                <option value="" disabled>Seleccione una unidad...</option>
                @for (u of measurementUnits; track u.value) {
                  <option [value]="u.value">{{ u.label }}</option>
                }
              </select>
            </div>
            <div class="module-field">
              <label for="purchase-quantity">Cantidad *</label>
              <input id="purchase-quantity" type="number" min="1" step="1" [(ngModel)]="form.quantity" name="quantity" required />
            </div>
            <div class="module-field">
              <label for="purchase-cost">Costo unitario *</label>
              <input id="purchase-cost" type="number" min="0" step="0.01" [(ngModel)]="form.unitCost" name="unitCost" required />
            </div>
            <div class="module-field">
              <label for="purchase-date">Fecha de solicitud *</label>
              <input id="purchase-date" type="date" [(ngModel)]="form.requestedAt" name="requestedAt" required />
            </div>
          </div>
          <button class="module-submit" type="submit" [disabled]="!form.supplier">
            {{ isAdmin ? 'Enviar pedido a Almacén' : 'Enviar solicitud al administrador' }}
          </button>
        </form>

      <div class="module-filter-bar">
        <div class="search-box">
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input 
            type="text" 
            placeholder="Buscar por artículo, proveedor, solicitante o ID..." 
            [(ngModel)]="searchQuery" 
            class="search-input" />
        </div>
      </div>

      <section class="module-records" aria-label="Solicitudes de compra">
        @for (record of filteredPurchaseOrders; track record.id) {
          <article class="module-record">
            <div class="module-record-head">
              <h3>{{ record.itemName }} <span class="module-muted">· {{ record.id }}</span></h3>
              <span class="module-badge" [ngClass]="{'badge-success': record.status === 'Recibida', 'badge-danger': record.status === 'Cancelada', 'badge-info': record.status === 'Aprobada', 'badge-warning': record.status === 'Por confirmar' || record.status === 'Solicitada'}">{{ record.status }}</span>
            </div>
            @if (record.requestedByName || record.requestedArea) {
              <p><strong>Área solicitante:</strong> {{ record.requestedArea || 'Área operativa' }} @if (record.requestedByName) { ({{ record.requestedByName }}) }</p>
            }
            <p><strong>Proveedor:</strong> {{ record.supplier }} · <strong>Categoría:</strong> {{ record.category }}</p>
            <p><strong>Cantidad:</strong> {{ record.quantity }} {{ record.unit }} · <strong>Costo unitario:</strong> {{ record.unitCost | currency:'MXN':'symbol':'1.2-2' }}</p>
            <p><strong>Total estimado:</strong> {{ record.quantity * record.unitCost | currency:'MXN':'symbol':'1.2-2' }} · <strong>Solicitud:</strong> {{ record.requestedAt }}</p>

            @if (record.status === 'Solicitada') {
              @if (canApprove) {
                <div class="module-record-foot">
                  <button type="button" class="module-submit" (click)="changeStatus(record.id, 'Aprobada')">Autorizar solicitud</button>
                  <button type="button" class="module-button-danger" (click)="changeStatus(record.id, 'Cancelada')">Rechazar</button>
                </div>
              } @else {
                <p class="module-muted"><strong>Estado:</strong> Pendiente de autorización del administrador.</p>
              }
            } @else if (record.status === 'Aprobada') {
              @if (canReceive) {
                <div class="module-record-foot">
                  <button type="button" class="module-submit" (click)="changeStatus(record.id, 'Por confirmar')">Registrar compra en almacén</button>
                  @if (canApprove) {
                    <button type="button" class="module-button-danger" (click)="changeStatus(record.id, 'Cancelada')">Cancelar</button>
                  }
                </div>
              } @else {
                <p class="module-muted"><strong>Estado:</strong> Aprobada · En espera de compra/registro en almacén.</p>
              }
            } @else if (record.status === 'Por confirmar') {
              @if (isAdmin) {
                <div class="module-record-foot">
                  <button type="button" class="module-submit module-button-success" (click)="changeStatus(record.id, 'Recibida')">Confirmar pedido correcto (Finalizar)</button>
                  <button type="button" class="module-button-danger" (click)="changeStatus(record.id, 'Cancelada')">Rechazar</button>
                </div>
              } @else {
                <p class="module-muted"><strong>Estado:</strong> Registrado por Almacén · Pendiente de confirmación final de Administración.</p>
              }
            } @else if (record.status === 'Recibida') {
              <p style="color: #15803d; font-weight: 600;">Recepción confirmada: existencias agregadas al almacén.</p>
            } @else {
              <p style="color: #b91c1c; font-weight: 600;">Solicitud rechazada / cancelada: no se agregó al inventario.</p>
            }
          </article>
        } @empty {
          <div class="module-empty">Aún no hay solicitudes de mercancía registradas.</div>
        }
      </section>
    </section>
  `
})
export class ComprasComponent {
  readonly records = inject(OperationalRecordsService);
  readonly drafts = inject(FormDraftService);
  readonly auth = inject(AuthService);
  readonly measurementUnits = MEASUREMENT_UNITS;
  searchQuery = '';

  form = {
    supplier: '',
    itemName: '',
    category: 'Insumos hospitalarios' as InventoryCategory,
    unit: '',
    quantity: 1,
    unitCost: 0,
    requestedAt: this.today(),
    status: 'Solicitada' as const
  };

  get isAdmin(): boolean {
    return this.auth.hasRole('admin');
  }

  get canApprove(): boolean {
    return this.auth.hasRole('admin', 'compras');
  }

  get canReceive(): boolean {
    return this.auth.hasRole('almacen', 'compras', 'admin');
  }

  get availableSuppliers(): SupplierRecord[] {
    return this.records.suppliers().filter(s => s.category === this.form.category);
  }

  get requestedOrdersCount(): number {
    return this.records.purchaseOrders().filter(order => order.status === 'Solicitada').length;
  }

  get approvedOrdersCount(): number {
    return this.records.purchaseOrders().filter(order => order.status === 'Aprobada').length;
  }

  get receivedOrdersCount(): number {
    return this.records.purchaseOrders().filter(order => order.status === 'Recibida').length;
  }

  get filteredPurchaseOrders() {
    const q = this.searchQuery.trim().toLowerCase();
    const list = this.records.purchaseOrders();
    if (!q) return list;
    return list.filter(order =>
      order.itemName.toLowerCase().includes(q) ||
      order.supplier.toLowerCase().includes(q) ||
      order.category.toLowerCase().includes(q) ||
      (order.requestedByName && order.requestedByName.toLowerCase().includes(q)) ||
      (order.requestedArea && order.requestedArea.toLowerCase().includes(q)) ||
      order.id.toLowerCase().includes(q) ||
      (order.status && order.status.toLowerCase().includes(q))
    );
  }

  onCategoryChange(): void {
    const valid = this.availableSuppliers.some(s => s.name === this.form.supplier);
    if (!valid) {
      this.form.supplier = '';
    }
  }

  async create(): Promise<void> {
    if (!this.form.supplier) {
      this.records.storageError.set('Seleccione un proveedor autorizado de la lista.');
      return;
    }
    if (await this.records.addPurchaseOrder(this.form)) {
      this.drafts.clear('compras:nueva');
      this.form = {
        supplier: '', itemName: '', category: this.form.category,
        unit: '', quantity: 1, unitCost: 0,
        requestedAt: this.today(), status: 'Solicitada'
      };
    }
  }

  async changeStatus(id: string, status: PurchaseOrderRecord['status']): Promise<void> {
    await this.records.setPurchaseOrderStatus(id, status);
  }

  private today(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
