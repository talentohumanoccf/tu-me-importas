/**
 * PANEL DE ADMINISTRACIÓN SST - COMFAMILIAR RISARALDA
 * Indicadores KPI de Gestión con Desglose por Estado (Garantizado en render general)
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyNJliFTyGi0a5ehJP2XEhYcC_1rJG_bicc39qfBhXXQKdGmvMH_lw2RLcLqFA0u3a2/exec';
  const VALID_PINS = ['2026', 'comfamiliar2026', 'sst2026'];

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
    supportManagement: JSON.parse(localStorage.getItem('comfamiliar_support_management')) || {}
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

  const tabContentMain = document.getElementById('tab-content-main');
  const tabContentAnalytics = document.getElementById('tab-content-analytics');
  const tabContentManagement = document.getElementById('tab-content-management');
  
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

  window.triggerGlobalFilter = applyFilters;
  window.triggerMgmtRender = renderManagementDashboard;
  
  window.filterMgmtByCard = function(cardType) {
    const elStatus = document.getElementById('mgmt-filter-status');
    const elCat = document.getElementById('mgmt-filter-category');

    if (cardType === 'resueltos') {
      if (elStatus) elStatus.value = 'resuelto';
      if (elCat) elCat.value = 'all';
    } else {
      if (elStatus) elStatus.value = 'activos';
      if (elCat) elCat.value = cardType;
    }

    renderManagementDashboard();
  };

  window.claimCase = function(doc) {
    const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
    const existing = state.supportManagement[doc];

    if (existing && existing.status === 'proceso' && existing.operator && existing.operator !== currentOperator) {
      const confirmTransfer = confirm(`⚠️ Este caso ya está asignado a [${existing.operator}]. ¿Deseas reasignarlo a tu nombre (${currentOperator})?`);
      if (!confirmTransfer) return;
    }

    const statusEl = document.getElementById(`mgmt-select-${doc}`);
    const notesEl = document.getElementById(`mgmt-notes-${doc}`);

    const newStatus = 'proceso';
    const newNotes = (notesEl && notesEl.value.trim().length > 0) ? notesEl.value.trim() : `Caso tomado por ${currentOperator}`;
    const nowStr = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    state.supportManagement[doc] = {
      status: newStatus,
      notes: newNotes,
      operator: currentOperator,
      updatedAt: nowStr
    };

    localStorage.setItem('comfamiliar_support_management', JSON.stringify(state.supportManagement));

    if (statusEl) {
      statusEl.value = 'proceso';
      statusEl.className = 'mgmt-status-select proceso';
    }

    if (state.googleSheetsUrl && navigator.onLine) {
      sendManagementToSheets(doc, newStatus, newNotes, currentOperator);
    }

    alert(`✋ Caso Cédula ${doc} ASIGNADO EXITOSAMENTE a [${currentOperator}].`);
    renderManagementDashboard();
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
    const statusEl = document.getElementById(`mgmt-select-${doc}`);
    const notesEl = document.getElementById(`mgmt-notes-${doc}`);
    
    if (!statusEl || !notesEl) return;

    const newStatus = statusEl.value;
    const newNotes = notesEl.value.trim();
    const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
    const nowStr = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const existing = state.supportManagement[doc];
    if (existing && existing.operator && existing.operator !== currentOperator && existing.status === 'proceso') {
      const confirmOverwrite = confirm(`⚠️ Este caso estaba registrado por [${existing.operator}]. ¿Confirmas guardar la actualización a nombre de [${currentOperator}]?`);
      if (!confirmOverwrite) return;
    }

    state.supportManagement[doc] = {
      status: newStatus,
      notes: newNotes,
      operator: currentOperator || 'Operador SST',
      updatedAt: nowStr
    };

    localStorage.setItem('comfamiliar_support_management', JSON.stringify(state.supportManagement));
    
    statusEl.className = `mgmt-status-select ${newStatus}`;

    if (state.googleSheetsUrl && navigator.onLine) {
      sendManagementToSheets(doc, newStatus, newNotes, currentOperator);
    }
    
    if (newStatus === 'resuelto') {
      alert(`🎉 Caso RESUELTO por [${currentOperator}] para Cédula ${doc}. Se ha archivado fuera del tablero activo.`);
    } else {
      alert(`✅ Caso guardado por [${currentOperator}] para Cédula ${doc}: Estado [${newStatus.toUpperCase()}]`);
    }

    renderManagementDashboard();
  };

  function sendManagementToSheets(doc, statusVal, notesVal, operatorVal) {
    const callbackName = 'onMgmtSaveResult';
    const scriptId = 'jsonp-save-mgmt-sync';
    
    const oldScript = document.getElementById(scriptId);
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${state.googleSheetsUrl}?action=saveManagementNote&documento=${encodeURIComponent(doc)}&status=${encodeURIComponent(statusVal)}&notes=${encodeURIComponent(notesVal)}&operator=${encodeURIComponent(operatorVal)}&callback=${callbackName}`;
    
    window.onMgmtSaveResult = function() {
      console.log('✅ Estado y Responsable SST sincronizados con Google Sheets.');
    };

    document.body.appendChild(script);
  }

  setupTabsNavigation();
  checkAuthentication();

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredPin = pinInput.value.trim();
    const customPin = localStorage.getItem('comfamiliar_admin_pin');

    const opName = loginOperatorInput ? loginOperatorInput.value.trim() : '';
    if (opName) {
      state.operatorName = opName;
      localStorage.setItem('comfamiliar_operator_name', opName);
      if (topOperatorInput) topOperatorInput.value = opName;
    }

    if (VALID_PINS.includes(enteredPin) || (customPin && enteredPin === customPin)) {
      sessionStorage.setItem('comfamiliar_admin_auth', 'true');
      state.isAuthenticated = true;
      loginError.style.display = 'none';
      checkAuthentication();
    } else {
      loginError.style.display = 'block';
      pinInput.value = '';
      pinInput.focus();
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
    if (tabBtnMain) tabBtnMain.addEventListener('click', () => switchTab('main'));
    if (tabBtnAnalytics) tabBtnAnalytics.addEventListener('click', () => switchTab('analytics'));
    if (tabBtnManagement) tabBtnManagement.addEventListener('click', () => switchTab('management'));
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    
    [tabBtnMain, tabBtnAnalytics, tabBtnManagement].forEach(btn => { if(btn) btn.classList.remove('active'); });
    [tabContentMain, tabContentAnalytics, tabContentManagement].forEach(content => { if(content) content.style.display = 'none'; });

    if (tabName === 'main') {
      if(tabBtnMain) tabBtnMain.classList.add('active');
      if(tabContentMain) tabContentMain.style.display = 'block';
      if (state.map) setTimeout(() => state.map.invalidateSize(), 150);
    } else if (tabName === 'analytics') {
      if(tabBtnAnalytics) tabBtnAnalytics.classList.add('active');
      if(tabContentAnalytics) tabContentAnalytics.style.display = 'block';
      renderAnalyticsDashboard();
    } else if (tabName === 'management') {
      if(tabBtnManagement) tabBtnManagement.classList.add('active');
      if(tabContentManagement) tabContentManagement.style.display = 'block';
      renderManagementDashboard();
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
    renderDashboard();

    fetchLiveReportsFromSheets(true);

    if (state.refreshInterval) clearInterval(state.refreshInterval);
    state.refreshInterval = setInterval(() => {
      fetchLiveReportsFromSheets(true);
    }, 12000);

    if (filterSearch) filterSearch.addEventListener('input', applyFilters);
    if (filterApoyo) filterApoyo.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterMunicipio) filterMunicipio.addEventListener('change', applyFilters);
    if (btnExportExcelMain) btnExportExcelMain.addEventListener('click', () => exportAllToExcel());
    if (btnExportFilteredExcel) btnExportFilteredExcel.addEventListener('click', () => exportFilteredToExcel());

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

  function normalizeStr(str) {
    return (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  function preprocessReports(list) {
    return list.map(r => {
      r._nNombre = normalizeStr(r.nombre);
      r._nDoc = normalizeStr(r.documento || r.cedula);
      r._nSede = normalizeStr(r.sede);
      r._nProceso = normalizeStr(r.proceso);
      r._nApoyo = normalizeStr(r.situacionYApoyo);
      r._nStatus = normalizeStr(r.criticidad);
      r._nMuni = normalizeStr(r.municipio);

      const doc = r.documento || r.cedula;
      if (r.gestionStatus && !state.supportManagement[doc]) {
        state.supportManagement[doc] = {
          status: r.gestionStatus || 'pendiente',
          notes: r.gestionNotes || '',
          updatedAt: r.gestionUpdatedAt || '',
          operator: r.gestionOperator || 'Operador SST'
        };
      }

      return r;
    });
  }

  function loadMockAndLocalReports() {
    const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
    const mockReports = window.INITIAL_MOCK_REPORTS || [];
    
    const mapReports = new Map();
    localReports.forEach(r => {
      if (r.documento) mapReports.set(String(r.documento).trim(), r);
    });
    mockReports.forEach(r => {
      if (r.documento && !mapReports.has(String(r.documento).trim())) {
        mapReports.set(String(r.documento).trim(), r);
      }
    });

    state.reports = preprocessReports(Array.from(mapReports.values()));
    applyFilters();
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
      remoteReports.forEach(r => {
        if (r.documento) mapReports.set(String(r.documento).trim(), r);
      });
    }

    const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
    localReports.forEach(r => {
      if (r.documento && !mapReports.has(String(r.documento).trim())) {
        mapReports.set(String(r.documento).trim(), r);
      }
    });

    const mockReports = window.INITIAL_MOCK_REPORTS || [];
    mockReports.forEach(r => {
      if (r.documento && !mapReports.has(String(r.documento).trim())) {
        mapReports.set(String(r.documento).trim(), r);
      }
    });

    state.reports = preprocessReports(Array.from(mapReports.values()));
    applyFilters();

    if (sheetsStatus) {
      if (remoteReports.length > 0) {
        sheetsStatus.innerHTML = `<span style="color:var(--success)">🟢 Sincronizado en Vivo: ${remoteReports.length} registros leídos de Google Sheets (${new Date().toLocaleTimeString()}). Total en Tablero: ${state.reports.length}</span>`;
      } else {
        sheetsStatus.innerHTML = `<span style="color:var(--warning)">⚠️ Conectado a Google Sheets, mostrando ${state.reports.length} reportes locales.</span>`;
      }
    }
  };

  function fetchLiveReportsFromSheets(isBackground = false) {
    if (!state.googleSheetsUrl) return;

    if (!navigator.onLine) {
      if (!isBackground && sheetsStatus) {
        sheetsStatus.innerHTML = '<span style="color:var(--danger)">📶 Sin conexión a Internet temporalmente. Mostrando reportes en memoria.</span>';
      }
      return;
    }

    if (!isBackground && sheetsStatus) {
      sheetsStatus.innerHTML = '⌛ Consultando en vivo a Google Sheets...';
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
      if (!isBackground && sheetsStatus) {
        sheetsStatus.innerHTML = '<span style="color:var(--text-muted)">ℹ️ Conexión interrumpida o fuera de línea. Se reintentará automáticamente.</span>';
      }
    };

    document.body.appendChild(script);
  }

  function renderDashboard() {
    updateKPIs();
    renderTable();
    
    // Siempre actualizamos la analítica y los KPIs de gestión para asegurar visibilidad inmediata
    renderManagementDashboard();

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

    const elTotal = document.getElementById('kpi-total');
    const elSalvo = document.getElementById('kpi-salvo');
    const elLeve = document.getElementById('kpi-leve');
    const elUrgente = document.getElementById('kpi-urgente');
    const elVivienda = document.getElementById('kpi-vivienda');

    if (elTotal) elTotal.textContent = total;
    if (elSalvo) elSalvo.textContent = salvo;
    if (elLeve) elLeve.textContent = leve;
    if (elUrgente) elUrgente.textContent = urgente;
    if (elVivienda) elVivienda.textContent = sinLugar;
  }

  function getBestPhoneNumber(r) {
    return r.telefono || r.telefonoBase || r.celular || r.contactoEmergencia || r.contacto || '';
  }

  function renderManagementDashboard() {
    const tbody = document.getElementById('mgmt-reports-tbody');
    
    let countPsico = 0, countPsicoPend = 0, countPsicoProc = 0, countPsicoRes = 0;
    let countSocial = 0, countSocialPend = 0, countSocialProc = 0, countSocialRes = 0;
    let countMeds = 0, countMedsPend = 0, countMedsProc = 0, countMedsRes = 0;
    let countAlimentos = 0, countAlimentosPend = 0, countAlimentosProc = 0, countAlimentosRes = 0;
    let countResueltos = 0;

    state.reports.forEach(r => {
      const ap = r._nApoyo || normalizeStr(r.situacionYApoyo || '');
      const doc = r.documento || r.cedula;
      const mgmt = state.supportManagement[doc] || { status: 'pendiente' };

      if (!ap.includes('estoy bien y seguro')) {
        if (ap.includes('psico')) {
          countPsico++;
          if (mgmt.status === 'resuelto') countPsicoRes++;
          else if (mgmt.status === 'proceso') countPsicoProc++;
          else countPsicoPend++;
        }
        if (ap.includes('social')) {
          countSocial++;
          if (mgmt.status === 'resuelto') countSocialRes++;
          else if (mgmt.status === 'proceso') countSocialProc++;
          else countSocialPend++;
        }
        if (ap.includes('medicament') || ap.includes('salud') || ap.includes('receta')) {
          countMeds++;
          if (mgmt.status === 'resuelto') countMedsRes++;
          else if (mgmt.status === 'proceso') countMedsProc++;
          else countMedsPend++;
        }
        if (ap.includes('aliment') || ap.includes('kit') || ap.includes('mercado')) {
          countAlimentos++;
          if (mgmt.status === 'resuelto') countAlimentosRes++;
          else if (mgmt.status === 'proceso') countAlimentosProc++;
          else countAlimentosPend++;
        }
        if (mgmt.status === 'resuelto') countResueltos++;
      }
    });

    const elPsico = document.getElementById('mgmt-kpi-psico');
    const elSocial = document.getElementById('mgmt-kpi-social');
    const elMeds = document.getElementById('mgmt-kpi-meds');
    const elAlimentos = document.getElementById('mgmt-kpi-alimentos');
    const elResueltos = document.getElementById('mgmt-kpi-resueltos');

    if (elPsico) elPsico.textContent = countPsico;
    if (elSocial) elSocial.textContent = countSocial;
    if (elMeds) elMeds.textContent = countMeds;
    if (elAlimentos) elAlimentos.textContent = countAlimentos;
    if (elResueltos) elResueltos.textContent = countResueltos;

    const makeBreakdownHTML = (pend, proc, res) => `
      <span class="badge-kpi-pend" title="Pendientes por contactar">🟡 ${pend} Pend.</span>
      <span class="badge-kpi-proc" title="En proceso / gestión">🔵 ${proc} Proc.</span>
      <span class="badge-kpi-res" title="Entregados / Resueltos">🟢 ${res} Res.</span>
    `;

    const elPsicoBd = document.getElementById('mgmt-kpi-psico-breakdown');
    const elSocialBd = document.getElementById('mgmt-kpi-social-breakdown');
    const elMedsBd = document.getElementById('mgmt-kpi-meds-breakdown');
    const elAlimentosBd = document.getElementById('mgmt-kpi-alimentos-breakdown');
    const elResueltosBd = document.getElementById('mgmt-kpi-resueltos-breakdown');

    if (elPsicoBd) elPsicoBd.innerHTML = makeBreakdownHTML(countPsicoPend, countPsicoProc, countPsicoRes);
    if (elSocialBd) elSocialBd.innerHTML = makeBreakdownHTML(countSocialPend, countSocialProc, countSocialRes);
    if (elMedsBd) elMedsBd.innerHTML = makeBreakdownHTML(countMedsPend, countMedsProc, countMedsRes);
    if (elAlimentosBd) elAlimentosBd.innerHTML = makeBreakdownHTML(countAlimentosPend, countAlimentosProc, countAlimentosRes);
    if (elResueltosBd) elResueltosBd.innerHTML = `<span class="badge-kpi-res" style="width:100%; justify-content:center;">🎉 ${countResueltos} Casos Resueltos</span>`;

    if (!tbody) return;

    const elStatus = document.getElementById('mgmt-filter-status');
    const elCat = document.getElementById('mgmt-filter-category');

    const currentOperator = topOperatorInput ? topOperatorInput.value.trim() : state.operatorName;
    const statusFilter = elStatus ? elStatus.value : 'activos';
    const catFilter = normalizeStr(elCat ? elCat.value : 'all');

    const supportReports = state.reports.filter(r => {
      const ap = r._nApoyo || normalizeStr(r.situacionYApoyo || '');
      const doc = r.documento || r.cedula;
      const mgmt = state.supportManagement[doc] || { status: 'pendiente', notes: '' };

      const isApoyo = !ap.includes('estoy bien y seguro');

      let matchStatus = false;
      if (statusFilter === 'activos') {
        matchStatus = mgmt.status !== 'resuelto';
      } else if (statusFilter === 'all') {
        matchStatus = true;
      } else {
        matchStatus = mgmt.status === statusFilter;
      }

      const matchCat = catFilter === 'all' || ap.includes(catFilter);

      return isApoyo && matchStatus && matchCat;
    });

    if (supportReports.length === 0) {
      const emptyMsg = statusFilter === 'activos'
        ? `🎉 ¡Excelente! No hay casos de apoyos pendientes por atender. Todos han sido resueltos.`
        : `💚 No se encontraron solicitudes con los filtros seleccionados.`;
      
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:28px; color:var(--success); font-weight:700; font-size:1rem;">${emptyMsg}</td></tr>`;
      return;
    }

    tbody.innerHTML = supportReports.map(r => {
      const doc = r.documento || r.cedula;
      const mgmt = state.supportManagement[doc] || { status: 'pendiente', notes: '', operator: 'Operador SST' };

      const isTakenByOther = mgmt.status === 'proceso' && mgmt.operator && mgmt.operator !== currentOperator;
      const isTakenByMe = mgmt.status === 'proceso' && mgmt.operator === currentOperator;

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
        concurrencyLockHTML = `<div class="case-locked-badge" style="background:#D1FAE5; color:#065F46; border-color:#86EFAC;">✋ En atención por TI</div>`;
      } else {
        concurrencyLockHTML = `<button onclick="window.claimCase('${doc}')" class="btn-claim-case">✋ Tomar Caso</button>`;
      }

      const rowStyle = isTakenByOther ? 'background-color: rgba(224, 242, 254, 0.4);' : '';

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
            <select id="mgmt-select-${doc}" class="mgmt-status-select ${mgmt.status}">
              <option value="pendiente" ${mgmt.status === 'pendiente' ? 'selected' : ''}>🟡 Pendiente por Contactar</option>
              <option value="proceso" ${mgmt.status === 'proceso' ? 'selected' : ''}>🔵 En Gestión / En Proceso</option>
              <option value="resuelto" ${mgmt.status === 'resuelto' ? 'selected' : ''}>🟢 Apoyo Entregado / Resuelto</option>
            </select>
          </td>
          <td>
            <input type="text" id="mgmt-notes-${doc}" class="mgmt-notes-input" placeholder="Ej: Se entregó kit / Derivado a Psicología" value="${mgmt.notes || ''}">
            <div style="margin-top:4px;">${concurrencyLockHTML}</div>
          </td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              <button onclick="window.saveSupportCase('${doc}')" class="mgmt-save-btn">💾 Guardar</button>
              ${whatsappBtn}
              ${callBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function exportManagementMatrixToExcel() {
    const supportReports = state.reports.filter(r => !r._nApoyo.includes('estoy bien y seguro'));

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
      const doc = r.documento || r.cedula;
      const mgmt = state.supportManagement[doc] || { status: 'pendiente', notes: '', updatedAt: '', operator: 'Operador SST' };
      const statusLabel = mgmt.status === 'resuelto' ? '🟢 APOYO ENTREGADO / RESUELTO' : mgmt.status === 'proceso' ? '🔵 EN GESTIÓN' : '🟡 PENDIENTE POR CONTACTAR';
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
          <td class="${mgmt.status}">${statusLabel}</td>
          <td>${mgmt.notes || ''}</td>
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

  function applyFilters() {
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

    renderDashboard();
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

    tableHtml += `</tbody>mtable></body></html>`;

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
});
