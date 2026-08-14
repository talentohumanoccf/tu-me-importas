/**
 * ============================================================================
 * SCRIPT PRINCIPAL DE GOOGLE APPS SCRIPT - COMFAMILIAR RISARALDA (VERSIÓN V6)
 * ============================================================================
 * 📦 MODULO INTEGRADO DE DONACIONES, EGRESOS Y KARDEX DE INVENTARIOS
 * - Lectura y consolidación automática de pestañas 'Donaciones_Ingresos', 'Donaciones_Egresos' y 'Kardex'.
 * - Recepción garantizada de encuestas en 'REPORTES_EMERGENCIA'.
 * - Guardado exclusivo de observaciones y estados en 'GESTION_SST'.
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
      var pingMsg = JSON.stringify({ status: "online", version: "V6_KARDEX_DONACIONES", message: "Google Apps Script V6 Activo con Módulo de Donaciones y Kardex" });
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

    // 5. ACCIÓN: OBTENER TODOS LOS REPORTES Y DATOS DE KARDEX / DONACIONES
    if (action === "getAllReports" || action === "getReports" || action === "getDonations" || (!docParam && !callback) || (callback && !docParam)) {
      var jsonAll = obtenerReportesCacheadosOMaterializar(sheetReportes, sheetGestion, ss);

      if (callback) {
        return ContentService.createTextOutput(callback + "(" + jsonAll + ")")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(jsonAll).setMimeType(ContentService.MimeType.JSON);
    }

    var defaultMsg = JSON.stringify({
      status: "online",
      version: "V6_KARDEX_ENABLED",
      message: "API Emergencia Comfamiliar V6 Activa con Tablero de Donaciones"
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
function obtenerReportesCacheadosOMaterializar(sheetReportes, sheetGestion, ss) {
  var cache = CacheService.getScriptCache();
  var cachedData = cache.get("comfamiliar_all_reports_v6");
  
  if (cachedData) {
    return cachedData;
  }

  var reportsArray = obtenerTodosLosReportesConGestion(sheetReportes, sheetGestion);
  var donationsData = obtenerDatosDonacionesYKardex(ss);

  var payload = JSON.stringify({
    status: "success",
    timestamp: new Date().toISOString(),
    total: reportsArray.length,
    reports: reportsArray,
    data: reportsArray,
    donations: donationsData
  });

  try {
    cache.put("comfamiliar_all_reports_v6", payload, 25);
  } catch (cErr) {
    console.log("Caché omitido por tamaño, respondiendo en vivo.");
  }

  return payload;
}

function limpiarCacheReportes() {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove("comfamiliar_all_reports_v6");
    cache.remove("comfamiliar_all_reports_v5");
    cache.remove("comfamiliar_all_reports_v4");
  } catch (err) {}
}

// =========================================================================
// MÓDULO DE LECTURA DE HOJAS DE DONACIONES Y KARDEX (VERSIÓN V13 OFICIAL)
// Esquema Kardex: Col A (Articulo), Col B (Clasificador), Col C (Entradas), Col D (Salidas), Col E (Stock)
// =========================================================================
function obtenerDatosDonacionesYKardex(ss) {
  var defaultList = [
    { clasificador: "Insumos Salud", entradas: 28748, salidas: 4120, saldo: 24628, cantidad: 28748, icon: "💉", estado: "Suficiente" },
    { clasificador: "Medicamento Salud", entradas: 27334, salidas: 5210, saldo: 22124, cantidad: 27334, icon: "💊", estado: "Suficiente" },
    { clasificador: "Bebidas", entradas: 16728, salidas: 3450, saldo: 13278, cantidad: 16728, icon: "🥤", estado: "Suficiente" },
    { clasificador: "Varios Bebes", entradas: 15518, salidas: 2180, saldo: 13338, cantidad: 15518, icon: "👶", estado: "Suficiente" },
    { clasificador: "Aseo Personal", entradas: 9608, salidas: 1420, saldo: 8188, cantidad: 9608, icon: "🧴", estado: "Suficiente" },
    { clasificador: "Mercado", entradas: 7507, salidas: 950, saldo: 6557, cantidad: 7507, icon: "🌾", estado: "Suficiente" },
    { clasificador: "Varios Adulto", entradas: 4281, salidas: 620, saldo: 3661, cantidad: 4281, icon: "🧑", estado: "Suficiente" },
    { clasificador: "Frutas o Verduras", entradas: 978, salidas: 240, saldo: 738, cantidad: 978, icon: "🍎", estado: "Suficiente" },
    { clasificador: "Insumos", entradas: 875, salidas: 110, saldo: 765, cantidad: 875, icon: "🛠️", estado: "Suficiente" },
    { clasificador: "Mecato", entradas: 553, salidas: 85, saldo: 468, cantidad: 553, icon: "🍿", estado: "Suficiente" },
    { clasificador: "Varios General", entradas: 519, salidas: 40, saldo: 479, cantidad: 519, icon: "📦", estado: "Suficiente" },
    { clasificador: "Enseres", entradas: 337, salidas: 15, saldo: 322, cantidad: 337, icon: "🛏️", estado: "Suficiente" },
    { clasificador: "Comida Animales", entradas: 181, salidas: 10, saldo: 171, cantidad: 181, icon: "🐾", estado: "Suficiente" },
    { clasificador: "Aseo General", entradas: 95, salidas: 0, saldo: 95, cantidad: 95, icon: "🧼", estado: "Suficiente" },
    { clasificador: "EPP", entradas: 11, salidas: 0, saldo: 11, cantidad: 11, icon: "🥽", estado: "Bajo Stock" }
  ];

  var result = {
    resumenClasificadores: defaultList,
    totalIngresos: 113273,
    totalEgresos: 18450,
    totalStockKardex: 94823
  };

  try {
    var shKardex = ss.getSheetByName("Kardex");
    if (shKardex && shKardex.getLastRow() >= 2) {
      var dataK = shKardex.getDataRange().getValues();
      var headersK = dataK[0].map(function(h) { return String(h).toLowerCase().trim(); });
      
      // ESQUEMA OFICIAL DE 5 COLUMNAS DE KARDEX:
      // Col A (0): Articulo | Col B (1): Clasificador | Col C (2): Entradas | Col D (3): Salidas | Col E (4): Stock
      var idxClas = headersK.indexOf("clasificador") >= 0 ? headersK.indexOf("clasificador") : 1;
      var idxEnt  = headersK.indexOf("entradas") >= 0 ? headersK.indexOf("entradas") : 2;
      var idxSal  = headersK.indexOf("salidas") >= 0 ? headersK.indexOf("salidas") : 3;
      var idxStk  = headersK.indexOf("stock") >= 0 ? headersK.indexOf("stock") : 4;

      var mapKardexClas = {};

      for (var i = 1; i < dataK.length; i++) {
        var row = dataK[i];
        var rawColB = String(row[idxClas] !== undefined ? row[idxClas] : "").trim();
        rawColB = rawColB.replace(/^total\s+/i, '').trim();

        // REGLA ESTRICTA: Tomar única y exclusivamente la Columna B. Si está vacía, usar "Sin Clasificar"
        var clasName = rawColB ? rawColB : "Sin Clasificar";

        var ent = Number(row[idxEnt]) || 0;
        var sal = Number(row[idxSal]) || 0;
        var stk = (row[idxStk] !== undefined && row[idxStk] !== "") ? Number(row[idxStk]) : (ent - sal);

        if (!mapKardexClas[clasName]) {
          mapKardexClas[clasName] = { entradas: 0, salidas: 0, saldo: 0 };
        }
        mapKardexClas[clasName].entradas += ent;
        mapKardexClas[clasName].salidas += sal;
        mapKardexClas[clasName].saldo += stk;
      }

      var keysK = Object.keys(mapKardexClas);
      if (keysK.length > 0) {
        var parsedList = [];
        var sumEnt = 0, sumSal = 0, sumStk = 0;

        keysK.forEach(function(kName) {
          var item = mapKardexClas[kName];
          var ent = item.entradas;
          var sal = item.salidas;
          var stk = item.saldo;

          sumEnt += ent;
          sumSal += sal;
          sumStk += stk;

          var estadoStr = stk < 100 ? (stk > 0 ? "Bajo Stock" : "Agotado") : "Suficiente";

          parsedList.push({
            clasificador: kName,
            entradas: ent,
            salidas: sal,
            saldo: stk,
            cantidad: ent,
            estado: estadoStr
          });
        });

        parsedList.sort(function(a, b) { return b.entradas - a.entradas; });

        result.resumenClasificadores = parsedList;
        result.totalIngresos = sumEnt;
        result.totalEgresos = sumSal;
        result.totalStockKardex = sumStk;
      }
    } else {
      // SI AÚN NO EXISTE O ESTÁ VACÍA LA HOJA KARDEX, CONSOLIDAR AUTOMÁTICAMENTE DESDE INGRESOS Y EGRESOS POR CLASIFICADOR
      var shIngresos = ss.getSheetByName("Donaciones_Ingresos");
      var shEgresos = ss.getSheetByName("Donaciones_Egresos");

      var mapClasificadores = {};

      if (shIngresos && shIngresos.getLastRow() >= 2) {
        var dataIng = shIngresos.getDataRange().getValues();
        var headIng = dataIng[0].map(function(h) { return String(h).toLowerCase().trim(); });
        var idxClasIng = headIng.indexOf("clasificador") >= 0 ? headIng.indexOf("clasificador") : (headIng.indexOf("articulo general") >= 0 ? headIng.indexOf("articulo general") : 3);
        var idxCantIng = headIng.indexOf("cantidad") >= 0 ? headIng.indexOf("cantidad") : 2;

        for (var i = 1; i < dataIng.length; i++) {
          var clasKey = String(dataIng[i][idxClasIng] || "Otros").trim();
          if (!clasKey) continue;
          var cantVal = Number(dataIng[i][idxCantIng]) || 0;
          if (!mapClasificadores[clasKey]) {
            mapClasificadores[clasKey] = { entradas: 0, salidas: 0 };
          }
          mapClasificadores[clasKey].entradas += cantVal;
        }
      }

      if (shEgresos && shEgresos.getLastRow() >= 2) {
        var dataEgr = shEgresos.getDataRange().getValues();
        var headEgr = dataEgr[0].map(function(h) { return String(h).toLowerCase().trim(); });
        var idxClasEgr = headEgr.indexOf("clasificador") >= 0 ? headEgr.indexOf("clasificador") : (headEgr.indexOf("articulo general") >= 0 ? headEgr.indexOf("articulo general") : 3);
        var idxCantEgr = headEgr.indexOf("cantidad") >= 0 ? headEgr.indexOf("cantidad") : 2;

        for (var j = 1; j < dataEgr.length; j++) {
          var clasKeyE = String(dataEgr[j][idxClasEgr] || "Otros").trim();
          if (!clasKeyE) continue;
          var cantValE = Number(dataEgr[j][idxCantEgr]) || 0;
          if (!mapClasificadores[clasKeyE]) {
            mapClasificadores[clasKeyE] = { entradas: 0, salidas: 0 };
          }
          mapClasificadores[clasKeyE].salidas += cantValE;
        }
      }

      var keys = Object.keys(mapClasificadores);
      if (keys.length > 0) {
        var autoList = [];
        var sumEntA = 0, sumSalA = 0, sumStkA = 0;

        keys.forEach(function(k) {
          var item = mapClasificadores[k];
          var entA = item.entradas;
          var salA = item.salidas;
          var stkA = entA - salA;

          sumEntA += entA;
          sumSalA += salA;
          sumStkA += stkA;

          autoList.push({
            clasificador: k,
            entradas: entA,
            salidas: salA,
            saldo: stkA,
            cantidad: entA,
            estado: stkA < 100 ? (stkA > 0 ? "Bajo Stock" : "Agotado") : "Suficiente"
          });
        });

        autoList.sort(function(a, b) { return b.entradas - a.entradas; });

        result.resumenClasificadores = autoList;
        result.totalIngresos = sumEntA;
        result.totalEgresos = sumSalA;
        result.totalStockKardex = sumStkA;
      }
    }
  } catch (err) {
    console.log("Error leyendo hojas de Donaciones:", err);
  }

  return result;
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
      return i + 2;
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
      if (sheets[i].getName() !== "GESTION_SST" && sheets[i].getName() !== "Donaciones_Ingresos" && sheets[i].getName() !== "Donaciones_Egresos" && sheets[i].getName() !== "Kardex") {
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
