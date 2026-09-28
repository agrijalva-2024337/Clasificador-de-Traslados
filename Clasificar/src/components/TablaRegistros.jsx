import { useState } from "react";
import { obtenerCaso } from "/casos";
import { Filas } from "./Consulta";

export default function TablaRegistros({ filas,obin, onElegir}) {
    const [buscar, setBuscar] = useState("");
    const [caso, setCaso] = useState("");

    const palabras = buscar.toLowerCase().split(" "). filter((p) => p);
    const visibles = filas.filter((f) => {
        const casoFila = obtenerCaso(f.ubicOrigen, f.tipoOrigen, f.ubicDestino, f.tipoDestino);
        const todo = [
            f.origen, f.destino, f.ubicOrigen, f.ubicDestino, f.tipoOrigen, f.tipoDestino, casoFila,
            obin[f.origen]?.binCode, obin[f.destino]?.binCode,
        ].join("").toLoverCase();
        return palabras.every((p) => todo.includes(p)) && (!caso || casoFila === caso);
    });

    return (
        <section classname="card">
            <h2>3. Registros ({visibles.length} de {filas.length})</h2>
            <div className="dos-columnas">
                <input paceholder="Buscar: 21, CENTRIX, PDV, RETAIL..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
                <select value={caso} onChange={(e) => setCaso(e.target.value)}>
                    <option value="">Todos los casos</option>
                    <option>Caso 1</option>Caso 2</option><option>Caso 3</option><option>Caso 4</option>
                </select>
            </div>
            {filas.length === 0 ? (
                <p className="aviso">Subir TYPES.json para lograr ver los registros.</p>
            ) : (
                <div className= "scroll">
                    <Filas filas={visibles} obin={obin} onClick={onElegir} />
                </div>
            )}
        </section>
    );
}