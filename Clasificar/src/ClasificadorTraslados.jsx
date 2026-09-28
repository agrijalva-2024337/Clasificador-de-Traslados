import { useMemo, useState, useRef } from "react";
import "./ClasificadorTraslados.css";

/* ------------------------------------------------------------------
   Reglas: mismo orden que el if / elif / else del código Python
   resultado[0] = o.ubicacionFisica   resultado[1] = d.ubicacionFisica
   resultado[2] = o.tipo              resultado[3] = d.tipo
------------------------------------------------------------------- */
export const CASOS = {
  "Caso 1": { cond: "Central → Central", es: "Traslado", proc: "CASO_1_CENTRAL_CENTRAL", fn: "do_sap_stock_transfer_ubicacion" },
  "Caso 2": { cond: "Central → PDV", es: "Request", proc: "CASO_2_CENTRAL_PDV", fn: "do_sap_transfer_v3_ubicacion" },
  "Caso 3": { cond: "Ubicación física distinta", es: "Request", proc: "CASO_3_TS_ACENT", fn: "do_sap_transfer_v3_ubicacion" },
  "Caso 4": { cond: "PDV → PDV / resto", es: "Traslado", proc: "CASO_4_PDV_PDV", fn: "do_sap_stock_transfer_ubicacion" },
};

export function clasificar(ufo, to, ufd, td) {
  if (ufo !== ufd) return "Caso 3";
  if (to === "Central" && td === "Central") return "Caso 1";
  if (to === "Central" && td === "PDV") return "Caso 2";
  return "Caso 4";
}

const UF_BASE = ["CD-1", "CENTRIX"];
const TIPO_BASE = ["Central", "PDV", "Transito"];

/* busca una llave sin importar mayúsculas */
const key = (o, k) => {
  const f = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
  return f === undefined ? undefined : o[f];
};

function readTypes(j) {
  if (!Array.isArray(j) || !j.length) throw new Error("Debe ser una lista de registros.");
  const need = ["absEntry_Origen", "ubicacionFisica_Origen", "tipo_Origen", "absEntry_Destino", "ubicacionFisica_Destino", "tipo_Destino"];
  const miss = need.filter((k) => key(j[0], k) === undefined);
  if (miss.length) throw new Error("Faltan columnas: " + miss.join(", "));
  return j.map((x) => ({
    ao: Number(key(x, "absEntry_Origen")),
    ufo: key(x, "ubicacionFisica_Origen"),
    to: key(x, "tipo_Origen"),
    ad: Number(key(x, "absEntry_Destino")),
    ufd: key(x, "ubicacionFisica_Destino"),
    td: key(x, "tipo_Destino"),
  }));
}

function readObin(j) {
  if (!Array.isArray(j) || !j.length) throw new Error("Debe ser una lista de ubicaciones.");
  if (key(j[0], "AbsEntry") === undefined || key(j[0], "BinCode") === undefined)
    throw new Error("Faltan columnas: AbsEntry, BinCode, WhsCode.");
  const m = {};
  j.forEach((x) => (m[Number(key(x, "AbsEntry"))] = { bin: key(x, "BinCode"), whs: key(x, "WhsCode") }));
  return m;
}

const okCfg = (c, f) => (!f.u || c.u === f.u) && (!f.t || c.t === f.t);

/* ------------------------------------------------------------------ */

