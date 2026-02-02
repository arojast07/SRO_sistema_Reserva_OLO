import { supabase } from '../lib/supabase';

export interface Reservation {
  id: string;
  org_id: string;
  dock_id: string;
  start_datetime: string;
  end_datetime: string;
  dua: string;
  invoice: string;
  driver: string;
  status_id: string | null;
  notes: string | null;
  transport_type: string | null;
  cargo_type: string | null;
  is_cancelled: boolean;
  cancel_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;

  purchase_order?: string | null;
  truck_plate?: string | null;
  order_request_number?: string | null;
  shipper_provider?: string | null;
  recurrence?: any | null;

  status?: {
    name: string;
    code: string;
    color: string;
  };
}

export interface DockTimeBlock {
  id: string;
  org_id: string;
  dock_id: string;
  start_datetime: string;
  end_datetime: string;
  reason: string;
  created_by: string;
  created_at: string;
  creator?: {
    name: string;
    email: string;
  };
}

export interface Dock {
  id: string;
  org_id: string;
  name: string;
  category_id: string | null;
  status_id: string | null;
  is_active: boolean;
  warehouse_id?: string | null;
  category?: {
    name: string;
    code: string;
    color: string;
  };
  status?: {
    name: string;
    code: string;
    color: string;
    is_blocking: boolean;
  };
}

export interface Warehouse {
  id: string;
  org_id: string;
  name: string;
  location: string | null;

  // ✅ NUEVO: horario configurable del almacén
  business_start_time: string; // 'HH:MM:SS'
  business_end_time: string;   // 'HH:MM:SS'
  slot_interval_minutes: number; // 15 | 30 | 60
}

export const calendarService = {
  async getReservations(orgId: string, startDate: string, endDate: string): Promise<Reservation[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        status:reservation_statuses(name, code, color)
      `)
      .eq('org_id', orgId)
      .eq('is_cancelled', false)
      .gte('start_datetime', startDate)
      .lte('start_datetime', endDate)
      .order('start_datetime', { ascending: true });

    if (error) {
      console.error('[Calendar] reservationsError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    return data || [];
  },

  async getDockTimeBlocks(orgId: string, startDate: string, endDate: string): Promise<DockTimeBlock[]> {
    const { data, error } = await supabase
      .from('dock_time_blocks')
      .select('*')
      .eq('org_id', orgId)
      .gte('start_datetime', startDate)
      .lte('start_datetime', endDate)
      .order('start_datetime', { ascending: true });

    if (error) {
      console.error('[Calendar] blocksError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    if (data && data.length > 0) {
      const creatorIds = [...new Set(data.map((b) => b.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', creatorIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return data.map((block) => ({
        ...block,
        creator: profileMap.get(block.created_by) || undefined,
      }));
    }

    return data || [];
  },

  async getDocks(orgId: string, warehouseId?: string | null): Promise<Dock[]> {
    let query = supabase
      .from('docks')
      .select(`
        *,
        category:dock_categories(name, code, color),
        status:dock_statuses(name, code, color, is_blocking)
      `)
      .eq('org_id', orgId)
      .eq('is_active', true);

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[Calendar] docksError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    return data || [];
  },

  async getWarehouses(orgId: string): Promise<Warehouse[]> {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, org_id, name, location, business_start_time, business_end_time, slot_interval_minutes')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Calendar] warehousesError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    console.log('[Calendar] warehouses loaded', { count: data?.length || 0 });
    return (data || []) as Warehouse[];
  },

  async createReservation(reservation: Partial<Reservation>): Promise<Reservation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('reservations')
      .insert({
        ...reservation,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(`
        *,
        status:reservation_statuses(name, code, color)
      `)
      .single();

    if (error) {
      console.error('[Calendar] createReservationError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: reservation,
      });
      throw error;
    }

    return data;
  },

  async updateReservation(id: string, updates: Partial<Reservation>): Promise<Reservation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('reservations')
      .update({
        ...updates,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        status:reservation_statuses(name, code, color)
      `)
      .single();

    if (error) {
      console.error('[Calendar] updateReservationError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: updates,
      });
      throw error;
    }

    return data;
  },

  async cancelReservation(id: string, reason: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { error } = await supabase
      .from('reservations')
      .update({
        is_cancelled: true,
        cancel_reason: reason,
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[Calendar] cancelReservationError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
  },

  async deleteReservation(id: string): Promise<void> {
    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Calendar] deleteReservationError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
  },

  async createDockTimeBlock(block: Partial<DockTimeBlock>): Promise<DockTimeBlock> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('dock_time_blocks')
      .insert({
        org_id: block.org_id,
        dock_id: block.dock_id,
        start_datetime: block.start_datetime,
        end_datetime: block.end_datetime,
        reason: block.reason,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[Calendar] createBlockError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single();

    return {
      ...data,
      creator: profile || undefined,
    };
  },

  async deleteDockTimeBlock(id: string): Promise<void> {
    const { error } = await supabase
      .from('dock_time_blocks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Calendar] deleteBlockError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
  },

  async getReservationStatuses(orgId: string) {
    const { data, error } = await supabase
      .from('reservation_statuses')
      .select('*')
      .eq('org_id', orgId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[Calendar] statusesError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    return data || [];
  },

  async getDockCategories(orgId: string) {
    const { data, error } = await supabase
      .from('dock_categories')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Calendar] categoriesError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    return data || [];
  },
};

