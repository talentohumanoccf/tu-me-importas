/**
 * CÓDIGO DE GOOGLE APPS SCRIPT PARA GOOGLE SHEETS
 * Sistema de Reporte de Emergencia - Comfamiliar Risaralda
 * 
 * ESTRUCTURA INTEGRADA CON HOJA: BASE_PX
 * CAMPOS BASE_PX: DOCUMENTO, NOMBRE, CARGO, EMAIL, CONTRATO, PROCESO, AREA, Sexo, SEDE, TELEFONO, DIRECCIÓN, MUNICIPIO, MODELO TRABAJO
 */

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Obtener o Crear Hoja de Reportes de Emergencia
    var reportSheet = ss.getSheetByName("REPORTES_EMERGENCIA");
    if (!reportSheet) {
      reportSheet = ss.insertSheet("REPORTES_EMERGENCIA");
    }
    
    // Si la hoja de reportes está vacía, crear encabezados consolidados
    if (reportSheet.getLastRow() === 0) {
      reportSheet.appendRow([
        "Fecha y Hora",
        "Documento",
        "Nombre Completo",
        "Cargo",
        "Email",
        "Contrato",
        "Proceso",
        "Área",
        "Sexo",
        "Sede Registrada",
        "Teléfono Registrado",
        "Dirección Registrada",
        "Municipio Registrado",
        "Modelo Trabajo",
        "Estado Salud",
        "Estado Familia",
        "Estado Vivienda",
        "Municipio Actual Emergencia",
        "Dirección Actual / Referencia",
        "Teléfono Contacto Actual",
        "Latitud GPS",
        "Longitud GPS",
        "Necesidades Prioritarias",
        "Observaciones / Comentarios",
        "Nivel Criticidad",
        "Origen Sincronización"
      ]);
      
      // Dar formato institucional Comfamiliar
      var headerRange = reportSheet.getRange(1, 1, 1, 26);
      headerRange.setBackground("#003366");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      reportSheet.setFrozenRows(1);
    }
    
    var data = JSON.parse(e.postData.contents);
    
    // Si no viene toda la info institucional, intentar buscarla en la pestaña BASE_PX por DOCUMENTO
    var empInfo = buscarEnBasePX(ss, data.cedula || data.documento);
    
    reportSheet.appendRow([
      data.timestamp || new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
      data.cedula || data.documento || "",
      data.nombre || empInfo.nombre || "No registrado",
      data.cargo || empInfo.cargo || "",
      data.email || empInfo.email || "",
      data.contrato || empInfo.contrato || "",
      data.proceso || empInfo.proceso || "",
      data.area || empInfo.area || "",
      data.sexo || empInfo.sexo || "",
      data.sede || empInfo.sede || "",
      data.telefonoBase || empInfo.telefono || "",
      data.direccionBase || empInfo.direccion || "",
      data.municipioBase || empInfo.municipio || "",
      data.modeloTrabajo || empInfo.modeloTrabajo || "",
      data.estadoSalud || "",
      data.estadoFamilia || "",
      data.estadoVivienda || "",
      data.municipio || "",
      data.direccion || "",
      data.telefono || "",
      data.latitud || "",
      data.longitud || "",
      Array.isArray(data.necesidades) ? data.necesidades.join(", ") : (data.necesidades || ""),
      data.observaciones || "",
      data.criticidad || "verde",
      data.origen || "Web App"
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Reporte guardado correctamente en REPORTES_EMERGENCIA"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Búsqueda directa por DOCUMENTO en la hoja BASE_PX para GET HTTP
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var docParam = e.parameter ? (e.parameter.documento || e.parameter.cedula) : null;
    
    if (docParam) {
      var found = buscarEnBasePX(ss, docParam);
      return ContentService.createTextOutput(JSON.stringify({
        status: found.encontrado ? "found" : "not_found",
        data: found
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "online",
      service: "Comfamiliar Risaralda Emergency Sync Engine API",
      baseSheet: "BASE_PX"
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función Auxiliar: Busca una cédula/documento en la pestaña BASE_PX
 */
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

  docTarget = String(documento).trim();

  for (var i = 1; i < data.length; i++) {
    var cellDoc = String(data[i][colDoc]).trim();
    if (cellDoc === docTarget) {
      return {
        encontrado: true,
        documento: cellDoc,
        nombre: colNombre > -1 ? data[i][colNombre] : "",
        cargo: colCargo > -1 ? data[i][colCargo] : "",
        email: colEmail > -1 ? data[i][colEmail] : "",
        contrato: colContrato > -1 ? data[i][colContrato] : "",
        proceso: colProceso > -1 ? data[i][colProceso] : "",
        area: colArea > -1 ? data[i][colArea] : "",
        sexo: colSexo > -1 ? data[i][colSexo] : "",
        sede: colSede > -1 ? data[i][colSede] : "",
        telefono: colTelefono > -1 ? data[i][colTelefono] : "",
        direccion: colDireccion > -1 ? data[i][colDireccion] : "",
        municipio: colMunicipio > -1 ? data[i][colMunicipio] : "",
        modeloTrabajo: colModelo > -1 ? data[i][colModelo] : ""
      };
    }
  }

  return emptyObj;
}
