import { useState, useEffect } from 'react';
import { operationalStatusService } from '../../../services/operationalStatusService';
import type { OperationalStatus, CreateOperationalStatusDto } from '../../../types/operationalStatus';

interface OperationalStatusesTabProps {
  orgId: string;
}

export default function OperationalStatusesTab({ orgId }: OperationalStatusesTabProps) {
  const [statuses, setStatuses] = useState<OperationalStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<OperationalStatus | null>(null);
  const [formData, setFormData] = useState<CreateOperationalStatusDto>({
    name: '',
    code: '',
    color: '#6B7280',
    order_index: 0,
  });

  useEffect(() => {
    loadStatuses();
  }, [orgId]);

  const loadStatuses = async () => {
    try {
      setLoading(true);
      const data = await operationalStatusService.getAll(orgId);
      setStatuses(data);
    } catch (error) {
      console.error('Error cargando estados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (status?: OperationalStatus) => {
    if (status) {
      setEditingStatus(status);
      setFormData({
        name: status.name,
        code: status.code,
        color: status.color,
        order_index: status.order_index,
      });
    } else {
      setEditingStatus(null);
      setFormData({
        name: '',
        code: '',
        color: '#6B7280',
        order_index: statuses.length,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingStatus(null);
    setFormData({
      name: '',
      code: '',
      color: '#6B7280',
      order_index: 0,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStatus) {
        await operationalStatusService.update(editingStatus.id, formData);
      } else {
        await operationalStatusService.create(orgId, formData);
      }
      await loadStatuses();
      handleCloseModal();
    } catch (error) {
      console.error('Error guardando estado:', error);
      alert('Error al guardar el estado operativo');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este estado operativo?')) return;
    
    try {
      await operationalStatusService.delete(id);
      await loadStatuses();
    } catch (error) {
      console.error('Error eliminando estado:', error);
      alert('Error al eliminar el estado operativo');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    
    const newStatuses = [...statuses];
    [newStatuses[index - 1], newStatuses[index]] = [newStatuses[index], newStatuses[index - 1]];
    
    const updates = newStatuses.map((status, idx) => ({
      id: status.id,
      order_index: idx,
    }));

    try {
      await operationalStatusService.reorder(updates);
      setStatuses(newStatuses);
    } catch (error) {
      console.error('Error reordenando:', error);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === statuses.length - 1) return;
    
    const newStatuses = [...statuses];
    [newStatuses[index], newStatuses[index + 1]] = [newStatuses[index + 1], newStatuses[index]];
    
    const updates = newStatuses.map((status, idx) => ({
      id: status.id,
      order_index: idx,
    }));

    try {
      await operationalStatusService.reorder(updates);
      setStatuses(newStatuses);
    } catch (error) {
      console.error('Error reordenando:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <i className="ri-loader-4-line text-3xl text-teal-600 animate-spin"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Estados Operativos</h2>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona los estados operativos disponibles para las reservas
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          Nuevo Estado
        </button>
      </div>

      {/* Lista de estados */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Orden
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Color
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Código
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {statuses.map((status, index) => (
              <tr key={status.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <i className="ri-arrow-up-s-line"></i>
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === statuses.length - 1}
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <i className="ri-arrow-down-s-line"></i>
                    </button>
                    <span className="text-sm text-gray-500 ml-2">{index + 1}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg border border-gray-200"
                      style={{ backgroundColor: status.color }}
                    ></div>
                    <span className="text-xs text-gray-500 font-mono">{status.color}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">{status.name}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600 font-mono">{status.code}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenModal(status)}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <i className="ri-edit-line"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(status.id)}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {statuses.length === 0 && (
          <div className="text-center py-12">
            <i className="ri-list-check text-4xl text-gray-300 mb-3"></i>
            <p className="text-gray-500">No hay estados operativos configurados</p>
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 text-teal-600 hover:text-teal-700 font-medium"
            >
              Crear el primero
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingStatus ? 'Editar Estado Operativo' : 'Nuevo Estado Operativo'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Ej: En Proceso"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono"
                  placeholder="Ej: in_progress"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Identificador único (sin espacios, minúsculas)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-16 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono"
                    placeholder="#6B7280"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
                >
                  {editingStatus ? 'Guardar Cambios' : 'Crear Estado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
