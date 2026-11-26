import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryCategory } from '../../models/operational-records.model';
import { MEASUREMENT_UNITS } from '../../models/units';
import { OperationalRecordsService } from '../../services/operational-records.service';
import { FormDraftDirective } from '../../services/form-draft.directive';
import { FormValidationDirective } from '../../services/form-validation.directive';
import { FormDraftService } from '../../services/form-draft.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-almacenes',
  standalone: true,
  imports: [CommonModule, FormsModule, FormDraftDirective, FormValidationDirective],
  template: `
    <section class="module-page operational-module">
      <header class="module-heading">
        <div>
          <span class="module-kicker">INVENTARIO Y SUMINISTROS</span>
          <h2>Almacenes</h2>
          <p>Control de existencias por categoría: alimentos, insumos hospitalarios y medicamentos.</p>
        </div>
      </header>
      <div class="module-alert">
        <strong>Cuenta activa:</strong> {{ auth.user()?.name || 'Sin cuenta identificada' }}.
        <strong>Encargado(s) de almacén:</strong> {{ warehouseStaffNames || 'No configurados' }}.
      </div>
      <div class="operational-summary" aria-label="Resumen de almacenes">
        <article class="operational-stat">
          <span>Artículos registrados</span>
          <strong>{{ records.inventory().length }}</strong>
        </article>
        <article class="operational-stat attention">
          <span>Existencias por reabastecer</span>
          <strong>{{ lowStockCount }}</strong>
        </article>
        <article class="operational-stat">
          <span>Medicamentos</span>
          <strong>{{ medicineCount }}</strong>
        </article>
      </div>
      <form class="module-panel" appFormDraft="almacenes:nuevo-articulo" appFormValidation [appFormValidationError]="records.storageError()" (appFormValidationDismiss)="records.clearError()" (ngSubmit)="create()">
        <h3>Registrar artículo</h3>
        <div class="module-form-grid">
          <div class="module-field wide">
            <label for="stock-name">Nombre del artículo *</label>
            <input id="stock-name" [(ngModel)]="form.name" name="name" maxlength="120" required />
          </div>
          <div class="module-field">
            <label for="stock-category">Categoría *</label>
            <select id="stock-category" [(ngModel)]="form.category" name="category" required>
              <option value="Alimentos">Alimentos</option>
              <option value="Insumos hospitalarios">Insumos hospitalarios</option>
              <option value="Medicamentos">Medicamentos</option>
            </select>
          </div>
          <div class="module-field">
            <label for="stock-unit">Unidad de medida *</label>
            <select id="stock-unit" [(ngModel)]="form.unit" name="unit" required>
              <option value="" disabled>Seleccione una unidad...</option>
              @for (u of measurementUnits; track u.value) {
                <option [value]="u.value">{{ u.label }}</option>
              }
            </select>
          </div>
          <div class="module-field">
            <label for="stock-quantity">Existencia inicial *</label>
            <input id="stock-quantity" type="number" min="0" step="1" [(ngModel)]="form.stock" name="stock" required />
          </div>
          <div class="module-field">
            <label for="stock-minimum">Nivel mínimo * <small>(cantidad mínima que debe mantenerse en almacén)</small></label>
            <input id="stock-minimum" type="number" min="0" step="1" [(ngModel)]="form.minimumStock" name="minimumStock" required />
          </div>
          <div class="module-field">
            <label for="stock-cost">Costo unitario ($) *</label>
            <div class="currency-input">
              <span aria-hidden="true">$</span>
              <input id="stock-cost" type="number" min="0" step="0.01" [(ngModel)]="form.unitCost" name="unitCost" required />
            </div>
          </div>
          <div class="module-field">
            <label for="stock-expiry">Caducidad (si aplica)</label>
            <input id="stock-expiry" type="date" [(ngModel)]="form.expirationDate" name="expirationDate"
              [required]="form.category === 'Medicamentos' && form.stock > 0" />
          </div>
          @if (form.category === 'Medicamentos') {
            <div class="module-field">
              <label for="stock-batch">Lote *</label>
              <input id="stock-batch" [(ngModel)]="form.batchCode" name="batchCode"
                [required]="form.stock > 0" maxlength="60" />
            </div>
            <div class="module-field">
              <label for="stock-price">Precio al paciente por unidad</label>
              <input id="stock-price" type="number" min="0" step="0.01" [(ngModel)]="form.unitPrice" name="unitPrice" />
            </div>
            <label class="module-field">
              <span>Medicamento controlado</span>
              <input type="checkbox" [(ngModel)]="form.isControlled" name="isControlled" />
            </label>
          }
        </div>
        <button class="module-submit" type="submit">Guardar artículo</button>
      </form>

      <div class="module-field search-field">
        <label for="stock-search">Buscar en existencias</label>
        <input 
          id="stock-search"
          type="text" 
          placeholder="Buscar artículo por nombre, código o categoría..." 
          [(ngModel)]="searchQuery" />
      </div>

      <div class="module-field">
        <label for="stock-filter">Ver categoría</label>
        <select id="stock-filter" [(ngModel)]="categoryFilter" name="categoryFilter">
          <option value="Todas">Todas las categorías</option>
          <option value="Alimentos">Alimentos</option>
          <option value="Insumos hospitalarios">Insumos hospitalarios</option>
          <option value="Medicamentos">Medicamentos</option>
        </select>
      </div>

      <section class="module-records" aria-label="Existencias">
        @for (item of filteredItems; track item.id) {
          <article class="module-record">
            <div class="module-record-head">
              <h3>{{ item.name }} <span class="module-muted">· {{ item.id }}</span></h3>
              <span class="module-badge">{{ item.category }}</span>
            </div>
            <p [class.module-stock-low]="item.stock <= item.minimumStock">
              <strong>Disponible:</strong> {{ item.stock }} {{ item.unit }}
              <span class="module-muted"> · Mínimo: {{ item.minimumStock }} {{ item.unit }}</span>
              @if (item.stock <= item.minimumStock) { <span> · Reabastecimiento requerido</span> }
            </p>
            <p><strong>Costo unitario:</strong> {{ item.unitCost | currency:'MXN':'symbol':'1.2-2' }}</p>
            @if (item.expirationDate) { <p><strong>Caducidad:</strong> {{ item.expirationDate }}</p> }
            @if (item.isControlled) { <p><span class="module-badge">Controlado: requiere autorización médica adicional</span></p> }
            <div class="module-record-foot">
            <span class="module-muted">{{ item.category === 'Medicamentos' ? 'Recepción por lote FEFO' : 'Ajuste manual de inventario' }}</span>
              <div class="module-stock-actions">
                <button type="button" (click)="adjust(item.id, -1)" [disabled]="item.stock === 0" [attr.aria-label]="'Restar una unidad de ' + item.name">−</button>
              <button type="button" (click)="item.category === 'Medicamentos' ? openBatchForm(item.id) : adjust(item.id, 1)"
                [attr.aria-label]="item.category === 'Medicamentos' ? 'Recibir lote de ' + item.name : 'Sumar una unidad de ' + item.name">+</button>
              </div>
            </div>
            @if (batchItemId === item.id) {
            <form class="module-form-grid" appFormDraft="almacenes:nuevo-lote" appFormValidation [appFormValidationError]="records.storageError()" (appFormValidationDismiss)="records.clearError()" (ngSubmit)="receiveBatch(item.id)">
              <div class="module-field">
                <label [for]="'batch-code-' + item.id">Código de lote *</label>
                <input [id]="'batch-code-' + item.id" [(ngModel)]="batchForm.batchCode" name="batchCode" required maxlength="60" />
              </div>
              <div class="module-field">
                <label [for]="'batch-qty-' + item.id">Cantidad *</label>
                <input [id]="'batch-qty-' + item.id" type="number" min="1" step="1" [(ngModel)]="batchForm.quantity" name="quantity" required />
              </div>
              <div class="module-field">
                <label [for]="'batch-expiry-' + item.id">Caducidad *</label>
                <input [id]="'batch-expiry-' + item.id" type="date" [(ngModel)]="batchForm.expirationDate" name="expirationDate" required />
              </div>
              <div class="module-field">
                <label [for]="'batch-cost-' + item.id">Costo unitario *</label>
                <input [id]="'batch-cost-' + item.id" type="number" min="0" step="0.01" [(ngModel)]="batchForm.unitCost" name="unitCost" required />
              </div>
              <button class="module-submit" type="submit">Registrar lote</button>
              <button type="button" class="module-button-secondary" (click)="batchItemId = ''">Cancelar</button>
            </form>
            }
          </article>
        } @empty {
          <div class="module-empty">No hay artículos en esta categoría. Registre existencias o reciba una compra.</div>
        }
      </section>
    </section>
  `,
  styles: [`.currency-input { display: flex; align-items: center; gap: .45rem; } .currency-input span { font-weight: 700; } .currency-input input { flex: 1; min-width: 0; }`]
})
export class AlmacenesComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly records = inject(OperationalRecordsService);
  readonly drafts = inject(FormDraftService);
  readonly measurementUnits = MEASUREMENT_UNITS;
  categoryFilter: 'Todas' | InventoryCategory = 'Todas';
  searchQuery = '';
  form = {
    name: '',
    category: 'Insumos hospitalarios' as InventoryCategory,
    unit: '',
    stock: 0,
    minimumStock: 0,
    expirationDate: '',
    batchCode: '',
    unitCost: 0,
    unitPrice: 0,
    isControlled: false
  };
  batchItemId = '';
  batchForm = { batchCode: '', quantity: 1, expirationDate: '', unitCost: 0 };

  ngOnInit(): void {
    void this.records.loadAreaStaff();
  }

  get warehouseStaffNames(): string {
    return this.records.areaStaff().almacen.map(staff => staff.name).join(' · ');
  }

  get filteredItems() {
    const q = this.searchQuery.trim().toLowerCase();
    const items = this.categoryFilter === 'Todas'
      ? this.records.inventory()
      : this.records.inventory().filter(item => item.category === this.categoryFilter);

    if (!q) return items;
    return items.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.batchCode && item.batchCode.toLowerCase().includes(q))
    );
  }

  get lowStockCount(): number {
    return this.records.inventory().filter(item => item.stock <= item.minimumStock).length;
  }

  get medicineCount(): number {
    return this.records.inventory().filter(item => item.category === 'Medicamentos').length;
  }

  async create(): Promise<void> {
    if (await this.records.addInventoryItem(this.form)) {
      this.drafts.clear('almacenes:nuevo-articulo');
      this.form = {
        name: '', category: 'Insumos hospitalarios', unit: '',
        stock: 0, minimumStock: 0, expirationDate: '',
        batchCode: '', unitCost: 0, unitPrice: 0, isControlled: false
      };
    }
  }

  async adjust(id: string, amount: number): Promise<void> {
    await this.records.adjustStock(id, amount);
  }

  openBatchForm(id: string): void {
    this.batchItemId = id;
    this.batchForm = { batchCode: '', quantity: 1, expirationDate: '', unitCost: 0 };
  }

  async receiveBatch(id: string): Promise<void> {
    const saved = await this.records.adjustStock(id, this.batchForm.quantity, {
      batchCode: this.batchForm.batchCode,
      expirationDate: this.batchForm.expirationDate,
      unitCost: this.batchForm.unitCost
    });
    if (saved) {
      this.batchItemId = '';
      this.batchForm = { batchCode: '', quantity: 1, expirationDate: '', unitCost: 0 };
      this.drafts.clear('almacenes:nuevo-lote');
    }
  }
}
