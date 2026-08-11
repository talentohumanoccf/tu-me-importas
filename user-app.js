/**
 * PORTAL DEL EMPLEADO - FORMULARIO OFICIAL CON DIRECCIÓN Y TELÉFONO LIMPIOS PARA ACTUALIZACIÓN
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyNJliFTyGi0a5ehJP2XEhYcC_1rJG_bicc39qfBhXXQKdGmvMH_lw2RLcLqFA0u3a2/exec';

  const state = {
    documento: '',
    employee: null,
    situacionYApoyo: 'Estoy bien y seguro',
    afectacionVivienda: 'No presenta afectaciones',
    lugarSeguro: 'Si',
    estadoFamilia: 'Todos se encuentran bien',
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
  
  const formSection = document.getElementById('user-form-section');
  const successSection = document.getElementById('user-success-section');

  const gpsBtn = document.getElementById('btn-user-gps');
  const gpsStatus = document.getElementById('user-gps-status');

  const reportForm = document.getElementById('user-report-form');
  const btnReset = document.getElementById('btn-user-reset');

  setupTouchOptions();

  btnVerifyCC.addEventListener('click', handleCCLookupInstant);
  ccInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleCCLookupInstant();
  });

  function handleCCLookupInstant() {
    const doc = ccInput.value.trim();
    if (!doc || doc.length < 5) {
      alert('⚠️ Por favor digita tu número de documento o cédula.');
      return;
    }

    state.documento = doc;

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

    // Desbloquear formulario tras verificar cédula
    greetingBox.style.display = 'block';
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
  }

  function applyEmployeeData(found) {
    state.employee = found;
    const fullName = found.nombre || 'Colaborador';
    
    empName.textContent = `¡Hola, ${fullName}! 👋`;
    
    const cargoText = found.cargo ? `${found.cargo} ${found.proceso ? '• ' + found.proceso : ''}` : 'Colaborador Comfamiliar';
    const sedeText = found.sede ? `🏢 Sede Registrada: ${found.sede}` : '🏢 Comfamiliar Risaralda';
    
    empMeta.innerHTML = `<strong>${cargoText}</strong><br>${sedeText}`;

    // Nombre y Correo precompletados
    const nombreInput = document.getElementById('user-nombre-input');
    if (nombreInput) nombreInput.value = found.nombre || '';

    const emailInput = document.getElementById('user-email-input');
    if (emailInput) emailInput.value = found.email || '';

    // SE DEJAN LIMPIOS Y VACÍOS PARA FORZAR QUE EL USUARIO DILIGENCIE DIRECCIÓN Y TELÉFONO EN VIVO
    const phoneInput = document.getElementById('user-phone-input');
    if (phoneInput) phoneInput.value = '';

    const dirInput = document.getElementById('user-direccion-input');
    if (dirInput) dirInput.value = '';

    const muniInput = document.getElementById('user-municipio-input');
    if (muniInput) muniInput.value = '';

    const emergenciaInput = document.getElementById('user-contacto-emergencia-input');
    if (emergenciaInput) emergenciaInput.value = '';
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

  gpsBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      gpsStatus.textContent = '❌ GPS no disponible en este dispositivo.';
      return;
    }
    gpsStatus.textContent = '📡 Conectando a satélites GPS...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        gpsStatus.innerHTML = `<b style="color:var(--secondary)">📍 Ubicación GPS capturada correctamente</b>`;
      },
      () => {
        gpsStatus.textContent = '⚠️ No se pudo obtener GPS. Puedes continuar sin él.';
      },
      { timeout: 8000 }
    );
  });

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

    const report = {
      id: 'rep-' + Date.now(),
      timestamp: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
      documento: state.documento,
      cedula: state.documento,
      nombre: document.getElementById('user-nombre-input').value.trim() || emp.nombre || 'No especificado',
      cargo: emp.cargo || 'Comfamiliar Risaralda',
      emailPersonal: document.getElementById('user-email-input').value.trim() || emp.email || '',
      contrato: emp.contrato || '',
      proceso: emp.proceso || '',
      area: emp.area || '',
      sexo: emp.sexo || '',
      sede: emp.sede || 'Comfamiliar',
      telefono: document.getElementById('user-phone-input').value.trim() || '',
      contactoEmergencia: document.getElementById('user-contacto-emergencia-input').value.trim() || '',
      direccion: document.getElementById('user-direccion-input').value.trim() || '',
      municipio: document.getElementById('user-municipio-input').value.trim() || '',
      tipoSangre: document.getElementById('user-sangre-select').value,
      saludFisicaEmocional: document.getElementById('user-salud-textarea').value.trim() || 'Sin detalles',
      situacionYApoyo: state.situacionYApoyo,
      personasHogar: document.getElementById('user-personas-select').value,
      tipoVivienda: document.getElementById('user-tipovivienda-select').value,
      afectacionVivienda: state.afectacionVivienda,
      lugarSeguro: state.lugarSeguro,
      estadoFamilia: state.estadoFamilia,
      presencialidadObligatoria: document.getElementById('user-presencialidad-select').value,
      condicionesOptimas: document.getElementById('user-condiciones-select').value,
      herramientasTrabajo: document.getElementById('user-herramientas-select').value,
      latitud: state.gps ? state.gps.lat : '',
      longitud: state.gps ? state.gps.lng : '',
      criticidad: criticidad,
      origen: 'Formulario Oficial Web'
    };

    const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
    localReports.unshift(report);
    localStorage.setItem('comfamiliar_emergency_reports', JSON.stringify(localReports));

    if (state.googleSheetsUrl && navigator.onLine) {
      try {
        fetch(state.googleSheetsUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(report)
        }).catch(err => console.log('Envío en proceso background'));
      } catch(err) {
        console.log('Guardado localmente');
      }
    }

    formSection.style.display = 'none';
    successSection.style.display = 'block';
    successSection.scrollIntoView({ behavior: 'smooth' });
  });

  btnReset.addEventListener('click', () => {
    location.reload();
  });
});
