import { useState } from "react";
import CargarArchivos from "./components/CargarArchivos";
import Consulta from "./components/Consulta";
import TablaRegistros from "./components/TablaRegistros";
import { PY, TY } from "./queries";
import "./App.css";

const VACIO = { id: "", ubic: "", tipo: "" };

export default function App() {
  const [filas, setFilas] = useState([]); // TYPES.json
  const [obin, setObin] = useState({});   // OBIN_GT.json
  const [origen, setOrigen] = useState(VACIO);
  const [destino, setDestino] = useState(VACIO);

  // Al tocar una fila de la tabla, se carga arriba
  function elegirFila(f) {
    setOrigen({ ...VACIO, id: String(f.origen) });
    setDestino({ ...VACIO, id: String(f.destino) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app">
      <h1>Clasificador de Traslados GT</h1>

      <CargarArchivos onTypes={setFilas} onObin={setObin} />

      <Consulta filas={filas} obin={obin} origen={origen} destino={destino} setOrigen={setOrigen} setDestino={setDestino} />

      <TablaRegistros filas={filas} obin={obin} onElegir={elegirFila} />

      <section className="card">
        <h2>Query de referencia</h2>
        <pre>{PY}</pre>
        <pre>{TY}</pre>
      </section>
    </div>
  );
}
