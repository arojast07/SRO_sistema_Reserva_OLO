// src/services/userAccessService.ts
import { supabase } from '../lib/supabase';

interface UserAccessResponse {
  countryIds: string[];
  warehouseIds: string[];
  restricted: boolean;
}

interface SetCountriesParams {
  orgId: string;
  targetUserId: string;
  countryIds: string[];
}

interface SetWarehousesParams {
  orgId: string;
  targetUserId: string;
  restricted: boolean;
  warehouseIds: string[];
}

const assert = (cond: any, msg: string) => {
  if (!cond) throw new Error(msg);
};

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const uniq = (arr: string[]) => Array.from(new Set(arr));

// ✅ NUEVO: asegura sesión antes de invocar edge functions
const ensureSession = async () => {
  const snap1 = await supabase.auth.getSession();
  let session = snap1.data.session;

  if (!session?.access_token) {
    const refresh = await supabase.auth.refreshSession();
    session = refresh.data.session ?? null;
  }

  if (!session?.access_token) {
    throw new Error('No hay sesión activa (access_token faltante). Iniciá sesión y recargá.');
  }

  // best-effort: si está vencido, refrescar
  try {
    const payloadBase64 = session.access_token.split('.')[1];
    const payloadJson = JSON.parse(atob(payloadBase64));
    const now = Math.floor(Date.now() / 1000);
    const isExpired = Number(payloadJson?.exp ?? 0) < now;

    if (isExpired) {
      const refresh2 = await supabase.auth.refreshSession();
      session = refresh2.data.session ?? null;

      if (!session?.access_token) {
        throw new Error('Sesión expirada y no se pudo refrescar. Cerrá sesión e ingresá de nuevo.');
      }
    }
  } catch {
    // no bloquea
  }

  return session;
};

// ✅ NUEVO: leer body solo si realmente es Response-like
const safeReadResponseText = async (ctx: any) => {
  try {
    if (!ctx) return '';
    const maybeText = (ctx as any)?.text;
    if (typeof maybeText === 'function') {
      return await maybeText.call(ctx);
    }
    return '';
  } catch {
    return '';
  }
};

