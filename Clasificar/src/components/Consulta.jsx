import {CASOS, obtenerCasos} from "../casos.js";
I
function Bodega ({ titulo, valor, onChange, obin }){
    const cambiar  = (campo, v) => onChange({ ...valor, [campo]: v});
    const info = obin[valor.id];

    return(
        <div className="card bodega">
            <h3>{titulo}</h3>

            <label>
            Bodega (ID)
            <input type="number" value={valor.id} onChange={(e) => cambiar("id" , e.target.value)} placeholder="ej .16" />
            </label>
            {info && <small className="bin">{info.binCode} · {info.whsCode}</small>}

            <div className="dos-columnas">
                <label >
                    Ubicacion Fisica
                    <select value={valor.ubic} onChange={(e) => cambiar("ubic", e.target.value)}>
                        <option value="">Todas</option>
                        {UBICACIONES.map((u) => <option key={u}>{u}</option>)}
                    </select>
                </label>
                <label htmlFor="">
                    Tipo
                    <select value={valor.tipo} onChange={(e) => cambiar("tipo", e.target.value)}>
                        <option value="">Todas</option>
                        {TIPOS.map((t) => <option key ={t}>{t}</option>)}
                    </select>
                </label>     
            </div>
        </div>
    );
}

export default  function Consulta({filas, obin, origin, destino, setOrigen, setDestino}) {
    // Obtener las ubicaciones y tipos del TYPES.Json
    const ubicaciones = [...new Set(filas.flatMap((f) => [f.ubicacionFisicaOrigen, f.ubicacionFisicaDestino]))].sort();
    const tipos = [...new Set(filas.flatMap((f) => [f.tipoOrigen, f.tipoDestino]))].sort();
    // 1. Buscar las filas de TYPES que coinciden con lo elegido
    const coincide = (id, ubic, tipo, sel) => 
        (!sel.id || id === Number(sel.id)) && (!sel.ubic || ubic === sel.ubic) && (!sel.tipo || tipo === sel.tipo);

    let resultados = [];
    if (origen.id && destino.id) {
        resultados = filas.filter(
        (f) =>
            coincide(f.origen, f.ubicacionFisicaOrigen, f.tipoOrigen, origen) &&
            coincide(f.destino, f.ubicacionFisicaDestino, f.tipoDestino, destino)
        );
    } else if (origen.ubic && origen.tipo && destino.ubic && destino.tipo) {
        // 2. Sin IDs: registro nuevo con la ubicación y el tipo elegidos
        resultados = [{ origen: "-", ubicacionFisicaOrigen: origen.ubic, tipoOrigen: origen.tipo, destino: "-", ubicacionFisicaDestino: destino.ubic, tipoDestino: destino.tipo }];
    }

    const casos = [...new Set(resultados.map((f) => obtenerCaso(f.ubicacionFisicaOrigen, f.tipoOrigen, f.ubicacionFisicaDestino, f.tipoDestino)))];

    return (
        <section className="card">
        <h2>2. Elegir origen y destino</h2>
        <div className="dos-columnas">
            <Bodega titulo="Origen" valor={origen} onChange={setOrigen} obin={obin} />
            <Bodega titulo="Destino" valor={destino} onChange={setDestino} obin={obin} />
        </div>

        {resultados.length === 0 && (
            <p className="aviso">Escribe el ID de origen y destino, o elige ubicación y tipo de los dos lados para un registro nuevo.</p>
        )}

        {casos.length === 1 && (
            <div className={"resultado " + CASOS[casos[0]].es}>
            <b>{casos[0]}</b> · {CASOS[casos[0]].es} · {CASOS[casos[0]].proceso}
            </div>
        )}

        {casos.length > 1 && (
            <div className="resultado alerta">
            <b>{casos.length} resultados posibles:</b> {casos.join(" o ")}. La bodega está repetida en facAutoBodega.
            </div>
        )}

        {resultados.length > 1 && casos.length === 1 && (
            <p className="aviso">Hay {resultados.length} filas para este traslado (datos repetidos).</p>
        )}

        {resultados.length > 0 && <Filas filas={resultados} obin={obin} />}
        </section>
    );
    }

    // Tabla pequeña con las filas encontradas (la usa también TablaRegistros)
    export function Filas({ filas, obin, onClick }) {
    return (
        <table>
        <thead>
            <tr>
            <th>Origen</th><th>Ubicación origen</th><th>Tipo</th>
            <th>Destino</th><th>Ubicación destino</th><th>Tipo</th>
            <th>Caso</th><th>Es</th><th>tipoProcesoSAP</th>
            </tr>
        </thead>
        <tbody>
            {filas.map((f, i) => {
            const caso = obtenerCaso(f.ubicOrigen, f.tipoOrigen, f.ubicDestino, f.tipoDestino);
            return (
                <tr key={i} onClick={() => onClick?.(f)} className={onClick ? "click" : ""}>
                <td>{f.origen}</td>
                <td>{obin[f.origen]?.binCode ?? ""} <small>{f.ubicOrigen}</small></td>
                <td>{f.tipoOrigen}</td>
                <td>{f.destino}</td>
                <td>{obin[f.destino]?.binCode ?? ""} <small>{f.ubicDestino}</small></td>
                <td>{f.tipoDestino}</td>
                <td>{caso}</td>
                <td className={CASOS[caso].es}>{CASOS[caso].es}</td>
                <td>{CASOS[caso].proceso}</td>
                </tr>
            );
            })}
        </tbody>
        </table>
    );
    }
