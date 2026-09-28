
import {useState} from React;

export default function CargarArchivos({onTypes, onBin}){
   const [msgType, setMsgTypes] = useState("sin Archivo");
   const [msgObin, setMsgObin] = useState("Sin Archivo");

   //Leer archivo Json

   async function leerJson(e){
    const archivo = e.target.files[0];
    if (!archivo) return null;
    const texto = await archivo.text();
    return {nombre: archivo.name, datos: JSON.parse(texto)};
   }

   async function subirTypes(e){
        try {
            const {nombre, datos} = await leerJson(e);

            const filas = datos.map((x) =>({
                origen: Number(x.absEntry_Origen),
                ubicacionFisicaOrigen: x.ubicacionFisica_Origen,
                tipoOrigen: x.tipo_Origen,
                destino: Number(x.abdEntry_Destino),
                ubicacionFisicaDestino: x.ubicacionFisica_Destino,
                tipoDestino: x.tipo_Destino,
            }));
            onTypes(filas);
            setMsgTypes(`${nombre}: ${filas.length} registros`);
        } catch {
            setMsgTypes("Error: El archivo no es un TYPES.Json valido");
        }
   }

   async function subirObin(e){
    try {
        const {nombre, datos} = await leerJson(e);

        const mapa = {};
        datos.forEach((x) => {
            mapa[x.AbsEntry] = { binCode: x.BinCode, whsCode: x.WhsCode };
        });
        onBin(filas);
        setMsgObin(`${nombre}: ${filas.length} registros`);
    } catch {
        setMsgObin("Error: El archivo no es un OBIN_GT.Json valido")
    }
   }

   return (
    <section>
        <h2>1. Subir Archivos</h2>
        <div className="dos_columnas">
            <label className="archivo">
                <b>TYPES.json</b>
                <input type="file" accept=".json" onChange={subirTypes} />
                <small>{msgTypes}</small>
            </label>
            <label className="archivo">
                <b>OBIN_GT.json</b>
                <input type="file" accept=".json" onChange={subirTypes} />
                <small>{msgObin}</small>
            </label>
        </div>
    </section>
   );
}