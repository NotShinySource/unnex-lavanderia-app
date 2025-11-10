function StatusProgress() {
  const stages = [
    "Recibida",
    "Lavado",
    "Enjuague",
    "Secado",
    "Planchado",
    "Listo para retiro",
    "En ruta",
    "Entregado"
  ];

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        backgroundColor: "#fff4f0",
        minHeight: "100vh",
        padding: "24px",
        color: "#1a1a2e"
      }}
    >
      <h1 style={{ color: "#1a1a2e", marginBottom: "20px" }}>
        Estado de tu ropa
      </h1>

      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}
      >
        {stages.map((stage, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "12px"
            }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                backgroundColor: "#ff6b35", 
                marginRight: "12px"
              }}
            ></div>

            <span
              style={{
                fontSize: "16px",
                color: "#2c2c3e" 
              }}
            >
              {stage}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatusProgress;