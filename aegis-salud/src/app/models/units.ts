export interface MeasurementUnitOption {
  value: string;
  label: string;
}

export const MEASUREMENT_UNITS: MeasurementUnitOption[] = [
  { value: 'pieza', label: 'Pieza' },
  { value: 'unidad', label: 'Unidad' },
  { value: 'par', label: 'Par' },
  { value: 'caja', label: 'Caja' },
  { value: 'paquete', label: 'Paquete' },
  { value: 'rollo', label: 'Rollo' },
  { value: 'bolsa', label: 'Bolsa' },
  { value: 'sobre', label: 'Sobre' },
  { value: 'tableta', label: 'Tableta' },
  { value: 'cápsula', label: 'Cápsula' },
  { value: 'frasco', label: 'Frasco' },
  { value: 'ampolleta', label: 'Ampolleta' },
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'g', label: 'Gramo (g)' },
  { value: 'litro', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'porción', label: 'Porción' },
];
