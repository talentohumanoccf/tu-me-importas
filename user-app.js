/**
 * PORTAL DEL EMPLEADO - FORMULARIO OFICIAL CON FALLBACK DE SINCRO ULTRA-RESISTENTE
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyNJliFTyGi0a5ehJP2XEhYcC_1rJG_bicc39qfBhXXQKdGmvMH_lw2RLcLqFA0u3a2/exec';

  const state = {
    documento: '',
    employee: null,
    isPreviousReport: false,
    situacionYApoyo: 'Estoy bien y seguro',
    afectacionVivienda: 'No presenta afectaciones',
    lugarSeguro: 'Si',
    estadoFamilia: 'Todos se encuentran bien',
    presencialidadObligatoria: 'Sí',
    condicionesOptimas: 'Sí',
    herramientasTrabajo: 'Sí',
    personasHogar: '1',
    tipoVivienda: 'Propia',
    gps: null,
    googleSheetsUrl: localStorage.getItem('comfamiliar_sheets_url') || DEFAULT_SHEETS_URL
  };

  if (!localStorage.getItem('comfamiliar_sheets_url')) {
    localStorage.setItem('comfamiliar_sheets_url', DEFAULT_SHEETS_URL);
  }

  const ccInput = document.getElementById('user-cc-input');
  const btnVerifyCC = document.getElementById('btn-verify-cc');
  const greetingBox = document.getElementById('user-greeting-box');
  const empName = document.getElementById('user-emp-name');
  const empMeta = document.getElementById('user-emp-meta');
  const duplicateWarning = document.getElementById('user-duplicate-warning');
  
  const formSection = document.getElementById('user-form-section');
  const successSection = document.getElementById('user-success-section');

  const gpsBtn = document.getElementById('btn-user-gps');
  const gpsStatus = document.getElementById('user-gps-status');

  const reportForm = document.getElementById('user-report-form');
  const btnReset = document.getElementById('btn-user-reset');

  setupTouchOptions();

  if (btnVerifyCC) btnVerifyCC.addEventListener('click', handleCCLookupInstant);
  if (ccInput) {
    ccInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handleCCLookupInstant();
    });
  }

  function getValue(id, fallback = '') {
    const el = document.getElementById(id);
    return (el && el.value !== undefined && el.value !== null) ? el.value.trim() : fallback;
  }

  function handleCCLookupInstant() {
    if (!ccInput) return;
    const doc = ccInput.value.trim();
    if (!doc || doc.length < 5) {
      alert('⚠️ Por favor digita tu número de documento o cédula.');
      return;
    }

    state.documento = doc;

    const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
    const prevReport = localReports.find(r => r.documento === doc || r.cedula === doc);
    
    if (prevReport) {
      state.isPreviousReport = true;
      if (duplicateWarning) duplicateWarning.style.display = 'block';
    } else {
      state.isPreviousReport = false;
      if (duplicateWarning) duplicateWarning.style.display = 'none';
    }

    const foundLocal = window.MOCK_EMPLOYEES_DB ? window.MOCK_EMPLOYEES_DB[doc] : null;

    if (foundLocal) {
      applyEmployeeData(foundLocal);
    } else {
      applyEmployeeData({
        documento: doc,
        cedula: doc,
        nombre: `Colaborador (${doc})`,
        cargo: "Comfamiliar Risaralda",
        sede: "Eje Cafetero",
        proceso: "General",
        email: ""
      });

      if (state.googleSheetsUrl && navigator.onLine) {
        fetchJSONPBasePX(doc);
      }
    }

    if (greetingBox) greetingBox.style.display = 'block';
    if (formSection) {
      formSection.style.display = 'block';
      formSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function applyEmployeeData(found) {
    state.employee = found;
    const fullName = found.nombre || 'Colaborador';
    
    if (empName) empName.textContent = `¡Hola, ${fullName}! 👋`;
    
    const cargoText = found.cargo ? `${found.cargo} ${found.proceso ? '• ' + found.proceso : ''}` : 'Colaborador Comfamiliar';
    const sedeText = found.sede ? `🏢 Sede Registrada: ${found.sede}` : '🏢 Comfamiliar Risaralda';
    
    if (empMeta) empMeta.innerHTML = `<strong>${cargoText}</strong><br>${sedeText}`;

    const nombreInput = document.getElementById('user-nombre-input');
    if (nombreInput) nombreInput.value = found.nombre || '';

    const emailInput = document.getElementById('user-email-input');
    if (emailInput) emailInput.value = found.email || '';

    const dirInput = document.getElementById('user-direccion-input');
    if (dirInput && found.direccion && !dirInput.value) {
      dirInput.value = found.direccion;
    }

    const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
    const prevReport = localReports.find(r => r.documento === found.documento);

    const dirActualInput = document.getElementById('user-direccion-actual-input');
    if (dirActualInput) dirActualInput.value = prevReport ? prevReport.direccionActual || '' : '';

    const phoneInput = document.getElementById('user-phone-input');
    if (phoneInput) phoneInput.value = prevReport ? prevReport.telefono || '' : '';

    const muniInput = document.getElementById('user-municipio-input');
    if (muniInput) muniInput.value = prevReport ? prevReport.municipio || '' : '';

    const emergenciaInput = document.getElementById('user-contacto-emergencia-input');
    if (emergenciaInput) emergenciaInput.value = prevReport ? prevReport.contactoEmergencia || '' : '';
  }

  window.onBasePXLookupResult = function(result) {
    if (result && result.status === 'found' && result.data) {
      applyEmployeeData(result.data);
    }
  };

  function fetchJSONPBasePX(doc) {
    const callbackName = 'onBasePXLookupResult';
    const scriptId = 'jsonp-base-px-lookup';
    
    const oldScript = document.getElementById(scriptId);
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${state.googleSheetsUrl}?documento=${encodeURIComponent(doc)}&callback=${callbackName}`;
    script.onerror = function() {
      console.log('Consulta en vivo no disponible en este momento.');
    };
    document.body.appendChild(script);
  }

  function setupTouchOptions() {
    document.querySelectorAll('.touch-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.getAttribute('data-group');
        const val = btn.getAttribute('data-value');

        document.querySelectorAll(`.touch-option-btn[data-group="${group}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        state[group] = val;
      });
    });
  }

  if (gpsBtn) {
    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        if (gpsStatus) gpsStatus.textContent = '❌ GPS no disponible en este dispositivo.';
        return;
      }
      if (gpsStatus) gpsStatus.textContent = '📡 Conectando a satélites GPS...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (gpsStatus) gpsStatus.innerHTML = `<b style="color:var(--secondary)">📍 Ubicación GPS capturada correctamente</b>`;
        },
        () => {
          if (gpsStatus) gpsStatus.textContent = '⚠️ No se pudo obtener GPS. Puedes continuar sin él.';
        },
        { timeout: 8000 }
      );
    });
  }

  if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!state.documento) {
        alert('⚠️ Por favor digita tu documento antes de enviar.');
        return;
      }

      const emp = state.employee || {};

      let criticidad = 'verde';
      if (
        state.situacionYApoyo.includes('medicamentos') ||
        state.situacionYApoyo.includes('alimentos') ||
        state.afectacionVivienda.includes('graves') ||
        state.afectacionVivienda.includes('NO me permiten') ||
        state.lugarSeguro === 'No' ||
        state.estadoFamilia.includes('lesionados') ||
        state.estadoFamilia.includes('atención médica') ||
        state.estadoFamilia.includes('Pérdida')
      ) {
        criticidad = 'rojo';
      } else if (
        state.situacionYApoyo.includes('psicológico') ||
        state.situacionYApoyo.includes('social') ||
        state.situacionYApoyo.includes('jurídico') ||
        state.afectacionVivienda.includes('menores') ||
        state.estadoFamilia.includes('leves') ||
        state.estadoFamilia.includes('psicosocial')
      ) {
        criticidad = 'amarillo';
      }

      const dirHabitual = getValue('user-direccion-input', emp.direccion || '');
      const dirActual = getValue('user-direccion-actual-input', '');

      const report = {
        id: 'rep-' + Date.now(),
        timestamp: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
        documento: state.documento,
        cedula: state.documento,
        nombre: getValue('user-nombre-input', emp.nombre || 'No especificado'),
        cargo: emp.cargo || 'Comfamiliar Risaralda',
        emailPersonal: getValue('user-email-input', emp.email || ''),
        contrato: emp.contrato || '',
        proceso: emp.proceso || '',
        area: emp.area || '',
        sexo: emp.sexo || '',
        sede: emp.sede || 'Comfamiliar',
        telefono: getValue('user-phone-input', ''),
        contactoEmergencia: getValue('user-contacto-emergencia-input', ''),
        direccionResidencia: dirHabitual,
        direccionActual: dirActual || dirHabitual,
        direccion: dirActual || dirHabitual,
        municipio: getValue('user-municipio-input', ''),
        tipoSangre: getValue('user-sangre-select', 'O+'),
        situacionYApoyo: state.situacionYApoyo,
        personasHogar: state.personasHogar,
        tipoVivienda: state.tipoVivienda,
        afectacionVivienda: state.afectacionVivienda,
        lugarSeguro: state.lugarSeguro,
        estadoFamilia: state.estadoFamilia,
        presencialidadObligatoria: state.presencialidadObligatoria,
        condicionesOptimas: state.condicionesOptimas,
        herramientasTrabajo: state.herramientasTrabajo,
        latitud: state.gps ? state.gps.lat : '',
        longitud: state.gps ? state.gps.lng : '',
        criticidad: criticidad,
        esActualizacion: state.isPreviousReport,
        origen: 'Formulario Oficial Web'
      };

      // Guardar localmente siempre
      let localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
      const existingIdx = localReports.findIndex(r => r.documento === state.documento);
      if (existingIdx >= 0) {
        localReports[existingIdx] = report;
      } else {
        localReports.unshift(report);
      }
      localStorage.setItem('comfamiliar_emergency_reports', JSON.stringify(localReports));

      // Sincronización Doble a Google Sheets (POST + Fallback)
      if (state.googleSheetsUrl && navigator.onLine) {
        sendReportToGoogleSheets(report);
      }

      if (formSection) formSection.style.display = 'none';
      if (successSection) {
        successSection.style.display = 'block';
        successSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  function sendReportToGoogleSheets(report) {
    try {
      fetch(state.googleSheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(report)
      }).catch(() => {
        // Fallback vía JSONP/GET si el navegador móvil restringe POST
        const script = document.createElement('script');
        script.src = `${state.googleSheetsUrl}?action=submitReport&payload=${encodeURIComponent(JSON.stringify(report))}`;
        document.body.appendChild(script);
      });
    } catch(err) {
      console.log('Sincronizando en segundo plano');
    }
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      location.reload();
    });
  }
});
