// Tipos para el módulo Casetilla
export interface CreateCasetillaIngresoInput {
  chofer: string;
  matricula: string;
  dua: string;
  factura: string;
  orden_compra?: string;
  numero_pedido?: string;
}

export interface CasetillaIngreso {
  id: string;
  org_id: string;
  chofer: string;
  matricula: string;
  dua: string;
  factura: string;
  orden_compra?: string | null;
  numero_pedido?: string | null;
  reservation_id?: string | null;
  created_by: string;
  created_at: string;
}