export const userAccessService = {
  async get(orgId: string, targetUserId: string): Promise<UserAccessResponse> {
    assert(orgId && isUuid(orgId), 'orgId inválido');
    assert(targetUserId && isUuid(targetUserId), 'targetUserId inválido');

    // ✅ asegura sesión
    await ensureSession();

    const { data, error } = await supabase.functions.invoke('admin-user-access', {
      body: { action: 'get', orgId, targetUserId, debug: true },
    });

    if (error) {
      const ctx = (error as any)?.context;
      console.error('[userAccessService.get] invoke error', {
        message: error.message,
        hasContext: !!ctx,
        status: (ctx as any)?.status,
        statusText: (ctx as any)?.statusText,
        details: (error as any)?.details,
      });

      const raw = await safeReadResponseText(ctx);
      if (raw) console.error('[userAccessService.get] raw response body', raw);

      throw new Error(`Error al obtener accesos: ${error.message}`);
    }

    if (data && typeof data === 'object' && 'error' in (data as any)) {
      throw new Error(`Error del servidor: ${(data as any).error}`);
    }

    return {
      countryIds: Array.isArray((data as any)?.countryIds) ? (data as any).countryIds : [],
      warehouseIds: Array.isArray((data as any)?.warehouseIds) ? (data as any).warehouseIds : [],
      restricted: !!(data as any)?.restricted,
    };
  },

  async setCountries(params: SetCountriesParams): Promise<void> {
    assert(params?.orgId && isUuid(params.orgId), 'orgId inválido');
    assert(params?.targetUserId && isUuid(params.targetUserId), 'targetUserId inválido');
    assert(Array.isArray(params?.countryIds), 'countryIds debe ser array');

    const countryIds = uniq(params.countryIds.filter(Boolean));
    countryIds.forEach((id) => assert(isUuid(id), 'countryIds contiene uuid inválido'));

    // ✅ asegura sesión
    await ensureSession();

    const { data, error } = await supabase.functions.invoke('admin-user-access', {
      body: {
        action: 'set_countries',
        orgId: params.orgId,
        targetUserId: params.targetUserId,
        countryIds,
        debug: true,
      },
    });

    if (error) {
      const ctx = (error as any)?.context;

      console.error('[userAccessService.setCountries] invoke error', {
        message: error.message,
        hasContext: !!ctx,
        status: (ctx as any)?.status,
        statusText: (ctx as any)?.statusText,
        details: (error as any)?.details,
      });

      const raw = await safeReadResponseText(ctx);
      if (raw) {
        console.error('[userAccessService.setCountries] raw response body', raw);
        try {
          const parsed = JSON.parse(raw);
          console.error('[userAccessService.setCountries] parsed server body', parsed);

          if (parsed?.error) {
            const extra = [
              parsed?.message ? `message=${parsed.message}` : null,
              parsed?.code ? `code=${parsed.code}` : null,
              parsed?.hint ? `hint=${parsed.hint}` : null,
              parsed?.details ? `details=${parsed.details}` : null,
            ]
              .filter(Boolean)
              .join(' | ');

            throw new Error(`Error al asignar países: ${parsed.error}${extra ? ` (${extra})` : ''}`);
          }
        } catch {
          // raw no era JSON
        }
      }

      throw new Error(`Error al asignar países: ${error.message}`);
    }

    if (data && typeof data === 'object' && 'error' in (data as any)) {
      throw new Error(`Error del servidor: ${(data as any).error}`);
    }
  },

  async setWarehouses(params: SetWarehousesParams): Promise<void> {
    assert(params?.orgId && isUuid(params.orgId), 'orgId inválido');
    assert(params?.targetUserId && isUuid(params.targetUserId), 'targetUserId inválido');
    assert(typeof params?.restricted === 'boolean', 'restricted debe ser boolean');
    assert(Array.isArray(params?.warehouseIds), 'warehouseIds debe ser array');

    const warehouseIds = uniq(params.warehouseIds.filter(Boolean));
    warehouseIds.forEach((id) => assert(isUuid(id), 'warehouseIds contiene uuid inválido'));

    // ✅ asegura sesión
    await ensureSession();

    const { data, error } = await supabase.functions.invoke('admin-user-access', {
      body: {
        action: 'set_warehouses',
        orgId: params.orgId,
        targetUserId: params.targetUserId,
        restricted: params.restricted,
        warehouseIds: params.restricted ? warehouseIds : [],
        debug: true,
      },
    });

    if (error) {
      const ctx = (error as any)?.context;

      console.error('[userAccessService.setWarehouses] invoke error', {
        message: error.message,
        hasContext: !!ctx,
        status: (ctx as any)?.status,
        statusText: (ctx as any)?.statusText,
        details: (error as any)?.details,
      });

      const raw = await safeReadResponseText(ctx);
      if (raw) {
        console.error('[userAccessService.setWarehouses] raw response body', raw);

        try {
          const parsed = JSON.parse(raw);
          console.error('[userAccessService.setWarehouses] parsed server body', parsed);

          if (parsed?.error) {
            const extra = [
              parsed?.message ? `message=${parsed.message}` : null,
              parsed?.code ? `code=${parsed.code}` : null,
              parsed?.hint ? `hint=${parsed.hint}` : null,
              parsed?.details ? `details=${parsed.details}` : null,
            ]
              .filter(Boolean)
              .join(' | ');

            throw new Error(
              `Error al configurar almacenes: ${parsed.error}${extra ? ` (${extra})` : ''}`
            );
          }
        } catch {
          // raw no era JSON
        }
      }

      throw new Error(`Error al configurar almacenes: ${error.message}`);
    }

    if (data && typeof data === 'object' && 'error' in (data as any)) {
      throw new Error(`Error del servidor: ${(data as any).error}`);
    }
  },
};
