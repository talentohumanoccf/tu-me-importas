/**
 * CÓDIGO GOOGLE APPS SCRIPT - COMFAMILIAR RISARALDA
 * Soporte Dual (POST + GET/JSONP) para Garantizar la Sincronización desde Cualquier Celular
 */

function doPost(e) {
  return procesarYGuardarReporte(e ? e.postData.contents : null);
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = obtenerOCrearHoja(ss);

    var docParam = e && e.parameter ? (e.parameter.documento || e.parameter.cedula) : null;
    var callback = e && e.parameter ? e.parameter.callback : null;
    var action = e && e.parameter ? e.parameter.action : null;
    var payloadParam = e && e.parameter ? e.parameter.payload : null;

    // 1. Si llega un envío de reporte vía GET / JSONP (Fallback Celulares)
    if (action === "submitReport" && payloadParam) {
      return procesarYGuardarReporte(payloadParam, callback);
    }

    // 2. Si se solicita consultar una cédula específica en BASE_PX
    if (docParam && docParam !== "ping" && !action) {
      var found = buscarEnBasePX(ss, docParam);
      var jsonResult = JSON.stringify({
        status: found.encontrado ? "found" : "not_found",
        data: found
      });

      if (callback) {
        return ContentService.createTextOutput(callback + "(" + jsonResult + ")")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(jsonResult).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Si se solicita obtener TODOS los reportes para el Tablero Administrador SST
    if (action === "getAllReports" || action === "getReports" || (!docParam && !callback) || (callback && !docParam)) {
      var allReports = obtenerTodosLosReportes(sheet);
      var jsonAll = JSON.stringify({
        status: "success",
        total: allReports.length,
        reports: allReports
      });

      if (callback) {
        return ContentService.createTextOutput(callback + "(" + jsonAll + ")")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(jsonAll).setMimeType(ContentService.MimeType.JSON);
    }

    var onlineMsg = JSON.stringify({
      status: "online",
      message: "API Emergencia Comfamiliar Activa",
      baseSheet: "BASE_PX"
    });

    if (callback) {
      return ContentService.createTextOutput(callback + "(" + onlineMsg + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(onlineMsg).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function procesarYGuardarReporte(rawContents, callback) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var reportSheet = obtenerOCrearHoja(ss);
    
    var data = {};
    if (rawContents) {
      try {
        data = typeof rawContents === "string" ? JSON.parse(rawContents) : rawContents;
      } catch(errJson) {
        data = {};
      }
    }
    
    // Buscar datos base en la pestaña BASE_PX
    var empInfo = buscarEnBasePX(ss, data.cedula || data.documento);
    
    var docFinal = String(data.cedula || data.documento || empInfo.documento || "").trim();
    var nombreFinal = (empInfo.nombre && empInfo.nombre.trim().length > 0) 
      ? empInfo.nombre 
      : (data.nombre && !data.nombre.includes("Colaborador") ? data.nombre : (empInfo.nombre || data.nombre || "No registrado"));

    var cargoFinal = (empInfo.cargo && empInfo.cargo.trim().length > 0)
      ? empInfo.cargo
      : (data.cargo && data.cargo !== "Comfamiliar Risaralda" ? data.cargo : (empInfo.cargo || "Comfamiliar Risaralda"));

    var emailFinal = empInfo.email || data.emailPersonal || data.email || "";
    var contratoFinal = empInfo.contrato || data.contrato || "";
    var procesoFinal = empInfo.proceso || data.proceso || "";
    var areaFinal = empInfo.area || data.area || "";
    var sexoFinal = empInfo.sexo || data.sexo || "";
    var sedeFinal = empInfo.sede || data.sede || "";
    var telefonoBaseFinal = data.telefono || empInfo.telefono || "";
    var direccionHabitualFinal = data.direccionResidencia || data.direccionBase || empInfo.direccion || "";
    var direccionActualFinal = data.direccionActual || data.direccion || direccionHabitualFinal;
    var municipioBaseFinal = data.municipio || empInfo.municipio || "";

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

    // Buscar si la cédula ya tiene un registro previo en REPORTES_EMERGENCIA
    var existingRowIndex = buscarFilaPorDocumento(reportSheet, docFinal);

    if (existingRowIndex > 0) {
      reportSheet.getRange(existingRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      reportSheet.appendRow(rowValues);
    }
    
    var responseObj = {
      status: "success",
      action: existingRowIndex > 0 ? "updated" : "inserted",
      message: "Registro procesado exitosamente para " + docFinal
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

function obtenerTodosLosReportes(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 29).getValues();
  var reports = [];

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (r[1] && String(r[1]).trim().length > 0) {
      reports.push({
        id: 'rep-' + i,
        timestamp: r[0] ? String(r[0]) : '',
        documento: String(r[1]),
        cedula: String(r[1]),
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
        latitud: String(r[25] || ''),
        longitud: String(r[26] || ''),
        criticidad: String(r[27] || 'verde'),
        origen: String(r[28] || 'Google Sheet')
      });
    }
  }

  return reports;
}

function buscarFilaPorDocumento(sheet, documentoTarget) {
  if (!documentoTarget) return -1;
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

function crearHojaReportesManual() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = obtenerOCrearHoja(ss);
  Logger.log("✅ Hoja REPORTES_EMERGENCIA verificada/creada correctamente.");
}

function obtenerOCrearHoja(ss) {
  var sheet = ss.getSheetByName("REPORTES_EMERGENCIA");
  if (!sheet) {
    sheet = ss.insertSheet("REPORTES_EMERGENCIA");
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Fecha y Hora", "Documento", "Nombre Completo", "Cargo", "Email Personal", "Contrato",
      "Proceso", "Área", "Sexo", "Sede Registrada", "Teléfono Contacto", "Contacto Emergencia",
      "Dirección Residencia Habitual", "Dirección Actual en Emergencia", "Municipio / Barrio", "Tipo de Sangre",
      "Situación y Apoyo Requerido", "Personas en Hogar", "Tipo de Vivienda", "Afectación de Vivienda",
      "Cuenta con Lugar Seguro", "Estado Grupo Familiar", "Presencialidad Obligatoria",
      "Condiciones Óptimas (Net/Energía)", "Herramientas Trabajo Completas", "Latitud GPS", "Longitud GPS",
      "Nivel Criticidad", "Origen Sincronización"
    ]);
    var headerRange = sheet.getRange(1, 1, 1, 29);
    headerRange.setBackground("#003366");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function buscarEnBasePX(ss, documento) {
  var emptyObj = { encontrado: false };
  if (!documento) return emptyObj;

  var baseSheet = ss.getSheetByName("BASE_PX");
  if (!baseSheet) return emptyObj;

  var data = baseSheet.getDataRange().getValues();
  if (data.length < 2) return emptyObj;

  var headers = data[0].map(function(h) { return String(h).trim().toUpperCase(); });
  
  var colDoc = headers.indexOf("DOCUMENTO");
  var colNombre = headers.indexOf("NOMBRE");
  var colCargo = headers.indexOf("CARGO");
  var colEmail = headers.indexOf("EMAIL");
  var colContrato = headers.indexOf("CONTRATO");
  var colProceso = headers.indexOf("PROCESO");
  var colArea = headers.indexOf("AREA");
  var colSexo = headers.indexOf("SEXO");
  var colSede = headers.indexOf("SEDE");
  var colTelefono = headers.indexOf("TELEFONO");
  var colDireccion = headers.indexOf("DIRECCIÓN") > -1 ? headers.indexOf("DIRECCIÓN") : headers.indexOf("DIRECCION");
  var colMunicipio = headers.indexOf("MUNICIPIO");
  var colModelo = headers.indexOf("MOLDELO TRABABJO") > -1 ? headers.indexOf("MOLDELO TRABABJO") : headers.indexOf("MODELO TRABAJO");

  var docTarget = String(documento).trim();

  for (var i = 1; i < data.length; i++) {
    var docCell = String(data[i][colDoc]).trim();
    if (docCell === docTarget) {
      return {
        encontrado: true,
        documento: docTarget,
        nombre: colNombre > -1 ? String(data[i][colNombre]) : "",
        cargo: colCargo > -1 ? String(data[i][colCargo]) : "",
        email: colEmail > -1 ? String(data[i][colEmail]) : "",
        contrato: colContrato > -1 ? String(data[i][colContrato]) : "",
        proceso: colProceso > -1 ? String(data[i][colProceso]) : "",
        area: colArea > -1 ? String(data[i][colArea]) : "",
        sexo: colSexo > -1 ? String(data[i][colSexo]) : "",
        sede: colSede > -1 ? String(data[i][colSede]) : "",
        telefono: colTelefono > -1 ? String(data[i][colTelefono]) : "",
        direccion: colDireccion > -1 ? String(data[i][colDireccion]) : "",
        municipio: colMunicipio > -1 ? String(data[i][colMunicipio]) : "",
        modeloTrabajo: colModelo > -1 ? String(data[i][colModelo]) : ""
      };
    }
  }

  return emptyObj;
}
