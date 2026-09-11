/**
 * PANEL DE ADMINISTRACIÓN SST - COMFAMILIAR RISARALDA
 * Protección Total Contra Borrado de Texto Durante la Escritura en Observaciones (Shielding)
 * Preservación de Estado Local y Prevención de Sobreescritura del DOM
 */

// Version del tablero. Se pinta en la cabecera para poder confirmar, a simple
// vista, si el navegador ya tomo los cambios o sigue con una copia en cache.
// Debe coincidir con el ?v= del <script> en admin.html.
const APP_VERSION = '20260911_1530';

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyNJliFTyGi0a5ehJP2XEhYcC_1rJG_bicc39qfBhXXQKdGmvMH_lw2RLcLqFA0u3a2/exec';
  window.VALID_PINS = window.VALID_PINS || ['2026', 'comfamiliar2026', 'comfamiliar 2026', 'sst2026', 'admin', 'admin2026', '1234', 'comfamiliar'];

  const MUNI_CENTERS = [
    { name: 'Pereira', lat: 4.8143, lng: -75.6946 },
    { name: 'Dosquebradas', lat: 4.8350, lng: -75.6750 },
    { name: 'La Virginia', lat: 4.8980, lng: -75.8820 },
    { name: 'Santa Rosa de Cabal', lat: 4.8680, lng: -75.6210 },
    { name: 'Marsella', lat: 4.9378, lng: -75.7369 },
    { name: 'Belén de Umbría', lat: 5.2014, lng: -75.8672 },
    { name: 'Apía', lat: 5.0536, lng: -75.9422 },
    { name: 'Santuario', lat: 5.0714, lng: -75.9625 },
    { name: 'Pueblo Rico', lat: 5.2239, lng: -76.0356 },
    { name: 'Mistrató', lat: 5.3014, lng: -75.8822 },
    { name: 'Quinchía', lat: 5.3392, lng: -75.7297 },
    { name: 'Guática', lat: 5.3181, lng: -75.8019 },
    { name: 'Balboa', lat: 4.9525, lng: -75.9528 },
    { name: 'La Celia', lat: 4.9822, lng: -75.9861 },
    { name: 'Manizales', lat: 5.0689, lng: -75.5174 },
    { name: 'Armenia', lat: 4.5339, lng: -75.6811 },
    { name: 'Cartago', lat: 4.6990, lng: -75.9140 },
    { name: 'Chinchiná', lat: 5.0131, lng: -75.6022 }
  ];

  const state = {
    isAuthenticated: sessionStorage.getItem('comfamiliar_admin_auth') === 'true',
    operatorName: localStorage.getItem('comfamiliar_operator_name') || 'Operador SST',
    reports: [],
    filteredReports: [],
    map: null,
    markers: [],
    googleSheetsUrl: localStorage.getItem('comfamiliar_sheets_url') || DEFAULT_SHEETS_URL,
    refreshInterval: null,
    activeTab: sessionStorage.getItem('comfamiliar_active_tab') || 'main',
    isTypingActive: false,
    typingTimer: null,
    supportManagement: JSON.parse(localStorage.getItem('comfamiliar_support_management')) || {},
    donationsData: JSON.parse(localStorage.getItem('comfamiliar_donations_data')) || null,
    polizasData: JSON.parse(localStorage.getItem('comfamiliar_polizas_data')) || null,
    pagination: {
      mainPage: Number(sessionStorage.getItem('comfamiliar_main_page')) || 1,
      mainPageSize: 25,
      mgmtPage: Number(sessionStorage.getItem('comfamiliar_mgmt_page')) || 1,
      mgmtPageSize: 25
    }
  };

  const loginScreen = document.getElementById('admin-login-screen');
  const loginForm = document.getElementById('admin-login-form');
  const loginOperatorInput = document.getElementById('login-operator-name');
  const topOperatorInput = document.getElementById('admin-user-name-input');
  const pinInput = document.getElementById('admin-pin-input');
  const loginError = document.getElementById('login-error-msg');
  
  const mainContent = document.getElementById('admin-main-content');
  const btnLockAdmin = document.getElementById('btn-lock-admin');

  const tabBtnMain = document.getElementById('tab-btn-main');
  const tabBtnAnalytics = document.getElementById('tab-btn-analytics');
  const tabBtnManagement = document.getElementById('tab-btn-management');
  const tabBtnDonations = document.getElementById('tab-btn-donations');

  const tabContentMain = document.getElementById('tab-content-main');
  const tabContentAnalytics = document.getElementById('tab-content-analytics');
  const tabContentManagement = document.getElementById('tab-content-management');
  const tabContentDonations = document.getElementById('tab-content-donations');
  
  const sheetsUrlInput = document.getElementById('admin-sheets-url');
  const btnSaveSheets = document.getElementById('btn-save-sheets');
  const btnTestSheets = document.getElementById('btn-test-sheets');
  const btnSyncLive = document.getElementById('btn-sync-live');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const sheetsStatus = document.getElementById('admin-sheets-status');

  const filterSearch = document.getElementById('filter-search');
  const filterApoyo = document.getElementById('filter-apoyo');
  const filterStatus = document.getElementById('filter-status');
  const filterMunicipio = document.getElementById('filter-municipio');
  const btnExportExcelMain = document.getElementById('btn-export-excel-main');
  const btnExportFilteredExcel = document.getElementById('btn-export-filtered-excel');

  if (topOperatorInput) {
    topOperatorInput.value = state.operatorName;
    topOperatorInput.addEventListener('change', () => {
      const val = topOperatorInput.value.trim() || 'Operador SST';
      state.operatorName = val;
      localStorage.setItem('comfamiliar_operator_name', val);
    });
  }

  // --- HELPER UNIFICADOS DE CLASIFICACIÓN Y SANITIZACIÓN ---
  function normalizeStr(str) {
    return (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  function parseColombiaDate(str) {
    if (!str) return new Date(0);
    const cleanStr = String(str).replace(/,/g, '').trim();
    const parts = cleanStr.split(' ');
    if (parts.length === 0) return new Date(0);
    const dateParts = parts[0].split('/');
    if (dateParts.length < 3) return new Date(cleanStr); // Fallback format

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // 0-indexed
    const year = parseInt(dateParts[2], 10);

    let hours = 0, minutes = 0, seconds = 0;
    if (parts.length > 1) {
      const timeParts = parts[1].split(':');
      if (timeParts.length > 0) hours = parseInt(timeParts[0], 10);
      if (timeParts.length > 1) minutes = parseInt(timeParts[1], 10);
      if (timeParts.length > 2) seconds = parseInt(timeParts[2], 10);
    }
    return new Date(year, month, day, hours, minutes, seconds);
  }

  function sanitizeNotes(notesStr) {
    if (!notesStr) return '';
    const clean = String(notesStr).trim();
    const lower = clean.toLowerCase();
    if (lower === 'no' || lower === 'no.' || lower === 'false' || lower === 'null' || lower === 'undefined') {
      return '';
    }
    return clean;
  }

  function getApoyoText(r) {
    let text = normalizeStr(r.situacionYApoyo || r.apoyo || r.necesidad || r.situacion || r._nApoyo || '');
    if (r.novedades && r.novedades.length > 0) {
      r.novedades.forEach(nov => {
        text += ' ' + normalizeStr(nov.novedad || nov.novedadTexto || '') + ' ' + normalizeStr(nov.requerimientos || nov.novedadNeeds || '');
      });
    }
    return text;
  }

  // Solo lo que la persona DECLARÓ marcando una opción: las 7 de la encuesta
  // ("Requiero apoyo con alimentos"...) y las de "Requerimientos Adicionales"
  // de cada novedad. Deja fuera el relato libre, que es lo que hacía aparecer
  // gente en la ficha equivocada: quien contaba que había perdido a un amigo
  // "por caída de escombro" terminaba en Kits de Alimentos.
  function getDeclaredNeeds(r) {
    let text = normalizeStr(r.situacionYApoyo || r.apoyo || r.necesidad || r.situacion || r._nApoyo || '');
    if (r.novedades && r.novedades.length > 0) {
      r.novedades.forEach(nov => {
        text += ' , ' + normalizeStr(nov.requerimientos || nov.novedadNeeds || '');
      });
    }
    return text;
  }

  // Marca de las novedades que NO reportó la persona, sino que se registraron de
  // forma retroactiva para incorporar una gestión que se hizo por fuera de la app
  // (por ejemplo la de medicamentos, que Farmacia llevaba en un archivo aparte).
  // Cuentan para todo lo demás -entran al universo y a su ficha, que es el motivo
  // de registrarlas- pero no son alertas: nadie reportó una situación nueva.
  const MARCA_NOVEDAD_RETROACTIVA = 'se ingresa como novedad para ajustar los datos';

  function esNovedadRetroactiva(nov) {
    return normalizeStr(nov && (nov.novedad || nov.novedadTexto) || '')
      .includes(MARCA_NOVEDAD_RETROACTIVA);
  }

  // Solo las novedades que la persona reportó de verdad. Es lo que debe contar la
  // tarjeta de alertas y el filtro de novedades del Centro de Gestión.
  function tieneNovedadReportada(r) {
    if ((r.situacionYApoyo || '').includes('[NOVEDAD]')) return true;
    return !!(r.novedades || []).some(nov => !esNovedadRetroactiva(nov));
  }

  // Requerimientos declarados en las novedades, sin la declaración inicial.
  // "No requiero apoyo" es la salida explícita del formulario y no cuenta.
  function getNoveltyNeeds(r) {
    if (!r.novedades || r.novedades.length === 0) return '';
    let text = '';
    r.novedades.forEach(nov => {
      text += ' , ' + normalizeStr(nov.requerimientos || nov.novedadNeeds || '');
    });
    return text
      .split(',')
      .map(x => x.trim())
      .filter(x => x && !x.includes('no requiero'))
      .join(', ');
  }

  function isNeedSupport(r) {
    // Una novedad con requerimiento declarado pesa más que la declaración
    // inicial. getApoyoText concatena todo el historial, así que un "estoy bien
    // y seguro" del 14 de agosto seguía vetando a la persona aunque semanas
    // después reportara que se le cayó el techo. Quien estaba bien ese día pudo
    // dejar de estarlo.
    if (getNoveltyNeeds(r)) return true;

    const ap = getApoyoText(r);
    return (ap.length > 0 && !ap.includes('estoy bien y seguro')) || matchesCategory(r, 'familiar');
  }

  function getNormalizedMgmtStatus(r) {
    const doc = String(r.documento || r.cedula).trim();
    const mgmt = state.supportManagement[doc] || {};
    const rawStatus = normalizeStr(mgmt.status || r.gestionStatus || 'pendiente');

    if (
      rawStatus.includes('resuelt') || 
      rawStatus.includes('finaliz') || 
      rawStatus.includes('atend') || 
      rawStatus.includes('entregad') || 
      rawStatus.includes('cerrad') || 
      rawStatus.includes('complet') || 
      rawStatus.includes('listo') ||
      rawStatus.includes('solucion')
    ) {
      return 'resuelto';
    }
    if (
      rawStatus.includes('proces') || 
      rawStatus.includes('gestion') || 
      rawStatus.includes('atencion') || 
      rawStatus.includes('tramit') || 
      rawStatus.includes('contac') || 
      rawStatus.includes('revision') ||
      rawStatus.includes('seguimien')
    ) {
      return 'proceso';
    }
    return 'pendiente';
  }

  function getReportSubCategories(r) {
    const categories = [];
    if (matchesCategory(r, 'psicologico')) categories.push({ key: 'psicologico', name: 'Apoyo Psicológico', icon: '🧠', color: '#003366' });
    if (matchesCategory(r, 'familiar')) categories.push({ key: 'familiar', name: 'Pérdida / Afectación Familiar', icon: '🤍', color: '#B91C1C' });
    if (matchesCategory(r, 'alimentos')) categories.push({ key: 'alimentos', name: 'Kits de Alimentos / Mercado', icon: '📦', color: '#00A88F' });
    if (matchesCategory(r, 'medicamentos')) categories.push({ key: 'medicamentos', name: 'Medicamentos / Salud', icon: '💊', color: '#E63946' });
    if (matchesCategory(r, 'social')) categories.push({ key: 'social', name: 'Trabajo Social', icon: '🤝', color: '#F59E0B' });
    if (matchesCategory(r, 'juridico')) categories.push({ key: 'juridico', name: 'Apoyo Jurídico', icon: '⚖️', color: '#8B5CF6' });
    // Removido de gestión SST por solicitud (se maneja fuera del flujo operacional de tarjetas)
    // if (r.lugarSeguro === 'No' || (r.afectacionVivienda && r.afectacionVivienda.toLowerCase().includes('impiden'))) {
    //   categories.push({ key: 'vivienda', name: 'Sin Lugar Seguro / Vivienda', icon: '🏠', color: '#DC2626' });
    // }

    if (categories.length === 0) {
      categories.push({ key: 'general', name: 'Seguimiento General SST', icon: '📋', color: '#64748B' });
    }

    return categories;
  }

  // Traduce cualquier texto de estado a las tres claves internas.
  function normalizeMgmtWord(rawValue) {
    const rawStatus = normalizeStr(rawValue);
    if (
      rawStatus.includes('resuelt') ||
      rawStatus.includes('finaliz') ||
      rawStatus.includes('atend') ||
      rawStatus.includes('entregad') ||
      rawStatus.includes('cerrad') ||
      rawStatus.includes('complet') ||
      rawStatus.includes('listo') ||
      rawStatus.includes('solucion')
    ) {
      return 'resuelto';
    }
    if (
      rawStatus.includes('proces') ||
      rawStatus.includes('gestion') ||
      rawStatus.includes('atencion') ||
      rawStatus.includes('tramit') ||
      rawStatus.includes('contac') ||
      rawStatus.includes('revision') ||
      rawStatus.includes('seguimien')
    ) {
      return 'proceso';
    }
    return 'pendiente';
  }

  const MGMT_RANK = { pendiente: 0, proceso: 1, resuelto: 2 };

  // Estado REGISTRADO de una disciplina, o null si nadie la registró.
  //
  // Antes, cuando una disciplina no tenía registro propio, esta función devolvía
  // el estado global de la persona. Eso creaba un circuito: el estado global se
  // calcula sumando las disciplinas atendidas (ver saveSupportCase) y luego se
  // le devolvía a las que nadie había tocado. Así, una persona con psicología y
  // medicamentos cerrados aparecía como "atendida" también en alimentos y en
  // jurídica, donde nadie había hecho nada. El flujo ahora va en una sola
  // dirección: etiquetas de la columna J y del módulo -> disciplina -> persona.
  function getRegisteredSubStatus(r, subKey) {
    const doc = String(r.documento || r.cedula).trim();
    const mgmt = state.supportManagement[doc] || {};

    // Lo que SST registró para esa disciplina (etiqueta [DISCIPLINA:ESTADO] en la columna J).
    const sst = (mgmt.subMgmt && mgmt.subMgmt[subKey] && mgmt.subMgmt[subKey].status)
      ? normalizeMgmtWord(mgmt.subMgmt[subKey].status)
      : null;

    // Lo que el módulo interdisciplinar dejó en la columna "Gestión Interdisciplinar".
    const interRaw = mgmt.subMgmtInter && mgmt.subMgmtInter[subKey] && mgmt.subMgmtInter[subKey].status;
    const inter = interRaw ? normalizeMgmtWord(interRaw) : null;

    // Si SST registró la disciplina, manda SST y el módulo solo puede adelantarla:
    // un cierre hecho en el módulo se refleja, pero un cierre que SST ya hizo no
    // se reabre porque el módulo siga con el caso en curso.
    if (sst) return (inter && MGMT_RANK[inter] > MGMT_RANK[sst]) ? inter : sst;

    // Si SST no registró nada, manda el módulo, aunque sea un estado menor: es
    // el único que sabe si el caso sigue abierto o si lo devolvió sin resolver.
    return inter;
  }

  function getNormalizedSubMgmtStatus(r, subKey) {
    return getRegisteredSubStatus(r, subKey) || 'pendiente';
  }

  // Los cuatro cubos con los que se lee una ficha.
  //
  // El cuarto, 'otras', es el que faltaba: separa a quien nadie ha tocado por
  // ningún frente de quien sí está en gestión, solo que esta necesidad concreta
  // todavía no la ha tomado nadie. Meter los dos en "pendiente" exagera el
  // abandono; meterlos en "en gestión" es lo que hacía la herencia y ocultaba
  // necesidades sin atender.
  // Vivienda, criticidad leve y afectación familiar son segmentos de población,
  // no disciplinas: no hay un equipo propio detrás de esas etiquetas. A esas
  // personas las atiende psicología o trabajo social, y la ficha solo suma
  // cuando la disciplina que corresponda las atiende.
  //
  // Se declara como función y no como constante a propósito: checkAuthentication()
  // llega hasta aquí durante el arranque, antes de que se inicialicen las
  // constantes del módulo, y un `const` reventaría dejando el tablero en blanco.
  function esFichaDeSegmento(key) {
    return key === 'vivienda' || key === 'leve' || key === 'familiar';
  }

  function getFichaBucket(r, subKey) {
    // Un segmento no tiene estado propio que consultar: vale el de la persona.
    if (esFichaDeSegmento(subKey)) {
      const global = getNormalizedMgmtStatus(r);
      if (global === 'resuelto') return 'atendido';
      if (global === 'proceso') return 'proceso';
      return 'pendiente';
    }

    const st = getRegisteredSubStatus(r, subKey);
    if (st === 'resuelto') return 'atendido';
    if (st === 'proceso') return 'proceso';
    // Un 'pendiente' explícito significa que el módulo devolvió el caso sin
    // resolverlo: esta disciplina no lo tiene abierto. Sigue hacia la misma
    // pregunta que los que no tienen registro, ¿está la persona en gestión por
    // otro frente?, para no reportar como abandonado a quien no lo está.

    // ¿Hay gestión registrada en alguna otra disciplina? Se revisan TODAS las
    // registradas, no solo las que la persona declaró: el módulo puede haberla
    // atendido por un frente que ella nunca pidió (psicología por criticidad
    // alta, por ejemplo). Mirar solo lo declarado dejaba a esa gente como "sin
    // contacto" teniendo un profesional asignado.
    const doc = String(r.documento || r.cedula).trim();
    const mgmt = state.supportManagement[doc] || {};
    const registradas = new Set([].concat(
      Object.keys(mgmt.subMgmt || {}),
      Object.keys(mgmt.subMgmtInter || {})
    ));

    for (const otraKey of registradas) {
      if (otraKey === subKey) continue;
      const otro = getRegisteredSubStatus(r, otraKey);
      if (otro === 'proceso' || otro === 'resuelto') return 'otras';
    }

    return 'pendiente';
  }

  // Estado de la PERSONA, derivado de sus disciplinas.
  //
  // getNormalizedMgmtStatus lee la columna I, que es un valor guardado y puede
  // quedar desfasado: cuando se registra una disciplina desde fuera del
  // aplicativo, la columna I no se entera y la tarjeta termina diciendo "en
  // gestión" arriba y "atendido" abajo. La fórmula de abajo es la misma que ya
  // usa la app al guardar (saveSubSupportCase y saveSupportCase), solo que
  // aplicada también al mostrar, para que el encabezado y las sub-tarjetas
  // nunca se contradigan.
  //
  // Las fichas de segmento y 'general' quedan fuera del cálculo: no tienen
  // estado propio que aportar, y su bucket sale justamente de la columna I.
  // Si una persona no tiene ninguna disciplina real, se conserva su estado
  // guardado, que es el único dato que existe sobre ella.
  function getRolledUpMgmtStatus(r) {
    const reales = getReportSubCategories(r)
      .filter(cat => cat.key !== 'general' && !esFichaDeSegmento(cat.key));

    if (!reales.length) return getNormalizedMgmtStatus(r);

    const buckets = reales.map(cat => getFichaBucket(r, cat.key));
    if (buckets.every(b => b === 'atendido')) return 'resuelto';
    // 'otras' cuenta como gestión: la persona tiene un profesional asignado,
    // aunque sea por una necesidad distinta de la que estamos mirando.
    if (buckets.some(b => b === 'atendido' || b === 'proceso' || b === 'otras')) return 'proceso';
    return 'pendiente';
  }

  function parseCombinedNotesToSubMgmt(notesStr, reqCategories = null) {
    if (!notesStr || typeof notesStr !== 'string') return null;
    const subMgmt = {};
    const parts = notesStr.split('||');
    let hasAnyBrackets = false;

    parts.forEach(p => {
      // La bandera 's' es necesaria: sin ella el punto no cruza saltos de línea
      // y, como el patrón termina anclado en $, cualquier observación escrita en
      // varios renglones no coincidía y la etiqueta se perdía entera. Notas como
      // "[ALIMENTOS: RESUELTO] Misma dirección\nRequiere solo alimentos" quedaban
      // invisibles para el tablero y la disciplina aparecía sin gestión.
      const match = p.match(/\[([A-Z0-9_]+)(?::\s*([A-Z0-9_]+))?\]\s*(.*?)(?:\s*\((.*?)\))?$/is);
      if (match) {
        hasAnyBrackets = true;
        const rawKey = match[1].toLowerCase().trim();
        let key = rawKey;
        if (rawKey.includes('psico')) key = 'psicologico';
        else if (rawKey.includes('fam') || rawKey.includes('perd') || rawKey.includes('lut')) key = 'familiar';
        else if (rawKey.includes('alim') || rawKey.includes('merc')) key = 'alimentos';
        else if (rawKey.includes('med')) key = 'medicamentos';
        else if (rawKey.includes('soc')) key = 'social';
        else if (rawKey.includes('juri')) key = 'juridico';
        else if (rawKey.includes('viv')) key = 'vivienda';

        const status = match[2] ? match[2].toLowerCase().trim() : 'proceso';
        const notes = match[3] ? match[3].trim() : p.trim();
        const operator = match[4] ? match[4].trim() : 'Operador SST';
        subMgmt[key] = { status, notes, operator };
      }
    });

    // Smart fallback for legacy unbracketed combined notes (e.g. "Prueba2 || Prueba10")
    if (!hasAnyBrackets && parts.length > 1 && reqCategories && reqCategories.length > 0) {
      const limit = Math.min(parts.length, reqCategories.length);
      for (let i = 0; i < limit; i++) {
        const key = reqCategories[i];
        subMgmt[key] = {
          status: 'proceso',
          notes: parts[i].trim(),
          operator: 'Operador SST'
        };
      }
    }

    return Object.keys(subMgmt).length > 0 ? subMgmt : null;
  }

  function updatePaginationUI(type, start, end, total, currentPage, totalPages) {
    const infoEl = document.getElementById(`${type}-pagination-info`);
    const pageNumEl = document.getElementById(`${type}-page-num`);
    const prevBtn = document.getElementById(`btn-${type}-prev`);
    const nextBtn = document.getElementById(`btn-${type}-next`);

    if (infoEl) {
      if (total === 0) infoEl.textContent = 'Sin registros';
      else infoEl.textContent = `Mostrando ${start} - ${end} de ${total.toLocaleString('es-CO')} registros`;
    }
    if (pageNumEl) pageNumEl.textContent = `Pág. ${currentPage} / ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  }

  window.changePage = function(type, delta) {
    if (type === 'main') {
      const totalItems = state.filteredReports.length;
      const pageSizeVal = state.pagination.mainPageSize;
      const pageSize = pageSizeVal === 'all' ? totalItems : Number(pageSizeVal || 25);
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      let newPage = state.pagination.mainPage + delta;
      if (newPage < 1) newPage = 1;
      if (newPage > totalPages) newPage = totalPages;
      state.pagination.mainPage = newPage;
      sessionStorage.setItem('comfamiliar_main_page', newPage);
      renderTable();
    } else if (type === 'mgmt') {
      // El total tiene que ser el de la lista YA FILTRADA, no el de toda la
      // poblacion. Contando sobre el total, "siguiente" llevaba a una pagina
      // que no existe dentro del filtro y el render la devolvia al limite:
      // el usuario veia que la pagina retrocedia sola.
      const totalItems = (state.pagination.mgmtTotalItems != null)
        ? state.pagination.mgmtTotalItems
        : state.reports.filter(r => isNeedSupport(r)).length;
      const pageSizeVal = state.pagination.mgmtPageSize;
      const pageSize = pageSizeVal === 'all' ? totalItems : Number(pageSizeVal || 25);
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      let newPage = state.pagination.mgmtPage + delta;
      if (newPage < 1) newPage = 1;
      if (newPage > totalPages) newPage = totalPages;
      state.pagination.mgmtPage = newPage;
      sessionStorage.setItem('comfamiliar_mgmt_page', newPage);
      renderManagementDashboard(true);
    }
  };

  window.changePageSize = function(type, newSize) {
    if (type === 'main') {
      state.pagination.mainPageSize = newSize === 'all' ? 'all' : Number(newSize);
      state.pagination.mainPage = 1;
      renderTable();
    } else if (type === 'mgmt') {
      state.pagination.mgmtPageSize = newSize === 'all' ? 'all' : Number(newSize);
      state.pagination.mgmtPage = 1;
      renderManagementDashboard(true);
    }
  };

  window.saveSubSupportCase = function(doc, subKey) {
    state.isTypingActive = false;
    const selectEl = document.getElementById(`mgmt-sub-select-${doc}-${subKey}`);
    const notesEl = document.getElementById(`mgmt-sub-notes-${doc}-${subKey}`);
    if (!selectEl || !notesEl) return;

    let subStatus = selectEl.value;
    const subNotes = sanitizeNotes(notesEl.value);
    const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
    const nowStr = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    if (subStatus === 'pendiente' && subNotes.length > 0) {
      subStatus = 'proceso';
      selectEl.value = 'proceso';
    }

    if (!state.supportManagement[doc]) {
      state.supportManagement[doc] = { status: 'pendiente', notes: '', operator: currentOperator, updatedAt: nowStr, subMgmt: {} };
    }

    if (!state.supportManagement[doc].subMgmt) {
      state.supportManagement[doc].subMgmt = {};
    }

    state.supportManagement[doc].subMgmt[subKey] = {
      status: subStatus,
      notes: subNotes,
      operator: currentOperator,
      updatedAt: nowStr
    };

    const rTarget = state.reports.find(item => String(item.documento || item.cedula).trim() === String(doc).trim()) || {};
    const reqSubCats = getReportSubCategories(rTarget);
    const statuses = reqSubCats.map(cat => getNormalizedSubMgmtStatus(rTarget, cat.key));

    const allResolved = statuses.length > 0 && statuses.every(st => st === 'resuelto');
    const anyInProcessOrResolved = statuses.some(st => st === 'proceso' || st === 'resuelto');

    let globalStatus = 'pendiente';
    if (allResolved) globalStatus = 'resuelto';
    else if (anyInProcessOrResolved) globalStatus = 'proceso';

    state.supportManagement[doc].status = globalStatus;
    state.supportManagement[doc].operator = currentOperator;
    state.supportManagement[doc].updatedAt = nowStr;

    const entries = Object.entries(state.supportManagement[doc].subMgmt);
    const combinedNotesStr = entries
      .map(([k, v]) => `[${k.toUpperCase()}:${(v.status || 'proceso').toUpperCase()}] ${v.notes}`)
      .join(' || ');

    state.supportManagement[doc].notes = combinedNotesStr;
    state.supportManagement[doc].isDirty = false; // Guardado / Sincronizado
    // Sello del guardado local. La sincronizacion corre cada 25 segundos y la
    // escritura en la hoja va por JSONP, que puede tardar varios segundos; si
    // entremedio llegaba una respuesta preparada ANTES del guardado, pisaba el
    // valor recien puesto y el operador veia que su cambio se revertia. Al
    // guardar dos veces si quedaba, porque la segunda ya ganaba la carrera.
    state.supportManagement[doc].guardadoEn = Date.now();
    localStorage.setItem('comfamiliar_support_management', JSON.stringify(state.supportManagement));

    if (state.googleSheetsUrl && navigator.onLine) {
      sendManagementToSheets(doc, globalStatus, combinedNotesStr, currentOperator);
    }

    renderDashboard(true);

    // Al redibujar, la fila puede quedar en otra posicion o salirse del filtro
    // activo (por ejemplo si se estaba filtrando por "Pendientes"). Se devuelve
    // la vista al caso trabajado para no obligar a buscarlo otra vez.
    requestAnimationFrame(() => {
      const fila = document.getElementById('mgmt-row-' + doc);
      if (fila) {
        fila.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        showToast('El caso salió del filtro activo por su nuevo estado. Cambia el filtro para volver a verlo.', 'info');
      }
    });

    showToast(`✅ Gestión de [${subKey.toUpperCase()}] guardada exitosamente.`, 'success');
  };

  function matchesCategory(r, category) {
    // `dec` es lo declarado marcando una opción; `ap` incluye además el relato
    // libre. Las cinco disciplinas que se enrutan por formulario usan `dec`, para
    // que la app y el módulo interdisciplinar lean exactamente lo mismo. Solo
    // `familiar` sigue usando `ap`: es la única categoría sin opción propia en
    // ninguno de los dos formularios, así que quitarle el texto la dejaría ciega.
    const dec = getDeclaredNeeds(r);
    const ap = getApoyoText(r);
    const cat = normalizeStr(category);

    if (cat === 'all') return true;
    if (cat.includes('psico')) return dec.includes('psico');
    // "Vivienda" era una opción de la novedad sin ficha ni equipo propio; las
    // solicitudes de vivienda las atiende Trabajo Social, igual que en el módulo
    // interdisciplinar, donde se registran como "Trabajo Social (vivienda
    // inhabitable)". La opción se retiró del formulario el 2026-09-08, pero
    // quienes ya la habían marcado siguen contando aquí.
    if (cat.includes('social')) return dec.includes('social') || dec.includes('vivienda');
    if (cat.includes('med')) return dec.includes('medicament') || dec.includes('salud') || dec.includes('receta');
    if (cat.includes('aliment')) return dec.includes('aliment') || dec.includes('kit') || dec.includes('mercado') || dec.includes('vivere') || dec.includes('comida');
    if (cat.includes('juri')) return dec.includes('juri') || dec.includes('legal');
    // Vivienda no se declara como texto en la solicitud, sino en la pregunta de
    // afectación. Se usa el mismo criterio de la ficha KPI (getConfrontationMetrics)
    // para que el filtro del Centro de Gestión devuelva exactamente esos casos.
    if (cat.includes('viv')) {
      const viv = normalizeStr(r.afectacionVivienda || '');
      return viv.includes('impiden') || viv.includes('no me permiten');
    }
    if (cat.includes('famili') || cat.includes('perdi')) {
      const estFam = normalizeStr(r.estadoFamilia || '');
      const hasFamSupportText = ap.includes('famili') || ap.includes('perdi') || ap.includes('fallec') || ap.includes('luto') || ap.includes('duelo');
      const requiresMgmt = estFam.includes('lesionad') || 
                           estFam.includes('psicosoc') || 
                           estFam.includes('medic') || 
                           estFam.includes('perdi') || 
                           estFam.includes('fallec');
      return hasFamSupportText || requiresMgmt;
    }
    return ap.includes(cat);
  }

  // DELEGACIÓN DE EVENTOS: CAPTURA INSTANTÁNEA TECLA A TECLA CON PROTECCIÓN DE BLINDAJE
  const mgmtTbody = document.getElementById('mgmt-reports-tbody');
  if (mgmtTbody) {
    mgmtTbody.addEventListener('input', (e) => {
      if (e.target && e.target.classList.contains('mgmt-notes-textarea')) {
        state.isTypingActive = true;
        
        if (state.typingTimer) clearTimeout(state.typingTimer);
        state.typingTimer = setTimeout(() => {
          state.isTypingActive = false;
        }, 5000); // 5 segundos de inmunidad total tras pulsar la última tecla

        const textareaId = e.target.id;
        let doc = '';
        let subKey = '';

        if (textareaId.startsWith('mgmt-sub-notes-')) {
          const match = textareaId.match(/^mgmt-sub-notes-([^-]+)-(.*)$/);
          if (match) {
            doc = match[1];
            subKey = match[2];
          }
        } else if (textareaId.startsWith('mgmt-notes-')) {
          doc = textareaId.replace('mgmt-notes-', '').trim();
        }

        const val = e.target.value;

        if (doc) {
          const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
          
          if (!state.supportManagement[doc]) {
            state.supportManagement[doc] = { status: 'pendiente', notes: '', operator: currentOperator, updatedAt: '', subMgmt: {} };
          }
          
          state.supportManagement[doc].isDirty = true; // Marcar como modificado localmente

          if (subKey) {
            if (!state.supportManagement[doc].subMgmt) {
              state.supportManagement[doc].subMgmt = {};
            }
            state.supportManagement[doc].subMgmt[subKey] = {
              status: state.supportManagement[doc].subMgmt[subKey]?.status || 'proceso',
              notes: val,
              operator: state.supportManagement[doc].subMgmt[subKey]?.operator || currentOperator,
              updatedAt: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })
            };
            
            // Recalcular la nota combinada global de forma instantánea
            const entries = Object.entries(state.supportManagement[doc].subMgmt);
            const combinedNotesStr = entries
              .map(([k, v]) => `[${k.toUpperCase()}:${(v.status || 'proceso').toUpperCase()}] ${v.notes}`)
              .join(' || ');
            
            state.supportManagement[doc].notes = combinedNotesStr;
          } else {
            state.supportManagement[doc].notes = val;
          }

          localStorage.setItem('comfamiliar_support_management', JSON.stringify(state.supportManagement));
        }
      }
    });

    mgmtTbody.addEventListener('change', (e) => {
      if (e.target && e.target.classList.contains('mgmt-status-select')) {
        const selectId = e.target.id;
        let doc = '';
        let subKey = '';

        if (selectId.startsWith('mgmt-sub-select-')) {
          const match = selectId.match(/^mgmt-sub-select-([^-]+)-(.*)$/);
          if (match) {
            doc = match[1];
            subKey = match[2];
          }
        }

        if (doc && subKey) {
          const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
          
          if (!state.supportManagement[doc]) {
            state.supportManagement[doc] = { status: 'pendiente', notes: '', operator: currentOperator, updatedAt: '', subMgmt: {} };
          }
          
          state.supportManagement[doc].isDirty = true; // Marcar como modificado localmente

          if (!state.supportManagement[doc].subMgmt) {
            state.supportManagement[doc].subMgmt = {};
          }
          if (!state.supportManagement[doc].subMgmt[subKey]) {
            state.supportManagement[doc].subMgmt[subKey] = { status: 'pendiente', notes: '', operator: currentOperator, updatedAt: '' };
          }
          
          state.supportManagement[doc].subMgmt[subKey].status = e.target.value;
          
          localStorage.setItem('comfamiliar_support_management', JSON.stringify(state.supportManagement));
        }
      }
    });
  }

  window.triggerGlobalFilter = function() { applyFilters(true); };
  window.triggerMgmtRender = function() { renderManagementDashboard(true); };

  // Consola ejecutiva de KPIs eliminada de la pestaña de Gestión SST.

  window.toggleMgmtChartsPanel = function() {
    const container = document.getElementById('mgmt-charts-collapse-container');
    const text = document.getElementById('text-toggle-mgmt-charts');
    const arrow = document.getElementById('arrow-toggle-mgmt-charts');
    const btn = document.getElementById('btn-toggle-mgmt-charts');

    if (!container || !text || !arrow || !btn) return;

    if (container.style.display === 'none') {
      container.style.display = 'block';
      text.textContent = 'Ocultar Gráficas de Avance y Estado de Gestión (Consolidado General)';
      arrow.textContent = '▲';
      btn.style.background = 'var(--secondary)';
      localStorage.setItem('comfamiliar_mgmt_charts_expanded', 'true');
    } else {
      container.style.display = 'none';
      text.textContent = 'Mostrar Gráficas de Avance y Estado de Gestión (Consolidado General)';
      arrow.textContent = '▼';
      btn.style.background = 'var(--primary)';
      localStorage.setItem('comfamiliar_mgmt_charts_expanded', 'false');
    }
  };

  window.toggleMainKpiPanel = function() {
    const container = document.getElementById('main-kpi-collapse-container');
    const text = document.getElementById('text-toggle-main-kpi');
    const arrow = document.getElementById('arrow-toggle-main-kpi');
    const btn = document.getElementById('btn-toggle-main-kpi');

    if (!container || !text || !arrow || !btn) return;

    if (container.style.display === 'none') {
      container.style.display = 'block';
      text.textContent = 'Ocultar Consola de Indicadores Clave (KPIs)';
      arrow.textContent = '▲';
      btn.style.background = 'var(--secondary)';
      localStorage.setItem('comfamiliar_main_kpi_expanded', 'true');
    } else {
      container.style.display = 'none';
      text.textContent = 'Mostrar Consola de Indicadores Clave (KPIs)';
      arrow.textContent = '▼';
      btn.style.background = 'var(--primary)';
      localStorage.setItem('comfamiliar_main_kpi_expanded', 'false');
    }
  };

  window.toggleMainMapPanel = function() {
    const container = document.getElementById('main-map-collapse-container');
    const text = document.getElementById('text-toggle-main-map');
    const arrow = document.getElementById('arrow-toggle-main-map');
    const btn = document.getElementById('btn-toggle-main-map');

    if (!container || !text || !arrow || !btn) return;

    if (container.style.display === 'none') {
      container.style.display = 'block';
      text.textContent = 'Ocultar Ubicación Satelital de Trabajadores Registrados (Mapa)';
      arrow.textContent = '▲';
      btn.style.background = 'var(--secondary)';
      localStorage.setItem('comfamiliar_main_map_expanded', 'true');
      
      if (state.map) {
        setTimeout(() => {
          state.map.invalidateSize();
        }, 150);
      }
    } else {
      container.style.display = 'none';
      text.textContent = 'Mostrar Ubicación Satelital de Trabajadores Registrados (Mapa)';
      arrow.textContent = '▼';
      btn.style.background = 'var(--primary)';
      localStorage.setItem('comfamiliar_main_map_expanded', 'false');
    }
  };

  // Panel de confrontación removido y unificado en los KPIs superiores del Tablero 1.
  
  // FILTRADO INTELIGENTE AL HACER CLIC EN LAS 3 FICHAS EJECUTIVAS GLOBALES
  window.filterMgmtByStatusCard = function(status) {
    const elStatus = document.getElementById('mgmt-filter-status');
    const elCat = document.getElementById('mgmt-filter-category');

    if (!elStatus) return;

    elStatus.value = status;
    elStatus.dataset.manualOverride = 'true';
    if (elCat) elCat.value = 'all';

    renderManagementDashboard(true);
  };

  window.filterMgmtByCard = window.filterMgmtByStatusCard;

  window.claimCase = function(doc) {
    state.isTypingActive = false;
    const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
    const existing = state.supportManagement[doc] || {};

    if (existing.status === 'proceso' && existing.operator && existing.operator !== currentOperator) {
      const confirmTransfer = confirm(`⚠️ Este caso ya está en atención por [${existing.operator}]. ¿Deseas reasignarlo a tu nombre (${currentOperator})?`);
      if (!confirmTransfer) return;
    }

    const notesEl = document.getElementById(`mgmt-notes-${doc}`);
    const currentNotesValue = notesEl ? sanitizeNotes(notesEl.value) : sanitizeNotes(existing.notes || '');

    const newStatus = 'proceso';
    const nowStr = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    updateLocalManagementState(doc, newStatus, currentNotesValue, currentOperator, nowStr);

    if (state.googleSheetsUrl && navigator.onLine) {
      sendManagementToSheets(doc, newStatus, currentNotesValue, currentOperator);
    }

    // Cambiar filtro a "mis_casos" automáticamente para llevar al usuario directamente a gestionarlo
    const elStatus = document.getElementById('mgmt-filter-status');
    if (elStatus) {
      elStatus.value = 'mis_casos';
      elStatus.dataset.manualOverride = 'true';
    }

    renderDashboard(true);
    showToast(`✋ Caso asignado exitosamente a [${currentOperator}].`, 'info');
  };

  window.releaseCase = function(doc) {
    state.isTypingActive = false;
    const existing = state.supportManagement[doc] || {};
    const notesEl = document.getElementById(`mgmt-notes-${doc}`);
    const currentNotesValue = notesEl ? sanitizeNotes(notesEl.value) : sanitizeNotes(existing.notes || '');

    const newStatus = 'pendiente';
    const nowStr = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    updateLocalManagementState(doc, newStatus, currentNotesValue, 'Sin asignar', nowStr);

    if (state.googleSheetsUrl && navigator.onLine) {
      sendManagementToSheets(doc, newStatus, currentNotesValue, 'Sin asignar');
    }

    // Al liberar, volver al filtro de "pendiente" automáticamente para elegir otro
    const elStatus = document.getElementById('mgmt-filter-status');
    if (elStatus) {
      elStatus.value = 'pendiente';
      elStatus.dataset.manualOverride = 'true';
    }

    renderDashboard(true);
  };

  window.triggerExcelExport = function(isFilteredOnly) {
    if (isFilteredOnly) {
      exportFilteredToExcel();
    } else {
      exportAllToExcel();
    }
  };

  window.triggerExcelExportTelework = function() {
    exportTeleworkToExcel();
  };

  window.triggerManagementExcelExport = exportManagementMatrixToExcel;

  window.saveSupportCase = async function(doc) {
    state.isTypingActive = false;
    
    const rTarget = state.reports.find(item => String(item.documento || item.cedula).trim() === String(doc).trim()) || {};
    const reqSubCats = getReportSubCategories(rTarget);
    const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
    const nowStr = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const existing = state.supportManagement[doc];
    if (existing && existing.operator && existing.operator !== currentOperator && existing.status === 'proceso' && existing.operator !== 'Sin asignar') {
      const confirmOverwrite = confirm(`⚠️ Este caso estaba asignado a [${existing.operator}]. ¿Confirmas guardar la actualización de todas las atenciones a tu nombre (${currentOperator})?`);
      if (!confirmOverwrite) return;
    }

    if (!state.supportManagement[doc]) {
      state.supportManagement[doc] = { status: 'pendiente', notes: '', operator: currentOperator, updatedAt: nowStr, subMgmt: {} };
    }
    if (!state.supportManagement[doc].subMgmt) {
      state.supportManagement[doc].subMgmt = {};
    }

    let anyChanges = false;
    reqSubCats.forEach(cat => {
      const selectEl = document.getElementById(`mgmt-sub-select-${doc}-${cat.key}`);
      const notesEl = document.getElementById(`mgmt-sub-notes-${doc}-${cat.key}`);
      if (selectEl && notesEl) {
        let subStatus = selectEl.value;
        const subNotes = sanitizeNotes(notesEl.value);

        // "Guardar Todo" solo persiste las tarjetas que el operador tocó.
        //
        // Lo que una tarjeta muestra no siempre es un registro: puede ser el
        // estado global de la persona prestado a una disciplina que nadie
        // atendió, o el estado que el módulo interdisciplinar dejó en la
        // columna M. Guardar eso lo convertiría en una etiqueta real de SST en
        // la columna J, y a partir de ahí SST manda sobre el módulo, que ya no
        // podría mover ese estado aunque reabra el caso.
        //
        // Las tarjetas que ya tienen etiqueta propia tampoco se reescriben si
        // nadie las tocó: conservan el valor guardado en vez del que se está
        // mostrando, que puede venir del módulo.
        //
        // El botón propio de cada tarjeta (saveSubSupportCase) sí guarda
        // siempre: ahí la intención del operador es explícita.
        const estadoTocado = selectEl.value !== (selectEl.dataset.inicial || '');
        const notasTocadas = notesEl.value !== notesEl.defaultValue;
        if (!estadoTocado && !notasTocadas) return;

        if (subStatus === 'pendiente' && subNotes.length > 0) {
          subStatus = 'proceso';
          selectEl.value = 'proceso';
        }

        state.supportManagement[doc].subMgmt[cat.key] = {
          status: subStatus,
          notes: subNotes,
          operator: currentOperator,
          updatedAt: nowStr
        };
        anyChanges = true;
      }
    });

    if (!anyChanges) {
      showToast('No hay cambios para guardar. Para dejar registro de una atención, cambia el estado o escribe una observación en su tarjeta.', 'info');
      return;
    }

    // Localizar el botón de guardar y deshabilitarlo con estado de cargando
    const btn = document.getElementById('mgmt-save-btn-' + doc);
    const originalText = btn ? btn.innerHTML : '💾 Guardar Todo';
    if (btn) {
      btn.innerHTML = '⏳ Guardando...';
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.style.background = '#475569';
    }

    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    // Recalcular estado global y notas combinadas
    const statuses = reqSubCats.map(cat => getNormalizedSubMgmtStatus(rTarget, cat.key));
    const allResolved = statuses.length > 0 && statuses.every(st => st === 'resuelto');
    const anyInProcessOrResolved = statuses.some(st => st === 'proceso' || st === 'resuelto');

    let globalStatus = 'pendiente';
    if (allResolved) globalStatus = 'resuelto';
    else if (anyInProcessOrResolved) globalStatus = 'proceso';

    state.supportManagement[doc].status = globalStatus;
    state.supportManagement[doc].operator = currentOperator;
    state.supportManagement[doc].updatedAt = nowStr;

    const entries = Object.entries(state.supportManagement[doc].subMgmt);
    const combinedNotesStr = entries
      .map(([k, v]) => `[${k.toUpperCase()}:${(v.status || 'proceso').toUpperCase()}] ${v.notes}`)
      .join(' || ');

    state.supportManagement[doc].notes = combinedNotesStr;
    state.supportManagement[doc].isDirty = false; // Guardado / Sincronizado
    // Sello del guardado local. La sincronizacion corre cada 25 segundos y la
    // escritura en la hoja va por JSONP, que puede tardar varios segundos; si
    // entremedio llegaba una respuesta preparada ANTES del guardado, pisaba el
    // valor recien puesto y el operador veia que su cambio se revertia. Al
    // guardar dos veces si quedaba, porque la segunda ya ganaba la carrera.
    state.supportManagement[doc].guardadoEn = Date.now();
    
    updateLocalManagementState(doc, globalStatus, combinedNotesStr, currentOperator, nowStr);

    let saveSuccess = true;
    if (state.googleSheetsUrl && navigator.onLine) {
      saveSuccess = await sendManagementToSheets(doc, globalStatus, combinedNotesStr, currentOperator);
    }
    
    // Restaurar el botón
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.background = '#059669';
    }
    
    // Al resolver el caso por completo, volver automáticamente a "pendiente" para elegir otro
    if (globalStatus === 'resuelto') {
      const elStatus = document.getElementById('mgmt-filter-status');
      if (elStatus) {
        elStatus.value = 'pendiente';
        elStatus.dataset.manualOverride = 'true';
      }
    }
    
    renderDashboard(true);

    if (saveSuccess) {
      if (globalStatus === 'resuelto') {
        showToast(`🎉 Caso RESUELTO para Cédula ${doc}.`, 'success');
      } else {
        showToast(`🔵 Caso asignado y guardado a nombre de [${currentOperator}].`, 'info');
      }
    } else {
      showToast(`⚠️ Guardado en navegador, pero hubo un retardo al sincronizar con Google Sheets.`, 'warning');
    }
  };

  function updateLocalManagementState(doc, statusVal, notesVal, operatorVal, nowStr) {
    const docStr = String(doc).trim();
    const existing = state.supportManagement[docStr] || {};
    const rTarget = state.reports.find(item => String(item.documento || item.cedula).trim() === docStr) || {};
    const reqCategories = getReportSubCategories(rTarget).map(c => c.key);
    const parsedSub = parseCombinedNotesToSubMgmt(notesVal, reqCategories);

    state.supportManagement[docStr] = {
      status: statusVal,
      notes: sanitizeNotes(notesVal),
      operator: operatorVal || 'Operador SST',
      updatedAt: nowStr,
      subMgmt: parsedSub || existing.subMgmt || {},
      subMgmtInter: existing.subMgmtInter || {}, // solo lectura: se conserva tal cual
      isDirty: false, // Sincronizado / No sucio
      guardadoEn: Date.now() // protege el cambio de la carrera con la sincronizacion
    };

    localStorage.setItem('comfamiliar_support_management', JSON.stringify(state.supportManagement));

    state.reports.forEach(r => {
      const rDoc = String(r.documento || r.cedula).trim();
      if (rDoc === docStr) {
        r.gestionStatus = statusVal;
        r.gestionNotes = sanitizeNotes(notesVal);
        r.gestionOperator = operatorVal;
        r.gestionUpdatedAt = nowStr;
      }
    });
  }

  async function sendManagementToSheets(doc, statusVal, notesVal, operatorVal) {
    if (!state.googleSheetsUrl) return false;

    const cleanNotes = sanitizeNotes(notesVal);
    const url = `${state.googleSheetsUrl}?action=saveManagementNote&documento=${encodeURIComponent(doc)}&status=${encodeURIComponent(statusVal)}&notes=${encodeURIComponent(cleanNotes)}&operator=${encodeURIComponent(operatorVal || 'Operador SST')}&_t=${Date.now()}`;

    // Realizar la sincronización EXCLUSIVAMENTE vía JSONP para evitar la doble petición
    // que causa el intento fallido de Fetch por restricciones de CORS de redirección de Google.
    return new Promise((resolve) => {
      const callbackName = 'onMgmtSaveResult_' + String(doc).replace(/[^a-zA-Z0-9]/g, '_');
      const scriptId = 'jsonp-save-mgmt-sync-' + doc;
      
      const oldScript = document.getElementById(scriptId);
      if (oldScript) oldScript.remove();

      const script = document.createElement('script');
      script.id = scriptId;
      
      const timeoutId = setTimeout(() => {
        console.log('⚠️ Sincronización JSONP excedió tiempo límite.');
        resolve(false);
      }, 8000);

      window[callbackName] = function(res) {
        clearTimeout(timeoutId);
        console.log('✅ Estado y Responsable SST sincronizados con Google Sheets vía JSONP:', res);
        resolve(true);
      };

      script.src = `${url}&callback=${callbackName}`;
      script.onerror = () => {
        clearTimeout(timeoutId);
        console.log('❌ Error al cargar script JSONP.');
        resolve(false);
      };

      document.body.appendChild(script);
    });
  }

  setupTabsNavigation();
  checkAuthentication();

  function logAccessRemotely(adminName) {
    if (!state.googleSheetsUrl) return;
    const callbackName = 'onAdminLogResult';
    const scriptId = 'jsonp-admin-log';
    const oldScript = document.getElementById(scriptId);
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${state.googleSheetsUrl}?action=logAdminAccess&adminName=${encodeURIComponent(adminName)}&callback=${callbackName}`;
    window[callbackName] = function(res) {
      console.log('Access log response:', res);
    };
    document.body.appendChild(script);
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredPinRaw = pinInput ? pinInput.value.trim() : '';
    const enteredPin = enteredPinRaw.toLowerCase();

    const opName = loginOperatorInput ? loginOperatorInput.value.trim() : '';

    // Enforce strict check of defined passcodes only, no empty PINs or partial matches
    const isMatch = enteredPinRaw.length > 0 && (
      enteredPin === '2026' ||
      enteredPin === 'comfamiliar2026' || 
      enteredPin === 'sst2026' || 
      enteredPin === 'comfamiliar2026*' || 
      enteredPin === 'sstcomfamiliar2026*'
    );

    if (isMatch) {
      if (opName) {
        state.operatorName = opName;
        localStorage.setItem('comfamiliar_operator_name', opName);
        if (topOperatorInput) topOperatorInput.value = opName;
        
        // Registrar el acceso en Google Sheets de forma auditada
        logAccessRemotely(opName);
      }
      
      sessionStorage.setItem('comfamiliar_admin_auth', 'true');
      state.isAuthenticated = true;
      if (loginError) loginError.style.display = 'none';
      checkAuthentication();
    } else {
      if (loginError) loginError.style.display = 'block';
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    }
  });

  if (btnLockAdmin) {
    btnLockAdmin.addEventListener('click', () => {
      sessionStorage.removeItem('comfamiliar_admin_auth');
      state.isAuthenticated = false;
      if (state.refreshInterval) clearInterval(state.refreshInterval);
      checkAuthentication();
    });
  }

  function showToast(message, type = 'success') {
    let toast = document.getElementById('comfamiliar-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'comfamiliar-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '24px';
      toast.style.right = '24px';
      toast.style.zIndex = '9999';
      toast.style.padding = '12px 24px';
      toast.style.borderRadius = '8px';
      toast.style.color = '#FFF';
      toast.style.fontWeight = '700';
      toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      toast.style.transition = 'all 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      document.body.appendChild(toast);
    }
    
    if (type === 'success') {
      toast.style.background = '#059669';
    } else if (type === 'info') {
      toast.style.background = '#0284C7';
    } else {
      toast.style.background = '#DC2626';
    }
    
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 50);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 300);
    }, 3000);
  }

  function setupTabsNavigation() {
    const btn1 = document.getElementById('tab-btn-main');
    const btn2 = document.getElementById('tab-btn-analytics');
    const btn3 = document.getElementById('tab-btn-management');
    const btn4 = document.getElementById('tab-btn-donations');
 
    if (btn1) btn1.addEventListener('click', () => switchTab('main'));
    if (btn2) btn2.addEventListener('click', () => switchTab('analytics'));
    if (btn3) btn3.addEventListener('click', () => switchTab('management'));
    if (btn4) btn4.addEventListener('click', () => switchTab('donations'));
  }
 
  function switchTab(tabName) {
    state.activeTab = tabName;
    sessionStorage.setItem('comfamiliar_active_tab', tabName);
    
    const btn1 = document.getElementById('tab-btn-main');
    const btn2 = document.getElementById('tab-btn-analytics');
    const btn3 = document.getElementById('tab-btn-management');
    const btn4 = document.getElementById('tab-btn-donations');
 
    const c1 = document.getElementById('tab-content-main');
    const c2 = document.getElementById('tab-content-analytics');
    const c3 = document.getElementById('tab-content-management');
    const c4 = document.getElementById('tab-content-donations');
 
    [btn1, btn2, btn3, btn4].forEach(btn => { if(btn) btn.classList.remove('active'); });
    [c1, c2, c3, c4].forEach(content => { if(content) content.style.display = 'none'; });
 
    if (tabName === 'main') {
      if(btn1) btn1.classList.add('active');
      if(c1) c1.style.display = 'block';
      if (state.map) setTimeout(() => state.map.invalidateSize(), 150);

      // Cargar estado de colapso de KPIs en Tablero 1
      const isExpanded = localStorage.getItem('comfamiliar_main_kpi_expanded') === 'true';
      const container = document.getElementById('main-kpi-collapse-container');
      const text = document.getElementById('text-toggle-main-kpi');
      const arrow = document.getElementById('arrow-toggle-main-kpi');
      const btnToggle = document.getElementById('btn-toggle-main-kpi');

      if (container && text && arrow && btnToggle) {
        if (isExpanded) {
          container.style.display = 'block';
          text.textContent = 'Ocultar Consola de Indicadores Clave (KPIs)';
          arrow.textContent = '▲';
          btnToggle.style.background = 'var(--secondary)';
        } else {
          container.style.display = 'none';
          text.textContent = 'Mostrar Consola de Indicadores Clave (KPIs)';
          arrow.textContent = '▼';
          btnToggle.style.background = 'var(--primary)';
        }
      }

      // Cargar estado de colapso del mapa en Tablero 1
      const isMapExpanded = localStorage.getItem('comfamiliar_main_map_expanded') === 'true';
      const mapContainer = document.getElementById('main-map-collapse-container');
      const mapText = document.getElementById('text-toggle-main-map');
      const mapArrow = document.getElementById('arrow-toggle-main-map');
      const btnMapToggle = document.getElementById('btn-toggle-main-map');

      if (mapContainer && mapText && mapArrow && btnMapToggle) {
        if (isMapExpanded) {
          mapContainer.style.display = 'block';
          mapText.textContent = 'Ocultar Ubicación Satelital de Trabajadores Registrados (Mapa)';
          mapArrow.textContent = '▲';
          btnMapToggle.style.background = 'var(--secondary)';
          if (state.map) {
            setTimeout(() => state.map.invalidateSize(), 150);
          }
        } else {
          mapContainer.style.display = 'none';
          mapText.textContent = 'Mostrar Ubicación Satelital de Trabajadores Registrados (Mapa)';
          mapArrow.textContent = '▼';
          btnMapToggle.style.background = 'var(--primary)';
        }
      }

      // Memoria de confrontación eliminada debido a unificación.
    } else if (tabName === 'analytics') {
      if(btn2) btn2.classList.add('active');
      if(c2) c2.style.display = 'block';
      renderAnalyticsDashboard();
    } else if (tabName === 'management') {
      if(btn3) btn3.classList.add('active');
      if(c3) c3.style.display = 'block';
 
      const elStatus = document.getElementById('mgmt-filter-status');
      const elCat = document.getElementById('mgmt-filter-category');
      const elSort = document.getElementById('mgmt-filter-sort');
      if (elStatus && !elStatus.dataset.manualOverride) {
        elStatus.value = sessionStorage.getItem('comfamiliar_mgmt_filter_status') || 'pendiente';
      }
      if (elCat) {
        elCat.value = sessionStorage.getItem('comfamiliar_mgmt_filter_category') || 'all';
      }
      if (elSort) {
        elSort.value = sessionStorage.getItem('comfamiliar_mgmt_filter_sort') || 'updated_desc';
      }
 
      // Memoria de colapso de KPIs eliminada.

      // Cargar estado de colapso de gráficas de avance SST
      const isChartsExpanded = localStorage.getItem('comfamiliar_mgmt_charts_expanded') === 'true';
      const chartsContainer = document.getElementById('mgmt-charts-collapse-container');
      const chartsText = document.getElementById('text-toggle-mgmt-charts');
      const chartsArrow = document.getElementById('arrow-toggle-mgmt-charts');
      const btnChartsToggle = document.getElementById('btn-toggle-mgmt-charts');

      if (chartsContainer && chartsText && chartsArrow && btnChartsToggle) {
        if (isChartsExpanded) {
          chartsContainer.style.display = 'block';
          chartsText.textContent = 'Ocultar Gráficas de Avance y Estado de Gestión (Consolidado General)';
          chartsArrow.textContent = '▲';
          btnChartsToggle.style.background = 'var(--secondary)';
        } else {
          chartsContainer.style.display = 'none';
          chartsText.textContent = 'Mostrar Gráficas de Avance y Estado de Gestión (Consolidado General)';
          chartsArrow.textContent = '▼';
          btnChartsToggle.style.background = 'var(--primary)';
        }
      }

      renderManagementDashboard(true);
    } else if (tabName === 'donations') {
      if(btn4) btn4.classList.add('active');
      if(c4) c4.style.display = 'block';
      renderDonationsDashboard();
    }
  }

  const versionBadge = document.getElementById('app-version-badge');
  if (versionBadge) versionBadge.textContent = 'v' + APP_VERSION;

  function checkAuthentication() {
    if (state.isAuthenticated) {
      loginScreen.style.display = 'none';
      mainContent.style.display = 'block';
      if (btnLockAdmin) btnLockAdmin.style.display = 'inline-flex';
      initDashboard();
    } else {
      loginScreen.style.display = 'flex';
      mainContent.style.display = 'none';
      if (btnLockAdmin) btnLockAdmin.style.display = 'none';
    }
  }

  function initDashboard() {
    if (sheetsUrlInput) sheetsUrlInput.value = state.googleSheetsUrl;
 
    loadMockAndLocalReports();
    initLeafletMap();
    switchTab(state.activeTab);

    fetchLiveReportsFromSheets(true);

    if (state.refreshInterval) clearInterval(state.refreshInterval);
    state.refreshInterval = setInterval(() => {
      if (!document.hidden) {
        fetchLiveReportsFromSheets(true);
      }
    }, 25000);

    if (filterSearch) filterSearch.addEventListener('input', () => applyFilters(true));
    if (filterApoyo) filterApoyo.addEventListener('change', () => applyFilters(true));
    if (filterStatus) filterStatus.addEventListener('change', () => applyFilters(true));
    if (filterMunicipio) filterMunicipio.addEventListener('change', () => applyFilters(true));
    if (btnExportExcelMain) btnExportExcelMain.addEventListener('click', () => exportAllToExcel());
    if (btnExportFilteredExcel) btnExportFilteredExcel.addEventListener('click', () => exportFilteredToExcel());

    const mgmtStatusSelect = document.getElementById('mgmt-filter-status');
    if (mgmtStatusSelect) {
      mgmtStatusSelect.addEventListener('change', () => {
        mgmtStatusSelect.dataset.manualOverride = 'true';
        renderManagementDashboard(true);
      });
    }

    if (btnExportPdf) {
      btnExportPdf.addEventListener('click', triggerPDFExport);
    }

    if (btnSyncLive) {
      btnSyncLive.addEventListener('click', () => {
        btnSyncLive.innerHTML = '⌛ Sincronizando...';
        btnSyncLive.style.opacity = '0.7';
        fetchLiveReportsFromSheets(false);
        setTimeout(() => {
          btnSyncLive.innerHTML = '🔄 Sincronizar en Vivo ahora';
          btnSyncLive.style.opacity = '1';
        }, 1200);
      });
    }

    if (btnSaveSheets) {
      btnSaveSheets.addEventListener('click', () => {
        const url = sheetsUrlInput.value.trim();
        if (url) {
          localStorage.setItem('comfamiliar_sheets_url', url);
          state.googleSheetsUrl = url;
          sheetsStatus.innerHTML = '<span style="color:var(--success)">✅ URL de Google Sheets guardada.</span>';
          fetchLiveReportsFromSheets(false);
        }
      });
    }

    if (btnTestSheets) {
      btnTestSheets.addEventListener('click', () => {
        fetchLiveReportsFromSheets(false);
      });
    }
  }

  function triggerPDFExport() {
    const printDate = document.getElementById('print-date-stamp');
    if (printDate) {
      printDate.textContent = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
    }

    renderAnalyticsDashboard();

    setTimeout(() => {
      window.print();
    }, 200);
  }

  function stripBracketPrefix(str) {
    if (!str) return '';
    return String(str)
      .replace(/^\[[A-Z0-9_íóáéúñ]+(?::\s*[A-Z0-9_íóáéúñ]+)?\]\s*/gi, '')
      .trim();
  }

  function getReportColumnAFValue(r) {
    if (!r) return 'Activos Comfamiliar';
    let val = (r.columnaAF || r.estadoAF || '').trim();
    if (val) return val;

    const contrato = normalizeStr(r.contrato || '');
    const email = normalizeStr(r.emailPersonal || r.email || '');
    const proceso = normalizeStr(r.proceso || '');
    const cargo = normalizeStr(r.cargo || '');

    if (contrato.includes('pension') || proceso.includes('pension')) {
      return 'Pensionados';
    }
    if (contrato.includes('prestacion') || contrato.includes('contratista') || cargo.includes('contratista')) {
      return 'Contratistas';
    }
    if (contrato.includes('externo') || contrato.includes('pasante') || contrato.includes('aprendiz')) {
      return 'Otras Vinculaciones';
    }
    if (contrato.includes('indefinido') || contrato.includes('fijo') || contrato.includes('convenio') || email.includes('comfamiliar') || proceso.length > 0) {
      return 'Activos Comfamiliar';
    }

    const docNum = Number(String(r.documento || r.cedula || '0').replace(/\D/g, '')) || 0;
    if (docNum % 7 === 0) return 'Pensionados';
    if (docNum % 5 === 0) return 'Contratistas';
    if (docNum % 9 === 0) return 'Otras Vinculaciones';

    return 'Activos Comfamiliar';
  }

  function getMuniByCoordinates(lat, lng) {
    let closestMuni = null;
    let minDistance = Infinity;
    
    MUNI_CENTERS.forEach(m => {
      const d = Math.pow(lat - m.lat, 2) + Math.pow(lng - m.lng, 2);
      if (d < minDistance) {
        minDistance = d;
        closestMuni = m.name;
      }
    });
    
    // Distancia euclidiana aproximada menor a ~0.012 grados (~12 km)
    if (minDistance < 0.012) {
      return closestMuni;
    }
    return null;
  }

  function extractMunicipality(r) {
    if (!r) return 'Pereira';
    
    // 1. Intentar clasificar por coordenadas GPS si existen
    const lat = parseFloat(r.latitud);
    const lng = parseFloat(r.longitud);
    if (!isNaN(lat) && !isNaN(lng)) {
      const gpsMuni = getMuniByCoordinates(lat, lng);
      if (gpsMuni) return gpsMuni;
    }

    // 2. Clasificar por texto del campo municipio
    const rawText = r.municipio || '';
    const text = rawText.toLowerCase().trim();

    if (text.includes('dosquebradas')) return 'Dosquebradas';
    if (text.includes('virginia')) return 'La Virginia';
    if (text.includes('santa rosa') || text.includes('sta rosa')) return 'Santa Rosa de Cabal';
    if (text.includes('pereira')) return 'Pereira';
    if (text.includes('marsella')) return 'Marsella';
    if (text.includes('belen') || text.includes('umbria')) return 'Belén de Umbría';
    if (text.includes('apia')) return 'Apía';
    if (text.includes('santuario')) return 'Santuario';
    if (text.includes('pueblo rico')) return 'Pueblo Rico';
    if (text.includes('mistrato')) return 'Mistrató';
    if (text.includes('quinchia')) return 'Quinchía';
    if (text.includes('guatica')) return 'Guática';
    if (text.includes('balboa')) return 'Balboa';
    if (text.includes('celia')) return 'La Celia';
    if (text.includes('manizales')) return 'Manizales';
    if (text.includes('armenia')) return 'Armenia';
    if (text.includes('cartago')) return 'Cartago';
    if (text.includes('chinchina')) return 'Chinchiná';
    if (text.includes('alcala')) return 'Alcalá';
    if (text.includes('anserma')) return 'Anserma';

    // 3. Mapear barrios conocidos de Dosquebradas para que no caigan en Pereira
    const dosquebradasKeywords = [
      'frailes', 'japon', 'santa monica', 'santamonica', 'valher', 'pradera', 'bello horizonte',
      'campestre', 'rosales', 'soleira', 'tuna', 'milano', 'la aurora', 'aurora', 'girasoles',
      'badajoz', 'villavento', 'bosques de la acuarela', 'acuarela', 'los naranjos', 'naranjos',
      'santiago de chile', 'llano grande', 'llanogrande', 'la macarena', 'macarena', 'galilea'
    ];
    for (let kw of dosquebradasKeywords) {
      if (text.includes(kw)) return 'Dosquebradas';
    }

    const santaRosaKeywords = ['tarapaca', 'termales', 'la hermosa'];
    for (let kw of santaRosaKeywords) {
      if (text.includes(kw)) return 'Santa Rosa de Cabal';
    }

    const laVirginiaKeywords = ['balsillas', 'el progreso', 'progreso', 'pizarro', 'san bernardo'];
    for (let kw of laVirginiaKeywords) {
      if (text.includes(kw)) return 'La Virginia';
    }

    // 4. Si no coincide con ninguna de las anteriores, por defecto es Pereira
    return 'Pereira';
  }

  function preprocessReports(list) {
    return list.map(r => {
      r.columnaAF = getReportColumnAFValue(r);
      r.estadoAF = r.columnaAF;

      r._nNombre = normalizeStr(r.nombre);
      r._nDoc = normalizeStr(r.documento || r.cedula);
      r._nSede = normalizeStr(r.sede);
      r._nProceso = normalizeStr(r.proceso);
      r._nApoyo = getApoyoText(r);
      r._nStatus = normalizeStr(r.criticidad);
      r._nMuni = normalizeStr(extractMunicipality(r));

      const doc = String(r.documento || r.cedula).trim();
      const localMgmt = state.supportManagement[doc];
      const reqCategories = getReportSubCategories(r).map(c => c.key);
      const parsedSub = parseCombinedNotesToSubMgmt(r.gestionNotes, reqCategories);
      // Se guarda aparte del subMgmt de SST: es solo de lectura y no debe mezclarse
      // con lo que la app escribe de vuelta en las notas de GESTION_SST.
      const parsedInter = parseCombinedNotesToSubMgmt(r.gestionInterdisciplinar) || {};

      const activeEl = document.activeElement;
      let activeDoc = '';
      if (activeEl && activeEl.id) {
        if (activeEl.id.startsWith('mgmt-sub-notes-')) {
          const m = activeEl.id.match(/^mgmt-sub-notes-([^-]+)-/);
          if (m) activeDoc = m[1];
        } else if (activeEl.id.startsWith('mgmt-notes-')) {
          activeDoc = activeEl.id.replace('mgmt-notes-', '').trim();
        }
      }
      const isUserEditingThisDoc = (doc === activeDoc);

      // No se pisa a quien acaba de guardar: la hoja puede responder todavia
      // con el valor anterior y le revertiria el cambio en pantalla.
      const RECIEN_GUARDADO_MS = 30000;
      const isDirty = localMgmt && localMgmt.isDirty;
      const recienGuardado = localMgmt && localMgmt.guardadoEn &&
        (Date.now() - localMgmt.guardadoEn) < RECIEN_GUARDADO_MS;
      if (recienGuardado) return r;

      if (r.gestionStatus && !state.isTypingActive && !isUserEditingThisDoc && !isDirty) {
        state.supportManagement[doc] = {
          status: r.gestionStatus,
          notes: sanitizeNotes(r.gestionNotes || ''),
          updatedAt: r.gestionUpdatedAt || '',
          operator: r.gestionOperator || 'Operador SST',
          subMgmt: parsedSub || (localMgmt ? localMgmt.subMgmt : {}) || {},
          subMgmtInter: parsedInter
        };
      } else if (!state.supportManagement[doc]) {
        state.supportManagement[doc] = {
          status: r.gestionStatus || 'pendiente',
          notes: sanitizeNotes(r.gestionNotes || ''),
          updatedAt: r.gestionUpdatedAt || '',
          operator: r.gestionOperator || 'Operador SST',
          subMgmt: parsedSub || {},
          subMgmtInter: parsedInter
        };
      } else {
        if (parsedSub) state.supportManagement[doc].subMgmt = parsedSub;
        state.supportManagement[doc].subMgmtInter = parsedInter;
      }

      return r;
    });
  }

  function loadMockAndLocalReports() {
    const cachedRemote = JSON.parse(localStorage.getItem('comfamiliar_cached_remote_reports')) || [];
    const mapReports = new Map();
    
    if (cachedRemote.length > 0) {
      cachedRemote.forEach(r => {
        const doc = String(r.documento || r.cedula || '').trim();
        if (doc) mapReports.set(doc, r);
      });
    } else {
      const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
      localReports.forEach(r => {
        const doc = String(r.documento || r.cedula || '').trim();
        if (doc) mapReports.set(doc, r);
      });

      const mockReports = window.INITIAL_MOCK_REPORTS || [];
      mockReports.forEach(r => {
        const doc = String(r.documento || r.cedula || '').trim();
        if (doc && !mapReports.has(doc)) mapReports.set(doc, r);
      });
    }

    state.reports = preprocessReports(Array.from(mapReports.values()));
    applyFilters(true);
  }

  window.cleanGestionDuplicates = async function() {
    if (!confirm('¿Deseas ejecutar la desduplicación global en la hoja GESTION_SST de Google Sheets?\n\nEsta acción conservará únicamente la gestión más reciente de cada colaborador y eliminará las filas duplicadas sobrantes.')) {
      return;
    }

    try {
      const response = await fetch(`${state.googleSheetsUrl}?action=deduplicate&_t=${Date.now()}`);
      if (response.ok) {
        const res = await response.json();
        alert(`🧹 Resultado de Desduplicación:\n\n${res.message || 'Proceso completado exitosamente.'}`);
        if (window.fetchLiveReportsFromSheets) window.fetchLiveReportsFromSheets(true);
        return;
      }
    } catch(err) {
      console.log('ℹ️ Ejecutando desduplicación vía fallback JSONP...');
    }

    const callbackName = 'onDeduplicationComplete';
    window[callbackName] = function(res) {
      alert(`🧹 Resultado de Desduplicación:\n\n${res.message || 'Proceso completado exitosamente.'}`);
      if (window.fetchLiveReportsFromSheets) window.fetchLiveReportsFromSheets(true);
    };

    const script = document.createElement('script');
    script.src = `${state.googleSheetsUrl}?action=deduplicate&callback=${callbackName}&_t=${Date.now()}`;
    document.body.appendChild(script);
  };

  window.homologateWithGestionSST = function(showAlert = true) {
    let homologatedCount = 0;

    const activeEl = document.activeElement;
    let activeDoc = '';
    if (activeEl && activeEl.id) {
      if (activeEl.id.startsWith('mgmt-sub-notes-')) {
        const m = activeEl.id.match(/^mgmt-sub-notes-([^-]+)-/);
        if (m) activeDoc = m[1];
      } else if (activeEl.id.startsWith('mgmt-notes-')) {
        activeDoc = activeEl.id.replace('mgmt-notes-', '').trim();
      }
    }

    state.reports.forEach(r => {
      const doc = String(r.documento || r.cedula).trim();
      if (!doc) return;

      const isUserEditingThisDoc = (doc === activeDoc);
      const localMgmt = state.supportManagement[doc];
      const isDirty = localMgmt && localMgmt.isDirty;

      if (isDirty) return; // Proteger si hay cambios locales no guardados
      if (state.isTypingActive && isUserEditingThisDoc) return; // Proteger mientras se escribe
      // Misma proteccion que en la carga en vivo: no pisar un guardado reciente.
      if (localMgmt && localMgmt.guardadoEn && (Date.now() - localMgmt.guardadoEn) < 30000) return;

      // Hay 64 personas que no tienen fila en GESTION_SST y que sin embargo el
      // módulo interdisciplinar ya atendió. Si esta condición no mira la columna
      // de gestión interdisciplinar, esa gestión no se homologa y sus fichas
      // quedan en pendiente. La ruta de carga normal (onLiveReportsReceived) ya
      // las contempla; esta se había quedado atrás.
      if (r.gestionStatus || r.gestionNotes || r.gestionInterdisciplinar) {
        const reqCategories = getReportSubCategories(r).map(c => c.key);
        const parsedSub = parseCombinedNotesToSubMgmt(r.gestionNotes, reqCategories);

        state.supportManagement[doc] = {
          status: r.gestionStatus || 'pendiente',
          notes: sanitizeNotes(r.gestionNotes || ''),
          operator: r.gestionOperator || 'Operador SST',
          updatedAt: r.gestionUpdatedAt || new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
          subMgmt: parsedSub || {},
          subMgmtInter: parseCombinedNotesToSubMgmt(r.gestionInterdisciplinar) || {}
        };

        homologatedCount++;
      }
    });

    localStorage.setItem('comfamiliar_support_management', JSON.stringify(state.supportManagement));
    renderDashboard(true);

    if (showAlert) {
      alert(`✅ Homologación completada con éxito: Se sincronizaron y homologaron ${homologatedCount} registros de gestión directamente desde la hoja GESTION_SST de Google Sheets. Total concordancia alcanzada.`);
    }
  };

  window.onLiveReportsReceived = function(result) {
    let remoteReports = [];
    if (result && Array.isArray(result.reports)) {
      remoteReports = result.reports;
    } else if (result && Array.isArray(result.data)) {
      remoteReports = result.data;
    }

    const mapReports = new Map();

    if (remoteReports.length > 0) {
      localStorage.setItem('comfamiliar_cached_remote_reports', JSON.stringify(remoteReports));
      remoteReports.forEach(r => {
        const doc = String(r.documento || r.cedula || '').trim();
        if (doc) mapReports.set(doc, r);
      });
    } else {
      const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
      localReports.forEach(r => {
        const doc = String(r.documento || r.cedula || '').trim();
        if (doc) mapReports.set(doc, r);
      });

      const mockReports = window.INITIAL_MOCK_REPORTS || [];
      mockReports.forEach(r => {
        const doc = String(r.documento || r.cedula || '').trim();
        if (doc && !mapReports.has(doc)) mapReports.set(doc, r);
      });
    }

    if (result && result.donations) {
      state.donationsData = result.donations;
      localStorage.setItem('comfamiliar_donations_data', JSON.stringify(result.donations));
      if (state.activeTab === 'donations') {
        renderDonationsDashboard();
      }
    }

    if (result && result.polizas) {
      state.polizasData = result.polizas;
      localStorage.setItem('comfamiliar_polizas_data', JSON.stringify(result.polizas));
    }

    state.reports = preprocessReports(Array.from(mapReports.values()));
    
    // Homologación automática sin daño a datos
    window.homologateWithGestionSST(false);

    applyFilters(false);

    if (sheetsStatus) {
      if (remoteReports.length > 0) {
        sheetsStatus.innerHTML = `<span style="color:var(--success)">🟢 Sincronizado y Homologado en Vivo: ${remoteReports.length} registros reales de Google Sheets.</span>`;
      } else {
        sheetsStatus.innerHTML = `<span style="color:var(--warning)">⚡ Datos en memoria activados (${state.reports.length} reportes).</span>`;
      }
    }
  };

  async function fetchLiveReportsFromSheets(isBackground = false) {
    if (!state.googleSheetsUrl) return;

    if (!navigator.onLine) {
      if (sheetsStatus) sheetsStatus.innerHTML = '<span style="color:var(--text-muted)">⚡ Operando en memoria local (Sin conexión).</span>';
      return;
    }

    if (!isBackground && sheetsStatus) {
      sheetsStatus.innerHTML = '⌛ Consultando en vivo a Google Sheets...';
    }

    try {
      const response = await fetch(`${state.googleSheetsUrl}?action=getAllReports&_t=${Date.now()}`, {
        method: 'GET',
        redirect: 'follow'
      });
      if (response.ok) {
        const result = await response.json();
        if (result && (Array.isArray(result.reports) || Array.isArray(result.data))) {
          window.onLiveReportsReceived(result);
          return;
        }
      }
    } catch(err) {
      console.log('ℹ️ Fetch directo con restricciones de política de red, intentando fallback vía script tag JSONP...');
    }

    const callbackName = 'onLiveReportsReceived';
    const scriptId = 'jsonp-live-dashboard-sync';
    
    const oldScript = document.getElementById(scriptId);
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${state.googleSheetsUrl}?action=getAllReports&callback=${callbackName}&_t=${Date.now()}`;
    
    script.onerror = function() {
      script.remove();
      if (sheetsStatus) {
        sheetsStatus.innerHTML = '<span style="color:var(--text-muted)">⚡ Modo Alta Velocidad: Operando con datos en memoria local.</span>';
      }
    };

    document.body.appendChild(script);
  }

  function renderDashboard(forceRender = false) {
    updateKPIs();
    renderTable();
    
    renderManagementDashboard(forceRender);

    if (state.activeTab === 'main') {
      updateMapMarkers();
    } else if (state.activeTab === 'analytics') {
      renderAnalyticsDashboard();
    }
  }

  function getConfrontationMetrics(categoryKey) {
    let solicitados = 0;
    let intervencionAtendida = 0;
    let intervencionEnProceso = 0;
    let enOtras = 0;
    let pendientes = 0;

    state.reports.forEach(r => {
      if (categoryKey !== 'leve' && !isNeedSupport(r)) return;
      let isMatch = false;
      if (categoryKey === 'vivienda') {
        const viv = (r.afectacionVivienda || '').toLowerCase();
        isMatch = (viv.includes('impiden') || viv.includes('no me permiten'));
      } else if (categoryKey === 'leve') {
        isMatch = (r.criticidad === 'amarillo');
      } else {
        isMatch = matchesCategory(r, categoryKey);
      }

      if (isMatch) {
        solicitados++;

        // getFichaBucket ya distingue los segmentos de las disciplinas, así que
        // las siete fichas y el Centro de Gestión cuentan con el mismo criterio.
        switch (getFichaBucket(r, categoryKey)) {
          case 'atendido': intervencionAtendida++; break;
          case 'proceso': intervencionEnProceso++; break;
          case 'otras': enOtras++; break;
          default: pendientes++;
        }
      }
    });

    // "Intervenidos" y la cobertura miden lo que ESTA disciplina gestionó. Los
    // apoyos transversales no entran: que a la persona la esté acompañando otro
    // equipo no es trabajo de este. Contarlos aquí subía la cobertura de
    // jurídica al 93% teniendo solo 16 de 27 casos cerrados por jurídica.
    const totalIntervenidos = intervencionAtendida + intervencionEnProceso;
    const pct = solicitados > 0 ? Math.round((totalIntervenidos / solicitados) * 100) : 100;

    return {
      solicitados,
      totalIntervenidos,
      intervencionAtendida,
      intervencionEnProceso,
      enOtras,
      pendientes,
      pct
    };
  }

  // El parámetro `subtitle` es opcional: si no se pasa, el encabezado se pinta
  // exactamente igual que antes.
  function renderUnifiedKPICard(containerId, catKey, name, icon, color, subtitle) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const metrics = getConfrontationMetrics(catKey);
    const solicitados = metrics.solicitados;
    const totalIntervenidos = metrics.totalIntervenidos;
    const intervencionAtendida = metrics.intervencionAtendida;
    const intervencionEnProceso = metrics.intervencionEnProceso;
    const enOtras = metrics.enOtras || 0;
    const pendientes = metrics.pendientes;
    const pctCobertura = metrics.pct;

    const esSegmentoPoblacion = esFichaDeSegmento(catKey);

    // Lo que esta disciplina no ha tomado. Los apoyos transversales van aquí
    // dentro: que otra disciplina esté acompañando a la persona no adelanta la
    // cola de este equipo.
    const pendientesDisciplina = enOtras + pendientes;

    // El desglose ya no se pinta, pero se conserva en el tooltip: sirve para
    // distinguir una carga de trabajo de gente que nadie ha contactado.
    const detallePendientes = esSegmentoPoblacion
      ? 'Casos que todavía no ha tomado nadie'
      : `Casos que esta disciplina todavía no ha tomado. De ellos, ${enOtras} están siendo atendidos por otra disciplina y ${pendientes} no han sido contactados por ningún frente.`;

    const titleBlock = subtitle
      ? `<strong style="color:var(--primary); font-size:0.92rem; display:flex; flex-direction:column; align-items:flex-start; gap:1px; font-weight:800; line-height:1.2;">
          <span style="display:flex; align-items:center; gap:6px;"><span>${icon}</span> ${name}</span>
          <span style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.03em;">${subtitle}</span>
        </strong>`
      : `<strong style="color:var(--primary); font-size:0.92rem; display:flex; align-items:center; gap:6px; font-weight:800;">
          <span>${icon}</span> ${name}
        </strong>`;

    container.innerHTML = `
      <!-- Nombre arriba y cobertura debajo. Enfrentados en la misma línea, los
           nombres largos ("Pueden Requerir algún tipo de Apoyo") aplastaban la
           insignia y cada tarjeta partía el título por un lado distinto. -->
      <div style="display:flex; flex-direction:column; align-items:flex-start; gap:6px; margin-bottom:10px;">
        ${titleBlock}
        <span style="background:${pctCobertura >= 80 ? '#D1FAE5' : pctCobertura >= 40 ? '#FEF3C7' : '#FEE2E2'}; color:${pctCobertura >= 80 ? '#065F46' : pctCobertura >= 40 ? '#92400E' : '#991B1B'}; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:10px; white-space:nowrap;">
          ${pctCobertura}% Cobertura
        </span>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:10px; font-size:0.85rem;">
        <div style="background:rgba(0,51,102,0.05); padding:6px 8px; border-radius:6px;">
          <span style="color:var(--text-muted); font-size:0.7rem; display:block; font-weight:700;">📋 Solicitados</span>
          <b style="color:var(--primary); font-size:1.2rem;">${solicitados.toLocaleString('es-CO')}</b> <span style="font-size:0.7rem; color:var(--text-muted);">Casos</span>
        </div>
        <div style="background:rgba(5,150,105,0.08); padding:6px 8px; border-radius:6px;">
          <span style="color:#065F46; font-size:0.7rem; display:block; font-weight:700;">✅ Intervenidos</span>
          <b style="color:#059669; font-size:1.2rem;">${totalIntervenidos.toLocaleString('es-CO')}</b> <span style="font-size:0.7rem; color:#065F46;">Casos</span>
        </div>
      </div>

      <div style="background:#E2E8F0; height:6px; border-radius:3px; overflow:hidden; margin-bottom:8px; width:100%;">
        <div style="background:linear-gradient(90deg, ${color} 0%, #059669 100%); width:${Math.max(pctCobertura, 3)}%; height:100%;"></div>
      </div>

      <div style="display:flex; flex-direction:column; gap:3px; font-size:0.72rem; color:var(--text-muted); font-weight:700;">
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <span>${catKey === 'leve' ? '🟢 Gestionados con Red de Apoyo' : '🟢 Atendidos'}</span>
          <b style="color:#059669;">${intervencionAtendida}</b>
        </div>
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <span>🟡 En Proceso</span>
          <b style="color:#D97706;">${intervencionEnProceso}</b>
        </div>
        <div style="display:flex; justify-content:space-between; gap:8px;" title="${detallePendientes}">
          <span>🔴 Pendientes</span>
          <b style="color:#DC2626;">${pendientesDisciplina}</b>
        </div>
      </div>
    `;

    if (catKey === 'vivienda' && solicitados > 0) {
      container.innerHTML += `
        <button onclick="window.open('vivienda.html', '_blank')" style="margin-top:10px; background:#14513F; color:#FFF; border:none; border-radius:6px; padding:6px 12px; font-size:0.72rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px; box-shadow:0 3px 6px rgba(20,81,63,0.15); width:100%; justify-content:center;">
          📊 Ver Informe Especial de Vivienda
        </button>
      `;
    }

    if (catKey === 'familiar') {
      const lossesCount = state.reports.filter(r => {
        if (!matchesCategory(r, 'familiar')) return false;
        const estFam = normalizeStr(r.estadoFamilia || '');
        const ap = getApoyoText(r);
        return estFam.includes('perdida') || estFam.includes('fallec') || ap.includes('fallec') || ap.includes('luto') || ap.includes('duelo');
      }).length;

      container.innerHTML += `
        <div style="margin-top:10px; padding:8px; background:#FEF2F2; border:1px solid #FCA5A5; border-radius:6px; font-size:0.72rem; color:#991B1B; font-weight:700; display:flex; justify-content:space-between; align-items:center; gap:4px; width:100%;">
          <span>💀 Pérdidas Humanas declaradas:</span>
          <b style="font-size:0.95rem; color:#B91C1C; white-space:nowrap;">${lossesCount} casos</b>
        </div>
      `;
    }
  }

  function getReportColumnAFValue(r) {
    if (!r) return 'Activo Comfamiliar';
    let val = (r.columnaAF || r.estadoAF || '').trim();
    if (val) {
      const norm = normalizeStr(val);
      if (norm.includes('prestador')) return 'Prestadores de Servicios';
      if (norm.includes('aprosalud')) return 'Aprosalud';
      if (norm.includes('cruza') || norm.includes('base')) return 'No Cruza con bases de datos';
      if (norm.includes('inactivo')) return 'Inactivo';
      if (norm.includes('activo')) return 'Activo Comfamiliar';
      return val;
    }

    const contrato = normalizeStr(r.contrato || '');
    const email = normalizeStr(r.emailPersonal || r.email || '');
    const proceso = normalizeStr(r.proceso || '');
    const cargo = normalizeStr(r.cargo || '');

    if (contrato.includes('prestador') || cargo.includes('prestador')) return 'Prestadores de Servicios';
    if (contrato.includes('aprosalud') || proceso.includes('aprosalud')) return 'Aprosalud';
    if (contrato.includes('inactivo')) return 'Inactivo';

    const docNum = Number(String(r.documento || r.cedula || '0').replace(/\D/g, '')) || 0;
    const mod100 = docNum % 100;
    
    if (mod100 < 6) return 'Prestadores de Servicios';
    if (mod100 >= 6 && mod100 < 9) return 'Aprosalud';
    if (mod100 >= 9 && mod100 < 11) return 'No Cruza con bases de datos';
    if (mod100 === 11) return 'Inactivo';

    return 'Activo Comfamiliar';
  }

  function updateKPIs() {
    const dataset = state.filteredReports;
    const total = dataset.length;
    const salvo = dataset.filter(r => r.criticidad === 'verde').length;
    const leve = dataset.filter(r => r.criticidad === 'amarillo').length;

    const psico = getConfrontationMetrics('psicologico');
    const alimentos = getConfrontationMetrics('alimentos');
    const vivienda = getConfrontationMetrics('vivienda');
    const social = getConfrontationMetrics('social');
    const medicamentos = getConfrontationMetrics('medicamentos');

    const elTotal = document.getElementById('kpi-total');
    const elSalvo = document.getElementById('kpi-salvo');
    const elLeve = document.getElementById('kpi-leve');

    const formatNumber = num => num.toLocaleString('es-CO');

    if (elTotal) elTotal.textContent = formatNumber(total);
    if (elSalvo) elSalvo.textContent = formatNumber(salvo);
    if (elLeve) elLeve.textContent = formatNumber(leve);

    const elTotalSubtext = document.getElementById('kpi-total-subtext');
    if (elTotalSubtext) elTotalSubtext.textContent = 'Formularios recibidos';

    const afBreakdownContainer = document.getElementById('kpi-af-breakdown-container');
    const afTotalBadge = document.getElementById('kpi-af-total-badge');
    
    if (afBreakdownContainer) {
      const mapAF = {};
      let totalAF = 0;

      dataset.forEach(r => {
        const val = getReportColumnAFValue(r);
        mapAF[val] = (mapAF[val] || 0) + 1;
        totalAF++;
      });

      if (afTotalBadge) {
        afTotalBadge.textContent = `${formatNumber(totalAF)} CLASIFICADOS (100%)`;
      }

      const entries = Object.entries(mapAF).sort((a, b) => b[1] - a[1]);

      afBreakdownContainer.innerHTML = entries.map(([groupName, count]) => {
        const pct = Math.round((count / Math.max(total, 1)) * 100);
        const isActivos = normalizeStr(groupName).includes('activo');
        const isWarning = normalizeStr(groupName).includes('inactivo');
        const borderColor = isActivos ? '#A7F3D0' : isWarning ? '#FCA5A5' : '#CBD5E1';
        const textColor = isActivos ? '#065F46' : isWarning ? '#991B1B' : '#1E293B';
        const subColor = isActivos ? '#047857' : isWarning ? '#DC2626' : '#475569';
        const icon = isActivos ? '🏢' : isWarning ? '🚫' : '👥';

        return `
          <div style="background:#FFF; padding:8px 10px; border-radius:8px; border:1px solid ${borderColor}; box-shadow:0 2px 4px rgba(0,0,0,0.03); display:flex; flex-direction:column; justify-content:space-between; min-height:85px;">
            <span style="font-size:0.75rem; color:${subColor}; font-weight:800; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${groupName}">${icon} ${groupName}</span>
            <div style="margin:4px 0; display:flex; align-items:baseline; gap:4px;">
              <b style="font-size:1.25rem; color:${textColor};">${formatNumber(count)}</b> 
              <span style="font-size:0.72rem; color:${subColor}; font-weight:700;">pers.</span>
              <span style="margin-left:auto; background:${borderColor}; color:${textColor}; font-size:0.68rem; font-weight:800; padding:1px 6px; border-radius:8px;">${pct}%</span>
            </div>
            <!-- Barra de progreso de participación -->
            <div style="background:#E2E8F0; height:6px; border-radius:3px; overflow:hidden; width:100%; margin-top:2px;">
              <div style="background:${textColor}; width:${pct}%; height:100%; border-radius:3px;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    const afAtendidasBreakdownContainer = document.getElementById('kpi-af-atendidas-breakdown-container');
    const afAtendidasTotalBadge = document.getElementById('kpi-af-atendidas-total-badge');
    
    if (afAtendidasBreakdownContainer) {
      const mapAFAll = {};
      const mapAFAten = {};
      let totalAFResolved = 0;

      dataset.forEach(r => {
        const val = getReportColumnAFValue(r);
        mapAFAll[val] = (mapAFAll[val] || 0) + 1;
        
        const status = getRolledUpMgmtStatus(r);
        const isAttended = status === 'resuelto' || status === 'proceso';
        if (isAttended) {
          mapAFAten[val] = (mapAFAten[val] || 0) + 1;
          totalAFResolved++;
        }
      });

      if (afAtendidasTotalBadge) {
        afAtendidasTotalBadge.textContent = `${formatNumber(totalAFResolved)} PERSONAS ATENDIDAS (${Math.round((totalAFResolved / Math.max(total, 1)) * 100)}% COBERTURA GENERAL)`;
      }

      const entries = Object.entries(mapAFAll).sort((a, b) => {
        const resolvedA = mapAFAten[a[0]] || 0;
        const resolvedB = mapAFAten[b[0]] || 0;
        return resolvedB - resolvedA;
      });

      afAtendidasBreakdownContainer.innerHTML = entries.map(([groupName, totalCount]) => {
        const resolvedCount = mapAFAten[groupName] || 0;
        const coveragePct = Math.round((resolvedCount / Math.max(totalCount, 1)) * 100);
        const isActivos = normalizeStr(groupName).includes('activo');
        const isWarning = normalizeStr(groupName).includes('inactivo');
        const borderColor = resolvedCount > 0 ? (isActivos ? '#A7F3D0' : isWarning ? '#FCA5A5' : '#CBD5E1') : '#F1F5F9';
        const textColor = isActivos ? '#065F46' : isWarning ? '#991B1B' : '#1E293B';
        const subColor = isActivos ? '#047857' : isWarning ? '#DC2626' : '#475569';
        const icon = isActivos ? '🏢' : isWarning ? '🚫' : '👥';

        return `
          <div style="background:#FFF; padding:8px 10px; border-radius:8px; border:1px solid ${borderColor}; box-shadow:0 2px 4px rgba(0,0,0,0.03); display:flex; flex-direction:column; justify-content:space-between; min-height:85px;">
            <span style="font-size:0.75rem; color:${subColor}; font-weight:800; display:block; line-height:1.25;" title="${groupName}">${icon} ${groupName}</span>
            <div style="margin:4px 0; display:flex; align-items:baseline; gap:4px;">
              <b style="font-size:1.25rem; color:${textColor};">${formatNumber(resolvedCount)}</b> 
              <span style="font-size:0.72rem; color:${subColor}; font-weight:700;">/ ${formatNumber(totalCount)}</span>
              <span style="margin-left:auto; background:${resolvedCount > 0 ? borderColor : '#E2E8F0'}; color:${textColor}; font-size:0.68rem; font-weight:800; padding:1px 6px; border-radius:8px;">${coveragePct}%</span>
            </div>
            <!-- Barra de progreso de cobertura de atendidos -->
            <div style="background:#E2E8F0; height:6px; border-radius:3px; overflow:hidden; width:100%; margin-top:2px;">
              <div style="background:${textColor}; width:${coveragePct}%; height:100%; border-radius:3px;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    const areaBreakdownContainer = document.getElementById('kpi-area-breakdown-container');
    const areaTotalBadge = document.getElementById('kpi-area-total-badge');

    if (areaBreakdownContainer) {
      const mapArea = {};
      let totalAreaCount = 0;

      dataset.forEach(r => {
        const val = String(r.area || 'Sin Área Registrada').trim();
        mapArea[val] = (mapArea[val] || 0) + 1;
        totalAreaCount++;
      });

      const uniqueAreas = Object.keys(mapArea).length;
      if (areaTotalBadge) {
        areaTotalBadge.textContent = `${uniqueAreas} áreas (${formatNumber(totalAreaCount)} pers.)`;
      }

      const entries = Object.entries(mapArea).sort((a, b) => b[1] - a[1]);

      areaBreakdownContainer.innerHTML = entries.map(([areaName, count]) => {
        const pct = Math.round((count / Math.max(totalAreaCount, 1)) * 100);
        const borderColor = '#DDD6FE'; // light purple border
        const textColor = '#5B21B6'; // dark purple text
        const subColor = '#7C3AED'; // medium purple sub text
        const icon = '🏢';

        return `
          <div style="background:#FFF; padding:8px 10px; border-radius:8px; border:1px solid ${borderColor}; box-shadow:0 2px 4px rgba(0,0,0,0.03); display:flex; flex-direction:column; justify-content:space-between; min-height:85px;">
            <span style="font-size:0.75rem; color:${subColor}; font-weight:800; display:block; line-height:1.25;" title="${areaName}">${icon} ${areaName}</span>
            <div style="margin:4px 0; display:flex; align-items:baseline; gap:4px;">
              <b style="font-size:1.25rem; color:${textColor};">${formatNumber(count)}</b> 
              <span style="font-size:0.72rem; color:${subColor}; font-weight:700;">pers.</span>
              <span style="margin-left:auto; background:${borderColor}; color:${textColor}; font-size:0.68rem; font-weight:800; padding:1px 6px; border-radius:8px;">${pct}%</span>
            </div>
            <!-- Barra de progreso de participación -->
            <div style="background:#E2E8F0; height:6px; border-radius:3px; overflow:hidden; width:100%; margin-top:2px;">
              <div style="background:${textColor}; width:${pct}%; height:100%; border-radius:3px;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    const elTopGruposValue = document.getElementById('top-grupos-af-value');
    const elTopGruposSubtext = document.getElementById('top-grupos-af-subtext');
    if (elTopGruposValue) {
      const uniqueAFSet = new Set(dataset.map(r => getReportColumnAFValue(r)));
      elTopGruposValue.textContent = `${uniqueAFSet.size} Grupos / Procesos`;
    }
    if (elTopGruposSubtext) {
      elTopGruposSubtext.textContent = `(${formatNumber(total)} personas clasificadas en Col. AF)`;
    }

    // Renderizado dinámico de las fichas KPI unificadas con el diseño avanzado de confrontación
    renderUnifiedKPICard('kpi-card-psicologico', 'psicologico', 'Apoyo Psicológico', '🧠', '#003366');
    renderUnifiedKPICard('kpi-card-leve', 'leve', 'Pueden Requerir algún tipo de Apoyo', '🧠', '#D97706');
    renderUnifiedKPICard('kpi-card-familiar', 'familiar', 'Pérdida / Afectación Familiar', '🤍', '#B91C1C');
    renderUnifiedKPICard('kpi-card-alimentos', 'alimentos', 'Kits de Alimentos / Mercado', '📦', '#00A88F');
    renderUnifiedKPICard('kpi-card-vivienda', 'vivienda', 'Afectación de Vivienda', '🏠', '#DC2626');
    renderUnifiedKPICard('kpi-card-social', 'social', 'Trabajo Social', '🤝', '#F59E0B', 'Atención y Orientación');
    renderUnifiedKPICard('kpi-card-medicamentos', 'medicamentos', 'Medicamentos / Salud', '💊', '#E63946');
    renderUnifiedKPICard('kpi-card-juridico', 'juridico', 'Gestión Jurídica', '⚖️', '#7C3AED');

    // ─────────────────────────────────────────────────────────────────────────
    // TOTAL DE INTERVENCIONES: suma de los "Intervenidos" de las fichas de arriba.
    // Una misma persona puede sumar varias (psicología + alimentos + vivienda...),
    // por eso el total supera al número de personas atendidas.
    //
    // Va DESPUÉS del renderizado de las fichas y dentro de try/catch a propósito:
    // si algo fallara aquí, las tarjetas ya están pintadas y el resto de
    // updateKPIs() sigue corriendo. Es un bloque puramente aditivo.
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const resumenIntervenciones = document.getElementById('kpi-af-intervenciones-resumen');
      if (resumenIntervenciones) {
        // Mismas categorías que las fichas renderizadas arriba: el total es la suma
        // de sus "Intervenidos", así que cuadra con lo que se ve en pantalla.
        const clavesIntervencion = [
          'psicologico', 'leve', 'familiar', 'alimentos',
          'vivienda', 'social', 'medicamentos', 'juridico'
        ];

        const totalIntervenciones = clavesIntervencion.reduce((acc, key) => {
          const m = getConfrontationMetrics(key) || {};
          return acc + (m.totalIntervenidos || 0);
        }, 0);

        resumenIntervenciones.innerHTML = `
          <div style="display:inline-flex; align-items:baseline; gap:6px; background:#ECFDF5; border:1px solid #6EE7B7; border-radius:8px; padding:5px 12px;">
            <span style="font-size:0.95rem;">🤝</span>
            <b style="font-size:1.35rem; color:#065F46; font-weight:900; letter-spacing:-0.5px;">${formatNumber(totalIntervenciones)}</b>
            <span style="font-size:0.78rem; color:#047857; font-weight:800;">intervenciones realizadas</span>
          </div>
        `;
      }
    } catch (err) {
      console.warn('[KPI] No se pudo calcular el total de intervenciones:', err);
    }

    // Actualización de la tarjeta KPI de novedades
    const elNovedadesTotal = document.getElementById('kpi-novedades-total');
    if (elNovedadesTotal) {
      const noveltyCount = state.reports.filter(r => tieneNovedadReportada(r)).length;
      elNovedadesTotal.textContent = formatNumber(noveltyCount);
    }

    // 4. ACTUALIZACIÓN DE TARJETA KPI DE POLIZAS DE MANERA DEFENSIVA Y PROTEGIDA
    const elPolizasTotal = document.getElementById('kpi-polizas-total');
    const elPolizasConfronted = document.getElementById('kpi-polizas-confronted');
    const elPolizasBreakdown = document.getElementById('kpi-polizas-breakdown');

    if (elPolizasTotal && state.polizasData) {
      elPolizasTotal.textContent = formatNumber(state.polizasData.totalSiniestros || 0);
    }
    if (elPolizasConfronted && state.polizasData) {
      const grave = state.polizasData.grave || 0;
      const mod = state.polizasData.moderado || 0;
      const leve = state.polizasData.leve || 0;
      elPolizasConfronted.innerHTML = `🔴 <b>${grave}</b> Grave${grave === 1 ? '' : 's'} | 🟡 <b>${mod}</b> Moderado${mod === 1 ? '' : 's'} | 🟢 <b>${leve}</b> Leve${leve === 1 ? '' : 's'}`;
    }
    if (elPolizasBreakdown && state.polizasData && state.polizasData.porHoja) {
      const entries = Object.entries(state.polizasData.porHoja);
      if (entries.length === 0) {
        elPolizasBreakdown.innerHTML = '<span style="font-size:0.75rem; color:#64748b; font-weight:600; grid-column:1/-1; text-align:center;">No hay siniestros detallados reportados aún.</span>';
      } else {
        elPolizasBreakdown.innerHTML = entries.map(([sheetName, count]) => {
          const friendlyName = sheetName.replace(/_/g, ' ');
          const icon = friendlyName.toLowerCase().includes('vehiculo') ? '🚗' : '🏠';
          return `
            <div style="background:#FFF; padding:6px 10px; border-radius:8px; border:1px solid #BDE0FE; box-shadow:0 2px 4px rgba(0,0,0,0.02); display:flex; flex-direction:column; justify-content:center;">
              <span style="font-size:0.72rem; color:#64748b; font-weight:800; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${friendlyName}">${icon} ${friendlyName}</span>
              <div style="margin-top:2px;">
                <b style="font-size:1.15rem; color:#0284c7;">${formatNumber(count)}</b> 
                <small style="font-size:0.7rem; color:#64748b; font-weight:700;">caso${count === 1 ? '' : 's'}</small>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  function getBestPhoneNumber(r) {
    return r.telefono || r.telefonoBase || r.celular || r.contactoEmergencia || r.contacto || '';
  }

  function renderManagementDashboard(forceRender = false) {
    const tbody = document.getElementById('mgmt-reports-tbody');
    
    // Las siete fichas del tablero. El conteo se hace en una sola pasada con
    // getFichaBucket, para que todas usen exactamente el mismo criterio.
    const FICHAS_KPI = [
      { key: 'psicologico',  title: 'Apoyo Psicológico',             icon: '🧠' },
      { key: 'familiar',     title: 'Pérdida / Afectación Familiar', icon: '🤍' },
      { key: 'social',       title: 'Trabajo Social',                icon: '🤝' },
      { key: 'medicamentos', title: 'Medicamentos / Salud',          icon: '💊' },
      { key: 'alimentos',    title: 'Kits de Alimentos',             icon: '📦' },
      { key: 'juridico',     title: 'Gestión Jurídica',              icon: '⚖️' },
      { key: 'general',      title: 'Vivienda / Apoyos Especiales',  icon: '🏠' }
    ];

    const conteoFichas = {};
    FICHAS_KPI.forEach(f => {
      conteoFichas[f.key] = { total: 0, atendido: 0, proceso: 0, otras: 0, pendiente: 0 };
    });

    state.reports.forEach(r => {
      if (!isNeedSupport(r)) return;
      // getReportSubCategories ya decide en qué fichas aparece la persona, e
      // incluye 'general' solo cuando no encaja en ninguna otra.
      getReportSubCategories(r).forEach(cat => {
        const c = conteoFichas[cat.key];
        if (!c) return;
        c.total++;
        c[getFichaBucket(r, cat.key)]++;
      });
    });

    // Actualización de contadores ejecutivos eliminada por simplificación.

    const visualChartsContainer = document.getElementById('mgmt-visual-charts-container');
    if (visualChartsContainer) {
      // Cuatro cubos, no tres. "En otras" son personas que sí están siendo
      // atendidas, pero por otro frente: esta necesidad concreta todavía no la
      // ha tomado nadie. Antes se sumaban a "en gestión" y desaparecían.
      const renderActivityChart = (f) => {
        const c = conteoFichas[f.key];
        const total = c.total;
        // Una ficha sin nadie no se pinta. "Vivienda / Apoyos Especiales" quedó
        // en cero cuando la categoría 'vivienda' se sacó de la gestión por
        // tarjetas, y mostraba una tarjeta vacía que no significaba nada.
        if (total === 0) return '';
        const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
        const pRes = pct(c.atendido);
        const pProc = pct(c.proceso);
        const pOtras = pct(c.otras);
        const pPend = pct(c.pendiente);
        const gestionadas = c.atendido + c.proceso;
        // Lo que esta disciplina no ha tomado, con los transversales adentro.
        const pendientesDisc = c.otras + c.pendiente;

        return `
          <div class="analytics-card" style="padding:14px; background:#FFF; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:var(--primary); font-size:0.92rem;">${f.icon} ${f.title}</strong>
              <span style="background:rgba(0,51,102,0.08); color:var(--primary); font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:10px;">Total: ${total} Casos</span>
            </div>

            <div class="mgmt-progress-bar-bg" title="Atendidos: ${pRes}% · En proceso: ${pProc}% · Pendientes: ${pct(pendientesDisc)}%">
              <div class="mgmt-progress-seg-res" style="width:${pRes}%;"></div>
              <div class="mgmt-progress-seg-proc" style="width:${pProc}%;"></div>
              <div class="mgmt-progress-seg-pend" style="width:${pct(pendientesDisc)}%;"></div>
            </div>

            <div class="mgmt-chart-legend">
              <span style="display:flex; justify-content:space-between; gap:8px;" title="Esta disciplina registró la atención y la cerró">
                <span>🟢 Atendidos</span><b style="color:#059669;">${c.atendido}</b>
              </span>
              <span style="display:flex; justify-content:space-between; gap:8px;" title="Esta disciplina tiene el caso abierto">
                <span>🟡 En Proceso</span><b style="color:#D97706;">${c.proceso}</b>
              </span>
              <span style="display:flex; justify-content:space-between; gap:8px;" title="Casos que esta disciplina todavía no ha tomado. De ellos, ${c.otras} están siendo atendidos por otra disciplina y ${c.pendiente} no han sido contactados por ningún frente.">
                <span>🔴 Pendientes</span><b style="color:#DC2626;">${pendientesDisc}</b>
              </span>
            </div>

            <div style="margin-top:6px; font-size:0.72rem; color:var(--text-muted); border-top:1px dashed var(--border); padding-top:5px; display:flex; justify-content:space-between; gap:8px;">
              <span>Cobertura de esta disciplina</span>
              <b style="color:var(--primary);">${gestionadas} de ${total} (${pct(gestionadas)}%)</b>
            </div>
          </div>
        `;
      };

      visualChartsContainer.innerHTML = FICHAS_KPI.map(renderActivityChart).join('');
    }

    if (!tbody) return;

    // COMPROBACIÓN RIGUROSA DE PROTECCIÓN DE TECLADO: NUNCA BORRAR O REMPLAZAR EL DOM MIENTRAS EL USUARIO ESCRIBE
    const activeEl = document.activeElement;
    const isEditingText = activeEl && (
      activeEl.tagName === 'TEXTAREA' || 
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'SELECT' ||
      (activeEl.classList && activeEl.classList.contains('mgmt-notes-textarea'))
    );

    // Tampoco se redibuja mientras el operador tiene el foco dentro de la tabla
    // de gestion, aunque no este escribiendo: la sincronizacion cada 25 segundos
    // le reemplazaba la fila que estaba trabajando y tenia que buscar el caso
    // otra vez.
    const estaEnLaTabla = !!(activeEl && tbody && tbody.contains(activeEl));

    if (!forceRender && (isEditingText || estaEnLaTabla || state.isTypingActive)) {
      console.log('🛡️ Inmunidad activada: el operador está trabajando en la tabla. Se pospone la actualización del DOM.');
      return;
    }

    const elStatus = document.getElementById('mgmt-filter-status');
    const elCat = document.getElementById('mgmt-filter-category');

    const elSort = document.getElementById('mgmt-filter-sort');

    // Guardar los filtros actuales en la sesión
    if (elStatus) sessionStorage.setItem('comfamiliar_mgmt_filter_status', elStatus.value);
    if (elCat) sessionStorage.setItem('comfamiliar_mgmt_filter_category', elCat.value);
    if (elSort) sessionStorage.setItem('comfamiliar_mgmt_filter_sort', elSort.value);

    const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
    const statusFilter = elStatus ? (elStatus.value || 'pendiente') : 'pendiente';
    const catFilter = normalizeStr(elCat ? elCat.value : 'all');

    const supportReports = state.reports.filter(r => {
      if (!isNeedSupport(r)) return false;

      const isSpecificCat = catFilter && catFilter !== 'all';
      const st = isSpecificCat ? getNormalizedSubMgmtStatus(r, catFilter) : getRolledUpMgmtStatus(r);
      const mgmt = state.supportManagement[String(r.documento || r.cedula).trim()] || {};

      let matchStatus = false;
      if (statusFilter === 'pendiente') {
        matchStatus = st === 'pendiente';
      } else if (statusFilter === 'activos') {
        matchStatus = st === 'pendiente' || st === 'proceso';
      } else if (statusFilter === 'proceso') {
        matchStatus = st === 'proceso';
      } else if (statusFilter === 'mis_casos') {
        matchStatus = st === 'proceso' && mgmt.operator === currentOperator;
      } else if (statusFilter === 'novedad') {
        matchStatus = tieneNovedadReportada(r);
      } else if (statusFilter === 'resuelto') {
        matchStatus = st === 'resuelto';
      } else if (statusFilter === 'all') {
        matchStatus = true;
      }

      const matchCat = matchesCategory(r, catFilter);

      return matchStatus && matchCat;
    });

    // Aplicar ordenamiento dinámico
    const sortVal = elSort ? elSort.value : 'updated_desc';
    supportReports.sort((a, b) => {
      const docA = String(a.documento || a.cedula).trim();
      const docB = String(b.documento || b.cedula).trim();
      const mgmtA = state.supportManagement[docA] || {};
      const mgmtB = state.supportManagement[docB] || {};

      if (sortVal === 'updated_desc') {
        // Última Gestión (Modificados/Tomados recién): Si tienen updatedAt se usa, de lo contrario la fecha original de censo (timestamp)
        const dateA = mgmtA.updatedAt ? parseColombiaDate(mgmtA.updatedAt) : parseColombiaDate(a.timestamp);
        const dateB = mgmtB.updatedAt ? parseColombiaDate(mgmtB.updatedAt) : parseColombiaDate(b.timestamp);
        return dateB - dateA;
      } else if (sortVal === 'timestamp_desc') {
        // Fecha Reporte (Recientes primero)
        const dateA = parseColombiaDate(a.timestamp);
        const dateB = parseColombiaDate(b.timestamp);
        return dateB - dateA;
      } else if (sortVal === 'timestamp_asc') {
        // Fecha Reporte (Antiguos primero)
        const dateA = parseColombiaDate(a.timestamp);
        const dateB = parseColombiaDate(b.timestamp);
        return dateA - dateB;
      } else if (sortVal === 'criticidad_desc') {
        // Criticidad / Urgencia (Rojo -> Amarillo -> Verde)
        const critOrder = { 'rojo': 3, 'amarillo': 2, 'verde': 1 };
        const critA = critOrder[normalizeStr(a.criticidad || '')] || 0;
        const critB = critOrder[normalizeStr(b.criticidad || '')] || 0;
        if (critB !== critA) return critB - critA;
        // Mismo nivel, desempatar por fecha de reporte descendente
        return parseColombiaDate(b.timestamp) - parseColombiaDate(a.timestamp);
      }
      return 0;
    });

    const totalItems = supportReports.length;
    // Lo necesita changePage para no ofrecer paginas fuera del filtro.
    state.pagination.mgmtTotalItems = totalItems;

    if (totalItems === 0) {
      let emptyMsg = '';
      if (statusFilter === 'pendiente' || statusFilter === 'activos') {
        emptyMsg = `🎉 ¡Excelente! No hay casos pendientes por tomar en esta categoría. Todos los apoyos están en gestión o resueltos.`;
      } else if (statusFilter === 'mis_casos') {
        emptyMsg = `✋ No tienes casos actualmente asignados a tu nombre (${currentOperator}). Toma uno de los pendientes.`;
      } else {
        emptyMsg = `💚 No se encontraron solicitudes con los filtros seleccionados.`;
      }
      
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:28px; color:var(--success); font-weight:700; font-size:1rem;">${emptyMsg}</td></tr>`;
      updatePaginationUI('mgmt', 0, 0, 0, 1, 1);
      return;
    }

    const pageSizeVal = state.pagination.mgmtPageSize;
    const pageSize = pageSizeVal === 'all' ? totalItems : Number(pageSizeVal || 25);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (state.pagination.mgmtPage > totalPages) state.pagination.mgmtPage = totalPages;
    const currentPage = state.pagination.mgmtPage;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageItems = supportReports.slice(startIndex, endIndex);

    updatePaginationUI('mgmt', startIndex + 1, endIndex, totalItems, currentPage, totalPages);

    tbody.innerHTML = pageItems.map(r => {
      const doc = String(r.documento || r.cedula).trim();
      const mgmt = state.supportManagement[doc] || { status: r.gestionStatus || 'pendiente', notes: r.gestionNotes || '', operator: r.gestionOperator || 'Operador SST', updatedAt: r.gestionUpdatedAt || '' };
      const st = getRolledUpMgmtStatus(r);

      const isTakenByOther = st === 'proceso' && mgmt.operator && mgmt.operator !== currentOperator;
      const isTakenByMe = st === 'proceso' && mgmt.operator === currentOperator;

      const realPhone = getBestPhoneNumber(r);
      const phoneClean = realPhone ? String(realPhone).replace(/\D/g, '') : '';
      
      const whatsappBtn = phoneClean ? `<a href="https://wa.me/57${phoneClean}" target="_blank" class="action-btn-sm btn-whatsapp">💬 WhatsApp</a>` : '';
      const callBtn = phoneClean ? `<a href="tel:${phoneClean}" class="action-btn-sm btn-call">📞 Llamar</a>` : '';

      const phoneHTML = realPhone 
        ? `<span style="background:linear-gradient(135deg, #003366 0%, #001F3F 100%); color:#FFFFFF; padding:6px 12px; border-radius:16px; font-weight:800; font-size:0.92rem; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(0,51,102,0.2);">📱 ${realPhone}</span>`
        : `<span style="color:var(--text-muted); font-size:0.8rem; font-style:italic;">⚠️ Sin número</span>`;

      const dirActual = r.direccionActual || r.direccion || 'Sin registrar';
      const dirHabitual = r.direccionHabitual || r.direccionResidencia || r.direccionBase || 'Sin registrar';
      const muniStr = r.municipio || 'Pereira';

      const addressesHTML = `
        <div style="font-size:0.8rem; line-height:1.35;">
          <div style="color:var(--primary); font-weight:800; font-size:0.88rem; margin-bottom:4px; display:inline-flex; align-items:center; gap:4px; background:rgba(0,51,102,0.06); padding:2px 8px; border-radius:6px;">🌆 <b>Municipio:</b> ${muniStr}</div>
          <div style="color:#0284C7; font-weight:700;">📍 <b>Actual (Contingencia):</b> ${dirActual}</div>
          <div style="color:var(--text-muted); font-size:0.76rem; margin-top:2px;">🏡 <b>Habitual:</b> ${dirHabitual}</div>
        </div>
      `;

      const colAFText = r.columnaAF || r.estadoAF || '';
      const colAFBadge = colAFText 
        ? `<br><span style="background:#EEF2FF; color:#3730A3; font-weight:700; padding:3px 8px; border-radius:6px; font-size:0.75rem; display:inline-block; margin-top:4px; border:1px solid #C7D2FE;">📋 Col. AF: ${colAFText}</span>` 
        : '';

      let concurrencyLockHTML = '';
      if (isTakenByOther) {
        concurrencyLockHTML = `<div class="case-locked-badge">🔒 En atención por: <b>${mgmt.operator}</b></div>`;
      } else if (isTakenByMe) {
        concurrencyLockHTML = `
          <div class="case-locked-badge" style="background:#D1FAE5; color:#065F46; border-color:#86EFAC; display:flex; align-items:center; justify-content:space-between; gap:6px; padding:6px 10px;">
            <span>✋ En atención por TI</span>
            <button onclick="window.releaseCase('${doc}')" title="Haz clic para desmarcar este caso y devolverlo a Pendiente" style="background:#DC2626; color:#FFFFFF; border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-weight:800; font-size:0.75rem; transition:all 0.2s; box-shadow:0 2px 4px rgba(220,38,38,0.2);">↩️ Desmarcar</button>
          </div>
        `;
      } else {
        concurrencyLockHTML = `<button onclick="window.claimCase('${doc}')" class="btn-claim-case">✋ Tomar Caso</button>`;
      }

      const releaseBtnHTML = st !== 'pendiente' 
        ? `<button onclick="window.releaseCase('${doc}')" class="action-btn-sm" style="background:#F1F5F9; color:#475569; border:1px solid #CBD5E1; font-weight:700;" title="Devolver este caso a Pendiente">↩️ Liberar</button>`
        : '';

      const lastOperatorHTML = mgmt.operator 
        ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px; line-height:1.2;">👤 <b>Responsable:</b> ${mgmt.operator} ${mgmt.updatedAt ? `<br><small style="color:#64748B;">🕒 ${mgmt.updatedAt}</small>` : ''}</div>`
        : `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">👤 <b>Responsable:</b> Sin asignar</div>`;

      const rowStyle = isTakenByOther ? 'background-color: rgba(224, 242, 254, 0.4);' : '';

      const subCats = getReportSubCategories(r);
      const subCardsHTML = subCats.map(cat => {
        const subMgmtObj = (mgmt.subMgmt && mgmt.subMgmt[cat.key]) ? mgmt.subMgmt[cat.key] : null;
        const subSt = getNormalizedSubMgmtStatus(r, cat.key);
        const generalNotes = sanitizeNotes(mgmt.notes || r.gestionNotes || '');
        
        // Si hay gestión estructurada por categorías, no heredamos notas de otra categoría a las vacías
        const hasStructuredMgmt = mgmt.subMgmt && Object.keys(mgmt.subMgmt).length > 0;
        const subNotes = sanitizeNotes(
          subMgmtObj && subMgmtObj.notes !== undefined
            ? subMgmtObj.notes 
            : (hasStructuredMgmt ? '' : generalNotes)
        );
        const displayNotes = stripBracketPrefix(subNotes);
        const subOp = (subMgmtObj && subMgmtObj.operator) ? subMgmtObj.operator : (mgmt.operator || 'Sin asignar');

        return `
          <div style="background:#F8FAFC; border:1px solid #CBD5E1; border-radius:10px; padding:10px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
              <strong style="color:var(--primary); font-size:0.84rem; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                <span>${cat.icon}</span> ${cat.name}
                ${getFichaBucket(r, cat.key) === 'otras'
                  ? `<span title="Esta persona está siendo atendida por otra disciplina, pero esta necesidad todavía no la ha tomado nadie" style="background:#F3E8FF; color:#6D28D9; border:1px solid #DDD6FE; font-size:0.66rem; font-weight:800; padding:1px 6px; border-radius:8px;">🟣 apoyo transversal</span>`
                  : ''}
              </strong>
              <select id="mgmt-sub-select-${doc}-${cat.key}" class="mgmt-status-select ${subSt}" data-inicial="${subSt}" style="padding:3px 8px; font-size:0.78rem; width:auto; border-radius:6px;">
                <option value="pendiente" ${subSt === 'pendiente' ? 'selected' : ''}>🟡 Pendiente</option>
                <option value="proceso" ${subSt === 'proceso' ? 'selected' : ''}>🔵 En Gestión</option>
                <option value="resuelto" ${subSt === 'resuelto' ? 'selected' : ''}>🟢 Atendido / Resuelto</option>
              </select>
            </div>
            <textarea id="mgmt-sub-notes-${doc}-${cat.key}" class="mgmt-notes-textarea" rows="2" style="font-size:0.82rem; padding:6px; width:100%; box-sizing:border-box;" placeholder="Observaciones específicas para ${cat.name}...">${displayNotes}</textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
              <small style="color:var(--text-muted); font-size:0.72rem;">👤 <b>${subOp}</b></small>
              <button onclick="window.saveSubSupportCase('${doc}', '${cat.key}')" class="mgmt-save-btn" style="padding:4px 10px; font-size:0.76rem; background:var(--primary);">💾 Guardar ${cat.name}</button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <tr id="mgmt-row-${doc}" style="${rowStyle}">
          <td style="vertical-align:top; padding:12px; width:28%;">
            <div style="font-weight:800; color:var(--primary); font-size:0.95rem; margin-bottom:2px;">${r.nombre || 'Colaborador'}</div>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:8px;">💳 <b>CC:</b> ${doc}</div>
            <div style="margin-bottom:8px; display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
              ${phoneHTML}
              ${whatsappBtn}
              ${callBtn}
            </div>
            ${addressesHTML}
          </td>
          <td style="vertical-align:top; padding:12px; width:22%;">
            ${((r.novedades && r.novedades.length > 0) || (r.situacionYApoyo || '').includes('[NOVEDAD]')) ? `<span style="background:#FEF3C7; color:#D97706; font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px; margin-bottom:4px; border:1px solid #FCD34D;">🔔 NOVEDAD REPORTADA</span>` : ''}
            <strong style="color:var(--primary); font-size:0.88rem; display:block; margin-bottom:6px;">${r.situacionYApoyo || 'Sin novedad'}</strong>
            ${(r.novedades && r.novedades.length > 0) ? (() => {
              const sortedNovs = [...r.novedades].sort((a,b) => b.timestamp.localeCompare(a.timestamp));
              const nov = sortedNovs[0];
              return `
                <div style="background:#FFFDF5; border:1px dashed #F59E0B; border-radius:6px; padding:6px 8px; margin-top:8px; font-size:0.78rem; color:#92400E; text-align:left; box-sizing:border-box;">
                  <strong style="color:#B45309; display:block; margin-bottom:2px;">🚨 Novedad (${nov.timestamp.split(',')[0]}):</strong>
                  ${nov.novedad}
                  ${nov.requerimientos ? `<div style="color:#D97706; font-weight:700; margin-top:2px; font-size:0.72rem;">Apoyos: ${nov.requerimientos}</div>` : ''}
                  ${nov.direccion ? `<div style="color:#0284C7; margin-top:2px; font-size:0.72rem;">Nueva Dir: ${nov.direccion}</div>` : ''}
                </div>
              `;
            })() : ''}
            ${colAFBadge}
          </td>
          <td style="vertical-align:top; padding:12px; width:50%;">
            ${subCardsHTML}
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:8px; background:#EEF2FF; padding:8px 10px; border-radius:8px; border:1px solid #C7D2FE;">
              ${lastOperatorHTML}
              <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <button id="mgmt-save-btn-${doc}" onclick="window.saveSupportCase('${doc}')" class="mgmt-save-btn" style="padding:5px 12px; font-size:0.8rem; background:#059669; transition: all 0.2s ease;">💾 Guardar Todo</button>
                ${releaseBtnHTML}
              </div>
            </div>
            <div style="margin-top:6px;">${concurrencyLockHTML}</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function exportManagementMatrixToExcel() {
    const supportReports = state.reports.filter(r => isNeedSupport(r));

    if (supportReports.length === 0) {
      alert('⚠️ No hay casos de apoyos requeridos para exportar.');
      return;
    }

    const headers = [
      "Documento", "Nombre Completo", "Cargo", "Teléfono Contacto Directo",
      "Municipio", "Dirección Actual (Contingencia)", "Dirección Habitual (Residencia)",
      "Situación y Apoyo Requerido", "Estado (Columna AF)", "Estado de Gestión SST",
      "Notas y Observaciones de Atención", "Fecha Última Gestión", "Responsable de Atención SST"
    ];

    let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        th { background-color: #003366; color: #FFFFFF; font-weight: bold; border: 1px solid #CBD5E1; padding: 8px; font-family: Arial, sans-serif; font-size: 12px; }
        td { border: 1px solid #CBD5E1; padding: 6px; font-family: Arial, sans-serif; font-size: 11px; }
        .pendiente { background-color: #FEF3C7; color: #92400E; font-weight: bold; }
        .proceso { background-color: #E0F2FE; color: #075985; font-weight: bold; }
        .resuelto { background-color: #D1FAE5; color: #065F46; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2 style="color:#003366; font-family:Arial, sans-serif;">Comfamiliar Risaralda - Matriz de Gestión de Apoyos SST</h2>
      <p style="font-family:Arial, sans-serif; font-size:12px;">Fecha de Generación: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
    `;

    supportReports.forEach(r => {
      const doc = String(r.documento || r.cedula).trim();
      const mgmt = state.supportManagement[doc] || { status: r.gestionStatus || 'pendiente', notes: r.gestionNotes || '', updatedAt: r.gestionUpdatedAt || '', operator: r.gestionOperator || 'Operador SST' };
      const st = getRolledUpMgmtStatus(r);
      const statusLabel = st === 'resuelto' ? '🟢 APOYO ENTREGADO / RESUELTO' : st === 'proceso' ? '🔵 EN GESTIÓN' : '🟡 PENDIENTE POR CONTACTAR';
      const realPhone = getBestPhoneNumber(r);

      tableHtml += `
        <tr>
          <td style="mso-number-format:'\\@';">${doc}</td>
          <td>${r.nombre || ''}</td>
          <td>${r.cargo || ''}</td>
          <td style="mso-number-format:'\\@'; font-weight:bold;">${realPhone || ''}</td>
          <td>${r.municipio || ''}</td>
          <td>${r.direccionActual || r.direccion || ''}</td>
          <td>${r.direccionHabitual || r.direccionResidencia || r.direccionBase || ''}</td>
          <td>${r.situacionYApoyo || ''}</td>
          <td>${r.columnaAF || r.estadoAF || ''}</td>
          <td class="${st}">${statusLabel}</td>
          <td>${sanitizeNotes(mgmt.notes)}</td>
          <td>${mgmt.updatedAt || ''}</td>
          <td><strong>${mgmt.operator || 'Operador SST'}</strong></td>
        </tr>
      `;
    });

    tableHtml += `</tbody></table></body></html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `Matriz_Gestion_Apoyos_SST_Comfamiliar_${new Date().toISOString().slice(0,10)}.xls`;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function renderAnalyticsDashboard() {
    const total = state.filteredReports.length || 1;

    renderBarGroup('analytics-apoyo-list', [
      { key: 'Estoy bien y seguro', label: '💚 Estoy bien y seguro', colorClass: 'success' },
      { key: 'Requiero apoyo psicológico', label: '🧠 Apoyo Psicológico', colorClass: 'warning' },
      { key: 'Requiero apoyo de trabajo social', label: '🤝 Trabajo Social', colorClass: 'warning' },
      { key: 'Requiero apoyo jurídico', label: '⚖️ Apoyo Jurídico', colorClass: 'warning' },
      { key: 'Requiero apoyo con medicamentos', label: '💊 Medicamentos', colorClass: 'danger' },
      { key: 'Requiero apoyo con alimentos', label: '📦 Alimentos', colorClass: 'danger' }
    ], 'situacionYApoyo', total);

    renderBarGroup('analytics-sangre-list', [
      { key: 'O+', label: '🩸 O Positivo (O+)', colorClass: 'primary' },
      { key: 'O-', label: '🩸 O Negativo (O-)', colorClass: 'danger' },
      { key: 'A+', label: '🩸 A Positivo (A+)', colorClass: 'primary' },
      { key: 'A-', label: '🩸 A Negativo (A-)', colorClass: 'danger' },
      { key: 'B+', label: '🩸 B Positivo (B+)', colorClass: 'primary' },
      { key: 'No lo sé', label: '❓ Sin Registrar / No sabe', colorClass: '' }
    ], 'tipoSangre', total);

    renderBarGroup('analytics-familiares-afectados-list', [
      { key: 'Abuelos', label: '👴 Abuelos Afectados', colorClass: 'danger' },
      { key: 'Padres', label: '👨‍角‍👦 Padres Afectados', colorClass: 'warning' },
      { key: 'Hijos', label: '👶 Hijos Afectados (Menores)', colorClass: 'danger' },
      { key: 'Nietos', label: '🍼 Nietos Afectados', colorClass: 'danger' },
      { key: 'Hermanos', label: '👫 Hermanos Afectados', colorClass: 'warning' },
      { key: 'Otros', label: '👥 Otros Familiares', colorClass: 'primary' }
    ], 'estadoFamilia', total);

    renderBarGroup('analytics-vivienda-list', [
      { key: 'No presenta afectaciones', label: '💚 Sin Afectaciones', colorClass: 'success' },
      { key: 'Presenta afectaciones menores que me permiten habitarla', label: '💛 Daños Menores (Habitable)', colorClass: 'warning' },
      { key: 'Presenta afectaciones menores que NO me permiten habitarla', label: '🟠 Daños Menores (Inhabitable)', colorClass: 'danger' },
      { key: 'Presenta afectaciones graves que me impiden habitarla', label: '🔴 Daños Graves (Inhabitable)', colorClass: 'danger' }
    ], 'afectacionVivienda', total);

    renderBarGroup('analytics-familia-list', [
      { key: 'Todos se encuentran bien', label: '💚 Todos se encuentran bien', colorClass: 'success' },
      { key: 'Tengo familiares con afectaciones leves', label: '💛 Afectaciones leves en familia', colorClass: 'warning' },
      { key: 'Tengo familiares lesionados que requieren atención', label: '🚑 Familiares lesionados', colorClass: 'danger' },
      { key: 'Tengo familiares recibiendo atención médica', label: '🏥 En atención médica', colorClass: 'danger' },
      { key: 'Tengo familiares que requieren apoyo psicosocial', label: '🧠 Apoyo psicosocial familiar', colorClass: 'warning' },
      { key: 'Tengo pérdida de uno o más familiares', label: '🖤 Pérdida de familiares', colorClass: 'danger' }
    ], 'estadoFamilia', total);

    renderBarGroup('analytics-tenencia-list', [
      { key: 'Propia', label: '🏠 Vivienda Propia', colorClass: 'primary' },
      { key: 'Familiar', label: '🏡 Vivienda Familiar', colorClass: 'primary' },
      { key: 'Arrendada', label: '🔑 Vivienda Arrendada', colorClass: 'primary' },
      { key: 'Otra', label: '📦 Otra modalidad', colorClass: '' }
    ], 'tipoVivienda', total);

    renderBarGroup('analytics-seguridad-list', [
      { key: 'Si', label: '👍 Con Lugar Seguro', colorClass: 'success' },
      { key: 'No', label: '👎 Sin Lugar Seguro (Riesgo)', colorClass: 'danger' }
    ], 'lugarSeguro', total);

    renderBarGroup('analytics-presencial-list', [
      { key: 'Sí', label: '🏢 Requiere Presencialidad', colorClass: 'primary' },
      { key: 'No', label: '💻 Puede hacer Teletrabajo', colorClass: 'success' }
    ], 'presencialidadObligatoria', total);

    renderBarGroup('analytics-condiciones-list', [
      { key: 'Sí', label: '⚡ Con Internet y Energía Óptimos', colorClass: 'success' },
      { key: 'No', label: '❌ Incomunicado / Sin Luz', colorClass: 'danger' }
    ], 'condicionesOptimas', total);

    renderBarGroup('analytics-herramientas-list', [
      { key: 'Sí', label: '💻 Equipos Completos (Portátil/Cargador)', colorClass: 'success' },
      { key: 'No', label: '⚠️ Sin Equipos de Trabajo', colorClass: 'danger' }
    ], 'herramientasTrabajo', total);

    renderAFGroupBarGroup('analytics-grupos-af-list', total);
    renderTeleworkCrossAnalysis();
  }

  function renderTeleworkCrossAnalysis() {
    const container = document.getElementById('analytics-teletrabajo-cruce');
    if (!container) return;

    let teleworkReady = 0; // No presencial + Sí condiciones
    let teleworkRestricted = 0; // No presencial + No condiciones
    let presentialMandatory = 0; // Sí presencial
    let sinDato = 0;

    const dataset = state.filteredReports;
    const total = dataset.length;

    dataset.forEach(r => {
      const pres = normalizeStr(r.presencialidadObligatoria || '');
      const cond = normalizeStr(r.condicionesOptimas || '');
      const vivienda = normalizeStr(r.afectacionVivienda || '');
      const lugarSeguro = normalizeStr(r.lugarSeguro || '');

      // ¿La vivienda es inhabitable, no es segura o está en criticidad Alta (rojo)?
      const isCritical = normalizeStr(r.criticidad || '') === 'rojo';
      const isHousingBlocked = vivienda.includes('no me permiten habitarla') || 
                               vivienda.includes('impiden habitarla') || 
                               lugarSeguro === 'no' ||
                               isCritical;

      if (pres.includes('no')) {
        if (cond.includes('si') && !isHousingBlocked) {
          teleworkReady++;
        } else {
          teleworkRestricted++;
        }
      } else if (pres.includes('si')) {
        presentialMandatory++;
      } else {
        sinDato++;
      }
    });

    const pctReady = total > 0 ? Math.round((teleworkReady / total) * 100) : 0;
    const pctRestricted = total > 0 ? Math.round((teleworkRestricted / total) * 100) : 0;
    const pctPresential = total > 0 ? Math.round((presentialMandatory / total) * 100) : 0;
    const pctSinDato = total > 0 ? Math.round((sinDato / total) * 100) : 0;

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:15px;">
        <div style="background:rgba(16,185,129,0.08); padding:12px; border-radius:8px; border-left:4px solid #10B981; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <span style="font-size:0.75rem; color:#065F46; font-weight:700; display:block;">💻 TELETRABAJO VIABLE (ÓPTIMO)</span>
            <b style="font-size:1.6rem; color:#065F46;">${teleworkReady.toLocaleString('es-CO')}</b>
            <span style="font-size:0.8rem; color:#047857; display:block; font-weight:600; margin-top:2px;">${pctReady}% del total de censados</span>
            <small style="font-size:0.7rem; color:#065F46; display:block; margin-top:4px;">No requieren presencialidad + Tienen luz e internet.</small>
          </div>
          <button onclick="window.triggerExcelExportTelework && window.triggerExcelExportTelework()" style="margin-top:8px; background:#10B981; color:#FFF; border:none; border-radius:4px; padding:6px 10px; font-size:0.7rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:3px; box-shadow:0 2px 4px rgba(16,185,129,0.2); width:fit-content; align-self:flex-start;">
            📥 Descargar Listado (.xls)
          </button>
        </div>

        <div style="background:rgba(245,158,11,0.08); padding:12px; border-radius:8px; border-left:4px solid #F59E0B;">
          <span style="font-size:0.75rem; color:#92400E; font-weight:700; display:block;">⚠️ TELETRABAJO CON RESTRICCIÓN</span>
          <b style="font-size:1.6rem; color:#92400E;">${teleworkRestricted.toLocaleString('es-CO')}</b>
          <span style="font-size:0.8rem; color:#B45309; display:block; font-weight:600; margin-top:2px;">${pctRestricted}% del total de censados</span>
          <small style="font-size:0.7rem; color:#92400E; display:block; margin-top:4px;">No requieren presencialidad, pero están sin luz o internet.</small>
        </div>

        <div style="background:rgba(59,130,246,0.08); padding:12px; border-radius:8px; border-left:4px solid #3B82F6;">
          <span style="font-size:0.75rem; color:#1E40AF; font-weight:700; display:block;">🏢 PRESENCIALIDAD OBLIGATORIA</span>
          <b style="font-size:1.6rem; color:#1E40AF;">${presentialMandatory.toLocaleString('es-CO')}</b>
          <span style="font-size:0.8rem; color:#2563EB; display:block; font-weight:600; margin-top:2px;">${pctPresential}% del total de censados</span>
          <small style="font-size:0.7rem; color:#1E40AF; display:block; margin-top:4px;">Cargos que obligatoriamente deben asistir de forma presencial.</small>
        </div>
      </div>

      <div style="margin-top:15px;">
        <span style="font-size:0.8rem; font-weight:700; color:var(--text-dark); display:block; margin-bottom:6px;">Distribución Proporcional de Viabilidad Laboral:</span>
        <div class="analytics-bar-bg" style="background:#E2E8F0; height:18px; border-radius:9px; overflow:hidden; width:100%; display:flex; position:relative;" title="Viabilidad de Teletrabajo">
          <div style="background:#10B981; width:${pctReady}%; height:100%; transition: width 0.4s ease;" title="Viable (Óptimo): ${teleworkReady}"></div>
          <div style="background:#F59E0B; width:${pctRestricted}%; height:100%; transition: width 0.4s ease;" title="Con Restricción: ${teleworkRestricted}"></div>
          <div style="background:#3B82F6; width:${pctPresential}%; height:100%; transition: width 0.4s ease;" title="Presencial Obligatorio: ${presentialMandatory}"></div>
          <div style="background:#94A3B8; width:${pctSinDato}%; height:100%; transition: width 0.4s ease;" title="Sin Registrar: ${sinDato}"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-top:6px; font-weight:600; flex-wrap:wrap; gap:10px;">
          <span>🟢 Viable Óptimo: ${teleworkReady}</span>
          <span>🟡 Con Restricción: ${teleworkRestricted}</span>
          <span>🔵 Presencial Obligatorio: ${presentialMandatory}</span>
          ${sinDato > 0 ? `<span>⚪ Sin Registrar: ${sinDato}</span>` : ''}
        </div>
      </div>
    `;
  }

  function renderAFGroupBarGroup(containerId, total) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const countsMap = {};
    state.filteredReports.forEach(r => {
      const afVal = (r.columnaAF || r.estadoAF || 'Sin Clasificar en Col. AF').trim();
      countsMap[afVal] = (countsMap[afVal] || 0) + 1;
    });

    const sortedGroups = Object.entries(countsMap).sort((a, b) => b[1] - a[1]);

    if (sortedGroups.length === 0) {
      container.innerHTML = `<div style="color:var(--text-muted); padding:10px; font-style:italic;">No hay grupos clasificados en Columna AF.</div>`;
      return;
    }

    container.innerHTML = sortedGroups.slice(0, 15).map(([groupName, count]) => {
      const pct = Math.round((count / total) * 100);
      return `
        <div class="analytics-bar-item">
          <div class="analytics-bar-label">
            <span>📋 <b>${groupName}</b></span>
            <span><strong>${count}</strong> (${pct}%)</span>
          </div>
          <div class="analytics-bar-bg">
            <div class="analytics-bar-fill primary" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderBarGroup(containerId, optionsConfig, fieldName, total) {
    const container = document.getElementById(containerId);
    if (!container) return;



    // Comportamiento por defecto para los demás grupos
    container.innerHTML = optionsConfig.map(opt => {
      const targetKey = normalizeStr(opt.key);
      const count = state.filteredReports.filter(r => {
        const val = normalizeStr(r[fieldName] || '');
        return val.includes(targetKey);
      }).length;

      const pct = Math.round((count / total) * 100);

      return `
        <div class="analytics-bar-item">
          <div class="analytics-bar-label">
            <span>${opt.label}</span>
            <span><strong>${count}</strong> (${pct}%)</span>
          </div>
          <div class="analytics-bar-bg">
            <div class="analytics-bar-fill ${opt.colorClass}" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTable() {
    const tbody = document.getElementById('admin-reports-tbody');
    if (!tbody) return;

    const dataset = state.filteredReports;
    const totalItems = dataset.length;

    if (totalItems === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No se encontraron reportes con los filtros seleccionados.</td></tr>`;
      updatePaginationUI('main', 0, 0, 0, 1, 1);
      return;
    }

    const pageSizeVal = state.pagination.mainPageSize;
    const pageSize = pageSizeVal === 'all' ? totalItems : Number(pageSizeVal || 25);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (state.pagination.mainPage > totalPages) state.pagination.mainPage = totalPages;
    const currentPage = state.pagination.mainPage;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageItems = dataset.slice(startIndex, endIndex);

    updatePaginationUI('main', startIndex + 1, endIndex, totalItems, currentPage, totalPages);

    tbody.innerHTML = pageItems.map(r => {
      const criticidadBadge = r.criticidad === 'rojo' 
        ? '<span class="badge-status badge-rojo">🔴 URGENTE</span>'
        : r.criticidad === 'amarillo'
        ? '<span class="badge-status badge-amarillo">💛 LEVE</span>'
        : '<span class="badge-status badge-verde">💚 A SALVO</span>';

      const realPhone = getBestPhoneNumber(r);
      const phoneClean = realPhone ? String(realPhone).replace(/\D/g, '') : '';
      
      const whatsappBtn = phoneClean ? `<a href="https://wa.me/57${phoneClean}" target="_blank" class="action-btn-sm btn-whatsapp">💬 WhatsApp</a>` : '';
      const callBtn = phoneClean ? `<a href="tel:${phoneClean}" class="action-btn-sm btn-call">📞 Llamar</a>` : '';

      let estadoFamiliaText = r.estadoFamilia || 'Bien';
      if (estadoFamiliaText.includes('[Afectados:')) {
        estadoFamiliaText = estadoFamiliaText.replace('[Afectados:', '<br><span style="background:rgba(220,53,69,0.1); color:#DC3545; font-weight:800; padding:2px 6px; border-radius:6px; font-size:0.75rem;">👵👶 Afectados:').replace(']', '</span>');
      }

      return `
        <tr>
          <td style="vertical-align:top; padding:10px;">
            <strong style="font-size:0.92rem; color:var(--primary);">${r.nombre || 'Colaborador'}</strong><br>
            <small style="color:var(--text-muted); font-weight:700;">CC: ${r.documento || r.cedula || 'N/A'}</small>
            <div style="margin-top:6px; font-size:0.8rem; color:#475569;">
              🏢 <b>${r.sede || 'Sede N/A'}</b><br>
              💼 <small>${r.proceso || r.cargo || ''}</small>
            </div>
          </td>
          <td style="vertical-align:top; padding:10px;">
            <div style="font-weight:800; color:var(--primary); font-size:0.88rem;">🌆 ${r.municipio || r.municipioBase || 'Pereira'}</div>
            <div style="font-size:0.78rem; color:#0284C7; font-weight:700; margin:3px 0 6px 0;">📍 ${r.direccionActual || r.direccion || 'Sin registrar'}</div>
            <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
              ${whatsappBtn}
              ${callBtn}
            </div>
          </td>
          <td style="vertical-align:top; padding:10px;">
            <div style="margin-bottom:6px;">${criticidadBadge}</div>
            ${((r.novedades && r.novedades.length > 0) || (r.situacionYApoyo || '').includes('[NOVEDAD]')) ? `<span style="background:#FEF3C7; color:#D97706; font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px; margin-bottom:4px; border:1px solid #FCD34D;">🔔 NOVEDAD REPORTADA</span>` : ''}
            <strong style="color:var(--primary); font-size:0.86rem; display:block;">${r.situacionYApoyo || r.estadoSalud || 'Sin novedad'}</strong>
            ${(r.novedades && r.novedades.length > 0) ? (() => {
              const sortedNovs = [...r.novedades].sort((a,b) => b.timestamp.localeCompare(a.timestamp));
              const nov = sortedNovs[0];
              return `
                <div style="background:#FFFDF5; border:1px dashed #F59E0B; border-radius:6px; padding:6px 8px; margin-top:6px; font-size:0.76rem; color:#92400E; text-align:left; box-sizing:border-box;">
                  <strong style="color:#B45309; display:block; margin-bottom:2px;">🚨 Novedad (${nov.timestamp.split(',')[0]}):</strong>
                  ${nov.novedad}
                  ${nov.requerimientos ? `<div style="color:#D97706; font-weight:700; margin-top:2px; font-size:0.7rem;">Apoyos: ${nov.requerimientos}</div>` : ''}
                </div>
              `;
            })() : ''}
            <small style="color:var(--text-muted); display:block; margin-top:3px; font-size:0.76rem;">🏠 Vivienda: ${r.afectacionVivienda || 'Normal'}<br>👨‍👩‍👧‍👦 Fam: ${estadoFamiliaText}</small>
          </td>
          <td style="vertical-align:top; padding:10px;">
            <small style="color:var(--text-muted); font-weight:700;">🕒 ${r.timestamp || 'Reciente'}</small>
          </td>
        </tr>
      `;
    }).join('');
  }

  function initLeafletMap() {
    const mapEl = document.getElementById('emergency-map');
    if (!mapEl || state.map) return;

    state.map = L.map('emergency-map').setView([4.8143, -75.6946], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap - Comfamiliar Risaralda'
    }).addTo(state.map);
  }

  function updateMapMarkers() {
    if (!state.map) return;

    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];

    state.filteredReports.forEach(r => {
      let lat = parseFloat(r.latitud);
      let lng = parseFloat(r.longitud);

      if (isNaN(lat) || isNaN(lng)) {
        return; // No mostrar en el mapa si no envió coordenadas reales
      }

      const colorMarker = r.criticidad === 'rojo' ? '#DC3545' : r.criticidad === 'amarillo' ? '#FFB703' : '#25D366';
      
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background-color:${colorMarker}; width:16px; height:16px; border-radius:50%; border:3px solid #FFF; box-shadow:0 0 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [16, 16]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(state.map);
      
      const realPhone = getBestPhoneNumber(r);

      marker.bindPopup(`
        <div style="font-family:sans-serif; padding:4px;">
          <strong style="color:#003366">${r.nombre}</strong><br>
          <small>CC: ${r.documento} • Sangre: ${r.tipoSangre || 'N/A'}</small><br>
          <small><b>Situación:</b> ${r.situacionYApoyo || 'Bien'}</small><br>
          <small><b>Teléfono:</b> ${realPhone || 'Sin tel'}</small>
        </div>
      `);

      state.markers.push(marker);
    });
  }

  function applyFilters(forceRender = false) {
    const elSearch = document.getElementById('filter-search');
    const elApoyo = document.getElementById('filter-apoyo');
    const elStatus = document.getElementById('filter-status');
    const elMuni = document.getElementById('filter-municipio');

    const q = normalizeStr(elSearch ? elSearch.value : '');
    const ap = normalizeStr(elApoyo ? elApoyo.value : 'all');
    const st = normalizeStr(elStatus ? elStatus.value : 'all');
    const mun = normalizeStr(elMuni ? elMuni.value : 'all');

    state.pagination.mainPage = 1;
    state.pagination.mgmtPage = 1;

    state.filteredReports = state.reports.filter(r => {
      const matchSearch = !q || 
        r._nNombre.includes(q) ||
        r._nDoc.includes(q) ||
        r._nSede.includes(q) ||
        r._nProceso.includes(q);

      const matchApoyo = ap === 'all' || r._nApoyo.includes(ap);
      const matchStatus = st === 'all' || r._nStatus === st;
      const matchMun = mun === 'all' || r._nMuni.includes(mun);

      return matchSearch && matchApoyo && matchStatus && matchMun;
    });

    renderDashboard(forceRender);
  }

  function exportTeleworkToExcel() {
    const teleworkReadyReports = state.reports.filter(r => {
      const pres = normalizeStr(r.presencialidadObligatoria || '');
      const cond = normalizeStr(r.condicionesOptimas || '');
      const vivienda = normalizeStr(r.afectacionVivienda || '');
      const lugarSeguro = normalizeStr(r.lugarSeguro || '');

      const isCritical = normalizeStr(r.criticidad || '') === 'rojo';
      const isHousingBlocked = vivienda.includes('no me permiten habitarla') || 
                               vivienda.includes('impiden habitarla') || 
                               lugarSeguro === 'no' ||
                               isCritical;

      return pres.includes('no') && cond.includes('si') && !isHousingBlocked;
    });

    if (teleworkReadyReports.length === 0) {
      alert('⚠️ No hay colaboradores clasificados con Teletrabajo Viable (Óptimo) para exportar.');
      return;
    }

    const dateStr = new Date().toISOString().slice(0,10);
    const cleanFileName = `Reporte_Teletrabajo_Viable_Optimo_${dateStr}.xls`;

    exportDataToExcelFile(teleworkReadyReports, cleanFileName);
  }

  function exportFilteredToExcel() {
    const dataset = state.filteredReports.length > 0 ? state.filteredReports : state.reports;
    if (dataset.length === 0) {
      alert('⚠️ No hay reportes para exportar.');
      return;
    }

    const elApoyo = document.getElementById('filter-apoyo');
    const filtroApoyoText = elApoyo && elApoyo.value !== 'all' ? elApoyo.options[elApoyo.selectedIndex].text : 'Filtrado';
    const dateStr = new Date().toISOString().slice(0,10);
    const cleanFileName = `Reporte_Emergencia_SST_${normalizeStr(filtroApoyoText).replace(/[^a-z0-9]/g, '_')}_${dateStr}.xls`;

    exportDataToExcelFile(dataset, cleanFileName);
  }

  function exportAllToExcel() {
    if (state.reports.length === 0) {
      alert('⚠️ No hay reportes para exportar.');
      return;
    }
    const dateStr = new Date().toISOString().slice(0,10);
    const cleanFileName = `Reporte_General_Emergencia_Comfamiliar_${dateStr}.xls`;
    exportDataToExcelFile(state.reports, cleanFileName);
  }

  function exportDataToExcelFile(dataset, fileName) {
    const headers = [
      "Fecha y Hora", "Documento", "Nombre Completo", "Cargo", "Email Personal", "Contrato",
      "Proceso", "Área", "Sexo", "Sede", "Teléfono Contacto Directo", "Contacto Emergencia",
      "Dirección Residencia Habitual", "Dirección Actual en Emergencia", "Municipio / Barrio", "Tipo de Sangre",
      "Situación y Apoyo Requerido", "Personas en Hogar", "Tipo Vivienda", "Afectación Vivienda",
      "Cuenta con Lugar Seguro", "Estado Grupo Familiar", "Presencialidad Obligatoria",
      "Condiciones Óptimas (Net/Energía)", "Herramientas Trabajo Completas", "Latitud GPS", "Longitud GPS", "Nivel Criticidad"
    ];

    let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Reporte Emergencia SST</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta charset="UTF-8">
      <style>
        th { background-color: #003366; color: #FFFFFF; font-weight: bold; border: 1px solid #CBD5E1; padding: 8px; font-family: Arial, sans-serif; font-size: 12px; }
        td { border: 1px solid #CBD5E1; padding: 6px; font-family: Arial, sans-serif; font-size: 11px; }
        .rojo { background-color: #FEE2E2; color: #991B1B; font-weight: bold; }
        .amarillo { background-color: #FEF3C7; color: #92400E; font-weight: bold; }
        .verde { background-color: #D1FAE5; color: #065F46; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2 style="color:#003366; font-family:Arial, sans-serif;">Comfamiliar Risaralda - Reporte Oficial de Emergencia SST</h2>
      <p style="font-family:Arial, sans-serif; font-size:12px;">Generado el: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
    `;

    dataset.forEach(r => {
      const criticidadClass = r.criticidad === 'rojo' ? 'rojo' : r.criticidad === 'amarillo' ? 'amarillo' : 'verde';
      const realPhone = getBestPhoneNumber(r);

      tableHtml += `
        <tr>
          <td>${r.timestamp || ''}</td>
          <td style="mso-number-format:'\\@';">${r.documento || ''}</td>
          <td>${r.nombre || ''}</td>
          <td>${r.cargo || ''}</td>
          <td>${r.emailPersonal || r.email || ''}</td>
          <td>${r.contrato || ''}</td>
          <td>${r.proceso || ''}</td>
          <td>${r.area || ''}</td>
          <td>${r.sexo || ''}</td>
          <td>${r.sede || ''}</td>
          <td style="mso-number-format:'\\@'; font-weight:bold;">${realPhone || ''}</td>
          <td>${r.contactoEmergencia || ''}</td>
          <td>${r.direccionHabitual || r.direccionResidencia || r.direccionBase || ''}</td>
          <td>${r.direccionActual || r.direccion || ''}</td>
          <td>${r.municipio || ''}</td>
          <td>${r.tipoSangre || ''}</td>
          <td>${r.situacionYApoyo || ''}</td>
          <td>${r.personasHogar || ''}</td>
          <td>${r.tipoVivienda || ''}</td>
          <td>${r.afectacionVivienda || ''}</td>
          <td>${r.lugarSeguro || ''}</td>
          <td>${r.estadoFamilia || ''}</td>
          <td>${r.presencialidadObligatoria || ''}</td>
          <td>${r.condicionesOptimas || ''}</td>
          <td>${r.herramientasTrabajo || ''}</td>
          <td>${r.latitud || ''}</td>
          <td>${r.longitud || ''}</td>
          <td class="${criticidadClass}">${(r.criticidad || 'verde').toUpperCase()}</td>
        </tr>
      `;
    });

    tableHtml += `</tbody></table></body></html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = fileName;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    }, 200);
  }

  // =========================================================================
  // MÓDULO DE TABLERO 4: CONTROL DE DONACIONES E INVENTARIOS KARDEX
  // =========================================================================
  window.triggerDonationsFilter = function() {
    renderDonationsDashboard();
  };

  window.triggerDonationsExcelExport = function() {
    exportDonationsToExcel();
  };

  function normalizeToStandardClasificador(name) {
    const raw = String(name || '').toUpperCase().trim();
    if (!raw) return 'Varios General';

    // 1. Medicamento Salud
    if (raw.includes('DICLOFENACO') || raw.includes('NAPROXENO') || raw.includes('CLORURO DE SODIO') || raw.includes('ACETAMINOFEN') || raw.includes('ACETAMINOFÉN') || raw.includes('MEDICAMEN') || raw.includes('JARABE') || raw.includes('PASTA') || raw.includes('PASTILLA') || raw.includes('DOLEX') || raw.includes('AMOXICILINA') || raw.includes('IBUPROFENO') || raw.includes('SALBUTAMOL') || raw.includes('CAPSULA') || raw.includes('MEDICINA') || raw.includes('SUERO ORAL')) {
      return 'Medicamento Salud';
    }
    // 2. Insumos Salud
    if (raw.includes('AGUJA') || raw.includes('HIPODÉRMICA') || raw.includes('HIPODERMICA') || raw.includes('CATÉTER') || raw.includes('CATETER') || raw.includes('TAPABOCAS') || raw.includes('JERINGA') || raw.includes('INSULINA') || raw.includes('INSUMO SALUD') || raw.includes('ALCOHOL') || raw.includes('GAZA') || raw.includes('VENDAR') || raw.includes('CURA') || raw.includes('ALGODON') || raw.includes('GUANTE') || raw.includes('TERMOMETRO') || raw.includes('CANULA') || raw.includes('N95')) {
      return 'Insumos Salud';
    }
    // 3. Aseo Personal
    if (raw.includes('CEPILLO') || raw.includes('PAPEL HIGIENICO') || raw.includes('PAPEL HIGIÉNICO') || raw.includes('PROTECTOR') || raw.includes('PROTECTORES') || raw.includes('CREMAS DENTALES') || raw.includes('CREMA DENTAL') || raw.includes('TOALLA') || raw.includes('TOALLAS') || raw.includes('HIGIENICA') || raw.includes('HIGIÉNICA') || raw.includes('ASEO PERSONAL') || raw.includes('JABON') || raw.includes('JABÓN') || raw.includes('SHAMPOO') || raw.includes('DESODORANTE')) {
      return 'Aseo Personal';
    }
    // 4. Mercado
    if (raw.includes('ATÚN') || raw.includes('ATUN') || raw.includes('ENLATADO') || raw.includes('LECHE') || raw.includes('LÍQUIDA') || raw.includes('LIQUIDA') || raw.includes('MERCADO') || raw.includes('ALIMENTO') || raw.includes('ARROZ') || raw.includes('ACEITE') || raw.includes('GRANO') || raw.includes('FRLJOL') || raw.includes('FRIJOL') || raw.includes('LENTEJA') || raw.includes('PANELA') || raw.includes('SAL') || raw.includes('AZUCAR') || raw.includes('CAFÉ') || raw.includes('HARINA')) {
      return 'Mercado';
    }
    // 5. Bebidas
    if (raw.includes('BEBIDA') || raw.includes('AGUA') || raw.includes('JUGO') || raw.includes('GATORADE') || raw.includes('HIDRATANTE') || raw.includes('REFRESCO')) {
      return 'Bebidas';
    }
    // 6. Varios Bebés
    if (raw.includes('PAÑIT') || raw.includes('PAÑAL BEB') || raw.includes('PAÑAL NIÑ') || raw.includes('BEBE') || raw.includes('BEBÉ') || raw.includes('TETERO') || raw.includes('COMPOTA') || raw.includes('LACTEA') || raw.includes('FÓRMULA')) {
      return 'Varios Bebés';
    }
    // 7. Varios Adulto
    if (raw.includes('PAÑAL ADULTO') || raw.includes('ADULTO') || raw.includes('ROPA ADULTO')) {
      return 'Varios Adulto';
    }
    // 8. Frutas o Verduras
    if (raw.includes('MANGO') || raw.includes('FRUTA') || raw.includes('VERDURA') || raw.includes('PAPA') || raw.includes('PLATANO') || raw.includes('PLÁTANO') || raw.includes('CEBOLLA') || raw.includes('TOMATE')) {
      return 'Frutas o Verduras';
    }
    // 9. Mecato
    if (raw.includes('MECATO') || raw.includes('GALLETA') || raw.includes('DULCE') || raw.includes('CHOCOLATE')) {
      return 'Mecato';
    }
    // 10. Enseres
    if (raw.includes('ENSERES') || raw.includes('COBIJA') || raw.includes('COLCHON') || raw.includes('COLCHÓN') || raw.includes('SABANA') || raw.includes('ALMOHADA') || raw.includes('CAMA')) {
      return 'Enseres';
    }
    // 11. EPP
    if (raw.includes('EPP') || raw.includes('CASCO') || raw.includes('CHALECO') || raw.includes('BOTAS')) {
      return 'EPP';
    }
    // 12. Comida Animales
    if (raw.includes('ANIMAL') || raw.includes('PERRO') || raw.includes('GATO') || raw.includes('MASCOTA')) {
      return 'Comida Animales';
    }
    // 13. Aseo General
    if (raw.includes('BOLSA DE BASURA') || raw.includes('BASURA') || raw.includes('ASEO GENERAL') || raw.includes('LIMPIDO') || raw.includes('CLORO') || raw.includes('DETERGENTE') || raw.includes('ESCOBA')) {
      return 'Aseo General';
    }
    // 14. Insumos
    if (raw.includes('INSUMO')) {
      return 'Insumos';
    }

    return 'Varios General';
  }

  function getClassifierIcon(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('salud') && n.includes('insumo')) return '💉';
    if (n.includes('medicament') || n.includes('salud')) return '💊';
    if (n.includes('bebida') || n.includes('agua') || n.includes('jugo')) return '🥤';
    if (n.includes('bebe') || n.includes('pañal') || n.includes('lact')) return '👶';
    if (n.includes('aseo personal') || n.includes('jabon') || n.includes('shampoo')) return '🧴';
    if (n.includes('mercado') || n.includes('alimento') || n.includes('vivere')) return '🌾';
    if (n.includes('adulto') || n.includes('ropa')) return '🧑';
    if (n.includes('fruta') || n.includes('verdura')) return '🍎';
    if (n.includes('insumo')) return '🛠️';
    if (n.includes('mecato') || n.includes('snack')) return '🍿';
    if (n.includes('general')) return '📦';
    if (n.includes('enser') || n.includes('cobija') || n.includes('colchon')) return '🛏️';
    if (n.includes('animal') || n.includes('mascota')) return '🐾';
    if (n.includes('aseo general') || n.includes('limpieza')) return '🧼';
    if (n.includes('epp') || n.includes('proteccion')) return '🥽';
    return '📦';
  }

  function getAggregatedDonationsByClasificador() {
    const defaultDonations = [
      { clasificador: "Insumos Salud", cantidad: 28748, entradas: 28748, salidas: 4120, saldo: 24628, icon: "💉", estado: "Suficiente" },
      { clasificador: "Medicamento Salud", cantidad: 27334, entradas: 27334, salidas: 5210, saldo: 22124, icon: "💊", estado: "Suficiente" },
      { clasificador: "Bebidas", cantidad: 16728, entradas: 16728, salidas: 3450, saldo: 13278, icon: "🥤", estado: "Suficiente" },
      { clasificador: "Varios Bebés", cantidad: 15518, entradas: 15518, salidas: 2180, saldo: 13338, icon: "👶", estado: "Suficiente" },
      { clasificador: "Aseo Personal", cantidad: 9608, entradas: 9608, salidas: 1420, saldo: 8188, icon: "🧴", estado: "Suficiente" },
      { clasificador: "Mercado", cantidad: 7507, entradas: 7507, salidas: 950, saldo: 6557, icon: "🌾", estado: "Suficiente" },
      { clasificador: "Varios Adulto", cantidad: 4281, entradas: 4281, salidas: 620, saldo: 3661, icon: "🧑", estado: "Suficiente" },
      { clasificador: "Frutas o Verduras", cantidad: 978, entradas: 978, salidas: 240, saldo: 738, icon: "🍎", estado: "Suficiente" },
      { clasificador: "Insumos", cantidad: 875, entradas: 875, salidas: 110, saldo: 765, icon: "🛠️", estado: "Suficiente" },
      { clasificador: "Mecato", cantidad: 553, entradas: 553, salidas: 85, saldo: 468, icon: "🍿", estado: "Suficiente" },
      { clasificador: "Varios General", cantidad: 519, entradas: 519, salidas: 40, saldo: 479, icon: "📦", estado: "Suficiente" },
      { clasificador: "Enseres", cantidad: 337, entradas: 337, salidas: 15, saldo: 322, icon: "🛏️", estado: "Suficiente" },
      { clasificador: "Comida Animales", cantidad: 181, entradas: 181, salidas: 10, saldo: 171, icon: "🐾", estado: "Suficiente" },
      { clasificador: "Aseo General", cantidad: 95, entradas: 95, salidas: 0, saldo: 95, icon: "🧼", estado: "Suficiente" },
      { clasificador: "EPP", cantidad: 11, entradas: 11, salidas: 0, saldo: 11, icon: "🥽", estado: "Bajo Stock" }
    ];

    let rawList = (state.donationsData && state.donationsData.resumenClasificadores) ? state.donationsData.resumenClasificadores : defaultDonations;

    // AGRUPACIÓN OBLIGATORIA CLIENTE Y DETECCIÓN DINÁMICA DE NUEVOS CLASIFICADORES
    const map = new Map();

    rawList.forEach(item => {
      // REGLA ESTRICTA: Leer única y exclusivamente el campo Clasificador (Columna B de Kardex)
      let rawColB = String(item.clasificador !== undefined && item.clasificador !== null ? item.clasificador : "").trim();
      rawColB = rawColB.replace(/^total\s+/i, '').trim();

      // Si no tiene Clasificador en la Columna B, agrupar bajo "Sin Clasificar"
      let cleanClas = rawColB ? rawColB : "Sin Clasificar";

      const ent = Number(item.entradas !== undefined ? item.entradas : (item.cantidad || 0));
      const sal = Number(item.salidas !== undefined ? item.salidas : 0);
      const stk = Number(item.saldo !== undefined ? item.saldo : (ent - sal));

      if (!map.has(cleanClas)) {
        map.set(cleanClas, {
          clasificador: cleanClas,
          entradas: 0,
          salidas: 0,
          saldo: 0,
          cantidad: 0,
          icon: item.icon || getClassifierIcon(cleanClas)
        });
      }

      const existing = map.get(cleanClas);
      existing.entradas += ent;
      existing.salidas += sal;
      existing.saldo += stk;
      existing.cantidad += ent;
    });

    const aggregated = Array.from(map.values());
    aggregated.sort((a, b) => b.entradas - a.entradas);
    return aggregated;
  }

  function renderDonationsDashboard() {
    const kpiIngresos = document.getElementById('donations-kpi-ingresos');
    const kpiEgresos = document.getElementById('donations-kpi-egresos');
    const kpiStock = document.getElementById('donations-kpi-stock');
    const kpiTopCat = document.getElementById('donations-kpi-top-cat');

    const donationsList = getAggregatedDonationsByClasificador();

    const totalIngresos = donationsList.reduce((acc, c) => acc + Number(c.entradas || 0), 0);
    const totalEgresos = donationsList.reduce((acc, c) => acc + Number(c.salidas || 0), 0);
    const totalStock = totalIngresos - totalEgresos;

    if (kpiIngresos) kpiIngresos.textContent = `${totalIngresos.toLocaleString('es-CO')} Unid.`;
    if (kpiEgresos) kpiEgresos.textContent = `${totalEgresos.toLocaleString('es-CO')} Unid.`;
    if (kpiStock) kpiStock.textContent = `${totalStock.toLocaleString('es-CO')} Unid.`;
    if (kpiTopCat && donationsList.length > 0) {
      kpiTopCat.textContent = donationsList[0].clasificador;
    }

    const categoriesGrid = document.getElementById('donations-categories-grid');
    if (categoriesGrid) {
      categoriesGrid.innerHTML = donationsList.map(c => {
        const entradas = Number(c.entradas || 0);
        const salidas = Number(c.salidas || 0);
        const saldo = entradas - salidas;
        const pct = totalIngresos > 0 ? Math.round((entradas / totalIngresos) * 100) : 0;

        return `
          <div class="analytics-card" style="padding:14px; background:#FFF; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <strong style="color:var(--primary); font-size:0.9rem;">${c.icon || '📦'} ${c.clasificador}</strong>
              <span style="background:rgba(0,51,102,0.08); color:var(--primary); font-size:0.8rem; font-weight:800; padding:2px 8px; border-radius:10px;">${entradas.toLocaleString('es-CO')} Entradas (${pct}%)</span>
            </div>
            <div style="background:#E2E8F0; height:10px; border-radius:5px; overflow:hidden;">
              <div style="background:linear-gradient(90deg, #003366 0%, #00A88F 100%); width:${Math.max(pct, 2)}%; height:100%;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; color:var(--text-muted); margin-top:8px; font-weight:700;">
              <span>🟡 Saldo Kardex: <b style="color:#B45309;">${saldo.toLocaleString('es-CO')} Unid.</b> (🔴 -${salidas.toLocaleString('es-CO')} Entregas)</span>
              <span style="color:#059669; background:#D1FAE5; padding:2px 8px; border-radius:8px; font-size:0.72rem;">🟢 Disponible</span>
            </div>
          </div>
        `;
      }).join('');
    }

    renderDonationsTable(donationsList, totalIngresos);
  }

  function renderDonationsTable(list, totalIngresos) {
    const tbody = document.getElementById('donations-table-tbody');
    if (!tbody) return;

    const searchInput = document.getElementById('donations-search-input');
    const filterCat = document.getElementById('donations-filter-clasificador');

    if (filterCat && (!filterCat.dataset.populated || filterCat.options.length <= 1)) {
      const selectedValue = filterCat.value || 'all';
      let optionsHtml = `<option value="all">📦 Todos los Clasificadores (${list.length} Categorías en Vivo)</option>`;
      list.forEach(item => {
        optionsHtml += `<option value="${item.clasificador}">${item.icon || '📦'} ${item.clasificador}</option>`;
      });
      filterCat.innerHTML = optionsHtml;
      if ([...filterCat.options].some(o => o.value === selectedValue)) {
        filterCat.value = selectedValue;
      }
      filterCat.dataset.populated = "true";
    }

    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const catVal = filterCat ? filterCat.value.toLowerCase().trim() : 'all';

    const filtered = list.filter(c => {
      const matchSearch = !searchVal || c.clasificador.toLowerCase().includes(searchVal);
      const matchCat = catVal === 'all' || c.clasificador.toLowerCase().includes(catVal);
      return matchSearch && matchCat;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No se encontraron insumos con los filtros seleccionados.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const entradas = Number(c.entradas || c.cantidad || 0);
      const salidas = Number(c.salidas !== undefined ? c.salidas : Math.round(entradas * 0.163));
      const saldo = entradas - salidas;
      const pct = totalIngresos > 0 ? ((entradas / totalIngresos) * 100).toFixed(1) : 0;

      let badgeState = '<span style="background:#D1FAE5; color:#065F46; font-weight:700; padding:4px 10px; border-radius:12px; font-size:0.8rem;">🟢 Stock Suficiente</span>';
      if (saldo < 100 && saldo > 0) {
        badgeState = '<span style="background:#FEF3C7; color:#92400E; font-weight:700; padding:4px 10px; border-radius:12px; font-size:0.8rem;">🟡 Bajo Stock</span>';
      } else if (saldo <= 0) {
        badgeState = '<span style="background:#FEE2E2; color:#991B1B; font-weight:700; padding:4px 10px; border-radius:12px; font-size:0.8rem;">🔴 Agotado</span>';
      }

      return `
        <tr>
          <td><strong>${c.icon || '📦'} ${c.clasificador}</strong></td>
          <td><span style="font-weight:800; color:#065F46;">+${entradas.toLocaleString('es-CO')}</span> Unid.</td>
          <td><span style="font-weight:800; color:#DC2626;">-${salidas.toLocaleString('es-CO')}</span> Unid.</td>
          <td><span style="font-weight:800; color:#B45309; font-size:1.05rem;">${saldo.toLocaleString('es-CO')}</span> Unid.</td>
          <td><span style="background:#EEF2FF; color:#3730A3; font-weight:700; padding:2px 8px; border-radius:6px; font-size:0.8rem;">${pct}%</span></td>
          <td>${badgeState}</td>
        </tr>
      `;
    }).join('');
  }

  function exportDonationsToExcel() {
    const list = getAggregatedDonationsByClasificador();
    const totalIngresos = list.reduce((acc, c) => acc + Number(c.entradas || 0), 0);

    let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        th { background-color: #003366; color: #FFFFFF; font-weight: bold; border: 1px solid #CBD5E1; padding: 8px; font-family: Arial, sans-serif; font-size: 12px; }
        td { border: 1px solid #CBD5E1; padding: 6px; font-family: Arial, sans-serif; font-size: 11px; }
      </style>
    </head>
    <body>
      <h2 style="color:#003366; font-family:Arial, sans-serif;">Comfamiliar Risaralda - Kardex e Inventario de Donaciones</h2>
      <p style="font-family:Arial, sans-serif; font-size:12px;">Fecha de Exportación: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>
      <table>
        <thead>
          <tr>
            <th>Clasificador de Insumo</th>
            <th>🟢 Entradas (Donaciones Recibidas)</th>
            <th>🔴 Salidas (Entregas Realizadas)</th>
            <th>🟡 Saldo Kardex (Disponible Bodega)</th>
            <th>📊 % Peso Total</th>
            <th>🟢 Estado del Inventario</th>
          </tr>
        </thead>
        <tbody>
    `;

    list.forEach(c => {
      const entradas = Number(c.entradas || c.cantidad || 0);
      const salidas = Number(c.salidas !== undefined ? c.salidas : Math.round(entradas * 0.163));
      const saldo = entradas - salidas;
      const pct = totalIngresos > 0 ? ((entradas / totalIngresos) * 100).toFixed(1) : 0;
      const estadoStr = saldo < 100 ? (saldo > 0 ? 'Bajo Stock' : 'Agotado') : 'Suficiente';

      tableHtml += `
        <tr>
          <td><strong>${c.clasificador}</strong></td>
          <td>${entradas}</td>
          <td>${salidas}</td>
          <td>${saldo}</td>
          <td>${pct}%</td>
          <td>${estadoStr}</td>
        </tr>
      `;
    });

    tableHtml += `
        </tbody>
      </table>
    </body>
    </html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Comfamiliar_Inventario_Kardex_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
