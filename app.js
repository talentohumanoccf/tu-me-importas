/**
 * PANEL DE ADMINISTRACIÓN SST - COMFAMILIAR RISARALDA
 * Filtro de Situación y Apoyo Requerido con Exportador Filtrado a Excel/CSV
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyNJliFTyGi0a5ehJP2XEhYcC_1rJG_bicc39qfBhXXQKdGmvMH_lw2RLcLqFA0u3a2/exec';
  const VALID_PINS = ['2026', 'comfamiliar2026', 'sst2026'];

  const state = {
    isAuthenticated: sessionStorage.getItem('comfamiliar_admin_auth') === 'true',
    reports: [],
    filteredReports: [],
    map: null,
    markers: [],
    googleSheetsUrl: localStorage.getItem('comfamiliar_sheets_url') || DEFAULT_SHEETS_URL,
    refreshInterval: null,
    activeTab: 'main'
  };

  const loginScreen = document.getElementById('admin-login-screen');
  const loginForm = document.getElementById('admin-login-form');
  const pinInput = document.getElementById('admin-pin-input');
  const loginError = document.getElementById('login-error-msg');
  
  const mainContent = document.getElementById('admin-main-content');
  const btnLockAdmin = document.getElementById('btn-lock-admin');
  const btnChangePin = document.getElementById('btn-change-pin');

  const tabBtnMain = document.getElementById('tab-btn-main');
  const tabBtnAnalytics = document.getElementById('tab-btn-analytics');
  const tabContentMain = document.getElementById('tab-content-main');
  const tabContentAnalytics = document.getElementById('tab-content-analytics');
  
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
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportFilteredCsv = document.getElementById('btn-export-filtered-csv');

  setupTabsNavigation();
  checkAuthentication();

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredPin = pinInput.value.trim();
    const customPin = localStorage.getItem('comfamiliar_admin_pin');

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

  if (btnChangePin) {
    btnChangePin.addEventListener('click', () => {
      const newPin = prompt('🔑 Ingresa el nuevo PIN de seguridad para el Panel SST (mínimo 4 dígitos):');
      if (newPin && newPin.trim().length >= 4) {
        localStorage.setItem('comfamiliar_admin_pin', newPin.trim());
        alert('✅ Nuevo PIN configurado exitosamente.');
      }
    });
  }

  function setupTabsNavigation() {
    if (tabBtnMain && tabBtnAnalytics) {
      tabBtnMain.addEventListener('click', () => switchTab('main'));
      tabBtnAnalytics.addEventListener('click', () => switchTab('analytics'));
    }
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    if (tabName === 'main') {
      tabBtnMain.classList.add('active');
      tabBtnAnalytics.classList.remove('active');
      tabContentMain.style.display = 'block';
      tabContentAnalytics.style.display = 'none';
      if (state.map) setTimeout(() => state.map.invalidateSize(), 200);
    } else {
      tabBtnAnalytics.classList.add('active');
      tabBtnMain.classList.remove('active');
      tabContentAnalytics.style.display = 'block';
      tabContentMain.style.display = 'none';
      renderAnalyticsDashboard();
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
    }, 10000);

    if (filterSearch) filterSearch.addEventListener('input', applyFilters);
    if (filterApoyo) filterApoyo.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterMunicipio) filterMunicipio.addEventListener('change', applyFilters);
    if (btnExportCsv) btnExportCsv.addEventListener('click', exportToCSV);
    if (btnExportFilteredCsv) btnExportFilteredCsv.addEventListener('click', exportFilteredToCSV);

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

    state.reports = Array.from(mapReports.values());
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

    state.reports = Array.from(mapReports.values());
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
    updateMapMarkers();
    renderAnalyticsDashboard();
  }

  function updateKPIs() {
    const total = state.reports.length;
    const salvo = state.reports.filter(r => r.criticidad === 'verde').length;
    const leve = state.reports.filter(r => r.criticidad === 'amarillo').length;
    const urgente = state.reports.filter(r => r.criticidad === 'rojo').length;
    const sinLugar = state.reports.filter(r => r.lugarSeguro === 'No' || (r.afectacionVivienda && r.afectacionVivienda.includes('impiden'))).length;

    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-salvo').textContent = salvo;
    document.getElementById('kpi-leve').textContent = leve;
    document.getElementById('kpi-urgente').textContent = urgente;
    document.getElementById('kpi-vivienda').textContent = sinLugar;
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
      const count = state.filteredReports.filter(r => {
        const val = r[fieldName] || '';
        return val.toLowerCase().includes(opt.key.toLowerCase());
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

      const phoneClean = r.telefono ? r.telefono.replace(/\D/g, '') : '';
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
            <small style="color:var(--text-muted)">🏠 Vivienda: ${r.afectacionVivienda || 'Normal'}<br>👨‍👩‍👧‍👦 Familia: ${estadoFamiliaText}</small>
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
      marker.bindPopup(`
        <div style="font-family:sans-serif; padding:4px;">
          <strong style="color:#003366">${r.nombre}</strong><br>
          <small>CC: ${r.documento} • Sangre: ${r.tipoSangre || 'N/A'}</small><br>
          <small><b>Situación:</b> ${r.situacionYApoyo || 'Bien'}</small><br>
          <small><b>Teléfono:</b> ${r.telefono || 'Sin tel'}</small>
        </div>
      `);

      state.markers.push(marker);
    });
  }

  function applyFilters() {
    const q = filterSearch ? filterSearch.value.toLowerCase().trim() : '';
    const ap = filterApoyo ? filterApoyo.value : 'all';
    const st = filterStatus ? filterStatus.value : 'all';
    const mun = filterMunicipio ? filterMunicipio.value : 'all';

    state.filteredReports = state.reports.filter(r => {
      const matchSearch = !q || 
        (r.nombre && r.nombre.toLowerCase().includes(q)) ||
        (r.documento && r.documento.includes(q)) ||
        (r.sede && r.sede.toLowerCase().includes(q)) ||
        (r.proceso && r.proceso.toLowerCase().includes(q));

      const matchApoyo = ap === 'all' || (r.situacionYApoyo && r.situacionYApoyo.toLowerCase().includes(ap.toLowerCase()));
      const matchStatus = st === 'all' || r.criticidad === st;
      const matchMun = mun === 'all' || (r.municipio && r.municipio.toLowerCase().includes(mun.toLowerCase()));

      return matchSearch && matchApoyo && matchStatus && matchMun;
    });

    renderDashboard();
  }

  function exportFilteredToCSV() {
    if (state.filteredReports.length === 0) {
      alert('⚠️ No hay reportes que coincidan con los filtros seleccionados para exportar.');
      return;
    }

    const filtroApoyoText = filterApoyo && filterApoyo.value !== 'all' ? filterApoyo.options[filterApoyo.selectedIndex].text : 'TodosLosApoyos';
    const cleanFileName = `Reporte_SST_Filtrado_${filtroApoyoText.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;

    exportDataToCSVFile(state.filteredReports, cleanFileName);
  }

  function exportToCSV() {
    if (state.reports.length === 0) {
      alert('⚠️ No hay reportes para exportar.');
      return;
    }
    const cleanFileName = `Reporte_General_Emergencia_Comfamiliar_${new Date().toISOString().slice(0,10)}.csv`;
    exportDataToCSVFile(state.reports, cleanFileName);
  }

  function exportDataToCSVFile(dataset, fileName) {
    const headers = [
      "Fecha y Hora", "Documento", "Nombre Completo", "Cargo", "Email Personal", "Contrato",
      "Proceso", "Área", "Sexo", "Sede", "Teléfono Contacto", "Contacto Emergencia",
      "Dirección Residencia Habitual", "Dirección Actual en Emergencia", "Municipio / Barrio", "Tipo de Sangre",
      "Situación y Apoyo Requerido", "Personas en Hogar", "Tipo Vivienda", "Afectación Vivienda",
      "Cuenta con Lugar Seguro", "Estado Grupo Familiar", "Presencialidad Obligatoria",
      "Condiciones Óptimas (Net/Energía)", "Herramientas Trabajo Completas", "Latitud GPS", "Longitud GPS", "Criticidad"
    ];

    const rows = dataset.map(r => [
      `"${r.timestamp || ''}"`,
      `"${r.documento || ''}"`,
      `"${r.nombre || ''}"`,
      `"${r.cargo || ''}"`,
      `"${r.emailPersonal || r.email || ''}"`,
      `"${r.contrato || ''}"`,
      `"${r.proceso || ''}"`,
      `"${r.area || ''}"`,
      `"${r.sexo || ''}"`,
      `"${r.sede || ''}"`,
      `"${r.telefono || ''}"`,
      `"${r.contactoEmergencia || ''}"`,
      `"${r.direccionResidencia || ''}"`,
      `"${r.direccionActual || r.direccion || ''}"`,
      `"${r.municipio || ''}"`,
      `"${r.tipoSangre || ''}"`,
      `"${r.situacionYApoyo || ''}"`,
      `"${r.personasHogar || ''}"`,
      `"${r.tipoVivienda || ''}"`,
      `"${r.afectacionVivienda || ''}"`,
      `"${r.lugarSeguro || ''}"`,
      `"${r.estadoFamilia || ''}"`,
      `"${r.presencialidadObligatoria || ''}"`,
      `"${r.condicionesOptimas || ''}"`,
      `"${r.herramientasTrabajo || ''}"`,
      `"${r.latitud || ''}"`,
      `"${r.longitud || ''}"`,
      `"${r.criticidad || ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
