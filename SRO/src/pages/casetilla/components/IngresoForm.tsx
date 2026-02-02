import { useState } from 'react';
import type { CreateCasetillaIngresoInput } from '../../../types/casetilla';

interface IngresoFormProps {
  onSubmit: (data: CreateCasetillaIngresoInput) => Promise<void>;
  initialData?: Partial<CreateCasetillaIngresoInput>;
  isLoading?: boolean;
}

export function IngresoForm({ onSubmit, initialData, isLoading }: IngresoFormProps) {
  const [formData, setFormData] = useState<CreateCasetillaIngresoInput>({
    chofer: initialData?.chofer || '',
    matricula: initialData?.matricula || '',
    dua: initialData?.dua || '',
    factura: initialData?.factura || '',
    orden_compra: initialData?.orden_compra || '',
    numero_pedido: initialData?.numero_pedido || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleChange = (field: keyof CreateCasetillaIngresoInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Chofer <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.chofer}
          onChange={(e) => handleChange('chofer', e.target.value)}
          required
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="Nombre del chofer"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Número de Matrícula <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.matricula}
          onChange={(e) => handleChange('matricula', e.target.value.toUpperCase())}
          required
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="ABC-1234"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          DUA <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.dua}
          onChange={(e) => handleChange('dua', e.target.value)}
          required
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="Número DUA"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Factura <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.factura}
          onChange={(e) => handleChange('factura', e.target.value)}
          required
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="Número de factura"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Orden de Compra</label>
        <input
          type="text"
          value={formData.orden_compra}
          onChange={(e) => handleChange('orden_compra', e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="Número de OC (opcional)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Número de Pedido</label>
        <input
          type="text"
          value={formData.numero_pedido}
          onChange={(e) => handleChange('numero_pedido', e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="Número de pedido (opcional)"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-teal-600 text-white py-2.5 px-4 rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium whitespace-nowrap"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <i className="ri-loader-4-line animate-spin"></i>
            Registrando...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <i className="ri-save-line"></i>
            Registrar Ingreso
          </span>
        )}
      </button>
    </form>
  );
}

