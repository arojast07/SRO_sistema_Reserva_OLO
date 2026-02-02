import { supabase } from '../lib/supabase';
import type { CreateCasetillaIngresoInput, CasetillaIngreso } from '../types/casetilla';

type PendingReservationRow = {
  id: string;
  dua: string;
  driver: string;
  truck_plate: string | null;
  purchase_order: string | null;
  order_request_number: string | null;
  shipper_provider: string | null;
  dock_id: string;
  created_at: string;
  status_id: string | null;
  is_cancelled: boolean | null;
};

class CasetillaService {
  // helper: obtener status_id por code o name, intentando con org_id si existe
  private async getStatusIdFlexible(params: {
    orgId: string;
    codes?: string[];
    names?: string[];
  }): Promise<string | null> {
    const { orgId, codes = [], names = [] } = params;

    // 1) intentamos por code con org_id (si aplica)
    for (const code of codes) {
      // try with org_id
      {
        const q = supabase
          .from('reservation_statuses')
          .select('id')
          .eq('code', code)
          .eq('org_id', orgId)
          .limit(1);

        const { data, error } = await q;
        if (!error && data && data.length > 0) return data[0].id;
      }

      // try without org_id (tu caso actual)
      {
        const q = supabase.from('reservation_statuses').select('id').eq('code', code).limit(1);
        const { data, error } = await q;
        if (!error && data && data.length > 0) return data[0].id;
      }
    }

    // 2) intentamos por name con org_id (si aplica) y luego sin org_id
    for (const name of names) {
      {
        const q = supabase
          .from('reservation_statuses')
          .select('id')
          .eq('name', name)
          .eq('org_id', orgId)
          .limit(1);

        const { data, error } = await q;
        if (!error && data && data.length > 0) return data[0].id;
      }

      {
        const q = supabase.from('reservation_statuses').select('id').eq('name', name).limit(1);
        const { data, error } = await q;
        if (!error && data && data.length > 0) return data[0].id;
      }
    }

    return null;
  }

  async createIngreso(orgId: string, userId: string, data: CreateCasetillaIngresoInput) {
    try {
      // 1) Buscar reserva que coincida con DUA + Matrícula (truck_plate)
      const { data: matchingReservations, error: searchError } = await supabase
        .from('reservations')
        .select('id,status_id')
        .eq('org_id', orgId)
        .eq('dua', data.dua)
        .eq('truck_plate', data.matricula)
        .eq('is_cancelled', false)
        .limit(1);

      if (searchError) throw searchError;

      let reservationId: string | undefined;
      let reservationUpdated = false;

      if (matchingReservations && matchingReservations.length > 0) {
        reservationId = matchingReservations[0].id;

        // 2) Status destino: LLEGO_AL_ALMACEN (si existe)
        const arrivedStatusId = await this.getStatusIdFlexible({
          orgId,
          codes: ['LLEGO_AL_ALMACEN'],
          names: ['LLegó al almacén', 'Llegó al almacén', 'LLEGO_AL_ALMACEN']
        });

        if (arrivedStatusId) {
          const { error: updateError } = await supabase
            .from('reservations')
            .update({
              status_id: arrivedStatusId,
              updated_by: userId,
              updated_at: new Date().toISOString()
            })
            .eq('id', reservationId)
            .eq('org_id', orgId);

          if (!updateError) reservationUpdated = true;
        }
      }

      // 3) Crear registro casetilla
      const { data: ingreso, error: ingresoError } = await supabase
        .from('casetilla_ingresos')
        .insert({
          org_id: orgId,
          chofer: data.chofer,
          matricula: data.matricula,
          dua: data.dua,
          factura: data.factura,
          orden_compra: data.orden_compra,
          numero_pedido: data.numero_pedido,
          reservation_id: reservationId,
          created_by: userId
        })
        .select()
        .single();

      if (ingresoError) throw ingresoError;

      return {
        ingreso,
        reservationFound: !!reservationId,
        reservationUpdated
      };
    } catch (error) {
      console.error('Error creating casetilla ingreso:', error);
      throw error;
    }
  }

