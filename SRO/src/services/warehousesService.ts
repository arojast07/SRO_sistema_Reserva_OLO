import { supabase } from '../lib/supabase';
import type { Warehouse, WarehouseFormData } from '../types/warehouse';

const normalizeTime = (t?: string | null, fallback = '06:00:00') => {
  const value = (t || '').trim();
  if (!value) return fallback;
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  return fallback;
};

export const warehousesService = {
  async getWarehouses(orgId: string): Promise<Warehouse[]> {
    console.log('[WarehousesService] getWarehouses', { orgId });

    const { data, error } = await supabase
      .from('warehouses')
      .select('id, org_id, name, location, country_id, business_start_time, business_end_time, slot_interval_minutes, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[WarehousesService] getWarehouses error', {
        error,
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint
      });
      throw error;
    }

    return (data || []) as Warehouse[];
  },

  // Alias para compatibilidad con páginas que esperan getAll()
  async getAll(orgId: string): Promise<Warehouse[]> {
    return this.getWarehouses(orgId);
  },

  async createWarehouse(orgId: string, formData: WarehouseFormData): Promise<Warehouse> {
    console.log('[WarehousesService] createWarehouse', { orgId, name: formData.name });

    if (!formData.country_id) throw new Error('El país es requerido');

    const { data, error } = await supabase
      .from('warehouses')
      .insert({
        org_id: orgId,
        name: formData.name.trim(),
        location: formData.location?.trim() || null,
        country_id: formData.country_id,
        business_start_time: normalizeTime(formData.business_start_time, '06:00:00'),
        business_end_time: normalizeTime(formData.business_end_time, '17:00:00'),
        slot_interval_minutes: formData.slot_interval_minutes || 60
      })
      .select('id, org_id, name, location, country_id, business_start_time, business_end_time, slot_interval_minutes, created_at')
      .single();

    if (error) {
      console.error('[WarehousesService] createWarehouse error', error);

      if (error.code === '23505' && error.message?.includes('warehouses_org_name_unique')) {
        throw new Error('Ya existe un almacén con ese nombre en tu organización');
      }

      throw error;
    }

    if (!data) throw new Error('No se pudo crear el almacén');
    return data as Warehouse;
  },

  async updateWarehouse(id: string, orgId: string, formData: WarehouseFormData): Promise<Warehouse> {
    console.log('[WarehousesService] updateWarehouse', { id, orgId, name: formData.name });

    if (!formData.country_id) throw new Error('El país es requerido');

    const { data, error } = await supabase
      .from('warehouses')
      .update({
        name: formData.name.trim(),
        location: formData.location?.trim() || null,
        country_id: formData.country_id,
        business_start_time: normalizeTime(formData.business_start_time, '06:00:00'),
        business_end_time: normalizeTime(formData.business_end_time, '17:00:00'),
        slot_interval_minutes: formData.slot_interval_minutes || 60
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select('id, org_id, name, location, country_id, business_start_time, business_end_time, slot_interval_minutes, created_at')
      .single();

    if (error) {
      console.error('[WarehousesService] updateWarehouse error', error);

      if (error.code === '23505' && error.message?.includes('warehouses_org_name_unique')) {
        throw new Error('Ya existe otro almacén con ese nombre en tu organización');
      }

      if (error.code === 'PGRST116') {
        throw new Error('No tienes permisos para actualizar este almacén o no existe');
      }

      throw error;
    }

    if (!data) throw new Error('No se pudo actualizar el almacén');
    return data as Warehouse;
  },

  async deleteWarehouse(id: string, orgId: string): Promise<void> {
    console.log('[WarehousesService] deleteWarehouse', { id, orgId });

    const { error } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[WarehousesService] deleteWarehouse error', error);

      if (error.code === 'PGRST116') {
        throw new Error('No tienes permisos para eliminar este almacén o no existe');
      }

      throw error;
    }
  }
};
