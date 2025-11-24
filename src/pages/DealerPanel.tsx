import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Seguimiento, Comanda, ComandaCompleta } from '../types';
import { 
  iniciarDespacho, 
  confirmarEntrega, 
  reportarIncidenciaDespacho 
} from '../services/seguimientoService';
import { 
  normalizarTipoCliente, 
  normalizarTipoEntrega, 
  generarCodigoVerificador,
  normalizarTelefono 
} from '../utils/normalize';
import { 
  BsTruck, 
  BsCheckCircle, 
  BsTelephoneFill, 
  BsGeoAltFill,
  BsClipboard,
  BsExclamationTriangle
} from 'react-icons/bs';
import Loader from '../components/Loader';

export const DealerPanel = () => {
  const { userData } = useAuth();
  const [comandasCompletas, setComandasCompletas] = useState<ComandaCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [comandaSeleccionada, setComandaSeleccionada] = useState<ComandaCompleta | null>(null);
  const [modalActivo, setModalActivo] = useState<'iniciar' | 'entregar' | 'incidencia' | null>(null);

  // Estados para modales
  const [vehiculo, setVehiculo] = useState('');
  const [patente, setPatente] = useState('');
  const [codigoDespacho, setCodigoDespacho] = useState('');
  const [personaQueRecibe, setPersonaQueRecibe] = useState('');
  const [tipoIncidencia, setTipoIncidencia] = useState<'cliente_ausente' | 'direccion_incorrecta' | 'falla_vehiculo' | 'otro'>('cliente_ausente');
  const [descripcionIncidencia, setDescripcionIncidencia] = useState('');
  const [errorModal, setErrorModal] = useState('');
  const [loadingModal, setLoadingModal] = useState(false);

  // Cargar comandas listo_despacho y en_despacho
  useEffect(() => {
    const q = query(
      collection(db, 'seguimiento_3'),
      where('activo', '==', true),
      where('estadoActual', 'in', ['listo_despacho', 'en_despacho'])
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const comandasData: ComandaCompleta[] = [];

      for (const docSnap of snapshot.docs) {
        const seguimientoData = docSnap.data();
        const seguimiento: Seguimiento = {
          id: docSnap.id,
          ...seguimientoData,
          historialEstados: seguimientoData.historialEstados?.map((h: any) => ({
            ...h,
            fechaCambio: h.fechaCambio?.toDate()
          })) || [],
          desmanche: {
            ...seguimientoData.desmanche,
            ultimaFecha: seguimientoData.desmanche?.ultimaFecha?.toDate() || null
          },
          despacho: seguimientoData.despacho ? {
            ...seguimientoData.despacho,
            horaSalida: seguimientoData.despacho.horaSalida?.toDate() || null,
            horaEntrega: seguimientoData.despacho.horaEntrega?.toDate() || null,
            incidencia: {
              ...seguimientoData.despacho.incidencia,
              fecha: seguimientoData.despacho.incidencia?.fecha?.toDate() || null
            }
          } : undefined,
          incidencias: seguimientoData.incidencias?.map((inc: any) => ({
            ...inc,
            fecha: inc.fecha?.toDate()
          })) || [],
          fechaCreacion: seguimientoData.fechaCreacion?.toDate(),
          fechaUltimaActualizacion: seguimientoData.fechaUltimaActualizacion?.toDate()
        } as Seguimiento;

        // Obtener comanda asociada
        try {
          const comandaRef = doc(db, 'comandas_2', seguimiento.comanda_id);
          const comandaDoc = await getDoc(comandaRef);

          if (comandaDoc.exists()) {
            const comandaData = comandaDoc.data();
            const comanda: Comanda = {
              id: comandaDoc.id,
              numeroOrden: comandaData.numeroOrden,
              codigoDespacho: comandaData.codigoDespacho || generarCodigoVerificador(),
              numeroBoucher: comandaData.numeroBoucher || '',
              nombreCliente: comandaData.nombreCliente,
              telefono: normalizarTelefono(comandaData.telefono),
              tipoCliente: normalizarTipoCliente(comandaData.tipoCliente || 'Particular'),
              direccion: comandaData.direccion || undefined,
              fechaIngreso: comandaData.fechaIngreso?.toDate() || new Date(),
              horaIngreso: comandaData.horaIngreso || '',
              fechaNotificacion: comandaData.fechaNotificacion?.toDate() || undefined,
              prendas: comandaData.prendas || [],
              montoSubtotal: comandaData.montoSubtotal || 0,
              montoTotal: comandaData.montoTotal || 0,
              tipoEntrega: normalizarTipoEntrega(comandaData.tipoEntrega || 'Retiro'),
              servicioExpress: comandaData.servicioExpress || false,
              notificado: comandaData.notificado || false
            } as Comanda;

            comandasData.push({ comanda, seguimiento });
          }
        } catch (error) {
          console.error('Error al obtener comanda:', error);
        }
      }

      setComandasCompletas(comandasData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Funciones para abrir modales
  const abrirModalIniciar = (comandaCompleta: ComandaCompleta) => {
    setComandaSeleccionada(comandaCompleta);
    setModalActivo('iniciar');
    setErrorModal('');
  };

  const abrirModalEntregar = (comandaCompleta: ComandaCompleta) => {
    setComandaSeleccionada(comandaCompleta);
    setModalActivo('entregar');
    setErrorModal('');
  };

  const abrirModalIncidencia = (comandaCompleta: ComandaCompleta) => {
    setComandaSeleccionada(comandaCompleta);
    setModalActivo('incidencia');
    setErrorModal('');
  };

  const cerrarModal = () => {
    setModalActivo(null);
    setComandaSeleccionada(null);
    setVehiculo('');
    setPatente('');
    setCodigoDespacho('');
    setPersonaQueRecibe('');
    setDescripcionIncidencia('');
    setErrorModal('');
  };

  // Handler: Iniciar despacho
  const handleIniciarDespacho = async () => {
    if (!comandaSeleccionada || !userData) return;

    if (!vehiculo.trim() || !patente.trim()) {
      setErrorModal('Debes completar todos los campos');
      return;
    }

    try {
      setLoadingModal(true);
      await iniciarDespacho(
        comandaSeleccionada.seguimiento,
        userData.id || userData.uid,
        userData.nombre,
        vehiculo.trim(),
        patente.trim().toUpperCase()
      );
      cerrarModal();
    } catch (error: any) {
      setErrorModal(error.message || 'Error al iniciar despacho');
    } finally {
      setLoadingModal(false);
    }
  };

  // Handler: Confirmar entrega
  const handleConfirmarEntrega = async () => {
    if (!comandaSeleccionada || !userData) return;

    if (!codigoDespacho.trim() || !personaQueRecibe.trim()) {
      setErrorModal('Debes completar todos los campos');
      return;
    }

    try {
      setLoadingModal(true);
      await confirmarEntrega(
        comandaSeleccionada.seguimiento,
        comandaSeleccionada.comanda,
        codigoDespacho.trim(),
        personaQueRecibe.trim(),
        userData.id || userData.uid,
        userData.nombre
      );
      cerrarModal();
    } catch (error: any) {
      setErrorModal(error.message || 'Error al confirmar entrega');
    } finally {
      setLoadingModal(false);
    }
  };

  // Handler: Reportar incidencia
  const handleReportarIncidencia = async () => {
    if (!comandaSeleccionada) return;

    if (tipoIncidencia === 'otro' && !descripcionIncidencia.trim()) {
      setErrorModal('Debes describir la incidencia');
      return;
    }

    try {
      setLoadingModal(true);
      
      const descripcionFinal = tipoIncidencia === 'otro' 
        ? descripcionIncidencia.trim()
        : getDescripcionIncidencia(tipoIncidencia);

      await reportarIncidenciaDespacho(
        comandaSeleccionada.seguimiento,
        tipoIncidencia,
        descripcionFinal
      );
      cerrarModal();
    } catch (error: any) {
      setErrorModal(error.message || 'Error al reportar incidencia');
    } finally {
      setLoadingModal(false);
    }
  };

  const getDescripcionIncidencia = (tipo: string): string => {
    const descripciones: Record<string, string> = {
      cliente_ausente: 'Cliente no se encuentra en el domicilio',
      direccion_incorrecta: 'La dirección proporcionada es incorrecta o no existe',
      falla_vehiculo: 'El vehículo presenta una falla mecánica'
    };
    return descripciones[tipo] || '';
  };

  // Función para hacer llamada telefónica
  const handleLlamar = (telefono: string) => {
    window.location.href = `tel:${telefono}`;
  };

  // Función para abrir en Google Maps
  const handleAbrirMaps = (direccion: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
    window.open(url, '_blank');
  };

  // Función para copiar dirección
  const handleCopiarDireccion = (direccion: string) => {
    navigator.clipboard.writeText(direccion);
    alert('Dirección copiada al portapapeles');
  };

  if (loading) {
    return (
      <Loader fullScreen text="Cargando despachos..." />
    );
  }

  const listoDespacho = comandasCompletas.filter(c => c.seguimiento.estadoActual === 'listo_despacho');
  const enDespacho = comandasCompletas.filter(c => c.seguimiento.estadoActual === 'en_despacho');

  return (
    <div className="min-h-screen bg-spac-light pb-20">
      {/* Header */}
      <nav className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-spac-dark">Panel de Despacho</h1>
            <p className="text-sm text-spac-gray">{userData?.nombre}</p>
          </div>
        </div>
      </nav>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Sección: Listo para Despacho */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BsCheckCircle className="text-2xl text-teal-600" />
            <h2 className="text-lg font-bold text-spac-dark">Listo para Despacho</h2>
            <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded-full text-sm font-semibold">
              {listoDespacho.length}
            </span>
          </div>

          {listoDespacho.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-center text-spac-gray">
              No hay pedidos listos para despacho
            </div>
          ) : (
            <div className="space-y-3">
              {listoDespacho.map(cc => (
                <ComandaCard 
                  key={cc.seguimiento.id} 
                  comandaCompleta={cc}
                  onIniciar={abrirModalIniciar}
                />
              ))}
            </div>
          )}
        </section>

        {/* Sección: En Despacho */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BsTruck className="text-2xl text-cyan-600" />
            <h2 className="text-lg font-bold text-spac-dark">En Despacho</h2>
            <span className="bg-cyan-100 text-cyan-800 px-2 py-1 rounded-full text-sm font-semibold">
              {enDespacho.length}
            </span>
          </div>

          {enDespacho.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-center text-spac-gray">
              No tienes despachos en curso
            </div>
          ) : (
            <div className="space-y-3">
              {enDespacho.map(cc => (
                <ComandaCard 
                  key={cc.seguimiento.id} 
                  comandaCompleta={cc}
                  onEntregar={abrirModalEntregar}
                  onIncidencia={abrirModalIncidencia}
                  onLlamar={handleLlamar}
                  onAbrirMaps={handleAbrirMaps}
                  onCopiarDireccion={handleCopiarDireccion}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modales */}
      {modalActivo === 'iniciar' && comandaSeleccionada && (
        <ModalIniciarDespacho
          comanda={comandaSeleccionada.comanda}
          vehiculo={vehiculo}
          setVehiculo={setVehiculo}
          patente={patente}
          setPatente={setPatente}
          error={errorModal}
          loading={loadingModal}
          onConfirmar={handleIniciarDespacho}
          onCancelar={cerrarModal}
        />
      )}

      {modalActivo === 'entregar' && comandaSeleccionada && (
        <ModalConfirmarEntrega
          comanda={comandaSeleccionada.comanda}
          codigoDespacho={codigoDespacho}
          setCodigoDespacho={setCodigoDespacho}
          personaQueRecibe={personaQueRecibe}
          setPersonaQueRecibe={setPersonaQueRecibe}
          error={errorModal}
          loading={loadingModal}
          onConfirmar={handleConfirmarEntrega}
          onCancelar={cerrarModal}
        />
      )}

      {modalActivo === 'incidencia' && comandaSeleccionada && (
        <ModalReportarIncidencia
          comanda={comandaSeleccionada.comanda}
          tipoIncidencia={tipoIncidencia}
          setTipoIncidencia={setTipoIncidencia}
          descripcion={descripcionIncidencia}
          setDescripcion={setDescripcionIncidencia}
          error={errorModal}
          loading={loadingModal}
          onConfirmar={handleReportarIncidencia}
          onCancelar={cerrarModal}
        />
      )}
    </div>
  );
};

// ============================================
// COMPONENTE: Tarjeta de Comanda
// ============================================
interface ComandaCardProps {
  comandaCompleta: ComandaCompleta;
  onIniciar?: (cc: ComandaCompleta) => void;
  onEntregar?: (cc: ComandaCompleta) => void;
  onIncidencia?: (cc: ComandaCompleta) => void;
  onLlamar?: (telefono: string) => void;
  onAbrirMaps?: (direccion: string) => void;
  onCopiarDireccion?: (direccion: string) => void;
}

const ComandaCard = ({ 
  comandaCompleta, 
  onIniciar, 
  onEntregar, 
  onIncidencia,
  onLlamar,
  onAbrirMaps,
  onCopiarDireccion
}: ComandaCardProps) => {
  const { comanda, seguimiento } = comandaCompleta;
  const esEnDespacho = seguimiento.estadoActual === 'en_despacho';

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-lg font-bold text-spac-dark">{comanda.numeroOrden}</p>
          <p className="text-sm text-spac-gray">{comanda.nombreCliente}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
          esEnDespacho ? 'bg-cyan-100 text-cyan-800' : 'bg-teal-100 text-teal-800'
        }`}>
          {esEnDespacho ? 'En Camino' : 'Listo'}
        </span>
      </div>

      {/* Información de contacto */}
      <div className="space-y-2 mb-4">
        <button
          onClick={() => onLlamar?.(comanda.telefono)}
          className="flex items-center gap-2 text-spac-dark hover:text-spac-orange transition w-full text-left"
        >
          <BsTelephoneFill className="text-spac-orange" />
          <span className="font-medium">{comanda.telefono}</span>
        </button>

        {comanda.direccion && (
          <div className="flex items-start gap-2">
            <BsGeoAltFill className="text-spac-orange mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-spac-dark">{comanda.direccion}</p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => onAbrirMaps?.(comanda.direccion!)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Abrir en Maps
                </button>
                <span className="text-xs text-gray-400">•</span>
                <button
                  onClick={() => onCopiarDireccion?.(comanda.direccion!)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info adicional en despacho */}
      {esEnDespacho && seguimiento.despacho && (
        <div className="bg-cyan-50 rounded-lg p-3 mb-4 space-y-1">
          <p className="text-sm font-semibold text-cyan-900">
            Vehículo: {seguimiento.despacho.vehiculo}
          </p>
          <p className="text-sm text-cyan-800">
            Patente: {seguimiento.despacho.patente}
          </p>
          <p className="text-xs text-cyan-700">
            Salida: {seguimiento.despacho.horaSalida?.toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-2">
        {!esEnDespacho && onIniciar && (
          <button
            onClick={() => onIniciar(comandaCompleta)}
            className="flex-1 bg-spac-orange hover:bg-spac-orange-dark text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
          >
            <BsTruck />
            Iniciar Despacho
          </button>
        )}

        {esEnDespacho && (
          <>
            <button
              onClick={() => onEntregar?.(comandaCompleta)}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <BsCheckCircle />
              Confirmar Entrega
            </button>
            <button
              onClick={() => onIncidencia?.(comandaCompleta)}
              className="px-4 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg transition"
            >
              <BsExclamationTriangle />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// MODAL: Iniciar Despacho
// ============================================
interface ModalIniciarDespachoProps {
  comanda: Comanda;
  vehiculo: string;
  setVehiculo: (v: string) => void;
  patente: string;
  setPatente: (p: string) => void;
  error: string;
  loading: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const ModalIniciarDespacho = ({
  comanda,
  vehiculo,
  setVehiculo,
  patente,
  setPatente,
  error,
  loading,
  onConfirmar,
  onCancelar
}: ModalIniciarDespachoProps) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
      <div className="bg-spac-orange text-white p-6 rounded-t-xl">
        <h2 className="text-xl font-bold">Iniciar Despacho</h2>
        <p className="text-sm opacity-90 mt-1">{comanda.numeroOrden}</p>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-spac-dark mb-2">
            Tipo de Vehículo
          </label>
          <input
            type="text"
            value={vehiculo}
            onChange={(e) => setVehiculo(e.target.value)}
            placeholder="Ej: Camioneta, Moto, Auto"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-spac-orange focus:border-transparent"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-spac-dark mb-2">
            Patente
          </label>
          <input
            type="text"
            value={patente}
            onChange={(e) => setPatente(e.target.value.toUpperCase())}
            placeholder="Ej: ABCD12"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-spac-orange focus:border-transparent uppercase"
            maxLength={6}
            disabled={loading}
          />
        </div>
      </div>

      <div className="p-6 bg-gray-50 rounded-b-xl flex gap-3">
        <button
          onClick={onCancelar}
          disabled={loading}
          className="flex-1 px-4 py-3 bg-gray-300 hover:bg-gray-400 text-spac-dark font-semibold rounded-lg transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirmar}
          disabled={loading || !vehiculo.trim() || !patente.trim()}
          className="flex-1 px-4 py-3 bg-spac-orange hover:bg-spac-orange-dark text-white font-semibold rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Iniciando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  </div>
);

// ============================================
// MODAL: Confirmar Entrega
// ============================================
interface ModalConfirmarEntregaProps {
  comanda: Comanda;
  codigoDespacho: string;
  setCodigoDespacho: (c: string) => void;
  personaQueRecibe: string;
  setPersonaQueRecibe: (p: string) => void;
  error: string;
  loading: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const ModalConfirmarEntrega = ({
  comanda,
  codigoDespacho,
  setCodigoDespacho,
  personaQueRecibe,
  setPersonaQueRecibe,
  error,
  loading,
  onConfirmar,
  onCancelar
}: ModalConfirmarEntregaProps) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
      <div className="bg-green-600 text-white p-6 rounded-t-xl">
        <h2 className="text-xl font-bold">Confirmar Entrega</h2>
        <p className="text-sm opacity-90 mt-1">{comanda.numeroOrden}</p>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm font-semibold text-blue-900 mb-1 flex items-center gap-2">
            <BsClipboard />
            Cliente: {comanda.nombreCliente}
          </p>
          <p className="text-xs text-blue-700">
            Solicita el código verificador de 5 caracteres
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-spac-dark mb-2">
            Código Verificador
          </label>
          <input
            type="text"
            value={codigoDespacho}
            onChange={(e) => setCodigoDespacho(e.target.value.toUpperCase())}
            placeholder="Ej: A3F9Z"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase text-center text-lg font-bold tracking-widest"
            maxLength={5}
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-spac-dark mb-2">
            Nombre de Quien Recibe
          </label>
          <input
            type="text"
            value={personaQueRecibe}
            onChange={(e) => setPersonaQueRecibe(e.target.value)}
            placeholder="Nombre completo"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
      </div>

      <div className="p-6 bg-gray-50 rounded-b-xl flex gap-3">
        <button
          onClick={onCancelar}
          disabled={loading}
          className="flex-1 px-4 py-3 bg-gray-300 hover:bg-gray-400 text-spac-dark font-semibold rounded-lg transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirmar}
          disabled={loading || codigoDespacho.length !== 5 || !personaQueRecibe.trim()}
          className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Confirmando...' : 'Confirmar Entrega'}
        </button>
      </div>
    </div>
  </div>
);

// ============================================
// MODAL: Reportar Incidencia
// ============================================
interface ModalReportarIncidenciaProps {
  comanda: Comanda;
  tipoIncidencia: 'cliente_ausente' | 'direccion_incorrecta' | 'falla_vehiculo' | 'otro';
  setTipoIncidencia: (t: 'cliente_ausente' | 'direccion_incorrecta' | 'falla_vehiculo' | 'otro') => void;
  descripcion: string;
  setDescripcion: (d: string) => void;
  error: string;
  loading: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const ModalReportarIncidencia = ({
  comanda,
  tipoIncidencia,
  setTipoIncidencia,
  descripcion,
  setDescripcion,
  error,
  loading,
  onConfirmar,
  onCancelar
}: ModalReportarIncidenciaProps) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
      <div className="bg-red-600 text-white p-6 rounded-t-xl">
        <h2 className="text-xl font-bold">Reportar Incidencia</h2>
        <p className="text-sm opacity-90 mt-1">{comanda.numeroOrden}</p>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-spac-dark mb-3">
            Tipo de Incidencia
          </label>
          <div className="space-y-2">
            {[
              { value: 'cliente_ausente', label: 'Cliente Ausente' },
              { value: 'direccion_incorrecta', label: 'Dirección Incorrecta' },
              { value: 'falla_vehiculo', label: 'Falla en Vehículo' },
              { value: 'otro', label: 'Otro' }
            ].map(option => (
              <label
                key={option.value}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                  tipoIncidencia === option.value
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="tipoIncidencia"
                  value={option.value}
                  checked={tipoIncidencia === option.value}
                  onChange={(e) => setTipoIncidencia(e.target.value as any)}
                  className="w-5 h-5 text-red-600"
                  disabled={loading}
                />
                <span className="font-medium text-spac-dark">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {tipoIncidencia === 'otro' && (
          <div>
            <label className="block text-sm font-semibold text-spac-dark mb-2">
              Describe la Incidencia
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalla el problema..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              disabled={loading}
            />
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
          <p className="text-xs text-yellow-800">
            ⚠️ Al reportar una incidencia, el pedido quedará marcado como fallido y se notificará al administrador.
          </p>
        </div>
      </div>

      <div className="p-6 bg-gray-50 rounded-b-xl flex gap-3">
        <button
          onClick={onCancelar}
          disabled={loading}
          className="flex-1 px-4 py-3 bg-gray-300 hover:bg-gray-400 text-spac-dark font-semibold rounded-lg transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirmar}
          disabled={loading || (tipoIncidencia === 'otro' && !descripcion.trim())}
          className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Reportando...' : 'Reportar Incidencia'}
        </button>
      </div>
    </div>
  </div>
);