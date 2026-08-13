/**
 * ============================================================================
 * SCRIPT PRINCIPAL DE GOOGLE APPS SCRIPT - COMFAMILIAR RISARALDA (VERSIÓN V5)
 * ============================================================================
 * 🛠️ SOLUCIÓN DEFINITIVA DE GUARDADO DE GESTIÓN SST EN 'GESTION_SST':
 * - Validación estricta del Documento de Identidad al guardar observaciones.
 * - Soporte DUAL Fetch API / JSONP para garantizar que la gestión se escriba en GESTION_SST.
 * - Búsqueda e inserción/actualización garantizada sin errores de desbordamiento.
 * - Invalidation inmediata de la caché del servidor.
 * ============================================================================
 */

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = params.action || "getAllReports";
    var callback = params.callback || null;
    var docParam = params.documento || params.cedula || null;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetReportes = obtenerHojaEncuestasOriginal(ss);
    var sheetGestion = obtenerOCrearHojaGestion(ss);

    // 1. ACCIÓN: PING / TEST DE CONEXIÓN
    if (action === "ping" || action === "test") {
      var pingMsg = JSON.stringify({ status: "online", version: "V5_GESTION_GARANTIZADA", message: "Google Apps Script V5 Activo con Guardado en GESTION_SST" });
      if (callback) {
        return ContentService.createTextOutput(callback + "(" + pingMsg + ")")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(pingMsg).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. ACCIÓN: GUARDAR GESTIÓN Y NOTAS SST (ESCRIBE 100% ÚNICAMENTE EN GESTION_SST)
    if (action === "saveManagementNote" || action === "saveManagement") {
      var statusVal = params.status || "pendiente";
      var notesVal = params.notes || "";
      var operatorVal = params.operator || "Operador SST";
      return guardarGestionExclusivaEnHoja(ss, sheetReportes, sheetGestion, docParam, statusVal, notesVal, operatorVal, callback);
    }

    // 3. ACCIÓN: RECIBIR Y GUARDAR NUEVA ENCUESTA DESDE EL FORMULARIO DE TRABAJADORES (GET / JSONP)
    if (action === "submitReport" || action === "saveReport" || action === "addReport" || (params.situacionYApoyo && docParam)) {
      return procesarYGuardarReporte(sheetReportes, params, callback);
    }

    // 4. ACCIÓN: OBTENER UN REPORTE ESPECÍFICO
    if (action === "getReport" && docParam) {
      var reportSingle = obtenerReportePorDocumento(sheetReportes, sheetGestion, docParam);
      var jsonResult = JSON.stringify({ status: reportSingle ? "success" : "not_found", data: reportSingle });

      if (callback) {
        return ContentService.createTextOutput(callback + "(" + jsonResult + ")")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(jsonResult).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. ACCIÓN: OBTENER TODOS LOS REPORTES (CON CACHÉ)
    if (action === "getAllReports" || action === "getReports" || (!docParam && !callback) || (callback && !docParam)) {
      var jsonAll = obtenerReportesCacheadosOMaterializar(sheetReportes, sheetGestion);

      if (callback) {
        return ContentService.createTextOutput(callback + "(" + jsonAll + ")")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(jsonAll).setMimeType(ContentService.MimeType.JSON);
    }

    var defaultMsg = JSON.stringify({
      status: "online",
      version: "V5_GESTION_ENABLED",
      message: "API Emergencia Comfamiliar Activa con Guardado Garantizado en GESTION_SST"
    });

    if (callback) {
      return ContentService.createTextOutput(callback + "(" + defaultMsg + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(defaultMsg).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    var errResponse = JSON.stringify({ status: "error", error: error.toString() });
    if (e && e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + "(" + errResponse + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(errResponse).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (pErr) {
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetReportes = obtenerHojaEncuestasOriginal(ss);
    var sheetGestion = obtenerOCrearHojaGestion(ss);

    if (postData.action === "saveManagementNote" || postData.action === "saveManagement") {
      return guardarGestionExclusivaEnHoja(
        ss, sheetReportes, sheetGestion,
        postData.documento || postData.cedula,
        postData.status || "pendiente",
        postData.notes || "",
        postData.operator || "Operador SST",
        postData.callback
      );
    }

    return procesarYGuardarReporte(sheetReportes, postData, postData.callback);
  } catch (err) {
    var errObj = JSON.stringify({ status: "error", error: err.toString() });
    return ContentService.createTextOutput(errObj).setMimeType(ContentService.MimeType.JSON);
  }
}

// CACHÉ INTELIGENTE DE RESPUESTAS (25 SEGUNDOS)
function obtenerReportesCacheadosOMaterializar(sheetReportes, sheetGestion) {
  var cache = CacheService.getScriptCache();
  var cachedData = cache.get("comfamiliar_all_reports_v5");
  
  if (cachedData) {
    return cachedData;
  }

  var reportsArray = obtenerTodosLosReportesConGestion(sheetReportes, sheetGestion);
  var payload = JSON.stringify({
    status: "success",
    timestamp: new Date().toISOString(),
    total: reportsArray.length,
    reports: reportsArray,
    data: reportsArray
  });

  try {
    cache.put("comfamiliar_all_reports_v5", payload, 25);
  } catch (cErr) {
    console.log("Caché omitido por tamaño, respondiendo en vivo.");
  }

  return payload;
}

function limpiarCacheReportes() {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove("comfamiliar_all_reports_v5");
    cache.remove("comfamiliar_all_reports_v4");
    cache.remove("comfamiliar_all_reports_v3");
    cache.remove("comfamiliar_all_reports_v2");
  } catch (err) {}
}

// GUARDA SOLAMENTE REGISTROS NUEVOS DEL FORMULARIO EN LA HOJA DE ENCUESTA
function procesarYGuardarReporte(reportSheet, data, callback) {
  try {
    var docFinal = String(data.documento || data.cedula || "").trim();
    if (!docFinal) {
      throw new Error("El documento de identidad es obligatorio");
    }

    var nombreFinal = String(data.nombre || data.nombreCompleto || "Colaborador").trim();
    var cargoFinal = String(data.cargo || "Colaborador").trim();
    var emailFinal = String(data.emailPersonal || data.email || "").trim();
    var contratoFinal = String(data.contrato || "").trim();
    var procesoFinal = String(data.proceso || "").trim();
    var areaFinal = String(data.area || "").trim();
    var sexoFinal = String(data.sexo || "").trim();
    var sedeFinal = String(data.sede || "Sede Principal").trim();
    var telefonoBaseFinal = String(data.telefono || data.telefonoBase || data.celular || "").trim();
    var direccionHabitualFinal = String(data.direccionHabitual || data.direccionResidencia || "").trim();
    var direccionActualFinal = String(data.direccionActual || data.direccion || "").trim();
    var municipioBaseFinal = String(data.municipio || "Pereira").trim();

    var rowValues = [
      data.timestamp || new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
      docFinal,
      nombreFinal,
      cargoFinal,
      emailFinal,
      contratoFinal,
      procesoFinal,
      areaFinal,
      sexoFinal,
      sedeFinal,
      telefonoBaseFinal,
      data.contactoEmergencia || "",
      direccionHabitualFinal,
      direccionActualFinal,
      municipioBaseFinal,
      data.tipoSangre || "",
      data.situacionYApoyo || "",
      data.personasHogar || "",
      data.tipoVivienda || "",
      data.afectacionVivienda || "",
      data.lugarSeguro || "",
      data.estadoFamilia || "",
      data.presencialidadObligatoria || "",
      data.condicionesOptimas || "",
      data.herramientasTrabajo || "",
      data.latitud || "",
      data.longitud || "",
      data.criticidad || "verde",
      data.esActualizacion ? "Actualización de Registro" : "Web App Formulario Oficial"
    ];

    var existingRowIndex = buscarFilaPorDocumento(reportSheet, docFinal);

    if (existingRowIndex > 0) {
      reportSheet.getRange(existingRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      reportSheet.appendRow(rowValues);
    }
    
    limpiarCacheReportes();

    var responseObj = {
      status: "success",
      action: existingRowIndex > 0 ? "updated" : "inserted",
      documento: docFinal,
      message: "Encuesta guardada exitosamente en " + reportSheet.getName() + " para " + docFinal
    };

    if (callback) {
      return ContentService.createTextOutput(callback + "(" + JSON.stringify(responseObj) + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(JSON.stringify(responseObj))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    var errObj = { status: "error", error: error.toString() };
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + JSON.stringify(errObj) + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(errObj)).setMimeType(ContentService.MimeType.JSON);
  }
}

// LECTURA PURA DE LA ENCUESTA COMBINADA CON GESTION_SST
function obtenerTodosLosReportesConGestion(sheetReportes, sheetGestion) {
  if (!sheetReportes) return [];
  var lastRowR = sheetReportes.getLastRow();
  if (lastRowR < 2) return [];

  var lastColR = Math.min(sheetReportes.getLastColumn(), 35);
  var dataR = sheetReportes.getRange(2, 1, lastRowR - 1, lastColR).getValues();
  
  var mapaGestion = {};
  if (sheetGestion && sheetGestion.getLastRow() >= 2) {
    var dataG = sheetGestion.getRange(2, 1, sheetGestion.getLastRow() - 1, 12).getValues();
    for (var g = 0; g < dataG.length; g++) {
      var docG = String(dataG[g][1]).trim();
      if (docG) {
        mapaGestion[docG] = {
          status: String(dataG[g][8] || 'pendiente'),
          notes: String(dataG[g][9] || ''),
          updatedAt: String(dataG[g][10] || ''),
          operator: String(dataG[g][11] || 'Operador SST')
        };
      }
    }
  }

  var reports = [];

  for (var i = 0; i < dataR.length; i++) {
    var r = dataR[i];
    var docR = String(r[1]).trim();

    if (docR) {
      var gObj = mapaGestion[docR];
      var mgmtStatusVal = gObj ? gObj.status : 'pendiente';
      var mgmtNotesVal = gObj ? gObj.notes : '';
      var mgmtUpdatedAtVal = gObj ? gObj.updatedAt : '';
      var mgmtOperatorVal = gObj ? gObj.operator : 'Operador SST';

      var columnaAFVal = r.length >= 32 ? String(r[31] || '') : '';

      reports.push({
        id: 'rep-' + i,
        timestamp: r[0] ? String(r[0]) : '',
        documento: docR,
        cedula: docR,
        nombre: String(r[2] || 'Colaborador'),
        cargo: String(r[3] || ''),
        emailPersonal: String(r[4] || ''),
        contrato: String(r[5] || ''),
        proceso: String(r[6] || ''),
        area: String(r[7] || ''),
        sexo: String(r[8] || ''),
        sede: String(r[9] || ''),
        telefono: String(r[10] || ''),
        contactoEmergencia: String(r[11] || ''),
        direccionResidencia: String(r[12] || ''),
        direccionHabitual: String(r[12] || ''),
        direccionActual: String(r[13] || ''),
        direccion: String(r[13] || r[12] || ''),
        municipio: String(r[14] || ''),
        tipoSangre: String(r[15] || 'O+'),
        situacionYApoyo: String(r[16] || 'Estoy bien y seguro'),
        personasHogar: String(r[17] || '1'),
        tipoVivienda: String(r[18] || 'Propia'),
        afectacionVivienda: String(r[19] || 'No presenta afectaciones'),
        lugarSeguro: String(r[20] || 'Si'),
        estadoFamilia: String(r[21] || 'Todos se encuentran bien'),
        presencialidadObligatoria: String(r[22] || 'Sí'),
        condicionesOptimas: String(r[23] || 'Sí'),
        herramientasTrabajo: String(r[24] || 'Sí'),
        latitud: r[25] || '',
        longitud: r[26] || '',
        criticidad: String(r[27] || 'verde').toLowerCase(),
        origen: String(r[28] || 'Google Sheets'),
        columnaAF: columnaAFVal,
        
        gestionStatus: mgmtStatusVal,
        gestionNotes: mgmtNotesVal,
        gestionUpdatedAt: mgmtUpdatedAtVal,
        gestionOperator: mgmtOperatorVal
      });
    }
  }

  return reports;
}

function obtenerReportePorDocumento(sheetReportes, sheetGestion, targetDoc) {
  var list = obtenerTodosLosReportesConGestion(sheetReportes, sheetGestion);
  var target = String(targetDoc).trim();
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].documento).trim() === target) {
      return list[i];
    }
  }
  return null;
}

function buscarInfoReportePorDoc(sheetReportes, targetDoc) {
  if (!sheetReportes) return {};
  var lastRow = sheetReportes.getLastRow();
  if (lastRow < 2) return {};

  var data = sheetReportes.getRange(2, 1, lastRow - 1, Math.min(sheetReportes.getLastColumn(), 17)).getValues();
  var target = String(targetDoc).trim();

  for (var i = 0; i < data.length; i++) {
    var docInRow = String(data[i][1]).trim();
    if (docInRow === target) {
      return {
        nombre: String(data[i][2] || "Colaborador"),
        cargo: String(data[i][3] || "Colaborador"),
        sede: String(data[i][9] || "Sede Principal"),
        telefono: String(data[i][10] || ""),
        municipio: String(data[i][14] || "Pereira"),
        situacionYApoyo: String(data[i][16] || "Apoyo SST")
      };
    }
  }
  return {};
}

function buscarFilaEnGestion(sheetGestion, targetDoc) {
  if (!sheetGestion || !targetDoc) return -1;
  var lastRow = sheetGestion.getLastRow();
  if (lastRow < 2) return -1;

  var docCol = sheetGestion.getRange(1, 2, lastRow, 1).getValues();
  var target = String(targetDoc).trim();

  for (var i = 0; i < docCol.length; i++) {
    var cellDoc = String(docCol[i][0] || "").trim();
    if (cellDoc === target) {
      return i + 2; // Fila real en la hoja (Encabezado = Fila 1)
    }
  }
  return -1;
}

function buscarFilaPorDocumento(sheet, documentoTarget) {
  if (!sheet || !documentoTarget) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var docColumnValues = sheet.getRange(1, 2, lastRow, 1).getValues();
  var target = String(documentoTarget).trim();

  for (var i = 1; i < docColumnValues.length; i++) {
    var cellValue = String(docColumnValues[i][0]).trim();
    if (cellValue === target) {
      return i + 1;
    }
  }
  return -1;
}

// GUARDA DE FORMA ABSOLUTAMENTE EXCLUSIVA EN LA PESTAÑA 'GESTION_SST'
function guardarGestionExclusivaEnHoja(ss, sheetReportes, sheetGestion, documento, status, notes, operator, callback) {
  try {
    var docStr = String(documento || "").trim();
    if (!docStr || docStr === "null" || docStr === "undefined") {
      throw new Error("El documento de identidad es obligatorio para registrar la gestión");
    }

    var nowStr = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
    var infoR = buscarInfoReportePorDoc(sheetReportes, docStr);

    var existingRowG = buscarFilaEnGestion(sheetGestion, docStr);
    var rowValuesG = [
      nowStr,
      docStr,
      infoR.nombre || "Colaborador",
      infoR.cargo || "Colaborador",
      infoR.sede || "Sede Principal",
      infoR.telefono || "",
      infoR.municipio || "Pereira",
      infoR.situacionYApoyo || "Apoyo SST",
      status || "pendiente",
      notes || "",
      nowStr,
      operator || "Operador SST"
    ];

    if (existingRowG > 0) {
      sheetGestion.getRange(existingRowG, 1, 1, rowValuesG.length).setValues([rowValuesG]);
    } else {
      sheetGestion.appendRow(rowValuesG);
    }

    limpiarCacheReportes();

    var resObj = {
      status: "success",
      message: "Gestión SST guardada exitosamente en GESTION_SST para " + docStr,
      documento: docStr,
      gestionStatus: status,
      gestionNotes: notes,
      gestionOperator: operator,
      gestionUpdatedAt: nowStr
    };

    if (callback) {
      return ContentService.createTextOutput(callback + "(" + JSON.stringify(resObj) + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(JSON.stringify(resObj))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errObj = { status: "error", error: err.toString() };
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + JSON.stringify(errObj) + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(errObj)).setMimeType(ContentService.MimeType.JSON);
  }
}

function obtenerHojaEncuestasOriginal(ss) {
  var sheet = ss.getSheetByName("REPORTES_EMERGENCIA");
  if (!sheet) {
    sheet = ss.getSheetByName("BASE_PX");
  }
  if (!sheet) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName() !== "GESTION_SST") {
        return sheets[i];
      }
    }
  }
  return sheet;
}

function obtenerOCrearHojaGestion(ss) {
  var sheet = ss.getSheetByName("GESTION_SST");
  if (!sheet) {
    sheet = ss.insertSheet("GESTION_SST");
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Timestamp Gestión", "Documento", "Nombre Colaborador", "Cargo", "Sede",
      "Teléfono", "Municipio", "Situación / Apoyo", "Estado Gestión SST",
      "Notas y Observaciones", "Última Actualización", "Responsable SST"
    ]);
    var headerRange = sheet.getRange(1, 1, 1, 12);
    headerRange.setBackground("#003366");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}
