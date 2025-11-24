import { useState } from 'react';
import type { ComandaCompleta, TipoIncidencia } from '../types';
import { reportarIncidencia } from '../services/seguimientoService';
import { useAuth } from '../contexts/AuthContext';

interface ModalReportarIncidenciaProps {
  comandaCompleta: ComandaCompleta;
  onClose: () => void;
  onSuccess: () => void;
}

// Catálogos de equipos e insumos
const EQUIPOS = [
  'Lavadora Industrial',
  'Secadora Industrial',
  'Plancha de Rodillo',
  'Plancha de Vapor',
  'Centro de Planchado',
  'Caldera',
  'Otro equipo'
];

const INSUMOS = [
  'Detergente Industrial',
  'Cloro / Blanqueador',
  'Suavizante',
  'Quitamanchas',
  'Desinfectante',
  'Bolsas de Empaquetado',
  'Etiquetas',
  'Otro insumo'
];

const TIPOS_DAÑO_PRENDA = [
  'Mancha persistente',
  'Desgarro / Rotura',
  'Decoloración',
  'Encogimiento',
  'Quemadura por plancha',
  'Pérdida de botones',
  'Otro daño'
];

export const ModalReportarIncidencia = ({ 
  comandaCompleta, 
  onClose, 
  onSuccess 
}: ModalReportarIncidenciaProps) => {
  const { userData } = useAuth();
  const { comanda, seguimiento } = comandaCompleta;
  
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoIncidencia | null>(null);
  
  // Selectores específicos
  const [equipoSeleccionado, setEquipoSeleccionado] = useState('');
  const [insumoSeleccionado, setInsumoSeleccionado] = useState('');
  const [tipoDañoSeleccionado, setTipoDañoSeleccionado] = useState('');
  
  const [descripcionAdicional, setDescripcionAdicional] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReportar = async () => {
    if (!userData || !tipoSeleccionado) return;

    // Construir descripción según tipo
    let descripcionFinal = '';

    switch (tipoSeleccionado) {
      case 'falla_equipo':
        if (!equipoSeleccionado) {
          setError('Selecciona el equipo con falla');
          return;
        }
        descripcionFinal = `Falla en: ${equipoSeleccionado}`;
        if (descripcionAdicional.trim()) {
          descripcionFinal += ` - ${descripcionAdicional.trim()}`;
        }
        break;

      case 'falta_insumo':
        if (!insumoSeleccionado) {
          setError('Selecciona el insumo faltante');
          return;
        }
        descripcionFinal = `Falta de: ${insumoSeleccionado}`;
        if (descripcionAdicional.trim()) {
          descripcionFinal += ` - ${descripcionAdicional.trim()}`;
        }
        break;

      case 'prenda_danada':
        if (!tipoDañoSeleccionado) {
          setError('Selecciona el tipo de daño');
          return;
        }
        descripcionFinal = `Prenda dañada - ${tipoDañoSeleccionado}`;
        if (descripcionAdicional.trim()) {
          descripcionFinal += ` - ${descripcionAdicional.trim()}`;
        }
        break;

      case 'otro':
        if (!descripcionAdicional.trim()) {
          setError('Describe la incidencia');
          return;
        }
        descripcionFinal = descripcionAdicional.trim();
        break;
    }

    try {
      setLoading(true);
      setError('');

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

  const resetSelecciones = () => {
    setEquipoSeleccionado('');
    setInsumoSeleccionado('');
    setTipoDañoSeleccionado('');
    setDescripcionAdicional('');
    setError('');
  };

  const handleTipoChange = (tipo: TipoIncidencia) => {
    setTipoSeleccionado(tipo);
    resetSelecciones();
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
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                  tipoSeleccionado === 'falla_equipo'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="tipoIncidencia"
                  value="falla_equipo"
                  checked={tipoSeleccionado === 'falla_equipo'}
                  onChange={() => handleTipoChange('falla_equipo')}
                  className="w-5 h-5 text-red-600 mt-0.5"
                  disabled={loading}
                />
                <div className="flex-1">
                  <p className="font-medium text-spac-dark">⚙️ Falla en Equipo</p>
                  <p className="text-xs text-spac-gray mt-1">Equipo no funciona correctamente</p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                  tipoSeleccionado === 'falta_insumo'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="tipoIncidencia"
                  value="falta_insumo"
                  checked={tipoSeleccionado === 'falta_insumo'}
                  onChange={() => handleTipoChange('falta_insumo')}
                  className="w-5 h-5 text-red-600 mt-0.5"
                  disabled={loading}
                />
                <div className="flex-1">
                  <p className="font-medium text-spac-dark">📦 Falta de Insumo</p>
                  <p className="text-xs text-spac-gray mt-1">No hay suficiente insumo para continuar</p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                  tipoSeleccionado === 'prenda_danada'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="tipoIncidencia"
                  value="prenda_danada"
                  checked={tipoSeleccionado === 'prenda_danada'}
                  onChange={() => handleTipoChange('prenda_danada')}
                  className="w-5 h-5 text-red-600 mt-0.5"
                  disabled={loading}
                />
                <div className="flex-1">
                  <p className="font-medium text-spac-dark">👕 Prenda Dañada</p>
                  <p className="text-xs text-spac-gray mt-1">La prenda presenta algún daño</p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                  tipoSeleccionado === 'otro'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="tipoIncidencia"
                  value="otro"
                  checked={tipoSeleccionado === 'otro'}
                  onChange={() => handleTipoChange('otro')}
                  className="w-5 h-5 text-red-600 mt-0.5"
                  disabled={loading}
                />
                <div className="flex-1">
                  <p className="font-medium text-spac-dark">⚠️ Otro</p>
                  <p className="text-xs text-spac-gray mt-1">Otra incidencia no listada</p>
                </div>
              </label>
            </div>
          </div>

          {/* Selector específico según tipo */}
          {tipoSeleccionado === 'falla_equipo' && (
            <div>
              <label className="block text-sm font-semibold text-spac-dark mb-2">
                ¿Qué equipo presenta la falla? *
              </label>
              <select
                value={equipoSeleccionado}
                onChange={(e) => setEquipoSeleccionado(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="">Selecciona el equipo...</option>
                {EQUIPOS.map(equipo => (
                  <option key={equipo} value={equipo}>{equipo}</option>
                ))}
              </select>
            </div>
          )}

          {tipoSeleccionado === 'falta_insumo' && (
            <div>
              <label className="block text-sm font-semibold text-spac-dark mb-2">
                ¿Qué insumo falta? *
              </label>
              <select
                value={insumoSeleccionado}
                onChange={(e) => setInsumoSeleccionado(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="">Selecciona el insumo...</option>
                {INSUMOS.map(insumo => (
                  <option key={insumo} value={insumo}>{insumo}</option>
                ))}
              </select>
            </div>
          )}

          {tipoSeleccionado === 'prenda_danada' && (
            <div>
              <label className="block text-sm font-semibold text-spac-dark mb-2">
                ¿Qué tipo de daño presenta? *
              </label>
              <select
                value={tipoDañoSeleccionado}
                onChange={(e) => setTipoDañoSeleccionado(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="">Selecciona el tipo de daño...</option>
                {TIPOS_DAÑO_PRENDA.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
          )}

          {/* Descripción adicional */}
          {tipoSeleccionado && (
            <div>
              <label className="block text-sm font-semibold text-spac-dark mb-2">
                {tipoSeleccionado === 'otro' ? 'Describe la Incidencia *' : 'Detalles Adicionales (Opcional)'}
              </label>
              <textarea
                value={descripcionAdicional}
                onChange={(e) => setDescripcionAdicional(e.target.value)}
                placeholder={
                  tipoSeleccionado === 'otro'
                    ? 'Describe el problema en detalle...'
                    : 'Agrega información adicional si es necesario...'
                }
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                disabled={loading}
              />
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
            disabled={loading || !tipoSeleccionado}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Reportando...' : 'Reportar Incidencia'}
          </button>
        </div>
      </div>
    </div>
  );
};