  async getIngresos(orgId: string) {
    try {
      const { data, error } = await supabase
        .from('casetilla_ingresos')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CasetillaIngreso[];
    } catch (error) {
      console.error('Error fetching casetilla ingresos:', error);
      throw error;
    }
  }

  async getPendingReservations(orgId: string) {
    try {
      // 1) Status PENDING (tu tabla tiene code PENDING)
      const pendingStatusId = await this.getStatusIdFlexible({
        orgId,
        codes: ['PENDING'],
        names: ['Pendiente', 'PENDIENTE']
      });

      if (!pendingStatusId) {
        // si no existe PENDING, devolvemos vacío sin romper
        return [];
      }

      // 2) Reservas pendientes (campos reales)
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select(
          `
          id,
          org_id,
          dua,
          driver,
          truck_plate,
          purchase_order,
          order_request_number,
          shipper_provider,
          dock_id,
          created_at,
          status_id,
          is_cancelled
        `
        )
        .eq('org_id', orgId)
        .eq('status_id', pendingStatusId)
        .eq('is_cancelled', false)
        .order('created_at', { ascending: false });

      if (reservationsError) throw reservationsError;
      if (!reservations || reservations.length === 0) return [];

      const rows = reservations as PendingReservationRow[];

      // 3) Docks (para derivar warehouse)
      const dockIds = [...new Set(rows.map((r) => r.dock_id).filter(Boolean))];

      let docksMap = new Map<string, { name?: string; warehouse_id?: string | null }>();

      if (dockIds.length > 0) {
        const { data: docksData } = await supabase
          .from('docks')
          .select('id,name,warehouse_id')
          .in('id', dockIds);

        (docksData ?? []).forEach((d: any) => {
          docksMap.set(d.id, { name: d.name, warehouse_id: d.warehouse_id ?? null });
        });
      }

      // 4) Warehouses (si existe la tabla, la usamos; si no, cae a N/A)
      const warehouseIds = [
        ...new Set(
          [...docksMap.values()]
            .map((d) => d.warehouse_id)
            .filter(Boolean) as string[]
        )
      ];

      let warehousesMap = new Map<string, string>();

      if (warehouseIds.length > 0) {
        const { data: warehousesData, error: warehousesError } = await supabase
          .from('warehouses')
          .select('id,name')
          .in('id', warehouseIds);

        if (!warehousesError) {
          (warehousesData ?? []).forEach((w: any) => {
            warehousesMap.set(w.id, w.name);
          });
        }
      }

      // 5) Map final para UI (nombres esperados por tu grid)
      return rows.map((r) => {
        const dock = docksMap.get(r.dock_id);
        const whName = dock?.warehouse_id ? warehousesMap.get(dock.warehouse_id) : null;

        return {
          id: r.id,
          dua: r.dua,
          placa: r.truck_plate ?? '',
          chofer: r.driver ?? '',
          orden_compra: r.purchase_order ?? '',
          numero_pedido: r.order_request_number ?? '',
          provider_name: r.shipper_provider ?? 'N/A',
          warehouse_name: whName ?? 'N/A',
          created_at: r.created_at
        };
      });
    } catch (error) {
      console.error('Error fetching pending reservations:', error);
      throw error;
    }
  }

  async searchPendingReservations(orgId: string, searchTerm: string) {
    try {
      const allReservations = await this.getPendingReservations(orgId);

      if (!searchTerm.trim()) return allReservations;

      const term = searchTerm.toLowerCase();

      return allReservations.filter((r: any) =>
        (r.dua ?? '').toLowerCase().includes(term) ||
        (r.chofer ?? '').toLowerCase().includes(term) ||
        (r.provider_name ?? '').toLowerCase().includes(term) ||
        (r.placa ?? '').toLowerCase().includes(term) ||
        (r.orden_compra ?? '').toLowerCase().includes(term)
      );
    } catch (error) {
      console.error('Error searching pending reservations:', error);
      throw error;
    }
  }
}

export const casetillaService = new CasetillaService();

