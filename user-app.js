/**
 * PORTAL DEL EMPLEADO - FORMULARIO OFICIAL
 * Verificación Inteligente de Cédula (Búsqueda en Caché de 1962 Registros + Consulta en Vivo)
 * Solución de Reconocimiento Inmediato sin Mensaje Falso de Advertencia
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
    familyTags: [],
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
  
  const existingFlowChoice = document.getElementById('user-existing-flow-choice');
  const btnFlowUpdate = document.getElementById('btn-flow-update');
  const btnFlowNovelty = document.getElementById('btn-flow-novelty');
  const noveltySection = document.getElementById('user-novelty-section');

  const novedadTexto = document.getElementById('user-novedad-texto');
  const novedadDireccion = document.getElementById('user-novedad-direccion');
  const btnNovedadGps = document.getElementById('btn-novedad-gps');
  const novedadGpsStatus = document.getElementById('user-novedad-gps-status');
  const btnSubmitNovedad = document.getElementById('btn-submit-novedad');
  
  const formSection = document.getElementById('user-form-section');
  const successSection = document.getElementById('user-success-section');
  const familySubbox = document.getElementById('family-detail-subbox');

  const gpsBtn = document.getElementById('btn-user-gps');
  const gpsStatus = document.getElementById('user-gps-status');

  const reportForm = document.getElementById('user-report-form');
  const btnReset = document.getElementById('btn-user-reset');

  state.currentFlow = 'new'; // 'new', 'update', 'novelty'
  state.noveltyGps = null;
  state.novedadNeeds = [];

  setupTouchOptions();
  setupFamilyTags();
  setupNoveltyFlowEvents();

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

  function setupNoveltyFlowEvents() {
    if (btnFlowUpdate) {
      btnFlowUpdate.addEventListener('click', () => {
        if (formSection) {
          formSection.style.display = 'block';
          formSection.scrollIntoView({ behavior: 'smooth' });
        }
        if (noveltySection) noveltySection.style.display = 'none';
        state.currentFlow = 'update';
      });
    }

    if (btnFlowNovelty) {
      btnFlowNovelty.addEventListener('click', () => {
        if (formSection) formSection.style.display = 'none';
        if (noveltySection) {
          noveltySection.style.display = 'block';
          noveltySection.scrollIntoView({ behavior: 'smooth' });
        }
        state.currentFlow = 'novelty';
        if (novedadTexto) novedadTexto.focus();
      });
    }

    if (btnNovedadGps) {
      btnNovedadGps.addEventListener('click', () => {
        if (!navigator.geolocation) {
          alert('⚠️ Tu navegador no soporta geolocalización GPS.');
          return;
        }
        if (novedadGpsStatus) novedadGpsStatus.innerHTML = '⌛ Obteniendo coordenadas exactas...';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            state.noveltyGps = {
              latitud: pos.coords.latitude,
              longitud: pos.coords.longitude
            };
            if (novedadGpsStatus) novedadGpsStatus.innerHTML = `<span style="color:var(--success)">📍 Ubicación capturada: Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}</span>`;
          },
          (err) => {
            if (novedadGpsStatus) novedadGpsStatus.innerHTML = `<span style="color:var(--danger)">⚠️ No se pudo obtener GPS (${err.message}).</span>`;
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    // Opciones táctiles para apoyos de novedad
    document.querySelectorAll('.touch-option-btn[data-group="novNeeds"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-value');
        btn.classList.toggle('selected');
        if (btn.classList.contains('selected')) {
          if (!state.novedadNeeds.includes(val)) {
            state.novedadNeeds.push(val);
          }
        } else {
          state.novedadNeeds = state.novedadNeeds.filter(x => x !== val);
        }
      });
    });

    // Envío del botón de novedad
    if (btnSubmitNovedad) {
      btnSubmitNovedad.addEventListener('click', (e) => {
        e.preventDefault();
        handleNoveltySubmit();
      });
    }
  }

  function handleNoveltySubmit() {
    if (!state.documento) {
      alert('⚠️ Por favor ingresa primero tu número de documento.');
      return;
    }
    const textVal = novedadTexto ? novedadTexto.value.trim() : '';
    if (!textVal) {
      alert('⚠️ Por favor describe detalladamente tu nueva situación.');
      if (novedadTexto) novedadTexto.focus();
      return;
    }

    const emp = state.employee || {};
    const cachedReports = JSON.parse(localStorage.getItem('comfamiliar_cached_remote_reports')) || [];
    const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
    const prevReport = cachedReports.find(r => String(r.documento || r.cedula).trim() === state.documento) || 
                       localReports.find(r => String(r.documento || r.cedula).trim() === state.documento) || {};

    let situacionTexto = `⚠️ [NOVEDAD] (${new Date().toLocaleDateString("es-CO")}): ${textVal}`;
    if (state.novedadNeeds.length > 0) {
      situacionTexto += ` | Requerimientos adicionales: ${state.novedadNeeds.join(', ')}`;
    }

    const newDir = novedadDireccion ? novedadDireccion.value.trim() : '';

    const payload = {
      timestamp: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
      documento: state.documento,
      cedula: state.documento,
      nombre: emp.nombre || prevReport.nombre || 'Colaborador',
      cargo: emp.cargo || prevReport.cargo || 'Colaborador',
      sede: emp.sede || prevReport.sede || 'Sede Principal',
      telefono: prevReport.telefono || emp.telefono || '',
      direccionActual: newDir || prevReport.direccionActual || prevReport.direccionResidencia || '',
      novedadTexto: textVal,
      novedadNeeds: state.novedadNeeds.join(', '),
      latitud: state.noveltyGps ? state.noveltyGps.latitud : '',
      longitud: state.noveltyGps ? state.noveltyGps.longitud : ''
    };

    // Almacenamos localmente las novedades de manera independiente para no alterar el censo inicial
    const localNovs = JSON.parse(localStorage.getItem('comfamiliar_local_novelties')) || [];
    localNovs.unshift(payload);
    localStorage.setItem('comfamiliar_local_novelties', JSON.stringify(localNovs));

    if (state.googleSheetsUrl && navigator.onLine) {
      sendNoveltyToSheetsJSONP(payload);
    }

    if (noveltySection) noveltySection.style.display = 'none';
    if (greetingBox) greetingBox.style.display = 'none';
    if (successSection) {
      successSection.style.display = 'block';
      successSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function sendNoveltyToSheetsJSONP(payload) {
    const callbackName = 'onUserNoveltySaveResult';
    const scriptId = 'jsonp-user-novelty-save';
    
    const oldScript = document.getElementById(scriptId);
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = scriptId;

    const queryString = Object.keys(payload)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(payload[key])}`)
      .join('&');

    script.src = `${state.googleSheetsUrl}?action=submitNovelty&${queryString}&callback=${callbackName}`;
    
    window.onUserNoveltySaveResult = function() {
      console.log('✅ Novedad del colaborador enviada exitosamente a Google Sheets.');
    };

    document.body.appendChild(script);
  }

  function handleCCLookupInstant() {
    if (!ccInput) return;
    const doc = ccInput.value.trim();
    if (!doc || doc.length < 5) {
      alert('⚠️ Por favor digita tu número de documento o cédula.');
      return;
    }

    state.documento = doc;

    // Reset flow buttons
    if (btnFlowUpdate) btnFlowUpdate.classList.add('selected');
    if (btnFlowNovelty) btnFlowNovelty.classList.remove('selected');
    if (noveltySection) noveltySection.style.display = 'none';
    state.noveltyGps = null;
    state.novedadNeeds = [];
    document.querySelectorAll('.touch-option-btn[data-group="novNeeds"]').forEach(b => b.classList.remove('selected'));
    if (novedadTexto) novedadTexto.value = '';
    if (novedadDireccion) novedadDireccion.value = '';
    if (novedadGpsStatus) novedadGpsStatus.innerHTML = '';

    // 1. VERIFICAR SI YA EXISTE UN REPORTE PREVIO (REMOTO O LOCAL)
    const cachedReports = JSON.parse(localStorage.getItem('comfamiliar_cached_remote_reports')) || [];
    const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
    
    const prevReportRemote = cachedReports.find(r => String(r.documento || r.cedula).trim() === doc);
    const prevReportLocal = localReports.find(r => String(r.documento || r.cedula).trim() === doc);
    const prevReport = prevReportRemote || prevReportLocal;
    
    if (prevReport) {
      state.isPreviousReport = true;
      state.currentFlow = 'update';
      if (existingFlowChoice) existingFlowChoice.style.display = 'block';
    } else {
      state.isPreviousReport = false;
      state.currentFlow = 'new';
      if (existingFlowChoice) existingFlowChoice.style.display = 'none';
    }

    // 2. BÚSQUEDA INTEGRADA EN TODAS LAS BASES (CACHÉ REMOTO 1962 REGISTROS, MOCK DB, REPORTES)
    let found = null;

    if (prevReportRemote && prevReportRemote.nombre) {
      found = {
        documento: doc,
        cedula: doc,
        nombre: prevReportRemote.nombre,
        cargo: prevReportRemote.cargo || "Colaborador",
        sede: prevReportRemote.sede || "Sede Principal",
        proceso: prevReportRemote.proceso || prevReportRemote.area || "General",
        email: prevReportRemote.emailPersonal || prevReportRemote.email || "",
        direccion: prevReportRemote.direccionHabitual || prevReportRemote.direccionResidencia || "",
        telefono: prevReportRemote.telefono || prevReportRemote.contacto || "",
        encontrado: true
      };
    } else if (window.MOCK_EMPLOYEES_DB && window.MOCK_EMPLOYEES_DB[doc]) {
      found = Object.assign({}, window.MOCK_EMPLOYEES_DB[doc]);
      found.encontrado = true;
    }

    if (found) {
      applyEmployeeData(found);
    } else {
      // 3. SI NO SE ENCONTRÓ DE INMEDIATO, MOSTRAR ESTADO DE VERIFICACIÓN Y CONSULTAR AL SERVIDOR
      applyEmployeeData({
        documento: doc,
        cedula: doc,
        nombre: '', // VACÍO PARA PERMITIR INGRESO DE NOMBRE REAL
        cargo: "Comfamiliar Risaralda",
        sede: "Eje Cafetero",
        proceso: "General",
        email: "",
        encontrado: false
      });

      if (state.googleSheetsUrl && navigator.onLine) {
        fetchJSONPBasePX(doc);
      }
    }

    if (greetingBox) greetingBox.style.display = 'block';
    if (state.isPreviousReport) {
      if (formSection) formSection.style.display = 'none';
      if (noveltySection) noveltySection.style.display = 'none';
      if (existingFlowChoice) {
        existingFlowChoice.style.display = 'block';
        existingFlowChoice.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      if (existingFlowChoice) existingFlowChoice.style.display = 'none';
      if (noveltySection) noveltySection.style.display = 'none';
      if (formSection) {
        formSection.style.display = 'block';
        formSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function applyEmployeeData(found) {
    state.employee = found;

    const isNewUnknown = !found.encontrado && (!found.nombre || found.nombre.includes('Colaborador'));
    const nombreInput = document.getElementById('user-nombre-input');

    if (isNewUnknown) {
      // SI REALMENTE NO EXISTE EN NINGUNA BASE: PEDIR INGRESO DE NOMBRE
      if (empName) empName.textContent = ` Documento ${found.documento}`;
      if (empMeta) empMeta.innerHTML = `<span style="color:#D90429; font-weight:800;">⚠️ Cédula no registrada en la base precargada.</span><br>Por favor escribe tu Nombre y Apellidos completos a continuación.`;

      if (nombreInput) {
        nombreInput.value = '';
        nombreInput.placeholder = '👉 Escribe aquí tus Nombres y Apellidos completos *';
        nombreInput.required = true;
        setTimeout(() => nombreInput.focus(), 300);
      }
    } else {
      // SI FUE ENCONTRADO EN LA BASE DE DATOS: RECONOCIMIENTO INMEDIATO
      const fullName = found.nombre || 'Colaborador';
      if (empName) empName.textContent = `¡Hola, ${fullName}! 👋`;
      
      const cargoText = found.cargo ? `${found.cargo} ${found.proceso ? '• ' + found.proceso : ''}` : 'Colaborador Comfamiliar';
      const sedeText = found.sede ? `🏢 Sede Registrada: ${found.sede}` : '🏢 Comfamiliar Risaralda';
      
      if (empMeta) empMeta.innerHTML = `<strong>${cargoText}</strong><br>${sedeText}`;

      if (nombreInput) {
        nombreInput.value = found.nombre || '';
        nombreInput.placeholder = 'Tus nombres y apellidos completos';
      }
    }

    const emailInput = document.getElementById('user-email-input');
    if (emailInput) emailInput.value = found.email || '';

    const dirInput = document.getElementById('user-direccion-input');
    if (dirInput && found.direccion && !dirInput.value) {
      dirInput.value = found.direccion;
    }

    const cachedReports = JSON.parse(localStorage.getItem('comfamiliar_cached_remote_reports')) || [];
    const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
    const prevReport = cachedReports.find(r => String(r.documento || r.cedula).trim() === found.documento) || 
                       localReports.find(r => String(r.documento || r.cedula).trim() === found.documento);

    const dirActualInput = document.getElementById('user-direccion-actual-input');
    if (dirActualInput && prevReport && prevReport.direccionActual) {
      dirActualInput.value = prevReport.direccionActual;
    }

    const phoneInput = document.getElementById('user-phone-input');
    if (phoneInput && (found.telefono || (prevReport && prevReport.telefono))) {
      phoneInput.value = found.telefono || prevReport.telefono;
    }

    const muniInput = document.getElementById('user-municipio-input');
    if (muniInput && prevReport && prevReport.municipio) {
      muniInput.value = prevReport.municipio;
    }

    const emergenciaInput = document.getElementById('user-contacto-emergencia-input');
    if (emergenciaInput && prevReport && prevReport.contactoEmergencia) {
      emergenciaInput.value = prevReport.contactoEmergencia;
    }
  }

  window.onBasePXLookupResult = function(result) {
    let foundData = null;

    if (result && result.status === 'success') {
      if (result.data) {
        foundData = result.data;
      } else if (Array.isArray(result.reports)) {
        foundData = result.reports.find(r => String(r.documento || r.cedula).trim() === state.documento);
      }
    } else if (result && result.status === 'found' && result.data) {
      foundData = result.data;
    }

    if (foundData && (foundData.nombre || foundData.documento)) {
      foundData.encontrado = true;
      applyEmployeeData(foundData);
    }
  };

  function fetchJSONPBasePX(doc) {
    const callbackName = 'onBasePXLookupResult';
    const scriptId = 'jsonp-base-px-lookup';
    
    const oldScript = document.getElementById(scriptId);
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${state.googleSheetsUrl}?action=getReport&documento=${encodeURIComponent(doc)}&callback=${callbackName}`;
    
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

        if (group === 'situacionYApoyo') {
          if (val === 'Estoy bien y seguro') {
            document.querySelectorAll(`.touch-option-btn[data-group="${group}"]`).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
          } else {
            const btnBien = document.querySelector(`.touch-option-btn[data-group="${group}"][data-value="Estoy bien y seguro"]`);
            if (btnBien) btnBien.classList.remove('selected');

            btn.classList.toggle('selected');

            const selectedBtns = document.querySelectorAll(`.touch-option-btn[data-group="${group}"].selected`);
            if (selectedBtns.length === 0 && btnBien) {
              btnBien.classList.add('selected');
            }
          }

          const selectedVals = Array.from(document.querySelectorAll(`.touch-option-btn[data-group="${group}"].selected`))
                                   .map(b => b.getAttribute('data-value'));
          state.situacionYApoyo = selectedVals.join(', ');
          return;
        }

        document.querySelectorAll(`.touch-option-btn[data-group="${group}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        state[group] = val;

        if (group === 'estadoFamilia') {
          if (val === 'Todos se encuentran bien') {
            if (familySubbox) familySubbox.style.display = 'none';
            state.familyTags = [];
            document.querySelectorAll('.family-tag-btn').forEach(b => b.classList.remove('selected'));
          } else {
            if (familySubbox) familySubbox.style.display = 'block';
          }
        }
      });
    });
  }

  function setupFamilyTags() {
    document.querySelectorAll('.family-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-tag');
        if (btn.classList.contains('selected')) {
          btn.classList.remove('selected');
          state.familyTags = state.familyTags.filter(t => t !== val);
        } else {
          btn.classList.add('selected');
          state.familyTags.push(val);
        }
      });
    });
  }

  if (gpsBtn) {
    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('⚠️ Tu navegador no soporta geolocalización GPS.');
        return;
      }
      gpsStatus.innerHTML = '⌛ Obteniendo coordenadas exactas...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.gps = {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude
          };
          gpsStatus.innerHTML = `<span style="color:var(--success)">📍 Ubicación capturada: Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}</span>`;
        },
        (err) => {
          gpsStatus.innerHTML = `<span style="color:var(--danger)">⚠️ No se pudo obtener GPS (${err.message}). Se usará referencia por municipio.</span>`;
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  if (reportForm) {
    reportForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!state.documento) {
        alert('⚠️ Por favor ingresa primero tu número de documento.');
        return;
      }

      const nombreInputVal = getValue('user-nombre-input');
      if (!nombreInputVal) {
        alert('⚠️ Por favor escribe tu Nombre y Apellidos completos.');
        document.getElementById('user-nombre-input').focus();
        return;
      }

      const payload = {
        timestamp: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
        documento: state.documento,
        cedula: state.documento,
        nombre: nombreInputVal,
        cargo: state.employee ? state.employee.cargo : 'Colaborador',
        emailPersonal: getValue('user-email-input'),
        contrato: state.employee ? state.employee.contrato : '',
        proceso: state.employee ? state.employee.proceso : 'General',
        area: state.employee ? state.employee.area : '',
        sexo: state.employee ? state.employee.sexo : '',
        sede: state.employee ? state.employee.sede : 'Sede Principal',
        telefono: getValue('user-phone-input'),
        contactoEmergencia: getValue('user-contacto-emergencia-input'),
        direccionHabitual: getValue('user-direccion-input'),
        direccionActual: getValue('user-direccion-actual-input') || getValue('user-direccion-input'),
        municipio: getValue('user-municipio-input', 'Pereira'),
        tipoSangre: getValue('user-sangre-input', 'O+'),
        situacionYApoyo: state.situacionYApoyo,
        personasHogar: getValue('user-personas-input', '1'),
        tipoVivienda: state.tipoVivienda,
        afectacionVivienda: state.afectacionVivienda,
        lugarSeguro: state.lugarSeguro,
        estadoFamilia: state.familyTags.length > 0 ? `${state.estadoFamilia} [Afectados: ${state.familyTags.join(', ')}]` : state.estadoFamilia,
        presencialidadObligatoria: state.presencialidadObligatoria,
        condicionesOptimas: state.condicionesOptimas,
        herramientasTrabajo: state.herramientasTrabajo,
        latitud: state.gps ? state.gps.latitud : '',
        longitud: state.gps ? state.gps.longitud : '',
        criticidad: calculateCriticidad(),
        esActualizacion: state.isPreviousReport
      };

      const localReports = JSON.parse(localStorage.getItem('comfamiliar_emergency_reports')) || [];
      const filteredLocal = localReports.filter(r => r.documento !== state.documento);
      filteredLocal.unshift(payload);
      localStorage.setItem('comfamiliar_emergency_reports', JSON.stringify(filteredLocal));

      if (state.googleSheetsUrl && navigator.onLine) {
        sendReportToSheetsJSONP(payload);
      }

      formSection.style.display = 'none';
      if (greetingBox) greetingBox.style.display = 'none';
      if (successSection) {
        successSection.style.display = 'block';
        successSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  function calculateCriticidad() {
    if (state.lugarSeguro === 'No' || state.afectacionVivienda.includes('impiden')) {
      return 'rojo';
    }
    if (state.situacionYApoyo.includes('apoyo') || state.afectacionVivienda.includes('menores')) {
      return 'amarillo';
    }
    return 'verde';
  }

  function sendReportToSheetsJSONP(payload) {
    const callbackName = 'onUserReportSaveResult';
    const scriptId = 'jsonp-user-report-save';
    
    const oldScript = document.getElementById(scriptId);
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = scriptId;

    const queryString = Object.keys(payload)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(payload[key])}`)
      .join('&');

    script.src = `${state.googleSheetsUrl}?action=submitReport&${queryString}&callback=${callbackName}`;
    
    window.onUserReportSaveResult = function() {
      console.log('✅ Reporte del colaborador enviado exitosamente a Google Sheets.');
    };

    document.body.appendChild(script);
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (successSection) successSection.style.display = 'none';
      if (ccInput) ccInput.value = '';
      state.documento = '';
      state.employee = null;
      state.isPreviousReport = false;
      state.gps = null;
      state.noveltyGps = null;
      state.novedadNeeds = [];
      state.currentFlow = 'new';

      if (novedadTexto) novedadTexto.value = '';
      if (novedadDireccion) novedadDireccion.value = '';
      if (novedadGpsStatus) novedadGpsStatus.innerHTML = '';
      if (existingFlowChoice) existingFlowChoice.style.display = 'none';
      if (noveltySection) noveltySection.style.display = 'none';

      document.querySelectorAll('.touch-option-btn').forEach(btn => btn.classList.remove('selected'));
      document.querySelectorAll('.family-tag-btn').forEach(btn => btn.classList.remove('selected'));
      state.familyTags = [];

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});