export default function ClasificadorTraslados() {
  const [rows, setRows] = useState([]);
  const [obin, setObin] = useState({});
  const [stTypes, setStTypes] = useState({ text: "Sin archivo" });
  const [stObin, setStObin] = useState({ text: "Sin archivo" });

  const [ids, setIds] = useState({ o: 0, d: 0 });
  const [texts, setTexts] = useState({ o: "", d: "" });
  const [hints, setHints] = useState({ o: "", d: "" });
  const [filters, setFilters] = useState({ o: { u: "", t: "" }, d: { u: "", t: "" } });
  const [soloHist, setSoloHist] = useState(true);

  const [q, setQ] = useState("");
  const [casoF, setCasoF] = useState("");

  const hasOB = Object.keys(obin).length > 0;
  const bin = (a) => (!hasOB ? "Falta subir OBIN" : obin[a] ? obin[a].bin : "NO EXISTE EN OBIN");
  const whs = (a) => (!hasOB ? "—" : obin[a] ? obin[a].whs : "NO EXISTE EN OBIN");

  /* catálogo de bodegas: absEntry -> configuraciones distintas {u, t} */
  const { CAT, ABS, ENR, UFS, TIPOS } = useMemo(() => {
    const CAT = {};
    rows.forEach((r) => {
      [[r.ao, r.ufo, r.to], [r.ad, r.ufd, r.td]].forEach(([a, u, t]) => {
        CAT[a] = CAT[a] || [];
        if (!CAT[a].some((c) => c.u === u && c.t === t)) CAT[a].push({ u, t });
      });
    });
    const ABS = Object.keys(CAT).map(Number).sort((x, y) => x - y);
    const ENR = rows
      .map((r) => ({ ...r, caso: clasificar(r.ufo, r.to, r.ufd, r.td) }))
      .sort((a, b) => a.ao - b.ao || a.ad - b.ad);
    const UFS = [...new Set(UF_BASE.concat(rows.flatMap((r) => [r.ufo, r.ufd])))].sort();
    const TIPOS = [...new Set(TIPO_BASE.concat(rows.flatMap((r) => [r.to, r.td])))].sort();
    return { CAT, ABS, ENR, UFS, TIPOS };
  }, [rows]);

  const matchF = (a, s) => CAT[a].some((c) => okCfg(c, filters[s]));

  const sugO = useMemo(
    () => ABS.filter((a) => rows.some((r) => r.ao === a) && matchF(a, "o")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ABS, rows, filters]
  );
  const sugD = useMemo(() => {
    let list = ABS.filter((a) => a !== ids.o && matchF(a, "d"));
    if (soloHist) list = list.filter((a) => rows.some((r) => r.ao === ids.o && r.ad === a));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ABS, rows, filters, ids.o, soloHist]);

  /* ---------- carga de archivos ---------- */
  const load = (file, kind) => {
    file.text().then((t) => {
      const setSt = kind === "types" ? setStTypes : setStObin;
      let j;
      try {
        j = JSON.parse(t);
      } catch {
        setSt({ text: "El archivo no es un JSON válido.", cls: "bad" });
        return;
      }
      try {
        if (kind === "types") {
          const r = readTypes(j);
          setRows(r);
          const first = [...r].sort((a, b) => a.ao - b.ao || a.ad - b.ad)[0];
          setIds({ o: first.ao, d: first.ad });
          setTexts({ o: String(first.ao), d: String(first.ad) });
          setHints({ o: "", d: "" });
          setSt({ text: `${file.name} · ${r.length} registros cargados`, cls: "ok" });
        } else {
          const m = readObin(j);
          setObin(m);
          setSt({ text: `${file.name} · ${Object.keys(m).length} ubicaciones cargadas`, cls: "ok" });
        }
      } catch (e) {
        setSt({ text: e.message, cls: "bad" });
      }
    });
  };

  /* ---------- selección de bodega por ID ---------- */
  const setId = (s, value) => {
    setTexts((p) => ({ ...p, [s]: value }));
    const m = String(value).match(/^\s*(\d+)/);
    const id = m ? Number(m[1]) : 0;
    const setHint = (h) => setHints((p) => ({ ...p, [s]: h }));
    if (!value.trim()) {
      setHint("");
      setIds((p) => ({ ...p, [s]: 0 }));
      return;
    }
    if (!CAT[id]) return setHint(`El ID ${id} no está en TYPES.json.`);
    if (s === "o" && !rows.some((r) => r.ao === id)) return setHint(`El ID ${id} no aparece como origen en TYPES.json.`);
    setHint("");
    setIds((p) => ({ ...p, [s]: id }));
  };

  const setFilter = (s, k, v) => setFilters((p) => ({ ...p, [s]: { ...p[s], [k]: v } }));

  const openPair = (o, d) => {
    setFilters({ o: { u: "", t: "" }, d: { u: "", t: "" } });
    setSoloHist(true);
    setIds({ o, d });
    setTexts({ o: String(o), d: String(d) });
    setHints({ o: "", d: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------- cálculo del resultado ---------- */
  const resultado = useMemo(() => {
    const { o, d } = ids;
    const fo = filters.o, fd = filters.d;
    const side = (id, f) => (id && CAT[id] ? CAT[id].filter((c) => okCfg(c, f)) : f.u && f.t ? [{ u: f.u, t: f.t }] : null);
    const cO = side(o, fo), cD = side(d, fd);
    if (!cO || !cD) return { estado: "vacio" };
    if (!cO.length || !cD.length) return { estado: "sinConfig", bodega: !cO.length ? o : d };

    const manual = !(o && CAT[o]) || !(d && CAT[d]);
    const hist = manual
      ? []
      : rows.filter((r) => r.ao === o && r.ad === d && okCfg({ u: r.ufo, t: r.to }, fo) && okCfg({ u: r.ufd, t: r.td }, fd));
    // no se quitan repetidos: se muestran todas las filas tal como vienen en TYPES.json
    const combos = hist.length
      ? hist.map((r) => [r.ufo, r.to, r.ufd, r.td])
      : cO.flatMap((co) => cD.map((cd) => [co.u, co.t, cd.u, cd.t]));
    const cnt = {};
    combos.forEach((c) => (cnt[c.join("|")] = (cnt[c.join("|")] || 0) + 1));
    const repetidas = Object.values(cnt).filter((n) => n > 1).reduce((a, n) => a + n, 0);
    const res = combos.map((c) => ({ c, caso: clasificar(c[0], c[1], c[2], c[3]), rep: cnt[c.join("|")] > 1 }));
    const casos = [...new Set(res.map((x) => x.caso))];

    const alerts = [];
    if (!hasOB && !manual) alerts.push({ info: true, text: "Falta subir OBIN_GT.json para ver el BinCode y el WhsCode de cada bodega." });
    if (manual) alerts.push({ info: true, text: "Caso calculado con la ubicación física y el tipo que elegiste. Sirve para saber qué caso tendrá un registro nuevo." });
    else if (!hist.length) alerts.push({ info: true, text: "Esta combinación no aparece en TYPES.json. El caso se calcula con la configuración de cada bodega." });
    if (repetidas) alerts.push({ text: `Hay ${repetidas} filas idénticas para ${o} → ${d} en TYPES.json. Abajo salen todas. Revisa si hay registros duplicados en trasladosUbicacion o facAutoBodega.` });
    [o, d]
      .filter((a, i, s) => a && CAT[a] && CAT[a].length > 1 && s.indexOf(a) === i)
      .forEach((a) =>
        alerts.push({
          text: `El absEntry ${a} tiene ${CAT[a].length} configuraciones en facAutoBodega (${CAT[a].map((x) => `${x.u} / ${x.t}`).join(" y ")}). fetchone() tomará la primera que regrese SQL Server, así que el resultado puede ser ${casos.join(" o ")}.`,
        })
      );
    const elseHit = res.find((x) => x.caso === "Caso 4" && !(x.c[1] === "PDV" && x.c[3] === "PDV"));
    if (elseHit) alerts.push({ text: `${elseHit.c[1]} → ${elseHit.c[3]} no es PDV → PDV: cae en el else y se procesa como Caso 4. Confirma con el equipo si ese es el comportamiento esperado.` });

    return { estado: "ok", o: manual && !CAT[o] ? 0 : o, d: manual && !CAT[d] ? 0 : d, res, casos, alerts };
  }, [ids, filters, CAT, rows, hasOB]);

  /* ---------- tabla ---------- */
  const filtradas = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return ENR.filter(
      (r) =>
        (!casoF || r.caso === casoF) &&
        words.every((w) =>
          [r.ao, r.ad, bin(r.ao), bin(r.ad), whs(r.ao), whs(r.ad), r.ufo, r.ufd, r.to, r.td, r.caso, CASOS[r.caso].es, CASOS[r.caso].proc]
            .join(" ")
            .toLowerCase()
            .includes(w)
        )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ENR, q, casoF, obin]);

  return (
    <div className="ct">
      <div className="ct-wrap">
        <header>
          <div className="ct-eyebrow">SLC · POS → SAP · Guatemala</div>
          <h1>Clasificador de Traslados GT</h1>
          <p className="ct-lead">
            Sube TYPES.json y OBIN_GT.json. Luego escribe el ID de la bodega de origen y la de destino (o elige su ubicación física y tipo
            para un registro nuevo). La página aplica la misma lógica de casos que el código Python.
          </p>
        </header>

        {/* Datos */}
        <section className="ct-block">
          <div className="ct-sec-head">
            <h2>Datos</h2>
            <span className="ct-foot">Los archivos se leen solo en tu navegador.</span>
          </div>
          <div className="ct-files">
            <FileDrop title="Subir TYPES.json" desc="Resultado del query de TYPES: absEntry, ubicacionFisica y tipo de origen y destino." status={stTypes} onFile={(f) => load(f, "types")} />
            <FileDrop title="Subir OBIN_GT.json" desc="Ubicaciones de SAP: AbsEntry, BinCode y WhsCode." status={stObin} onFile={(f) => load(f, "obin")} />
          </div>
        </section>

        {/* Origen / Destino */}
        <section className="ct-block">
          <div className="ct-route">
            {["o", "d"].map((s, i) => (
              <BodegaCard
                key={s}
                side={s}
                title={s === "o" ? "Origen" : "Destino"}
                id={ids[s]}
                cat={CAT}
                text={texts[s]}
                hint={hints[s]}
                filter={filters[s]}
                ufs={UFS}
                tipos={TIPOS}
                sugerencias={s === "o" ? sugO : sugD}
                disabled={!ABS.length}
                bin={bin}
                whs={whs}
                onText={(v) => setId(s, v)}
                onFilter={(k, v) => setFilter(s, k, v)}
                arrow={i === 0}
                extra={
                  s === "d" && (
                    <label className="ct-chk">
                      <input type="checkbox" checked={soloHist} onChange={(e) => setSoloHist(e.target.checked)} /> Solo destinos con historial desde este origen
                    </label>
                  )
                }
                emptyMsg={s === "d" && soloHist ? " con historial desde este origen" : ""}
              />
            ))}
          </div>

          <Resultado r={resultado} bin={bin} whs={whs} />
        </section>

        {/* Tabla */}
        <section className="ct-block">
          <div className="ct-sec-head">
            <h2>Tabla de registros</h2>
            <span className="ct-foot">{ENR.length ? `${filtradas.length} de ${ENR.length} registros` : ""}</span>
          </div>
          <div className="ct-tools">
            <input
              type="search"
              className="ct-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar: absEntry, BinCode, WhsCode, CD-1, CENTRIX, PDV, Caso 3, CASO_2… (puedes combinar palabras)"
            />
            <select className="ct-input" value={casoF} onChange={(e) => setCasoF(e.target.value)} aria-label="Filtrar por caso">
              <option value="">Todos los casos</option>
              {Object.keys(CASOS).sort().map((k) => (
                <option key={k} value={k}>{`${k} · ${CASOS[k].proc}`}</option>
              ))}
            </select>
          </div>
          <div className="ct-tablebox">
            <table>
              <thead>
                <tr>
                  <th>Origen</th><th>Ubicación origen</th>
                  <th className="bl">Destino</th><th>Ubicación destino</th>
                  <th className="bl">Caso</th><th>Es</th><th>tipoProcesoSAP</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length ? (
                  filtradas.map((r, i) => (
                    <tr
                      key={i}
                      tabIndex={0}
                      className={r.ao === ids.o && r.ad === ids.d ? "sel" : ""}
                      onClick={() => openPair(r.ao, r.ad)}
                      onKeyDown={(e) => e.key === "Enter" && openPair(r.ao, r.ad)}
                    >
                      <FilaCeldas r={{ ao: r.ao, c: [r.ufo, r.to, r.ufd, r.td], ad: r.ad, caso: r.caso }} bin={bin} whs={whs} />
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="ct-empty">
                      {ENR.length ? "No hay registros con esa búsqueda o filtro." : "Sube TYPES.json y OBIN_GT.json para generar la tabla."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="ct-foot">Toca una fila para cargarla en las cards de arriba.</p>
        </section>

        {/* Query de referencia */}
        <section className="ct-block">
          <div className="ct-sec-head"><h2>Query de referencia</h2></div>
          <CodeBlock title="Query del código (Python)" code={PY} />
          <CodeBlock title="Query de TYPES (genera TYPES.json)" code={TY} />
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FileDrop({ title, desc, status, onFile }) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={"ct-drop" + (over ? " over" : "")}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
    >
      <input type="file" accept=".json,application/json" onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
      <b>{title}</b>
      <span className="ct-foot">{desc}</span>
      <span className={"ct-st " + (status.cls || "")}>{status.text}</span>
    </label>
  );
}

function BodegaCard({ side, title, id, cat, text, hint, filter, ufs, tipos, sugerencias, disabled, bin, whs, onText, onFilter, extra, arrow, emptyMsg }) {
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  const listRef = useRef(null);

  const qv = text.trim().toLowerCase();
  const pre = sugerencias.filter((a) => !qv || String(a).startsWith(qv));
  const rest = qv ? sugerencias.filter((a) => !String(a).startsWith(qv) && bin(a).toLowerCase().includes(qv)) : [];
  const items = pre.concat(rest).slice(0, 60);

  const choose = (a) => { onText(String(a)); setOpen(false); setAct(-1); };
  const move = (dir) => {
    if (!items.length) return;
    const n = (act + dir + items.length) % items.length;
    setAct(n);
    listRef.current?.children[n]?.scrollIntoView({ block: "nearest" });
  };

  const tieneId = id && cat[id];
  const pills = tieneId ? cat[id].map((c) => c.t) : filter.t ? [filter.t] : [];

  return (
    <>
      <div className="ct-end">
        <div className="ct-end-head">
          <h2>{title}</h2>
          <span>{pills.map((t, i) => <span key={i} className={`ct-pill p-${t}`}>{t}</span>)}</span>
        </div>
        <div className="ct-row2">
          <label className="ct-f">Ubicación física
            <select className="ct-input" value={filter.u} onChange={(e) => onFilter("u", e.target.value)}>
              <option value="">Todas</option>
              {ufs.map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label className="ct-f">Tipo
            <select className="ct-input" value={filter.t} onChange={(e) => onFilter("t", e.target.value)}>
              <option value="">Todos</option>
              {tipos.map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="ct-combo">
          <label className="ct-f" htmlFor={`${side}-sel`}>Bodega (buscar por ID)</label>
          <input
            id={`${side}-sel`}
            className="ct-input ct-mono"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            placeholder={disabled ? "Sube TYPES.json" : side === "o" ? "Escribe el ID, ej. 16" : `Escribe el ID (${sugerencias.length} disponibles)`}
            value={text}
            onChange={(e) => { onText(e.target.value); setOpen(true); setAct(-1); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); move(1); }
              else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
              else if (e.key === "Enter") { if (items[act] !== undefined) { e.preventDefault(); choose(items[act]); } else setOpen(false); }
              else if (e.key === "Escape") setOpen(false);
            }}
          />
          {open && !disabled && (
            <ul className="ct-dd" role="listbox" ref={listRef}>
              {items.length ? (
                items.map((a, i) => (
                  <li key={a} role="option" aria-selected={i === act} className={i === act ? "act" : ""} onMouseDown={(e) => { e.preventDefault(); choose(a); }}>
                    <b>{a}</b>
                    <span className="dd-bin">{bin(a)}</span>
                    <span className="dd-meta">{whs(a)} · {cat[a][0].u} · {cat[a][0].t}</span>
                  </li>
                ))
              ) : (
                <li className="dd-empty">Sin coincidencias{emptyMsg}</li>
              )}
            </ul>
          )}
        </div>
        {hint && <span className="ct-hint bad">{hint}</span>}
        {extra}
        <dl className="ct-kv">
          {tieneId ? (
            <>
              <dt>absEntry</dt><dd>{id}</dd>
              <dt>BinCode</dt><dd>{bin(id)}</dd>
              <dt>WhsCode</dt><dd>{whs(id)}</dd>
              <dt>Ubic. física / tipo</dt>
              <dd>{cat[id].map((c, i) => <div key={i}>{c.u} / {c.t}</div>)}</dd>
            </>
          ) : filter.u && filter.t ? (
            <><dt>Registro nuevo</dt><dd>{filter.u} / {filter.t}</dd></>
          ) : null}
        </dl>
      </div>
      {arrow && <div className="ct-arrow" aria-hidden="true">→</div>}
    </>
  );
}

function Resultado({ r, bin, whs }) {
  if (r.estado === "vacio")
    return (
      <div className="ct-result">
        <div className="ct-res-top idle"><div className="ct-stat"><span className="ct-eyebrow">Resultado</span><b>Escribe el ID de cada bodega, o elige su ubicación física y tipo</b></div></div>
      </div>
    );
  if (r.estado === "sinConfig")
    return (
      <div className="ct-result">
        <div className="ct-res-top multi"><div className="ct-stat"><span className="ct-eyebrow">Resultado</span><b>La bodega {r.bodega} no tiene ninguna configuración con esa ubicación física y tipo. Cambia los filtros a Todas / Todos.</b></div></div>
      </div>
    );

  const main = CASOS[r.casos[0]];
  const esReq = main.es === "Request";
  return (
    <div className="ct-result">
      {r.casos.length > 1 ? (
        <div className="ct-res-top multi">
          <div className="ct-stat"><span className="ct-eyebrow">Caso</span><span className="ct-big sm">{r.casos.length} resultados posibles</span></div>
          {r.casos.map((k) => (
            <div className="ct-stat" key={k}>
              <span className="ct-eyebrow">{k}</span>
              <span><span className={`ct-pill ${CASOS[k].es === "Request" ? "p-req" : "p-tras"}`}>{CASOS[k].es}</span> <b>{CASOS[k].proc}</b></span>
            </div>
          ))}
        </div>
      ) : (
        <div className={"ct-res-top" + (esReq ? " req" : "")}>
          <div className="ct-stat"><span className="ct-eyebrow">Caso</span><span className="ct-big">{r.casos[0]}</span></div>
          <div className="ct-stat"><span className="ct-eyebrow">Es</span><span><span className={`ct-pill ${esReq ? "p-req" : "p-tras"}`}>{main.es}</span></span></div>
          <div className="ct-stat"><span className="ct-eyebrow">Proceso SAP</span><b>{main.proc}</b></div>
          <div className="ct-stat"><span className="ct-eyebrow">Función</span><b>self.{main.fn}()</b></div>
        </div>
      )}

      {r.alerts.length > 0 && (
        <div className="ct-alerts">
          {r.alerts.map((a, i) => <div key={i} className={"ct-alert" + (a.info ? " info" : "")}>{a.text}</div>)}
        </div>
      )}

      <div className="ct-tup">
        <span className="ct-eyebrow">{r.res.length > 1 ? `Registros (${r.res.length} filas)` : "Registro"}</span>
        <div className="ct-tablebox">
          <table>
            <thead>
              <tr>
                <th>Origen</th><th>Ubicación origen</th>
                <th className="bl">Destino</th><th>Ubicación destino</th>
                <th className="bl">Caso</th><th>Es</th><th>tipoProcesoSAP</th>
              </tr>
            </thead>
            <tbody>
              {r.res.map((x, i) => (
                <tr key={i} className="nohover">
                  <FilaCeldas r={{ ao: r.o, c: x.c, ad: r.d, caso: x.caso, rep: x.rep }} bin={bin} whs={whs} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* celdas compartidas por la tupla y la tabla de registros */
function Ubic({ id, u, t, bin, whs }) {
  return (
    <td className="bin">
      {id ? bin(id) : "Registro nuevo"}
      <small>
        {id ? `${whs(id)} · ` : ""}
        {u} · <span className={`tp t-${t}`}>{t}</span>
      </small>
    </td>
  );
}

function FilaCeldas({ r, bin, whs }) {
  const k = CASOS[r.caso];
  return (
    <>
      <td className="n">{r.ao || "—"}</td>
      <Ubic id={r.ao} u={r.c[0]} t={r.c[1]} bin={bin} whs={whs} />
      <td className="n bl">{r.ad || "—"}</td>
      <Ubic id={r.ad} u={r.c[2]} t={r.c[3]} bin={bin} whs={whs} />
      <td className="bl">
        {r.caso}
        {r.rep && <> <span className="ct-pill sm p-warn">Repetida</span></>}
      </td>
      <td><span className={`ct-pill sm ${k.es === "Request" ? "p-req" : "p-tras"}`}>{k.es}</span></td>
      <td className="ct-mono proc">{k.proc}</td>
    </>
  );
}

function CodeBlock({ title, code }) {
  const [label, setLabel] = useState("Copiar");
  const copy = () => {
    navigator.clipboard?.writeText(code).then(
      () => { setLabel("Copiado"); setTimeout(() => setLabel("Copiar"), 1400); },
      () => setLabel("No se pudo copiar")
    );
  };
  return (
    <div className="ct-code">
      <div className="ct-bar"><span className="ct-eyebrow">{title}</span><button className="ct-btn" onClick={copy}>{label}</button></div>
      <pre>{code}</pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PY = `query = text(f"""
    SELECT
        o.ubicacionFisica,
        d.ubicacionFisica,
        o.tipo,
        d.tipo
    FROM [{DB_POS}].dbo.trasladosSolicitud s
    INNER JOIN [{DB_POS}].dbo.trasladosUbicacion uo
        ON uo.id = s.ubicacionOrigenId
    INNER JOIN [{DB_POS}].dbo.trasladosUbicacion ud
        ON ud.id = s.ubicacionDestinoId

    INNER JOIN [{DB_FAC_AUTO}].dbo.facAutoBodega o
        ON o.absEntry = uo.UbicacionSAP
    INNER JOIN [{DB_FAC_AUTO}].dbo.facAutoCedis co
        ON co.id = o.cediId
    INNER JOIN [{DB_FAC_AUTO}].dbo.facAutoCountry fco
        ON fco.id = co.countryId

    INNER JOIN [{DB_FAC_AUTO}].dbo.facAutoBodega d
        ON d.absEntry = ud.UbicacionSAP
    INNER JOIN [{DB_FAC_AUTO}].dbo.facAutoCedis cd
        ON cd.id = d.cediId
    INNER JOIN [{DB_FAC_AUTO}].dbo.facAutoCountry fcd
        ON fcd.id = cd.countryId

    WHERE s.id = {solicitudId}
    AND fco.code = '{pais}'
    AND fcd.code = '{pais}'
""")

resultado = db_connection.execute(query).fetchone()

if resultado is None:
    raise Exception(f"No se encontró la configuración de bodegas para la solicitud {solicitudId}.")

tipoProcesoSAP = None
if resultado:

    # Caso 3
    # Ubicación física diferente
    # Solicitud de traslado vía TS-ACENT
    if resultado[0] != resultado[1]:
        tipoProcesoSAP = "CASO_3_TS_ACENT"
        respuestaSAap = self.do_sap_transfer_v3_ubicacion(pais, solicitudId, db_connection)

    # Caso 1
    # Misma ubicación física
    # Central -> Central
    # Traslado directo
    elif resultado[2] == "Central" and resultado[3] == "Central":
        tipoProcesoSAP = "CASO_1_CENTRAL_CENTRAL"
        respuestaSAap = self.do_sap_stock_transfer_ubicacion(pais, solicitudId, db_connection)

    # Caso 2
    # Misma ubicación física
    # Central -> PDV
    # Solicitud directa (sin TS-ACENT)
    elif resultado[2] == "Central" and resultado[3] == "PDV":
        tipoProcesoSAP = "CASO_2_CENTRAL_PDV"
        respuestaSAap = self.do_sap_transfer_v3_ubicacion(pais, solicitudId, db_connection)

    else:
        tipoProcesoSAP = "CASO_4_PDV_PDV"
        respuestaSAap = self.do_sap_stock_transfer_ubicacion(pais, solicitudId, db_connection)`;

const TY = `SELECT DISTINCT
    o.absEntry         AS absEntry_Origen,
    o.ubicacionFisica  AS ubicacionFisica_Origen,
    o.tipo             AS tipo_Origen,
    d.absEntry         AS absEntry_Destino,
    d.ubicacionFisica  AS ubicacionFisica_Destino,
    d.tipo             AS tipo_Destino
FROM [SLC_POS_GT].dbo.trasladosSolicitud s
INNER JOIN [SLC_POS_GT].dbo.trasladosUbicacion uo
    ON uo.id = s.ubicacionOrigenId
INNER JOIN [SLC_POS_GT].dbo.trasladosUbicacion ud
    ON ud.id = s.ubicacionDestinoId

INNER JOIN [SLC_FACTURACION_AUTOMATICA].dbo.facAutoBodega o
    ON o.absEntry = uo.UbicacionSAP
INNER JOIN [SLC_FACTURACION_AUTOMATICA].dbo.facAutoCedis co
    ON co.id = o.cediId
INNER JOIN [SLC_FACTURACION_AUTOMATICA].dbo.facAutoCountry fco
    ON fco.id = co.countryId

INNER JOIN [SLC_FACTURACION_AUTOMATICA].dbo.facAutoBodega d
    ON d.absEntry = ud.UbicacionSAP
INNER JOIN [SLC_FACTURACION_AUTOMATICA].dbo.facAutoCedis cd
    ON cd.id = d.cediId
INNER JOIN [SLC_FACTURACION_AUTOMATICA].dbo.facAutoCountry fcd
    ON fcd.id = cd.countryId

WHERE fco.code = 'GT'
  AND fcd.code = 'GT'

ORDER BY o.absEntry, d.absEntry;`;
