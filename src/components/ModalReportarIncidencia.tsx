import { useState } from 'react';
import type { ComandaCompleta, TipoIncidencia } from '../types';
import { PLANTILLAS_INCIDENCIAS_OPERARIO } from '../types';
import { reportarIncidencia } from '../services/seguimientoService';
import { useAuth } from '../contexts/AuthContext';

interface ModalReportarIncidenciaProps {
  comandaCompleta: ComandaCompleta;
  onClose: () => void;
  onSuccess: () => void;
}

export const ModalReportarIncidencia = ({ 
  comandaCompleta, 
  onClose, 
  onSuccess 
}: ModalReportarIncidenciaProps) => {
  const { userData } = useAuth();
  const { comanda, seguimiento } = comandaCompleta;
  
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoIncidencia | null>(null);
  const [descripcionPersonalizada, setDescripcionPersonalizada] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReportar = async () => {
    if (!userData || !tipoSeleccionado) return;

    // Validar descripción si es tipo "otro"
    if (tipoSeleccionado === 'otro' && !descripcionPersonalizada.trim()) {
      setError('Debes describir la incidencia');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Obtener descripción final
      let descripcionFinal = descripcionPersonalizada.trim();
      
      if (tipoSeleccionado !== 'otro') {
        const plantilla = PLANTILLAS_INCIDENCIAS_OPERARIO.find(p => p.tipo === tipoSeleccionado);
        descripcionFinal = plantilla?.descripcion || '';
        
        // Si hay descripción personalizada adicional, agregarla
        if (descripcionPersonalizada.trim()) {
          descripcionFinal += ` - ${descripcionPersonalizada.trim()}`;
        }
      }

      await reportarIncidencia(
        seguimiento,
        userData.id || '',
        userData.nombre,
        tipoSeleccionado,
        descripcionFinal
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error al reportar incidencia:', error);
      setError(error.message || 'Error al reportar incidencia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-red-600 text-white p-6 rounded-t-xl">
          <h2 className="text-xl font-bold">Reportar Incidencia</h2>
          <p className="text-sm opacity-90 mt-1">
            {comanda.numeroOrden} - {comanda.nombreCliente}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Información del estado actual */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 mb-1">
              Estado actual: <span className="capitalize">{seguimiento.estadoActual.replace('_', ' ')}</span>
            </p>
            <p className="text-xs text-blue-700">
              La incidencia quedará registrada en este estado
            </p>
          </div>

          {/* Selector de tipo de incidencia */}
          <div>
            <label className="block text-sm font-semibold text-spac-dark mb-3">
              Tipo de Incidencia
            </label>
            <div className="space-y-2">
              {PLANTILLAS_INCIDENCIAS_OPERARIO.map(plantilla => (
                <label
                  key={plantilla.tipo}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                    tipoSeleccionado === plantilla.tipo
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipoIncidencia"
                    value={plantilla.tipo}
                    checked={tipoSeleccionado === plantilla.tipo}
                    onChange={() => setTipoSeleccionado(plantilla.tipo)}
                    className="w-5 h-5 text-red-600 mt-0.5"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-spac-dark">{plantilla.titulo}</p>
                    {plantilla.descripcion && plantilla.tipo !== 'otro' && (
                      <p className="text-xs text-spac-gray mt-1">{plantilla.descripcion}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Campo de descripción adicional/personalizada */}
          {tipoSeleccionado && (
            <div>
              <label className="block text-sm font-semibold text-spac-dark mb-2">
                {tipoSeleccionado === 'otro' ? 'Describe la Incidencia *' : 'Detalles Adicionales (Opcional)'}
              </label>
              <textarea
                value={descripcionPersonalizada}
                onChange={(e) => setDescripcionPersonalizada(e.target.value)}
                placeholder={
                  tipoSeleccionado === 'otro'
                    ? 'Describe el problema en detalle...'
                    : 'Agrega información adicional si es necesario...'
                }
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                disabled={loading}
              />
              {tipoSeleccionado !== 'otro' && (
                <p className="text-xs text-spac-gray mt-1">
                  💡 Reemplaza [ESPECIFICAR] con la información específica
                </p>
              )}
            </div>
          )}

          {/* Advertencia */}
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
            <p className="text-xs text-yellow-800">
              ⚠️ La incidencia quedará registrada y será visible para los administradores. 
              No detendrá el proceso del pedido.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 rounded-b-xl flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-300 hover:bg-gray-400 text-spac-dark font-semibold rounded-lg transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleReportar}
            disabled={loading || !tipoSeleccionado || (tipoSeleccionado === 'otro' && !descripcionPersonalizada.trim())}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Reportando...' : 'Reportar Incidencia'}
          </button>
        </div>
      </div>
    </div>
  );
};