/**
 * PORTAL DEL EMPLEADO - LÓGICA CON MANEJO ROBULSTO DE CORS Y ORIGEN LOCAL (file://)
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

  btnVerifyCC.addEventListener('click', handleCCLookup);
  ccInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleCCLookup();
  });

  async function handleCCLookup() {
    const doc = ccInput.value.trim();
    if (!doc || doc.length < 5) {
      alert('⚠️ Por favor digita un número de documento o cédula válido.');
      return;
    }

    state.documento = doc;
    btnVerifyCC.textContent = '⏳ Buscando...';
    btnVerifyCC.disabled = true;

    // 1. Buscar primero en la Base de Datos Local
    let found = window.MOCK_EMPLOYEES_DB ? window.MOCK_EMPLOYEES_DB[doc] : null;

    // 2. Si no está en la base local y hay conexión a internet, intentar consultar Google Sheets
    if (!found && state.googleSheetsUrl && navigator.onLine) {
      try {
        const fetchUrl = `${state.googleSheetsUrl}?documento=${encodeURIComponent(doc)}`;
        const response = await fetch(fetchUrl, {
          method: 'GET',
          redirect: 'follow'
        });
        if (response.ok) {
          const result = await response.json();
          if (result.status === 'found' && result.data) {
            found = result.data;
          }
        }
      } catch (err) {
        // En entorno file:// los navegadores bloquean lecturas GET por CORS.
        // Se maneja silenciosamente continuando con el registro.
        console.log('📌 Usando registro de documento para el reporte.');
      }
    }

    btnVerifyCC.textContent = 'Ingresar';
    btnVerifyCC.disabled = false;

    if (found) {
      state.employee = found;
      const firstName = (found.nombre || 'Colaborador').split(' ')[0];
      empName.textContent = `¡Hola, ${firstName}! 👋`;
      
      const cargoText = found.cargo ? `${found.cargo} • ${found.proceso || found.area || ''}` : 'Colaborador Comfamiliar';
      const sedeText = found.sede ? `🏢 Sede: ${found.sede}` : '🏢 Comfamiliar Risaralda';
      const modeloText = found.modeloTrabajo ? ` • ${found.modeloTrabajo}` : '';
      
      empMeta.innerHTML = `<strong>${cargoText}</strong><br>${sedeText}${modeloText}`;

      const phoneInput = document.getElementById('user-phone-input');
      if (phoneInput && found.telefono) phoneInput.value = found.telefono;

      const dirInput = document.getElementById('user-direccion-input');
      if (dirInput && found.direccion) dirInput.value = found.direccion;

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

    } else {
      state.employee = {
        documento: doc,
        cedula: doc,
        nombre: `Colaborador (${doc})`,
        cargo: "Comfamiliar Risaralda",
        sede: "Eje Cafetero",
        proceso: "General",
        telefono: ""
      };
      empName.textContent = `¡Hola! Bienvenido(a) Colaborador.`;
      empMeta.textContent = `Documento ${doc} registrado para el reporte de emergencia.`;
    }

    greetingBox.style.display = 'block';
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
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

    // 1. Guardar siempre en LocalStorage (Instantáneo y sin errores)
    const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
    localReports.unshift(report);
    localStorage.setItem('comfamiliar_emergency_reports', JSON.stringify(localReports));

    // 2. Enviar a Google Sheets con compatibilidad total para file:// y Web (sin errores CORS)
    if (state.googleSheetsUrl && navigator.onLine) {
      try {
        fetch(state.googleSheetsUrl, {
          method: 'POST',
          mode: 'no-cors', // Evita bloqueo CORS al enviar datos desde archivos locales
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
