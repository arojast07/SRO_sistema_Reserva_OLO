import { useState, FormEvent, useEffect } from 'react';
import { Warehouse, WarehouseFormData } from '../../../../types/warehouse';
import type { Country } from '../../../../types/catalog';

interface WarehouseModalProps {
  orgId: string;
  warehouse: Warehouse | null;
  countries: Country[];
  onClose: () => void;
  onSave: (formData: WarehouseFormData) => Promise<void>;
}

export default function WarehouseModal({
  warehouse,
  countries,
  onClose,
  onSave,
}: WarehouseModalProps) {
  const [formData, setFormData] = useState<WarehouseFormData>({
    name: '',
    location: '',
    country_id: '',
    business_start_time: '06:00',
    business_end_time: '17:00',
    slot_interval_minutes: 60,
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (warehouse) {
      setFormData({
        name: warehouse.name,
        location: warehouse.location || '',
        country_id: warehouse.country_id || '',
        business_start_time: warehouse.business_start_time?.substring(0, 5) || '06:00',
        business_end_time: warehouse.business_end_time?.substring(0, 5) || '17:00',
        slot_interval_minutes: warehouse.slot_interval_minutes || 60,
      });
    } else {
      setFormData({
        name: '',
        location: '',
        country_id: '',
        business_start_time: '06:00',
        business_end_time: '17:00',
        slot_interval_minutes: 60,
      });
    }
    setErrors({});
  }, [warehouse]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
    else if (formData.name.trim().length < 2) newErrors.name = 'El nombre debe tener al menos 2 caracteres';

    if (!formData.country_id) newErrors.country_id = 'El país es requerido';

    if (formData.business_end_time <= formData.business_start_time) {
      newErrors.business_end_time = 'La hora fin debe ser mayor que la hora inicio';
    }

    if (![15, 30, 60].includes(formData.slot_interval_minutes)) {
      newErrors.slot_interval_minutes = 'El intervalo debe ser 15, 30 o 60 minutos';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      await onSave({
        ...formData,
        name: formData.name.trim(),
        location: formData.location?.trim() || '',
      });
    } catch (error) {
      console.error('[WarehouseModal] saveError', error);
      const message = error instanceof Error ? error.message : 'Error al guardar el almacén';
      setErrors({ submit: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {warehouse ? 'Editar Almacén' : 'Nuevo Almacén'}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-close-line text-xl w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ej: Almacén Central"
              disabled={saving}
              autoFocus
            />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ubicación
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Ej: Calle Principal 123, Ciudad"
              disabled={saving}
            />
            <p className="mt-1 text-xs text-gray-500">
              Opcional: dirección o descripción de la ubicación
            </p>
          </div>

          {/* País (select real con UUID) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              País <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.country_id}
              onChange={(e) => setFormData({ ...formData, country_id: e.target.value })}
              className={`w-full px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                errors.country_id ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={saving}
              required
            >
              <option value="">Seleccionar país</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.country_id && <p className="mt-1 text-sm text-red-500">{errors.country_id}</p>}
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Configuración de Agenda
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora inicio reservas <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.business_start_time}
                  onChange={(e) => setFormData({ ...formData, business_start_time: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora fin reservas <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.business_end_time}
                  onChange={(e) => setFormData({ ...formData, business_end_time: e.target.value })}
                  className={`w-full px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                    errors.business_end_time ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={saving}
                />
                {errors.business_end_time && (
                  <p className="mt-1 text-sm text-red-500">{errors.business_end_time}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intervalo de agenda <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.slot_interval_minutes}
                  onChange={(e) =>
                    setFormData({ ...formData, slot_interval_minutes: parseInt(e.target.value, 10) })
                  }
                  className={`w-full px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                    errors.slot_interval_minutes ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={saving}
                >
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={60}>60 minutos</option>
                </select>
                {errors.slot_interval_minutes && (
                  <p className="mt-1 text-sm text-red-500">{errors.slot_interval_minutes}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Define el tamaño de los segmentos en el calendario
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {saving ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-lg w-5 h-5 flex items-center justify-center"></i>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="ri-save-line text-lg w-5 h-5 flex items-center justify-center"></i>
                  {warehouse ? 'Actualizar' : 'Crear'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
