// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

/* ===================== ENV ===================== */
/**
 * IMPORTANTE: Solo usar variables VITE_* para que Vite las exponga al navegador.
 * Por defecto, Vite expone variables con prefijo VITE_ (sin PUBLIC).
 * Ver vite.config.ts para confirmar envPrefix.
 */
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const publishableKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';

/* ===================== VALIDACIONES ===================== */
if (!supabaseUrl) {
  throw new Error('❌ Missing env var: VITE_SUPABASE_URL');
}

if (!publishableKey) {
  throw new Error('❌ Missing env var: VITE_SUPABASE_PUBLISHABLE_KEY');
}

// Validación estricta: SOLO permitir claves sb_publishable_*
if (!publishableKey.startsWith('sb_publishable_')) {
  console.error('🚨 CRITICAL: publishableKey debe empezar con "sb_publishable_"', {
    receivedPrefix: publishableKey.slice(0, 14),
    expected: 'sb_publishable_'
  });
  throw new Error(
    '🚨 INVALID KEY: Solo se permiten claves nuevas sb_publishable_*. ' +
    'Las claves legacy (anon/service_role) están PROHIBIDAS en el frontend. ' +
    'Verifica tu .env y asegúrate de usar VITE_SUPABASE_PUBLISHABLE_KEY.'
  );
}

console.log('[Supabase Config] ✅ Inicializado correctamente', {
  url: supabaseUrl,
  publishablePrefix: publishableKey.slice(0, 16),
  keyType: 'sb_publishable (NEW FORMAT)'
});

/* ===================== CLIENT ===================== */
/**
 * Cliente único de Supabase:
 * - Usa SOLO publishable key (sb_publishable_*)
 * - Maneja auth + JWT automáticamente
 * - Funciona para DB + Edge Functions
 * - NUNCA usar claves legacy (anon/service_role) en el frontend
 */
export const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

/* ===================== TYPES ===================== */
export type Database = {
  public: {
    Tables: {
      organizations: { Row: { id: string; name: string; created_at: string; updated_at: string } };
      docks: {
        Row: {
          id: string; org_id: string; name: string; category_id: string | null;
          status_id: string | null; is_active: boolean; created_at: string; updated_at: string;
        };
      };
      reservations: {
        Row: {
          id: string; org_id: string; dock_id: string; start_datetime: string; end_datetime: string;
          dua: string; invoice: string; driver: string; status_id: string | null; notes: string | null;
          transport_type: string | null; cargo_type: string | null; is_cancelled: boolean;
          cancel_reason: string | null; cancelled_by: string | null; cancelled_at: string | null;
          created_by: string; created_at: string; updated_by: string | null; updated_at: string;
        };
      };
      dock_time_blocks: {
        Row: {
          id: string; org_id: string; dock_id: string; start_datetime: string;
          end_datetime: string; reason: string; created_by: string; created_at: string;
        };
      };
      reservation_statuses: {
        Row: {
          id: string; org_id: string; name: string; code: string; color: string;
          order_index: number | null; created_at: string;
        };
      };
      dock_categories: {
        Row: { id: string; org_id: string; name: string; code: string; color: string | null; created_at: string; updated_at: string };
      };
      user_org_roles: {
        Row: { id: string; user_id: string; org_id: string; role_id: string; assigned_by: string | null; assigned_at: string };
      };
      roles: { Row: { id: string; name: string; description: string | null; created_at: string } };
      permissions: { Row: { id: string; name: string; description: string | null; category: string | null; created_at: string } };
      role_permissions: { Row: { id: string; role_id: string; permission_id: string; created_at: string } };
    };
  };
};
