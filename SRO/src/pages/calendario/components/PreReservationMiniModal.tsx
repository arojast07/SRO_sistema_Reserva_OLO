import { useState, useEffect, useRef } from 'react';
import type { CargoType, Provider } from '../../../types/catalog';
import { cargoTypesService } from '../../../services/cargoTypesService';
import { providersService } from '../../../services/providersService';
import { timeProfilesService } from '../../../services/timeProfilesService';

interface PreReservationMiniModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  warehouseLabel: string;
  onConfirm: (data: {
    cargoTypeId: string;
    providerId: string;
    requiredMinutes: number;
  }) => void;
}

export default function PreReservationMiniModal({
  isOpen,
  onClose,
  orgId,
  warehouseLabel,
  onConfirm
}: PreReservationMiniModalProps) {
  const [selectedCargoTypeId, setSelectedCargoTypeId] = useState<string>('');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [cargoTypes, setCargoTypes] = useState<CargoType[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ NUEVO: duración calculada por perfil o fallback
  const [requiredMinutes, setRequiredMinutes] = useState<number>(30);
  const [durationSource, setDurationSource] = useState<'profile' | 'cargo_default' | 'fallback_30' | 'none'>('none');
  const [loadingDuration, setLoadingDuration] = useState(false);

  // ✅ Evita race conditions (cambios rápidos de selects)
  const reqKeyRef = useRef<string>('');

  // Cargar catálogos cuando se abre el modal
  useEffect(() => {
    if (isOpen && orgId) {
      loadCatalogs();
    }
  }, [isOpen, orgId]);

  const loadCatalogs = async () => {
    setLoading(true);
    try {
      const [cargoTypesData, providersData] = await Promise.all([
        cargoTypesService.getActive(orgId),
        providersService.getActive(orgId)
      ]);

      setCargoTypes(cargoTypesData);
      setProviders(providersData);

      console.log('[PreReservationMiniModal] Catalogs loaded', {
        cargoTypesCount: cargoTypesData.length,
        providersCount: providersData.length
      });
    } catch (error) {
      console.error('[PreReservationMiniModal] Error loading catalogs', error);
    } finally {
      setLoading(false);
    }
  };

  // Resetear form cuando se cierra
  useEffect(() => {
    if (!isOpen) {
      setSelectedCargoTypeId('');
      setSelectedProviderId('');
      setRequiredMinutes(30);
      setDurationSource('none');
      setLoadingDuration(false);
      reqKeyRef.current = '';
    }
  }, [isOpen]);

  const selectedCargoType = cargoTypes.find(ct => ct.id === selectedCargoTypeId);

  // ✅ NUEVO: cuando hay combinación, buscar avg_minutes del perfil
  useEffect(() => {
    if (!isOpen) return;

    const cargoTypeId = selectedCargoTypeId;
    const providerId = selectedProviderId;

    // Si falta algo, solo muestro default_minutes o fallback
    if (!cargoTypeId || !providerId) {
      const def = selectedCargoType?.default_minutes ?? null;

      if (typeof def === 'number' && def >= 5) {
        setRequiredMinutes(def);
        setDurationSource('cargo_default');
      } else {
        setRequiredMinutes(30);
        setDurationSource(selectedCargoType ? 'fallback_30' : 'none');
      }

      setLoadingDuration(false);
      reqKeyRef.current = '';
      return;
    }

    const reqKey = `${orgId}:${providerId}:${cargoTypeId}`;
    reqKeyRef.current = reqKey;

    const run = async () => {
      setLoadingDuration(true);
      try {
        const profile = await timeProfilesService.findMatchingProfile(orgId, providerId, cargoTypeId);

        if (reqKeyRef.current !== reqKey) return;

        if (profile?.avg_minutes && profile.avg_minutes >= 5) {
          setRequiredMinutes(profile.avg_minutes);
          setDurationSource('profile');
          return;
        }

        const def = selectedCargoType?.default_minutes ?? null;
        if (typeof def === 'number' && def >= 5) {
          setRequiredMinutes(def);
          setDurationSource('cargo_default');
        } else {
          setRequiredMinutes(30);
          setDurationSource('fallback_30');
        }
      } catch (error) {
        console.error('[PreReservationMiniModal] Error loading time profile', error);

        const def = selectedCargoType?.default_minutes ?? null;
        if (typeof def === 'number' && def >= 5) {
          setRequiredMinutes(def);
          setDurationSource('cargo_default');
        } else {
          setRequiredMinutes(30);
          setDurationSource('fallback_30');
        }
      } finally {
        if (reqKeyRef.current === reqKey) setLoadingDuration(false);
      }
    };

    run();
  }, [isOpen, orgId, selectedCargoTypeId, selectedProviderId, selectedCargoType?.default_minutes]);

  const canContinue = Boolean(selectedCargoTypeId && selectedProviderId) && requiredMinutes >= 5;

  const handleConfirm = () => {
    if (!canContinue || !selectedCargoTypeId || !selectedProviderId) return;

    console.log('[PreReservationMiniModal] Confirming', {
      cargoTypeId: selectedCargoTypeId,
      providerId: selectedProviderId,
      requiredMinutes,
      durationSource
    });

    onConfirm({
      cargoTypeId: selectedCargoTypeId,
      providerId: selectedProviderId,
      requiredMinutes
    });
  };

  const handleCancel = () => {
    console.log('[PreReservationMiniModal] Cancelled');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Nueva Reserva
            </h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Info de Almacén actual */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <i className="ri-building-2-line text-blue-600 text-lg flex-shrink-0 mt-0.5"></i>
              <div className="flex-1 text-sm">
                <p className="font-medium text-blue-900 mb-1">
                  Almacén seleccionado
                </p>
                <p className="text-blue-700">
                  {warehouseLabel}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Podés cambiar el almacén desde el selector principal si necesitás ver otros andenes
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <i className="ri-loader-4-line text-3xl text-teal-600 animate-spin"></i>
              <p className="mt-2 text-sm text-gray-600">Cargando catálogos...</p>
            </div>
          ) : (
            <>
              {/* Tipo de Carga */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Carga <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCargoTypeId}
                  onChange={(e) => setSelectedCargoTypeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="">Seleccionar tipo de carga</option>
                  {cargoTypes.map(ct => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name}
                      {ct.default_minutes ? ` (${ct.default_minutes} min)` : ''}
                    </option>
                  ))}
                </select>
                {cargoTypes.length === 0 && !loading && (
                  <p className="mt-1 text-xs text-amber-600">
                    No hay tipos de carga activos. Creá uno desde Catálogos.
                  </p>
                )}
              </div>

              {/* Proveedor / Expedidor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor / Expedidor <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="">Seleccionar proveedor</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {providers.length === 0 && !loading && (
                  <p className="mt-1 text-xs text-amber-600">
                    No hay proveedores activos. Creá uno desde Catálogos.
                  </p>
                )}
              </div>

              {/* Info de Duración */}
              <div className="bg-teal-50 border border-teal-200 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <i className="ri-time-line text-teal-600 text-lg flex-shrink-0 mt-0.5"></i>
                  <div className="flex-1 text-sm text-teal-900">
                    <p className="font-medium mb-1">
                      Duración requerida: {selectedCargoType ? (loadingDuration ? 'calculando...' : `${requiredMinutes} min`) : '—'}
                    </p>
                    <p className="text-teal-700">
                      {loadingDuration
                        ? 'Buscando tiempo promedio para esta combinación...'
                        : durationSource === 'profile'
                          ? 'Usando tiempo promedio del perfil (Proveedor x Tipo de carga).'
                          : durationSource === 'cargo_default'
                            ? 'No hay perfil para la combinación; usando minutos por defecto del tipo de carga.'
                            : durationSource === 'fallback_30'
                              ? 'No hay minutos definidos; usando fallback de 30 min.'
                              : 'El calendario habilitará solo espacios con tiempo continuo suficiente'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canContinue || loading || loadingDuration}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            Elegir espacio en calendario
          </button>
        </div>
      </div>
    </div>
  );
}
