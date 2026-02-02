import { useState, useMemo } from 'react';

interface PendingReservation {
  id: string;
  dua: string;
  placa: string;
  chofer: string;
  orden_compra?: string;
  numero_pedido?: string;
  provider_name: string;
  warehouse_name: string;
  created_at: string;
}

interface PendingReservationsGridProps {
  reservations: PendingReservation[];
  onOpenIngreso: (reservation: PendingReservation) => void;
  isLoading?: boolean;
}

const safeText = (v: any, fallback = '-') => {
  const s = (v ?? '').toString().trim();
  return s.length ? s : fallback;
};

export function PendingReservationsGrid({ reservations, onOpenIngreso, isLoading }: PendingReservationsGridProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReservations = useMemo(() => {
    if (!searchTerm.trim()) return reservations;

    const term = searchTerm.toLowerCase();
    return reservations.filter((r) =>
      r.dua?.toLowerCase().includes(term) ||
      r.chofer?.toLowerCase().includes(term) ||
      r.provider_name?.toLowerCase().includes(term) ||
      r.placa?.toLowerCase().includes(term) ||
      (r.orden_compra ?? '').toLowerCase().includes(term)
    );
  }, [reservations, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-teal-600 animate-spin"></i>
          <p className="mt-2 text-gray-600">Cargando reservas pendientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por DUA, chofer, proveedor, placa, OC..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <i className="ri-close-line"></i>
          </button>
        )}
      </div>

      <div className="text-sm text-gray-600">
        {filteredReservations.length === reservations.length ? (
          <span>{reservations.length} reservas pendientes</span>
        ) : (
          <span>
            {filteredReservations.length} de {reservations.length} reservas
          </span>
        )}
      </div>

      {filteredReservations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <i className="ri-inbox-line text-5xl text-gray-400"></i>
          <p className="mt-2 text-gray-600 font-medium">
            {searchTerm ? 'No se encontraron reservas' : 'No hay reservas pendientes'}
          </p>
          {searchTerm && <p className="text-sm text-gray-500 mt-1">Intenta con otro término de búsqueda</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">DUA</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">MATRÍCULA</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">CHOFER</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">PROVEEDOR</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ALMACÉN</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">OC</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">ACCIÓN</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReservations.map((reservation) => (
                <tr key={reservation.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{safeText(reservation.dua)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{safeText(reservation.placa)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{safeText(reservation.chofer)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{safeText(reservation.provider_name, 'N/A')}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{safeText(reservation.warehouse_name, 'N/A')}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{safeText(reservation.orden_compra)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onOpenIngreso(reservation)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
                    >
                      <i className="ri-login-box-line"></i>
                      Abrir Ingreso
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}
    </div>
  );
}

