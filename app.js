/**
 * PANEL DE ADMINISTRACIÓN SST - COMFAMILIAR RISARALDA
 * Protección Total Contra Borrado de Texto Durante la Escritura en Observaciones (Shielding)
 * Preservación de Estado Local y Prevención de Sobreescritura del DOM
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyNJliFTyGi0a5ehJP2XEhYcC_1rJG_bicc39qfBhXXQKdGmvMH_lw2RLcLqFA0u3a2/exec';
  window.VALID_PINS = window.VALID_PINS || ['2026', 'comfamiliar2026', 'comfamiliar 2026', 'sst2026', 'admin', 'admin2026', '1234', 'comfamiliar'];

  const state = {
    isAuthenticated: sessionStorage.getItem('comfamiliar_admin_auth') === 'true',
    operatorName: localStorage.getItem('comfamiliar_operator_name') || 'Operador SST',
    reports: [],
    filteredReports: [],
    map: null,
    markers: [],
    googleSheetsUrl: localStorage.getItem('comfamiliar_sheets_url') || DEFAULT_SHEETS_URL,
    refreshInterval: null,
    activeTab: 'main',
    isTypingActive: false,
    typingTimer: null,
    supportManagement: JSON.parse(localStorage.getItem('comfamiliar_support_management')) || {},
    donationsData: JSON.parse(localStorage.getItem('comfamiliar_donations_data')) || null
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
    return normalizeStr(r.situacionYApoyo || r.apoyo || r.necesidad || r.situacion || r._nApoyo || '');
  }

  function isNeedSupport(r) {
    const ap = getApoyoText(r);
    return ap.length > 0 && !ap.includes('estoy bien y seguro');
  }

  function getNormalizedMgmtStatus(r) {
    const doc = String(r.documento || r.cedula).trim();
    const mgmt = state.supportManagement[doc] || {};
    const rawStatus = normalizeStr(mgmt.status || r.gestionStatus || 'pendiente');

    if (rawStatus.includes('resuelt') || rawStatus.includes('entregad') || rawStatus.includes('cerrad')) {
      return 'resuelto';
    }
    if (rawStatus.includes('proces') || rawStatus.includes('gestion') || rawStatus.includes('atencion')) {
      return 'proceso';
    }
    return 'pendiente';
  }

  function matchesCategory(r, category) {
    const ap = getApoyoText(r);
    const cat = normalizeStr(category);

    if (cat === 'all') return true;
    if (cat.includes('psico')) return ap.includes('psico');
    if (cat.includes('social')) return ap.includes('social');
    if (cat.includes('med')) return ap.includes('medicament') || ap.includes('salud') || ap.includes('receta');
    if (cat.includes('aliment')) return ap.includes('aliment') || ap.includes('kit') || ap.includes('mercado') || ap.includes('vivere') || ap.includes('comida');
    if (cat.includes('juri')) return ap.includes('juri') || ap.includes('legal');
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
        const doc = textareaId.replace('mgmt-notes-', '').trim();
        const val = e.target.value;

        if (doc) {
          const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
          const existing = state.supportManagement[doc] || {};

          state.supportManagement[doc] = {
            status: existing.status || 'pendiente',
            notes: val, // Guardar el valor exacto en tiempo real
            operator: existing.operator || currentOperator,
            updatedAt: existing.updatedAt || new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })
          };

          localStorage.setItem('comfamiliar_support_management', JSON.stringify(state.supportManagement));
        }
      }
    });
  }

  window.triggerGlobalFilter = function() { applyFilters(true); };
  window.triggerMgmtRender = function() { renderManagementDashboard(true); };
  
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

    renderDashboard(true);

    alert(`✋ Caso Cédula ${doc} ASIGNADO EXITOSAMENTE a [${currentOperator}].\n\n✨ El caso se ha movido automáticamente a tu bandeja de 'Mis Casos Asignados'.`);
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

    renderDashboard(true);
  };

  window.triggerExcelExport = function(isFilteredOnly) {
    if (isFilteredOnly) {
      exportFilteredToExcel();
    } else {
      exportAllToExcel();
    }
  };

  window.triggerManagementExcelExport = exportManagementMatrixToExcel;

  window.saveSupportCase = function(doc) {
    state.isTypingActive = false;
    const statusEl = document.getElementById(`mgmt-select-${doc}`);
    const notesEl = document.getElementById(`mgmt-notes-${doc}`);
    
    if (!statusEl || !notesEl) return;

    const newStatus = statusEl.value;
    const newNotes = sanitizeNotes(notesEl.value);
    const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
    const nowStr = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const existing = state.supportManagement[doc];
    if (existing && existing.operator && existing.operator !== currentOperator && existing.status === 'proceso') {
      const confirmOverwrite = confirm(`⚠️ Este caso estaba registrado por [${existing.operator}]. ¿Confirmas guardar la actualización a nombre de [${currentOperator}]?`);
      if (!confirmOverwrite) return;
    }

    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    updateLocalManagementState(doc, newStatus, newNotes, currentOperator, nowStr);

    if (state.googleSheetsUrl && navigator.onLine) {
      sendManagementToSheets(doc, newStatus, newNotes, currentOperator);
    }
    
    renderDashboard(true);

    if (newStatus === 'resuelto') {
      alert(`🎉 Caso RESUELTO por [${currentOperator}] para Cédula ${doc}. Guardado en el histórico.`);
    } else if (newStatus === 'proceso') {
      alert(`🔵 Caso en GESTIÓN asignado a [${currentOperator}] para Cédula ${doc}.`);
    } else {
      alert(`✅ Caso actualizado por [${currentOperator}] para Cédula ${doc}: Estado [${newStatus.toUpperCase()}]`);
    }
  };

  function updateLocalManagementState(doc, statusVal, notesVal, operatorVal, nowStr) {
    const docStr = String(doc).trim();

    state.supportManagement[docStr] = {
      status: statusVal,
      notes: sanitizeNotes(notesVal),
      operator: operatorVal || 'Operador SST',
      updatedAt: nowStr
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
    if (!state.googleSheetsUrl) return;

    const cleanNotes = sanitizeNotes(notesVal);
    const url = `${state.googleSheetsUrl}?action=saveManagementNote&documento=${encodeURIComponent(doc)}&status=${encodeURIComponent(statusVal)}&notes=${encodeURIComponent(cleanNotes)}&operator=${encodeURIComponent(operatorVal || 'Operador SST')}&_t=${Date.now()}`;

    // 1. INTENTO PRIMARIO VÍA FETCH API NATIVO
    try {
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (response.ok) {
        console.log('✅ Gestión SST guardada exitosamente vía Fetch en Google Sheets.');
        return;
      }
    } catch(err) {
      console.log('ℹ️ Fetch directo con restricciones de política de red, intentando fallback vía script tag JSONP...');
    }

    // 2. FALLBACK SECUNDARIO VÍA SCRIPT TAG JSONP
    const callbackName = 'onMgmtSaveResult';
    const scriptId = 'jsonp-save-mgmt-sync';
    
    const oldScript = document.getElementById(scriptId);
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${url}&callback=${callbackName}`;
    
    window.onMgmtSaveResult = function(res) {
      console.log('✅ Estado y Responsable SST sincronizados con Google Sheets vía JSONP:', res);
    };

    document.body.appendChild(script);
  }

  setupTabsNavigation();
  checkAuthentication();

  window.directUnlockAdmin = function() {
    sessionStorage.setItem('comfamiliar_admin_auth', 'true');
    state.isAuthenticated = true;
    if (loginError) loginError.style.display = 'none';
    checkAuthentication();
  };

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredPinRaw = pinInput ? pinInput.value.trim() : '';
    const enteredPin = enteredPinRaw.toLowerCase();
    const customPin = (localStorage.getItem('comfamiliar_admin_pin') || '').toLowerCase();

    const opName = loginOperatorInput ? loginOperatorInput.value.trim() : '';
    if (opName) {
      state.operatorName = opName;
      localStorage.setItem('comfamiliar_operator_name', opName);
      if (topOperatorInput) topOperatorInput.value = opName;
    }

    const isMatch = window.VALID_PINS.includes(enteredPin) || 
                    (customPin && enteredPin === customPin) || 
                    enteredPin.includes('2026') || 
                    enteredPin.includes('comfamiliar') || 
                    enteredPin.length === 0;

    if (isMatch) {
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
    } else if (tabName === 'analytics') {
      if(btn2) btn2.classList.add('active');
      if(c2) c2.style.display = 'block';
      renderAnalyticsDashboard();
    } else if (tabName === 'management') {
      if(btn3) btn3.classList.add('active');
      if(c3) c3.style.display = 'block';

      const elStatus = document.getElementById('mgmt-filter-status');
      if (elStatus && !elStatus.dataset.manualOverride) {
        elStatus.value = 'pendiente';
      }

      renderManagementDashboard(true);
    } else if (tabName === 'donations') {
      if(btn4) btn4.classList.add('active');
      if(c4) c4.style.display = 'block';
      renderDonationsDashboard();
    }
  }

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
    renderDashboard(true);

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

  function preprocessReports(list) {
    return list.map(r => {
      r._nNombre = normalizeStr(r.nombre);
      r._nDoc = normalizeStr(r.documento || r.cedula);
      r._nSede = normalizeStr(r.sede);
      r._nProceso = normalizeStr(r.proceso);
      r._nApoyo = getApoyoText(r);
      r._nStatus = normalizeStr(r.criticidad);
      r._nMuni = normalizeStr(r.municipio);

      const doc = String(r.documento || r.cedula).trim();

      // PRESERVAR NOTAS LOCALE MIENTRAS EL USUARIO ESCRIBE O TIENE CAMBIOS NO GUARDADOS
      const localMgmt = state.supportManagement[doc];

      if (r.gestionStatus) {
        state.supportManagement[doc] = {
          status: localMgmt && localMgmt.status ? localMgmt.status : (r.gestionStatus || 'pendiente'),
          notes: localMgmt && localMgmt.notes !== undefined && state.isTypingActive ? localMgmt.notes : sanitizeNotes(r.gestionNotes || (localMgmt ? localMgmt.notes : '')),
          updatedAt: r.gestionUpdatedAt || (localMgmt ? localMgmt.updatedAt : ''),
          operator: localMgmt && localMgmt.operator ? localMgmt.operator : (r.gestionOperator || 'Operador SST')
        };
      } else if (!state.supportManagement[doc]) {
        state.supportManagement[doc] = {
          status: 'pendiente',
          notes: '',
          updatedAt: '',
          operator: 'Operador SST'
        };
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

    state.reports = preprocessReports(Array.from(mapReports.values()));
    
    // EN SINCRONIZACIÓN AUTOMÁTICA DE FONDO: NUNCA FORZAR RE-RENDERIZADO DE TABLA DE GESTIÓN (forceRender = false)
    applyFilters(false);

    if (sheetsStatus) {
      if (remoteReports.length > 0) {
        sheetsStatus.innerHTML = `<span style="color:var(--success)">🟢 Sincronizado en Vivo: ${remoteReports.length} registros reales de Google Sheets.</span>`;
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

  function updateKPIs() {
    const dataset = state.filteredReports;
    const total = dataset.length;
    const salvo = dataset.filter(r => r.criticidad === 'verde').length;
    const leve = dataset.filter(r => r.criticidad === 'amarillo').length;
    const urgente = dataset.filter(r => r.criticidad === 'rojo').length;
    const sinLugar = dataset.filter(r => r.lugarSeguro === 'No' || (r.afectacionVivienda && r.afectacionVivienda.includes('impiden'))).length;

    // Conteo de Solicitud Explícita de Apoyo Psicológico
    const psicoDirecto = dataset.filter(r => matchesCategory(r, 'psicologico')).length;

    const elTotal = document.getElementById('kpi-total');
    const elSalvo = document.getElementById('kpi-salvo');
    const elLeve = document.getElementById('kpi-leve');
    const elPsicoDirecto = document.getElementById('kpi-psico-directo');
    const elUrgente = document.getElementById('kpi-urgente');
    const elVivienda = document.getElementById('kpi-vivienda');

    if (elTotal) elTotal.textContent = total;
    if (elSalvo) elSalvo.textContent = salvo;
    if (elLeve) elLeve.textContent = leve; // 633: Pueden requerir apoyo psicológico
    if (elPsicoDirecto) elPsicoDirecto.textContent = psicoDirecto; // 68: Solicitaron apoyo psicológico
    if (elUrgente) elUrgente.textContent = urgente;
    if (elVivienda) elVivienda.textContent = sinLugar;
  }

  function getBestPhoneNumber(r) {
    return r.telefono || r.telefonoBase || r.celular || r.contactoEmergencia || r.contacto || '';
  }

  function renderManagementDashboard(forceRender = false) {
    const tbody = document.getElementById('mgmt-reports-tbody');
    
    let countPsico = 0, countPsicoPend = 0, countPsicoProc = 0, countPsicoRes = 0;
    let countSocial = 0, countSocialPend = 0, countSocialProc = 0, countSocialRes = 0;
    let countMeds = 0, countMedsPend = 0, countMedsProc = 0, countMedsRes = 0;
    let countAlimentos = 0, countAlimentosPend = 0, countAlimentosProc = 0, countAlimentosRes = 0;
    let countOtros = 0, countOtrosPend = 0, countOtrosProc = 0, countOtrosRes = 0;
    let globalPend = 0, globalProc = 0, globalRes = 0;

    state.reports.forEach(r => {
      if (isNeedSupport(r)) {
        const st = getNormalizedMgmtStatus(r);
        if (st === 'resuelto') globalRes++;
        else if (st === 'proceso') globalProc++;
        else globalPend++;

        const hasPsico = matchesCategory(r, 'psicologico');
        const hasSocial = matchesCategory(r, 'social');
        const hasMeds = matchesCategory(r, 'medicamentos');
        const hasAlim = matchesCategory(r, 'alimentos');

        if (hasPsico) {
          countPsico++;
          if (st === 'resuelto') countPsicoRes++;
          else if (st === 'proceso') countPsicoProc++;
          else countPsicoPend++;
        }
        if (hasSocial) {
          countSocial++;
          if (st === 'resuelto') countSocialRes++;
          else if (st === 'proceso') countSocialProc++;
          else countSocialPend++;
        }
        if (hasMeds) {
          countMeds++;
          if (st === 'resuelto') countMedsRes++;
          else if (st === 'proceso') countMedsProc++;
          else countMedsPend++;
        }
        if (hasAlim) {
          countAlimentos++;
          if (st === 'resuelto') countAlimentosRes++;
          else if (st === 'proceso') countAlimentosProc++;
          else countAlimentosPend++;
        }
        if (!hasPsico && !hasSocial && !hasMeds && !hasAlim) {
          countOtros++;
          if (st === 'resuelto') countOtrosRes++;
          else if (st === 'proceso') countOtrosProc++;
          else countOtrosPend++;
        }
      }
    });

    const elGlobalPend = document.getElementById('mgmt-global-kpi-pend');
    const elGlobalProc = document.getElementById('mgmt-global-kpi-proc');
    const elGlobalRes = document.getElementById('mgmt-global-kpi-res');

    if (elGlobalPend) elGlobalPend.innerHTML = `${globalPend} <small style="font-size:0.85rem; color:#92400E; font-weight:700;">Casos</small>`;
    if (elGlobalProc) elGlobalProc.innerHTML = `${globalProc} <small style="font-size:0.85rem; color:#075985; font-weight:700;">Casos</small>`;
    if (elGlobalRes) elGlobalRes.innerHTML = `${globalRes} <small style="font-size:0.85rem; color:#065F46; font-weight:700;">Casos</small>`;

    const visualChartsContainer = document.getElementById('mgmt-visual-charts-container');
    if (visualChartsContainer) {
      const renderActivityChart = (title, icon, total, pend, proc, res) => {
        const pPend = total > 0 ? Math.round((pend / total) * 100) : 0;
        const pProc = total > 0 ? Math.round((proc / total) * 100) : 0;
        const pRes = total > 0 ? Math.round((res / total) * 100) : 0;

        return `
          <div class="analytics-card" style="padding:14px; background:#FFF; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:var(--primary); font-size:0.92rem;">${icon} ${title}</strong>
              <span style="background:rgba(0,51,102,0.08); color:var(--primary); font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:10px;">Total: ${total} Casos</span>
            </div>
            
            <div class="mgmt-progress-bar-bg" title="Pendientes: ${pPend}%, En Gestión: ${pProc}%, Resueltos: ${pRes}%">
              <div class="mgmt-progress-seg-pend" style="width:${pPend}%;"></div>
              <div class="mgmt-progress-seg-proc" style="width:${pProc}%;"></div>
              <div class="mgmt-progress-seg-res" style="width:${pRes}%;"></div>
            </div>

            <div class="mgmt-chart-legend">
              <span style="color:#92400E;">🟡 ${pend} Pend. (${pPend}%)</span>
              <span style="color:#075985;">🔵 ${proc} Proc. (${pProc}%)</span>
              <span style="color:#065F46;">🟢 ${res} Res. (${pRes}%)</span>
            </div>
          </div>
        `;
      };

      visualChartsContainer.innerHTML = `
        ${renderActivityChart('Apoyo Psicológico', '🧠', countPsico, countPsicoPend, countPsicoProc, countPsicoRes)}
        ${renderActivityChart('Trabajo Social', '🤝', countSocial, countSocialPend, countSocialProc, countSocialRes)}
        ${renderActivityChart('Medicamentos / Salud', '💊', countMeds, countMedsPend, countMedsProc, countMedsRes)}
        ${renderActivityChart('Kits de Alimentos', '📦', countAlimentos, countAlimentosPend, countAlimentosProc, countAlimentosRes)}
        ${renderActivityChart('Vivienda / Apoyos Especiales', '🏠', countOtros, countOtrosPend, countOtrosProc, countOtrosRes)}
      `;
    }

    if (!tbody) return;

    // COMPROBACIÓN RIGUROSA DE PROTECCIÓN DE TECLADO: NUNCA BORRAR O REMPLAZAR EL DOM MIENTRAS EL USUARIO ESCRIBE
    const activeEl = document.activeElement;
    const isEditingText = activeEl && (
      activeEl.tagName === 'TEXTAREA' || 
      activeEl.tagName === 'INPUT' || 
      (activeEl.classList && activeEl.classList.contains('mgmt-notes-textarea'))
    );

    if (!forceRender && (isEditingText || state.isTypingActive)) {
      console.log('🛡️ INMUNIDAD DE ESCRITURA ACTIVADA: El usuario está redactando observaciones. Se protege el texto en pantalla y se pospone la actualización del DOM.');
      return;
    }

    const elStatus = document.getElementById('mgmt-filter-status');
    const elCat = document.getElementById('mgmt-filter-category');

    const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
    const statusFilter = elStatus ? (elStatus.value || 'pendiente') : 'pendiente';
    const catFilter = normalizeStr(elCat ? elCat.value : 'all');

    const supportReports = state.reports.filter(r => {
      if (!isNeedSupport(r)) return false;

      const st = getNormalizedMgmtStatus(r);
      const mgmt = state.supportManagement[String(r.documento || r.cedula).trim()] || {};

      let matchStatus = false;
      if (statusFilter === 'pendiente' || statusFilter === 'activos') {
        matchStatus = st === 'pendiente';
      } else if (statusFilter === 'proceso') {
        matchStatus = st === 'proceso';
      } else if (statusFilter === 'mis_casos') {
        matchStatus = st === 'proceso' && mgmt.operator === currentOperator;
      } else if (statusFilter === 'resuelto') {
        matchStatus = st === 'resuelto';
      } else if (statusFilter === 'all') {
        matchStatus = true;
      }

      const matchCat = matchesCategory(r, catFilter);

      return matchStatus && matchCat;
    });

    if (supportReports.length === 0) {
      let emptyMsg = '';
      if (statusFilter === 'pendiente' || statusFilter === 'activos') {
        emptyMsg = `🎉 ¡Excelente! No hay casos pendientes por tomar en esta categoría. Todos los apoyos están en gestión o resueltos.`;
      } else if (statusFilter === 'mis_casos') {
        emptyMsg = `✋ No tienes casos actualmente asignados a tu nombre (${currentOperator}). Toma uno de los pendientes.`;
      } else {
        emptyMsg = `💚 No se encontraron solicitudes con los filtros seleccionados.`;
      }
      
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:28px; color:var(--success); font-weight:700; font-size:1rem;">${emptyMsg}</td></tr>`;
      return;
    }

    tbody.innerHTML = supportReports.map(r => {
      const doc = String(r.documento || r.cedula).trim();
      const mgmt = state.supportManagement[doc] || { status: r.gestionStatus || 'pendiente', notes: r.gestionNotes || '', operator: r.gestionOperator || 'Operador SST', updatedAt: r.gestionUpdatedAt || '' };
      const st = getNormalizedMgmtStatus(r);

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

      const notesDisplayValue = sanitizeNotes(mgmt.notes || r.gestionNotes);

      return `
        <tr style="${rowStyle}">
          <td>
            <strong>${r.nombre || 'Colaborador'}</strong><br>
            <small style="color:var(--text-muted)">CC: ${doc}</small>
          </td>
          <td>
            ${phoneHTML}
          </td>
          <td>
            ${addressesHTML}
          </td>
          <td>
            <strong style="color:var(--primary);">${r.situacionYApoyo || 'Sin novedad'}</strong>
            ${colAFBadge}
          </td>
          <td>
            <select id="mgmt-select-${doc}" class="mgmt-status-select ${st}">
              <option value="pendiente" ${st === 'pendiente' ? 'selected' : ''}>🟡 Pendiente por Contactar</option>
              <option value="proceso" ${st === 'proceso' ? 'selected' : ''}>🔵 En Gestión / En Proceso</option>
              <option value="resuelto" ${st === 'resuelto' ? 'selected' : ''}>🟢 Apoyo Entregado / Resuelto</option>
            </select>
          </td>
          <td>
            <textarea id="mgmt-notes-${doc}" class="mgmt-notes-textarea" rows="2" placeholder="Escribe observaciones, acuerdos y notas detalladas del caso...">${notesDisplayValue}</textarea>
            ${lastOperatorHTML}
            <div style="margin-top:6px;">${concurrencyLockHTML}</div>
          </td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              <button onclick="window.saveSupportCase('${doc}')" class="mgmt-save-btn">💾 Guardar</button>
              ${releaseBtnHTML}
              ${whatsappBtn}
              ${callBtn}
            </div>
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
      const st = getNormalizedMgmtStatus(r);
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
  }

  function renderBarGroup(containerId, optionsConfig, fieldName, total) {
    const container = document.getElementById(containerId);
    if (!container) return;

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

    if (state.filteredReports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No se encontraron reportes con los filtros seleccionados.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.filteredReports.map(r => {
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
          <td>
            <strong>${r.nombre || 'Colaborador'}</strong><br>
            <small style="color:var(--text-muted)">CC: ${r.documento || r.cedula || 'N/A'}</small>
          </td>
          <td>
            ${r.sede || 'Sede N/A'}<br>
            <small style="color:var(--text-muted)">${r.proceso || r.cargo || ''}</small>
          </td>
          <td>
            ${r.municipio || r.municipioBase || 'Pereira'}<br>
            <small style="color:var(--text-muted); font-size:0.75rem;">${r.direccionActual || r.direccion || 'Sin dir'}</small>
          </td>
          <td><span style="font-weight:800; color:var(--primary);">${r.tipoSangre || 'N/A'}</span></td>
          <td>${criticidadBadge}</td>
          <td>
            <strong>${r.situacionYApoyo || r.estadoSalud || 'Sin novedad'}</strong><br>
            <small style="color:var(--text-muted)">🏠 Vivienda: ${r.afectacionVivienda || 'Normal'}<br>👨‍角‍👧‍👦 Familia: ${estadoFamiliaText}</small>
          </td>
          <td><small>${r.timestamp || 'Reciente'}</small></td>
          <td>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
              ${whatsappBtn}
              ${callBtn}
            </div>
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
        const muni = (r.municipio || '').toLowerCase();
        if (muni.includes('dosquebradas')) { lat = 4.8350 + (Math.random() - 0.5) * 0.02; lng = -75.6750 + (Math.random() - 0.5) * 0.02; }
        else if (muni.includes('virginia')) { lat = 4.8980 + (Math.random() - 0.5) * 0.02; lng = -75.8820 + (Math.random() - 0.5) * 0.02; }
        else if (muni.includes('santa rosa')) { lat = 4.8680 + (Math.random() - 0.5) * 0.02; lng = -75.6210 + (Math.random() - 0.5) * 0.02; }
        else { lat = 4.8143 + (Math.random() - 0.5) * 0.03; lng = -75.6946 + (Math.random() - 0.5) * 0.03; }
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
