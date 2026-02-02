import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { casetillaService } from '../../services/casetillaService';
import { IngresoForm } from './components/IngresoForm';
import { PendingReservationsGrid } from './components/PendingReservationsGrid';
import type { CreateCasetillaIngresoInput } from '../../types/casetilla';

interface PendingReservation {
  id: string;
  dua: string;
  placa: string; // mapped desde reservations.truck_plate
  chofer: string; // mapped desde reservations.driver
  orden_compra?: string;
  numero_pedido?: string;
  provider_name: string; // mapped desde reservations.shipper_provider
  warehouse_name: string; // derivado por dock -> warehouse
  created_at: string;
}

type ViewMode = 'HOME' | 'INGRESO' | 'PENDIENTES';

export default function CasetillaPage() {
  const { user, currentOrg } = useAuth();
  const { can } = usePermissions();

  const orgId = useMemo(() => currentOrg?.id ?? user?.orgId ?? null, [currentOrg?.id, user?.orgId]);

  const [viewMode, setViewMode] = useState<ViewMode>('HOME');

  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedReservation, setSelectedReservation] = useState<PendingReservation | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const canView = can('casetilla.view');
  const canCreate = can('casetilla.create') || can('casetilla.manage');

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadPendingReservations = async () => {
    if (!orgId) return;

    try {
      setIsLoadingReservations(true);
      const data = await casetillaService.getPendingReservations(orgId);
      setPendingReservations(data as PendingReservation[]);
    } catch (error) {
      console.error('Error loading pending reservations:', error);
      showNotification('error', 'Error al cargar reservas pendientes');
    } finally {
      setIsLoadingReservations(false);
    }
  };

  useEffect(() => {
    if (!orgId || !canView) return;

    if (viewMode === 'PENDIENTES') {
      loadPendingReservations();
    }
  }, [orgId, canView, viewMode]);

  const handleSubmitIngreso = async (data: CreateCasetillaIngresoInput) => {
    if (!orgId || !user?.id || !canCreate) return;

    try {
      setIsSubmitting(true);
      const result = await casetillaService.createIngreso(orgId, user.id, data);

      if (result.reservationFound && result.reservationUpdated) {
        showNotification('success', 'Ingreso registrado y reserva actualizada a LLEGO_AL_ALMACEN');
      } else if (result.reservationFound && !result.reservationUpdated) {
        showNotification('warning', 'Ingreso registrado pero no se pudo actualizar la reserva');
      } else {
        showNotification('warning', 'Ingreso registrado pero no se encontró reserva asociada');
      }

      setSelectedReservation(null);

      if (viewMode === 'PENDIENTES') {
        await loadPendingReservations();
      }
    } catch (error) {
      console.error('Error creating ingreso:', error);
      showNotification('error', 'Error al registrar el ingreso');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenIngreso = (reservation: PendingReservation) => {
    setSelectedReservation(reservation);
    setViewMode('INGRESO');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetIngreso = () => setSelectedReservation(null);

  const OptionCard = ({
    icon,
    title,
    desc,
    disabled,
    onClick
  }: {
    icon: string;
    title: string;
    desc: string;
    disabled?: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'group relative w-full text-left rounded-xl border p-5 transition-all',
        'bg-white shadow-sm hover:shadow-md',
        'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2',
        disabled ? 'opacity-60 cursor-not-allowed hover:shadow-sm' : 'hover:-translate-y-[1px]',
        'border-gray-200'
      ].join(' ')}
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            'h-11 w-11 rounded-lg flex items-center justify-center',
            'bg-teal-50 text-teal-700 border border-teal-100',
            'group-hover:bg-teal-100 transition-colors'
          ].join(' ')}
        >
          <i className={`${icon} text-xl`}></i>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {!disabled && (
              <span className="ml-auto text-xs text-teal-700 bg-teal-50 border border-teal-100 px-2 py-1 rounded-full">
                Abrir
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">{desc}</p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-transparent group-hover:ring-teal-100 transition" />
    </button>
  );

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <i className="ri-lock-line text-6xl text-gray-400"></i>
          <h2 className="mt-4 text-xl font-semibold text-gray-700">Acceso Denegado</h2>
          <p className="mt-2 text-gray-600">No tienes permisos para acceder a Casetilla</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <i className="ri-door-open-line text-teal-600"></i>
              Casetilla
            </h1>
            <p className="mt-1 text-gray-600">Control de ingreso físico al almacén</p>
          </div>

          {viewMode !== 'HOME' && (
            <button
              type="button"
              onClick={() => setViewMode('HOME')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              <i className="ri-arrow-left-line"></i>
              Volver
            </button>
          )}
        </div>

        {/* Notificación */}
        {notification && (
          <div
            className={[
              'mb-6 p-4 rounded-lg flex items-start gap-3',
              notification.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : notification.type === 'error'
                ? 'bg-red-50 border border-red-200'
                : 'bg-yellow-50 border border-yellow-200'
            ].join(' ')}
          >
            <i
              className={[
                'text-xl',
                notification.type === 'success'
                  ? 'ri-checkbox-circle-line text-green-600'
                  : notification.type === 'error'
                  ? 'ri-error-warning-line text-red-600'
                  : 'ri-alert-line text-yellow-600'
              ].join(' ')}
            />
            <p
              className={[
                'flex-1',
                notification.type === 'success'
                  ? 'text-green-800'
                  : notification.type === 'error'
                  ? 'text-red-800'
                  : 'text-yellow-800'
              ].join(' ')}
            >
              {notification.message}
            </p>
            <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600">
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}

        {/* HOME */}
        {viewMode === 'HOME' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">¿Qué querés hacer?</h2>
              <p className="text-sm text-gray-600 mt-1">
                Elegí una opción. No tocamos nada del resto del sistema.
              </p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <OptionCard
                  icon="ri-login-box-line"
                  title="Crear Registro de Ingreso"
                  desc="Formulario para registrar el ingreso y actualizar la reserva si hay match por DUA + Matrícula."
                  disabled={!canCreate}
                  onClick={() => setViewMode('INGRESO')}
                />
                <OptionCard
                  icon="ri-time-line"
                  title="Visualizar Reservas Pendientes"
                  desc="Lista con búsqueda para seleccionar una reserva y precargar el ingreso."
                  onClick={() => setViewMode('PENDIENTES')}
                />
              </div>

              {!canCreate && (
                <div className="mt-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <i className="ri-lock-line mr-1"></i>
                  No tenés permisos para crear ingresos (casetilla.create / casetilla.manage).
                </div>
              )}
            </div>
          </div>
        )}

        {/* INGRESO */}
        {viewMode === 'INGRESO' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <i className="ri-add-circle-line text-teal-600"></i>
                Crear Registro de Ingreso
              </h2>

              {selectedReservation && (
                <button
                  onClick={resetIngreso}
                  className="text-sm text-gray-700 hover:text-gray-900 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                >
                  <i className="ri-eraser-line"></i>
                  Limpiar
                </button>
              )}
            </div>

            {selectedReservation && (
              <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                <p className="text-sm text-teal-800 font-medium">Datos precargados desde reserva seleccionada</p>
              </div>
            )}

            {canCreate ? (
              <IngresoForm
                onSubmit={handleSubmitIngreso}
                initialData={
                  selectedReservation
                    ? {
                        chofer: selectedReservation.chofer,
                        matricula: selectedReservation.placa,
                        dua: selectedReservation.dua,
                        orden_compra: selectedReservation.orden_compra,
                        numero_pedido: selectedReservation.numero_pedido,
                        factura: ''
                      }
                    : undefined
                }
                isLoading={isSubmitting}
              />
            ) : (
              <div className="text-center py-10 text-gray-500">
                <i className="ri-lock-line text-4xl"></i>
                <p className="mt-2">No tienes permisos para crear ingresos</p>
              </div>
            )}
          </div>
        )}

        {/* PENDIENTES */}
        {viewMode === 'PENDIENTES' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <i className="ri-time-line text-teal-600"></i>
                Reservas Pendientes
              </h2>

              <button
                type="button"
                onClick={loadPendingReservations}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
              >
                <i className={isLoadingReservations ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'}></i>
                Refrescar
              </button>
            </div>

            <PendingReservationsGrid
              reservations={pendingReservations}
              onOpenIngreso={handleOpenIngreso}
              isLoading={isLoadingReservations}
            />
          </div>
        )}
      </div>
    </div>
  );
}
