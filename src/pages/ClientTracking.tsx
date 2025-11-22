import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase.ts";
import logo from "../assets/logo.png";

export const ClientTracking = () => {
  const { codigo } = useParams<{ codigo: string }>(); // Extrae código de la URL

  const palette = {
    naranja: "#ff6b35",
    naranjaOscuro: "#e85d2e",
    dorado: "#ffb84d",
    textoPrimario: "#1a1a2e",
    textoSecundario: "#2c2c3e",
    blanco: "#ffffff",
    fondoClaro: "#fff4f0",
  };

  const stages = ["Recibida","Lavado","Enjuague","Secado","Planchado","Retiro","En ruta","Entregado"];
  const icons: Record<string, string> = {
    Recibida:"📥", Lavado:"🧼", Enjuague:"💧", Secado:"🌬️", Planchado:"🧺",
    Retiro:"✅","En ruta":"🚚", Entregado:"📦"
  };

  const [pedido, setPedido] = useState<any>(null);
  const [activeStage, setActiveStage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codigo) return;

    const fetchPedido = async () => {
      const docRef = doc(db, "comandas", codigo);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setPedido(data);

        const historial = data.historialEstados || [];
        if (historial.length > 0) {
          setActiveStage(historial[historial.length - 1].estado);
        } else {
          setActiveStage("Recibida");
        }
      } else {
        console.error("Pedido no encontrado");
      }
      setLoading(false);
    };

    fetchPedido();
  }, [codigo]);

  if (loading) return <p>Cargando...</p>;
  if (!pedido) return <p>No se encontró el pedido.</p>;

  const employeeInfo = pedido.empleadosAsignados?.lavando?.empleados?.[0] || { employeeCode: "", employeeName: "" };
  const clientInfo = pedido.cliente;
  const bottomBarHeight = 84;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", backgroundColor: palette.fondoClaro, minHeight: "100vh", color: palette.textoPrimario, display: "flex", flexDirection: "column" }}>
      {/* NAVBAR */}
      <nav style={{ width: "100%", padding: "16px 24px", backgroundColor: palette.naranja, color: palette.blanco, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <img src={logo} alt="Logo Lavandería" style={{ height: "40px", width: "40px", objectFit: "contain" }} />
          <h2 style={{ margin: 0 }}>Lavandería el Cobre S.P.A</h2>
        </div>
        <div style={{ fontWeight: 700 }}>Comanda: {pedido.codigoSeguimiento}</div>
      </nav>

      <main style={{ padding: "24px", paddingBottom: `${bottomBarHeight + 24}px`, flex: 1 }}>
        <h1 style={{ marginBottom: "20px" }}>Estado de tu ropa</h1>
        <section style={{ backgroundColor: palette.blanco, padding: "24px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", overflowX: "auto" }}>
          <div style={{ display: "flex", gap: "32px", alignItems: "center", minWidth: "900px", padding: "10px 0" }}>
            {stages.map(stage => {
              const isActive = stage === activeStage;
              return (
                <div key={stage} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "150px" }}>
                  <div style={{
                    width: "75px",
                    height: "75px",
                    borderRadius: "50%",
                    backgroundColor: isActive ? palette.dorado : palette.naranja,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: palette.blanco,
                    fontSize: "40px",
                    marginBottom: "12px",
                    boxShadow: isActive ? "0 6px 20px rgba(255,180,0,0.35)" : "none"
                  }}>{icons[stage]}</div>

                  <span style={{ fontSize: "18px", fontWeight: isActive ? 700 : 600, color: isActive ? palette.textoPrimario : palette.textoSecundario, marginBottom: 6 }}>{stage}</span>

                  {isActive && employeeInfo.employeeName && (
                    <div style={{ fontSize: "14px", marginTop: 4 }}>
                      <div style={{ fontWeight: 700 }}>{employeeInfo.nombre || employeeInfo.employeeName}</div>
                      <div style={{ color: palette.textoSecundario }}>{employeeInfo.id || employeeInfo.employeeCode}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer style={{ width: "100%", position: "fixed", bottom: 0, left: 0, backgroundColor: palette.naranja, color: palette.blanco, padding: "14px 24px", display: "flex", gap: "24px", justifyContent: "space-between", alignItems: "center", boxShadow: "0 -6px 18px rgba(0,0,0,0.12)", height: `${bottomBarHeight}px` }}>
        <div style={{ fontSize: 13 }}>Cliente: {clientInfo.nombre}</div>
        <div style={{ fontSize: 13 }}>Teléfono: {clientInfo.telefono}</div>
        <div style={{ fontSize: 13 }}>Correo: {clientInfo.email}</div>
      </footer>
    </div>
  );
};
