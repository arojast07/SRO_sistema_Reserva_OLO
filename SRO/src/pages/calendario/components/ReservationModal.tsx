
import { useState, useEffect } from 'react';
import type React from 'react';
import { Dock } from '../../../types/dock';
import { useAuth } from '../../../contexts/AuthContext';
import { calendarService, type Reservation } from '../../../services/calendarService';
import { ActivityTab } from './ActivityTab';
import { providersService } from '../../../services/providersService';
import { cargoTypesService } from '../../../services/cargoTypesService';
import { timeProfilesService } from '../../../services/timeProfilesService';
import type { Provider, CargoType } from '../../../types/catalog';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  reservation?: Reservation | null;
  docks: Dock[];
  statuses: any[];
  defaults?: any;
  orgId: string;
}

interface FileItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  type: string;
  url?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  isExisting?: boolean;
  category?: string;
}

type FileCategory = 'cmr' | 'facturas' | 'otros' | 'internos';

export default function ReservationModal({
  isOpen,
  onClose,
  onSave,
  reservation,
  docks,
  statuses,
  defaults,
  orgId
}: ReservationModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'documents' | 'activity'>('info');
  const [formData, setFormData] = useState({
    dockId: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    purchaseOrder: '',
    truckPlate: '',
    orderRequestNumber: '',
    shipperProvider: '',
    driver: '',
    dua: '',
    invoice: '',
    statusId: '',
    notes: '',
    transportType: 'inbound',
    cargoType: ''
  });

  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [cargoTypes, setCargoTypes] = useState<CargoType[]>([]);
  const [suggestedMinutes, setSuggestedMinutes] = useState<number | null>(null);
  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    if (isOpen && orgId) {
      loadCatalogs();
    }
  }, [isOpen, orgId]);

  const loadCatalogs = async () => {
    try {
      const [providersData, cargoTypesData] = await Promise.all([
        providersService.getActive(orgId),
        cargoTypesService.getActive(orgId)
      ]);
      setProviders(providersData);
      setCargoTypes(cargoTypesData);
      console.log('[ReservationModal] Catalogs loaded', {
        providersCount: providersData.length,
        cargoTypesCount: cargoTypesData.length
      });
    } catch (error) {
      console.error('[ReservationModal] Error loading catalogs', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (reservation) {
        const start = new Date(reservation.start_datetime);
        const end = new Date(reservation.end_datetime);

        setFormData({
          dockId: reservation.dock_id,
          startDate: start.toISOString().split('T')[0],
          startTime: start.toTimeString().slice(0, 5),
          endDate: end.toISOString().split('T')[0],
          endTime: end.toTimeString().slice(0, 5),
          purchaseOrder: reservation.purchase_order || '',
          truckPlate: reservation.truck_plate || '',
          orderRequestNumber: reservation.order_request_number || '',
          shipperProvider: reservation.shipper_provider || '',
          driver: reservation.driver || '',
          dua: reservation.dua || '',
          invoice: reservation.invoice || '',
          statusId: reservation.status_id || '',
          notes: reservation.notes || '',
          transportType: reservation.transport_type || 'inbound',
          cargoType: reservation.cargo_type || ''
        });

        setFiles([]);
        setManualOverride(false);
        setSuggestedMinutes(null);
      } else {
        const now = defaults?.start_datetime ? new Date(defaults.start_datetime) : new Date();
        const endTime = defaults?.end_datetime
          ? new Date(defaults.end_datetime)
          : new Date(now.getTime() + 2 * 60 * 60 * 1000);

        setFormData({
          dockId: defaults?.dock_id || '',
          startDate: now.toISOString().split('T')[0],
          startTime: now.toTimeString().slice(0, 5),
          endDate: endTime.toISOString().split('T')[0],
          endTime: endTime.toTimeString().slice(0, 5),
          purchaseOrder: '',
          truckPlate: '',
          orderRequestNumber: '',
          shipperProvider: defaults?.shipper_provider || '',
          driver: '',
          dua: '',
          invoice: '',
          statusId: statuses[0]?.id || '',
          notes: '',
          transportType: 'inbound',
          cargoType: defaults?.cargo_type || ''
        });
        setFiles([]);
        setManualOverride(false);
        setSuggestedMinutes(null);
      }

      setActiveTab('info');
    }
  }, [isOpen, reservation, defaults, statuses]);

  useEffect(() => {
    if (
      !manualOverride &&
      formData.shipperProvider &&
      formData.cargoType &&
      formData.startDate &&
      formData.startTime
    ) {
      updateSuggestedDuration();
    }
  }, [formData.shipperProvider, formData.cargoType, formData.startDate, formData.startTime, manualOverride]);

  const updateSuggestedDuration = async () => {
    const provider = providers.find(p => p.id === formData.shipperProvider);
    const cargoType = cargoTypes.find(ct => ct.id === formData.cargoType);
    if (!provider || !cargoType) return;

    const startDatetime = `${formData.startDate}T${formData.startTime}:00`;

    try {
      const profile = await timeProfilesService.getMatchingProfile(orgId, provider.id, cargoType.id, startDatetime);

      if (profile) {
        setSuggestedMinutes(profile.avg_minutes);
        const startDate = new Date(startDatetime);
        const endDate = new Date(startDate.getTime() + profile.avg_minutes * 60 * 1000);

        setFormData(prev => ({
          ...prev,
          endDate: endDate.toISOString().split('T')[0],
          endTime: endDate.toTimeString().slice(0, 5)
        }));
      } else if (cargoType.default_minutes) {
        setSuggestedMinutes(cargoType.default_minutes);
        const startDate = new Date(startDatetime);
        const endDate = new Date(startDate.getTime() + cargoType.default_minutes * 60 * 1000);

        setFormData(prev => ({
          ...prev,
          endDate: endDate.toISOString().split('T')[0],
          endTime: endDate.toTimeString().slice(0, 5)
        }));
      } else {
        setSuggestedMinutes(null);
      }
    } catch (error) {
      console.error('[ReservationModal] Error fetching time profile', error);
      setSuggestedMinutes(null);
    }
  };

  const handleEndTimeChange = (field: 'endDate' | 'endTime', value: string) => {
    setManualOverride(true);
    setSuggestedMinutes(null);
    setFormData({ ...formData, [field]: value });
  };

  const handleProviderOrCargoTypeChange = (field: 'shipperProvider' | 'cargoType', value: string) => {
    setManualOverride(false);
    setSuggestedMinutes(null);
    setFormData({ ...formData, [field]: value });
  };

  const handleFileSelect = (selectedFiles: FileList | null, category: FileCategory) => {
    if (!selectedFiles) return;

    const newFiles: FileItem[] = Array.from(selectedFiles).map(file => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      category
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent, category: FileCategory) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files, category);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFilesByCategory = (category: FileCategory) => {
    return files.filter(f => f.category === category);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);

    if (endDateTime <= startDateTime) {
      alert('La fecha/hora de fin debe ser posterior a la de inicio');
      return;
    }

    if (!user?.id) {
      alert('Usuario no autenticado');
      return;
    }

    const payload: Partial<Reservation> = {
      org_id: orgId,
      dock_id: formData.dockId,
      start_datetime: startDateTime.toISOString(),
      end_datetime: endDateTime.toISOString(),
      purchase_order: formData.purchaseOrder || null,
      truck_plate: formData.truckPlate || null,
      order_request_number: formData.orderRequestNumber || null,
      shipper_provider: formData.shipperProvider || null,
      driver: formData.driver,
      dua: formData.dua,
      invoice: formData.invoice,
      status_id: formData.statusId || null,
      notes: formData.notes || null,
      transport_type: formData.transportType,
      cargo_type: formData.cargoType,
      is_cancelled: false
    };

    try {
      setSaving(true);

      if (reservation) {
        await calendarService.updateReservation(reservation.id, payload);
      } else {
        await calendarService.createReservation(payload);
      }

      onSave();
    } catch (error: any) {
      console.error('[Reservation] saveError', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload
      });
      alert(error.message || 'Error al guardar la reserva');
    } finally {
      setSaving(false);
    }
  };

  const getReservationId = () => {
    if (reservation?.id) return reservation.id.slice(0, 8);
    return 'NUEVA';
  };

  const getTimeRange = () => {
    if (formData.startTime && formData.endTime) return `${formData.startTime} - ${formData.endTime}`;
    return '';
  };

  const dockName = docks.find(d => d.id === formData.dockId)?.name || '';
  const statusName = statuses.find(s => s.id === formData.statusId)?.name || '';
  const providerName = providers.find(p => p.id === formData.shipperProvider)?.name || '';
  const cargoTypeName = cargoTypes.find(ct => ct.id === formData.cargoType)?.name || '';

  const categoryLabels: Record<FileCategory, string> = {
    cmr: 'CMR',
    facturas: 'Facturas',
    otros: 'Otros documentos',
    internos: 'Documentos internos'
  };

  const inputBase =
    'w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white shadow-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent';
  const selectBase =
    'w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white shadow-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer';
  const labelBase = 'block text-sm font-medium text-gray-800 mb-2';
  const hintBase = 'mt-1 text-xs text-gray-500';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">Reserva #{getReservationId()}</h2>
                {getTimeRange() && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                    {getTimeRange()}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                {dockName && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-200">
                    <i className="ri-road-map-line w-4 h-4 inline-flex items-center justify-center text-gray-500"></i>
                    {dockName}
                  </span>
                )}
                {statusName && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-200">
                    <i className="ri-flag-line w-4 h-4 inline-flex items-center justify-center text-gray-500"></i>
                    {statusName}
                  </span>
                )}
                {cargoTypeName && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-200">
                    <i className="ri-archive-line w-4 h-4 inline-flex items-center justify-center text-gray-500"></i>
                    {cargoTypeName}
                  </span>
                )}
                {providerName && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-200">
                    <i className="ri-truck-line w-4 h-4 inline-flex items-center justify-center text-gray-500"></i>
                    {providerName}
                  </span>
                )}
                {suggestedMinutes && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800">
                    <i className="ri-time-line w-4 h-4 inline-flex items-center justify-center text-teal-700"></i>
                    {suggestedMinutes} min sugeridos
                  </span>
                )}
              </div>
            </div>

            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
              <i className="ri-close-line text-2xl w-6 h-6 flex items-center justify-center"></i>
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 bg-white">
          <div className="flex px-6 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'info'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Información
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'documents'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Documentos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'activity'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Actividad
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'info' && (
              <div className="p-6">
                <div className="max-w-2xl">
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-900">Datos principales</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Completa primero la carga y proveedor para sugerir duración automáticamente (si aplica).
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="space-y-4">
                        <div>
                          <label className={labelBase}>Tipo de Carga *</label>
                          <select
                            value={formData.cargoType}
                            onChange={(e) => handleProviderOrCargoTypeChange('cargoType', e.target.value)}
                            className={selectBase}
                            required
                          >
                            <option value="">Seleccionar tipo de carga</option>
                            {cargoTypes.map(cargoType => (
                              <option key={cargoType.id} value={cargoType.id}>
                                {cargoType.name}
                              </option>
                            ))}
                          </select>
                          <div className={hintBase}>Este campo se usará para automatizaciones futuras del tiempo.</div>
                        </div>

                        <div>
                          <label className={labelBase}>Expedidor / Proveedor *</label>
                          <select
                            value={formData.shipperProvider}
                            onChange={(e) => handleProviderOrCargoTypeChange('shipperProvider', e.target.value)}
                            className={selectBase}
                            required
                          >
                            <option value="">Seleccionar proveedor</option>
                            {providers.map(provider => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {suggestedMinutes && (
                          <div className="bg-white border border-teal-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <i className="ri-time-line text-teal-700 w-5 h-5 flex items-center justify-center mt-0.5"></i>
                              <div className="min-w-0">
                                <p className="text-sm text-teal-900">
                                  <span className="font-semibold">Tiempo sugerido:</span> {suggestedMinutes} minutos
                                </p>
                                <p className="text-xs text-teal-700 mt-0.5">
                                  Si editás manualmente la hora fin, se desactiva la sugerencia.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Ubicación y estado</h4>
                      <div className="space-y-4">
                        <div>
                          <label className={labelBase}>Andén / Rampa *</label>
                          <select
                            value={formData.dockId}
                            onChange={(e) => setFormData({ ...formData, dockId: e.target.value })}
                            className={selectBase}
                            required
                          >
                            <option value="">Seleccionar andén</option>
                            {docks.map(dock => (
                              <option key={dock.id} value={dock.id}>
                                {dock.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className={labelBase}>Estado *</label>
                          <select
                            value={formData.statusId}
                            onChange={(e) => setFormData({ ...formData, statusId: e.target.value })}
                            className={selectBase}
                            required
                          >
                            <option value="">Seleccionar estado</option>
                            {statuses.map(status => (
                              <option key={status.id} value={status.id}>
                                {status.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Fecha y hora</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={labelBase}>Fecha Inicio *</label>
                            <input
                              type="date"
                              value={formData.startDate}
                              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                              className={inputBase}
                              required
                            />
                          </div>
                          <div>
                            <label className={labelBase}>Hora Inicio *</label>
                            <input
                              type="time"
                              value={formData.startTime}
                              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                              className={inputBase}
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={labelBase}>Fecha Fin *</label>
                            <input
                              type="date"
                              value={formData.endDate}
                              onChange={(e) => handleEndTimeChange('endDate', e.target.value)}
                              className={inputBase}
                              required
                            />
                          </div>
                          <div>
                            <label className={labelBase}>Hora Fin *</label>
                            <input
                              type="time"
                              value={formData.endTime}
                              onChange={(e) => handleEndTimeChange('endTime', e.target.value)}
                              className={inputBase}
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={labelBase}>Tipo de Transporte</label>
                            <select
                              value={formData.transportType}
                              onChange={(e) => setFormData({ ...formData, transportType: e.target.value })}
                              className={selectBase}
                            >
                              <option value="inbound">Inbound</option>
                              <option value="outbound">Outbound</option>
                            </select>
                          </div>

                          <div>
                            <label className={labelBase}>Recurrencia</label>
                            <button
                              type="button"
                              disabled
                              className="w-full px-4 py-2.5 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed whitespace-nowrap border border-gray-200"
                            >
                              <i className="ri-add-line mr-2 w-4 h-4 inline-flex items-center justify-center"></i>
                              Agregar (Próximamente)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Datos del transporte</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={labelBase}>Chofer *</label>
                            <input
                              type="text"
                              value={formData.driver}
                              onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                              className={inputBase}
                              placeholder="Nombre del chofer"
                              required
                            />
                          </div>

                          <div>
                            <label className={labelBase}>Número de matrícula del camión</label>
                            <input
                              type="text"
                              value={formData.truckPlate}
                              onChange={(e) => setFormData({ ...formData, truckPlate: e.target.value })}
                              className={inputBase}
                              placeholder="ABC-1234"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={labelBase}>DUA *</label>
                            <input
                              type="text"
                              value={formData.dua}
                              onChange={(e) => setFormData({ ...formData, dua: e.target.value })}
                              className={inputBase}
                              placeholder="DUA-2024-001"
                              required
                            />
                          </div>

                          <div>
                            <label className={labelBase}>Factura *</label>
                            <input
                              type="text"
                              value={formData.invoice}
                              onChange={(e) => setFormData({ ...formData, invoice: e.target.value })}
                              className={inputBase}
                              placeholder="FAC-001"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={labelBase}>Orden de Compra *</label>
                            <input
                              type="text"
                              value={formData.purchaseOrder}
                              onChange={(e) => setFormData({ ...formData, purchaseOrder: e.target.value })}
                              className={inputBase}
                              placeholder="OC-2024-001"
                              required
                            />
                          </div>

                          <div>
                            <label className={labelBase}>Número de pedido</label>
                            <textarea
                              value={formData.orderRequestNumber}
                              onChange={(e) => setFormData({ ...formData, orderRequestNumber: e.target.value })}
                              className={`${inputBase} resize-none`}
                              rows={2}
                              placeholder="Número de pedido o solicitud"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Observaciones</h4>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className={`${inputBase} resize-none`}
                        rows={4}
                        placeholder="Notas adicionales..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="p-6 space-y-6">
                {(['cmr', 'facturas', 'otros', 'internos'] as FileCategory[]).map(category => (
                  <div key={category} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">{categoryLabels[category]}</h3>
                      <span className="text-xs text-gray-500">
                        {getFilesByCategory(category).length} archivo(s)
                      </span>
                    </div>

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, category)}
                      className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors mb-3 ${
                        isDragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <input
                        type="file"
                        multiple
                        onChange={(e) => handleFileSelect(e.target.files, category)}
                        className="hidden"
                        id={`file-upload-${category}`}
                      />
                      <div className="flex flex-col items-center gap-2">
                        <i className="ri-upload-cloud-2-line text-2xl text-gray-400 w-8 h-8 flex items-center justify-center"></i>
                        <p className="text-sm text-gray-600">
                          Arrastrá archivos aquí o{' '}
                          <label
                            htmlFor={`file-upload-${category}`}
                            className="text-teal-700 font-semibold hover:text-teal-800 cursor-pointer"
                          >
                            seleccioná desde tu equipo
                          </label>
                        </p>
                        <p className="text-xs text-gray-500">PDF, imágenes u otros documentos</p>
                      </div>
                    </div>

                    {getFilesByCategory(category).length > 0 ? (
                      <div className="space-y-2">
                        {getFilesByCategory(category).map(file => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <i className="ri-file-line text-xl text-gray-400 w-5 h-5 flex items-center justify-center flex-shrink-0"></i>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(file.id)}
                              className="text-red-500 hover:text-red-700 transition-colors ml-2 flex-shrink-0"
                              title="Eliminar"
                            >
                              <i className="ri-delete-bin-line text-lg w-5 h-5 flex items-center justify-center"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">Aún no hay documentos cargados</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'activity' && reservation && (
              <ActivityTab orgId={orgId} reservationId={reservation.id} docks={docks} statuses={statuses} />
            )}

            {activeTab === 'activity' && !reservation && (
              <div className="p-6">
                <div className="text-center py-12">
                  <i className="ri-information-line text-4xl text-gray-300 mb-3 w-10 h-10 flex items-center justify-center mx-auto"></i>
                  <p className="text-sm text-gray-500">El historial de actividad estará disponible después de crear la reserva</p>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3 bg-white sticky bottom-0">
            <div className="text-xs text-gray-500">
              Los campos con <span className="text-gray-800 font-semibold">*</span> son obligatorios
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 border border-gray-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap disabled:opacity-50 shadow-sm"
              >
                {saving ? 'Guardando...' : reservation ? 'Guardar Cambios' : 'Crear Reserva'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
