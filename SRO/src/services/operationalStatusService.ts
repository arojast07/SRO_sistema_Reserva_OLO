import { supabase } from '../lib/supabase';
import type { OperationalStatus, CreateOperationalStatusDto, UpdateOperationalStatusDto } from '../types/operationalStatus';

export const operationalStatusService = {
  async getAll(orgId: string): Promise<OperationalStatus[]> {
    const { data, error } = await supabase
      .from('operational_statuses')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async create(orgId: string, dto: CreateOperationalStatusDto): Promise<OperationalStatus> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase
      .from('operational_statuses')
      .insert({
        org_id: orgId,
        ...dto,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, dto: UpdateOperationalStatusDto): Promise<OperationalStatus> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase
      .from('operational_statuses')
      .update({
        ...dto,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('operational_statuses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async reorder(items: { id: string; order_index: number }[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const updates = items.map(item =>
      supabase
        .from('operational_statuses')
        .update({ 
          order_index: item.order_index,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
    );

    await Promise.all(updates);
  },
};
