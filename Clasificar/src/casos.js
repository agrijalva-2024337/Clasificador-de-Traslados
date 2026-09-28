export const CASOS ={
    "Caso 1": { es: "Traslado", proceso: "CASO_1_CENTRAL_CENTRAL" },
    "Caso 2": { es: "Request", proceso: "CASO_2_CENTRAL_PDV" },
    "Caso 3": { es: "Request", proceso: "CASO3_TS_ACENT"},
    "Caso 4": { es: "Traslado", proceso: "Caso_4_PDV_PDV" },
};

export function obtenerCaso(ubicOrigen, tipoOrigen, ubicDestino, tipoDestino){
    if(ubicOrigen !== ubicDestino) return "Caso 3";
    if(tipoOrigen === "Central" && tipoDestino === "Central") return "Caso 1";
    if(tipoOrigen === "Central" && tipoDestino === "PDV") return "Caso2";
    return "Caso 4";
}
