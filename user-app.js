/**
 * PORTAL DEL EMPLEADO - LÓGICA CON MUESTRA DEL NOMBRE COMPLETO
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyNJliFTyGi0a5ehJP2XEhYcC_1rJG_bicc39qfBhXXQKdGmvMH_lw2RLcLqFA0u3a2/exec';

  const state = {
    documento: '',
    employee: null,
    salud: 'bien',
    familia: 'bien',
    vivienda: 'bien',
    municipio: 'Pereira',
    direccion: '',
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
        telefono: ""
      });

      if (state.googleSheetsUrl && navigator.onLine) {
        fetchJSONPBasePX(doc);
      }
    }

    greetingBox.style.display = 'block';
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
  }

  function applyEmployeeData(found) {
    state.employee = found;
    const fullName = found.nombre || 'Colaborador';
    
    // MOSTRAR NOMBRE COMPLETO SIN RECORTAR
    empName.textContent = `¡Hola, ${fullName}! 👋`;
    
    const cargoText = found.cargo ? `${found.cargo} ${found.proceso ? '• ' + found.proceso : ''}` : 'Colaborador Comfamiliar';
    const sedeText = found.sede ? `🏢 Sede: ${found.sede}` : '🏢 Comfamiliar Risaralda';
    const modeloText = found.modeloTrabajo ? ` • ${found.modeloTrabajo}` : '';
    
    empMeta.innerHTML = `<strong>${cargoText}</strong><br>${sedeText}${modeloText}`;

    const phoneInput = document.getElementById('user-phone-input');
    if (phoneInput && found.telefono && !phoneInput.value) {
      phoneInput.value = found.telefono;
    }

    const dirInput = document.getElementById('user-direccion-input');
    if (dirInput && found.direccion && !dirInput.value) {
      dirInput.value = found.direccion;
    }

    if (found.municipio) {
      const muniSelect = document.getElementById('user-municipio-select');
      if (muniSelect) {
        for (let opt of muniSelect.options) {
          if (opt.value.toLowerCase() === found.municipio.toLowerCase()) {
            muniSelect.value = opt.value;
            break;
          }
        }
      }
    }
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

    const emp = state.employee;
    let criticidad = 'verde';
    if (state.salud === 'emergencia_grave' || state.familia === 'emergencia_grave' || state.vivienda === 'inhabitable' || state.vivienda === 'colapso_total') {
      criticidad = 'rojo';
    } else if (state.salud === 'lesion_leve' || state.familia === 'afectados_menores' || state.familia === 'incomunicados' || state.vivienda === 'daños_menores') {
      criticidad = 'amarillo';
    }

    const report = {
      id: 'rep-' + Date.now(),
      timestamp: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
      documento: state.documento,
      cedula: state.documento,
      nombre: emp.nombre,
      cargo: emp.cargo,
      email: emp.email || '',
      contrato: emp.contrato || '',
      proceso: emp.proceso || '',
      area: emp.area || '',
      sexo: emp.sexo || '',
      sede: emp.sede || 'Comfamiliar',
      telefonoBase: emp.telefono || '',
      direccionBase: emp.direccion || '',
      municipioBase: emp.municipio || '',
      modeloTrabajo: emp.modeloTrabajo || '',
      estadoSalud: state.salud,
      estadoFamilia: state.familia,
      estadoVivienda: state.vivienda,
      municipio: document.getElementById('user-municipio-select').value,
      direccion: document.getElementById('user-direccion-input').value.trim() || 'No especificada',
      telefono: document.getElementById('user-phone-input')?.value || emp.telefono || 'Sin teléfono',
      latitud: state.gps ? state.gps.lat : '',
      longitud: state.gps ? state.gps.lng : '',
      necesidades: ['Reporte Exprés de Usuario'],
      observaciones: document.getElementById('user-obs-textarea').value.trim() || 'Sin observaciones',
      criticidad: criticidad,
      origen: 'Portal Usuario BASE_PX'
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
