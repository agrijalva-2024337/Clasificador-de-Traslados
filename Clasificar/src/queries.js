// Queries originales, solo para tenerlos a la mano.
export const PY = `query = text(f"""
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

export const TY = `SELECT DISTINCT
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
