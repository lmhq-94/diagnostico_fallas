/* ==========================================================================
   JavaScript - Herramienta de Diagnóstico de Fallas (RCA)
   Aplicación de Análisis Causa Raíz para mantenimiento y confiabilidad
   ========================================================================== */

/* ==========================================================================
   ESTADO GLOBAL DE LA APLICACIÓN
   Almacena toda la información ingresada por el usuario en los 4 tabs
   ========================================================================== */

let rcaData = {
  captura: {},
  whys: {},
  ishikawa: {},
  acciones: { correctivas: [], preventivas: [] }
};

/* ==========================================================================
   CONFIGURACIÓN DEL DIAGRAMA DE ISHIKAWA
   Define las 6 categorías y su orden en el diagrama
   ========================================================================== */

const ISHIKAWA_CATEGORY_CONFIG = {
  maquina:       { label: 'Máquina',       icon: 'fas fa-cog' },
  metodo:        { label: 'Método',        icon: 'fas fa-clipboard-list' },
  materiales:    { label: 'Materiales',    icon: 'fas fa-box' },
  manoObra:      { label: 'Mano de obra',  icon: 'fas fa-users' },
  medicion:      { label: 'Medición',      icon: 'fas fa-chart-line' },
  medioAmbiente: { label: 'Medio ambiente', icon: 'fas fa-leaf' }
};

const CATEGORY_ORDER = Object.keys(ISHIKAWA_CATEGORY_CONFIG);

/* ==========================================================================
   FUNCIONES AUXILIARES DE TEXTO
   ========================================================================== */

/** Normaliza un texto: minúsculas, sin tildes, sin espacios */
function normalizeText(text = '') {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Escapa caracteres HTML para prevenir XSS */
function escapeHtml(text = '') {
  return text
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Filtra valores duplicados (sin importar tildes) */
function uniqueValues(values = []) {
  const seen = new Set();
  return values.filter(value => {
    const cleanValue = value && value.toString().trim();
    if (!cleanValue) return false;
    const normalized = normalizeText(cleanValue);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/** Divide texto por saltos de línea, comas o punto y coma */
function splitTextValues(text = '') {
  return uniqueValues(
    text
      .split(/[\n,;]+/)
      .map(value => value.trim())
      .filter(Boolean)
  );
}

/** Filtra entradas válidas: máximo 4 palabras y 40 caracteres */
function sanitizeKeywordEntries(values = []) {
  return uniqueValues(values).filter(value => {
    const wordCount = value.trim().split(/\s+/).length;
    return wordCount <= 4 && value.trim().length <= 40;
  });
}

/** Trunca texto a una longitud máxima */
function truncateText(text = '', maxLength = 80) {
  const cleanText = text.toString().trim();
  if (cleanText.length <= maxLength) return cleanText;
  return `${cleanText.substring(0, maxLength - 3)}...`;
}

/** Obtiene la fecha actual en formato ISO (YYYY-MM-DD) */
function getTodayISODate() {
  return new Date().toISOString().split('T')[0];
}

/* ==========================================================================
   FUNCIONES DE LOS 5 PORQUÉS
   ========================================================================== */

/** Obtiene los valores de los 5 campos de porqué */
function getWhyTexts() {
  const values = [];
  for (let i = 1; i <= 5; i++) {
    values.push((document.getElementById(`why${i}`)?.value || '').trim());
  }
  return values;
}

/** Obtiene la causa raíz: el último porqué con contenido */
function getCurrentCauseSummary() {
  const whyTexts = getWhyTexts();
  return whyTexts[4] || whyTexts[3] || whyTexts[2] || whyTexts[1] || whyTexts[0] || '';
}

/** Actualiza el resumen visual de la causa raíz */
function updateRootCauseSummary() {
  const causeSummary = getCurrentCauseSummary();
  document.getElementById('causaRaizResumen').textContent =
    causeSummary || 'Completa los 5 porqués para ver la causa raíz.';
  return causeSummary;
}

/* ==========================================================================
   FUNCIONES DEL DIAGRAMA DE ISHIKAWA
   ========================================================================== */

/** Obtiene las categorías de Ishikawa que tienen contenido */
function getFilledIshikawaEntries() {
  return CATEGORY_ORDER
    .map(categoryKey => ({
      categoryKey,
      label: ISHIKAWA_CATEGORY_CONFIG[categoryKey].label,
      value: (document.getElementById(`ishikawa-${categoryKey}`)?.value || '').trim()
    }))
    .filter(entry => entry.value);
}

/** Refresca el diagrama SVG con los datos actuales */
function refreshIshikawaDiagram() {
  const diagram = document.getElementById('ishikawa-diagram');
  if (!diagram) return;

  const filledEntries = getFilledIshikawaEntries();
  if (filledEntries.length === 0) {
    diagram.classList.add('hidden');
  } else {
    diagram.classList.remove('hidden');
  }

  CATEGORY_ORDER.forEach(categoryKey => {
    const value = (document.getElementById(`ishikawa-${categoryKey}`)?.value || '').trim();
    const firstLine = value.split('\n')[0] || '';
    const displayText = truncateText(firstLine, 70);
    const el = document.getElementById(`ishikawa-content-${categoryKey}`);
    if (el) el.textContent = displayText;
  });

  const problema = (document.getElementById('descripcionProblema')?.value || '').trim();
  const causeText = document.getElementById('ishikawa-cause-text');
  if (causeText) causeText.textContent = problema || 'No definido';
}

/** Actualiza colores y checkmarks del diagrama según categorías detectadas */
function updateIshikawaDiagram(detectedCategories) {
  CATEGORY_ORDER.forEach(cat => {
    const rect = document.getElementById(`ishikawa-rect-${cat}`);
    const content = document.getElementById(`ishikawa-content-${cat}`);
    const check = document.getElementById(`ishikawa-check-${cat}`);

    if (detectedCategories[cat]) {
      if (rect) { rect.setAttribute('fill', '#e0f2fe'); rect.setAttribute('stroke', '#3b82f6'); }
      if (content) content.setAttribute('fill', '#1e40af');
      if (check) check.setAttribute('visibility', 'visible');
    } else {
      if (rect) { rect.setAttribute('fill', 'white'); rect.setAttribute('stroke', '#d1d5db'); }
      if (content) content.setAttribute('fill', '#9ca3af');
      if (check) check.setAttribute('visibility', 'hidden');
    }
  });
}

/** Enfoca el textarea de una categoría al hacer clic en el diagrama */
function editCategory(cat) {
  document.getElementById(`ishikawa-${cat}`).focus();
  document.getElementById(`ishikawa-${cat}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ==========================================================================
   FUNCIONES DE ACCIONES (Plan de Acción)
   ========================================================================== */

/** Obtiene todas las acciones del DOM para un tipo (correctiva/preventiva) */
function getAccionesFromDOM(tipo) {
  return Array.from(
    document.querySelectorAll(`#acciones${tipo.charAt(0).toUpperCase() + tipo.slice(1)}s > div`)
  ).map((div, index) => ({
    descripcion: document.getElementById(`accion-${tipo}-${index}-desc`)?.value || '',
    responsable: document.getElementById(`accion-${tipo}-${index}-resp`)?.value || '',
    fecha: document.getElementById(`accion-${tipo}-${index}-fecha`)?.value || '',
    prioridad: document.getElementById(`accion-${tipo}-${index}-prio`)?.value || 'media'
  }));
}

/** Re-indexa los IDs de las acciones después de eliminar una */
function reindexAcciones(tipo) {
  const container = document.getElementById(
    `acciones${tipo.charAt(0).toUpperCase() + tipo.slice(1)}s`
  );
  if (!container) return;

  Array.from(container.children).forEach((card, index) => {
    const descripcion = card.querySelector(`input[id^="accion-${tipo}-"][id$="-desc"]`);
    const responsable = card.querySelector(`input[id^="accion-${tipo}-"][id$="-resp"]`);
    const fecha = card.querySelector(`input[id^="accion-${tipo}-"][id$="-fecha"]`);
    const prioridad = card.querySelector(`select[id^="accion-${tipo}-"][id$="-prio"]`);

    if (descripcion) descripcion.id = `accion-${tipo}-${index}-desc`;
    if (responsable) responsable.id = `accion-${tipo}-${index}-resp`;
    if (fecha) fecha.id = `accion-${tipo}-${index}-fecha`;
    if (prioridad) prioridad.id = `accion-${tipo}-${index}-prio`;
  });
}

/** Genera el HTML de una tarjeta de acción */
function buildAccionHTML(tipo, index, accion = {}) {
  const descripcion = escapeHtml(accion.descripcion || '');
  const responsable = escapeHtml(accion.responsable || '');
  const fecha = escapeHtml(accion.fecha || getTodayISODate());
  const prioridad = accion.prioridad || 'media';

  return `
    <div class="accion-card bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 items-end">
        <div class="lg:col-span-5">
          <label class="std-label" for="accion-${tipo}-${index}-desc">Descripción</label>
          <input type="text" id="accion-${tipo}-${index}-desc" value="${descripcion}"
                 class="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                 placeholder="Describa la acción...">
        </div>
        <div class="lg:col-span-2">
          <label class="std-label" for="accion-${tipo}-${index}-resp">Responsable</label>
          <input type="text" id="accion-${tipo}-${index}-resp" value="${responsable}"
                 class="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                 placeholder="Nombre...">
        </div>
        <div class="lg:col-span-2">
          <label class="std-label" for="accion-${tipo}-${index}-fecha">Fecha límite</label>
          <input type="date" id="accion-${tipo}-${index}-fecha" value="${fecha}"
                 class="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base">
        </div>
        <div class="select-wrapper lg:col-span-2">
          <label class="std-label" for="accion-${tipo}-${index}-prio">Prioridad</label>
          <select id="accion-${tipo}-${index}-prio"
                  class="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base">
            <option value="alta" ${prioridad === 'alta' ? 'selected' : ''}>Alta</option>
            <option value="media" ${prioridad === 'media' ? 'selected' : ''}>Media</option>
            <option value="baja" ${prioridad === 'baja' ? 'selected' : ''}>Baja</option>
          </select>
        </div>
        <div class="flex items-end justify-end lg:col-span-1">
          <button onclick="removeAccion(this, '${tipo}')"
                  class="bg-red-500 hover:bg-red-600 text-white font-semibold w-11 h-11 rounded-lg transition shadow-md text-sm sm:text-base flex items-center justify-center">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

/** Agrega una tarjeta de acción al DOM */
function addAccionToDOM(tipo, accion = {}, index = null) {
  const container = document.getElementById(
    `acciones${tipo.charAt(0).toUpperCase() + tipo.slice(1)}s`
  );
  const nextIndex = index === null ? container.children.length : index;
  container.insertAdjacentHTML('beforeend', buildAccionHTML(tipo, nextIndex, accion));
  initializeDateInputs(container);
}

/* ==========================================================================
   DETECCIÓN DE DATOS Y ESTADO DE LA INTERFAZ
   ========================================================================== */

/** Verifica si hay algún dato ingresado en cualquier campo */
function hasData() {
  const fechaEvento = document.getElementById('fechaEvento')?.value;
  const maquina = document.getElementById('maquina')?.value;
  const tiempoParo = document.getElementById('tiempoParo')?.value;
  const descripcionProblema = document.getElementById('descripcionProblema')?.value;
  const sintomas = document.getElementById('sintomas')?.value;
  const responsable = document.getElementById('responsable')?.value;

  const why1 = document.getElementById('why1')?.value;
  const why2 = document.getElementById('why2')?.value;
  const why3 = document.getElementById('why3')?.value;
  const why4 = document.getElementById('why4')?.value;
  const why5 = document.getElementById('why5')?.value;

  const ishikawaMaquina = document.getElementById('ishikawa-maquina')?.value;
  const ishikawaMetodo = document.getElementById('ishikawa-metodo')?.value;
  const ishikawaMateriales = document.getElementById('ishikawa-materiales')?.value;
  const ishikawaManoObra = document.getElementById('ishikawa-manoObra')?.value;
  const ishikawaMedicion = document.getElementById('ishikawa-medicion')?.value;
  const ishikawaMedioAmbiente = document.getElementById('ishikawa-medioAmbiente')?.value;

  const accionesCorrectivas = document.getElementById('accionesCorrectivas')?.children.length || 0;
  const accionesPreventivas = document.getElementById('accionesPreventivas')?.children.length || 0;

  return !!(
    fechaEvento || maquina || tiempoParo || descripcionProblema || sintomas || responsable ||
    why1 || why2 || why3 || why4 || why5 ||
    ishikawaMaquina || ishikawaMetodo || ishikawaMateriales ||
    ishikawaManoObra || ishikawaMedicion || ishikawaMedioAmbiente ||
    accionesCorrectivas > 0 || accionesPreventivas > 0
  );
}

/** Verifica si la captura del problema está completa */
function hasCapturaData() {
  return !!(rcaData.captura && rcaData.captura.problema);
}

/** Muestra u oculta el botón "Limpiar Todo" según si hay datos */
function updateClearAllButton() {
  const hasDataVal = hasData();
  const clearAllBtn = document.getElementById('clearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.classList.toggle('hidden', !hasDataVal);
  }
  const fab = document.getElementById('fab');
  if (fab) {
    fab.classList.toggle('hidden', !hasCapturaData());
  }
}

/* ==========================================================================
   PERSISTENCIA EN LOCALSTORAGE
   ========================================================================== */

/** Guarda todo el estado actual en localStorage */
function persistCurrentState() {
  reindexAcciones('correctiva');
  reindexAcciones('preventiva');
  rcaData.acciones = {
    correctivas: getAccionesFromDOM('correctiva'),
    preventivas: getAccionesFromDOM('preventiva')
  };
  localStorage.setItem('rcaData', JSON.stringify(rcaData));
  updateClearAllButton();
}

/* ==========================================================================
   NAVEGACIÓN ENTRE TABS
   ========================================================================== */

/** Muestra el tab seleccionado y oculta los demás */
function showTab(tabName) {
  if (tabName !== 'captura') {
    const tabBtn = document.getElementById(`tab-${tabName}`);
    if (tabBtn && tabBtn.classList.contains('tab-locked')) {
      return;
    }
  }

  document.querySelectorAll('[id^="content-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.remove('tab-active'));

  document.getElementById(`content-${tabName}`).classList.remove('hidden');
  document.getElementById(`tab-${tabName}`).classList.add('tab-active');

  if (tabName === 'plan') {
    syncPlanFromAnalysis();
  }
}

/** Bloquea o desbloquea los tabs según si hay captura completa */
function updateTabLockState() {
  const capturaCompleta = !!(rcaData.captura && rcaData.captura.problema);
  const lockedTabs = ['5whys', 'ishikawa', 'plan'];
  lockedTabs.forEach(tabName => {
    const btn = document.getElementById(`tab-${tabName}`);
    if (!btn) return;
    if (capturaCompleta) {
      btn.classList.remove('tab-locked');
      btn.onclick = null;
      btn.onclick = function() { showTab(tabName); };
    } else {
      btn.classList.add('tab-locked');
    }
  });
}

/* ==========================================================================
   FAB - BOTÓN DE ACCIÓN FLOTANTE
   ========================================================================== */

/** Abre o cierra el menú del FAB */
function toggleFab(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('fab-menu');
  const fab = document.getElementById('fab');
  const icon = document.querySelector('#fab-toggle i');
  menu.classList.toggle('hidden');
  fab.classList.toggle('fab-open');
  icon.classList.toggle('fa-plus');
  icon.classList.toggle('fa-times');
}

/** Cierra el menú del FAB al hacer clic fuera de él */
document.addEventListener('click', function(e) {
  const fab = document.getElementById('fab');
  if (!fab || fab.contains(e.target)) return;
  const menu = document.getElementById('fab-menu');
  const icon = document.querySelector('#fab-toggle i');
  if (!menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
    fab.classList.remove('fab-open');
    icon.classList.add('fa-plus');
    icon.classList.remove('fa-times');
  }
});

/* ==========================================================================
   ACCIONES DE GUARDADO Y LIMPIEZA POR TAB
   ========================================================================== */

/** Guarda los datos de captura y avanza al tab de Ishikawa */
function saveCaptura() {
  rcaData.captura = {
    fecha: document.getElementById('fechaEvento').value,
    maquina: document.getElementById('maquina').value,
    tiempoParo: document.getElementById('tiempoParo').value,
    problema: document.getElementById('descripcionProblema').value,
    sintomas: document.getElementById('sintomas').value,
    responsable: document.getElementById('responsable').value
  };

  if (!rcaData.captura.problema) {
    alert('Describe el problema antes de continuar.');
    return;
  }

  syncPlanFromAnalysis();
  persistCurrentState();
  updateTabLockState();
  showTab('ishikawa');
}

/** Guarda los 5 porqués */
function saveWhys() {
  for (let i = 1; i <= 5; i++) {
    rcaData.whys[`why${i}`] = document.getElementById(`why${i}`).value;
  }

  updateRootCauseSummary();
  syncPlanFromAnalysis();
  persistCurrentState();
}

/** Guarda las categorías del diagrama de Ishikawa */
function saveIshikawa() {
  const emptyCategories = [];
  CATEGORY_ORDER.forEach(cat => {
    const field = document.getElementById(`ishikawa-${cat}`);
    if (!field.value.trim()) {
      emptyCategories.push(cat);
    }
  });

  if (emptyCategories.length > 0) {
    const missingNames = emptyCategories.map(cat => ISHIKAWA_CATEGORY_CONFIG[cat].label).join(', ');
    alert(`Completa todas las categorías del Ishikawa antes de guardar:\n\n${missingNames}`);
    return;
  }

  CATEGORY_ORDER.forEach(cat => {
    const field = document.getElementById(`ishikawa-${cat}`);
    const sanitizedValue = sanitizeKeywordEntries(splitTextValues(field.value)).join(', ');
    field.value = sanitizedValue;
    rcaData.ishikawa[cat] = sanitizedValue;
  });
  refreshIshikawaDiagram();

  const machine = (document.getElementById('maquina')?.value || '').trim();
  const problemText = (document.getElementById('descripcionProblema')?.value || '').trim();
  if (machine && problemText) {
    updateIshikawaForMachine(machine, rcaData.ishikawa, problemText);
  }

  syncPlanFromAnalysis();
  persistCurrentState();
}

/** Limpia los campos de captura */
function clearCaptura() {
  document.getElementById('fechaEvento').value = '';
  document.getElementById('maquina').value = '';
  document.getElementById('tiempoParo').value = '';
  document.getElementById('descripcionProblema').value = '';
  document.getElementById('sintomas').value = '';
  document.getElementById('responsable').value = '';
  rcaData.captura = {};
  syncPlanFromAnalysis();
  persistCurrentState();
}

/** Limpia los 5 porqués */
function clearWhys() {
  for (let i = 1; i <= 5; i++) {
    document.getElementById(`why${i}`).value = '';
    rcaData.whys[`why${i}`] = '';
  }
  document.getElementById('causaRaizResumen').textContent =
    'Completa los 5 porqués para ver la causa raíz resumida aquí.';
  syncPlanFromAnalysis();
  persistCurrentState();
}

/** Limpia las categorías del Ishikawa */
function clearIshikawa() {
  CATEGORY_ORDER.forEach(cat => {
    document.getElementById(`ishikawa-${cat}`).value = '';
    rcaData.ishikawa[cat] = '';
  });

  const diagram = document.getElementById('ishikawa-diagram');
  if (diagram) {
    diagram.classList.add('hidden');
  }

  const emptyState = {};
  CATEGORY_ORDER.forEach(cat => { emptyState[cat] = false; });
  updateIshikawaDiagram(emptyState);
  syncPlanFromAnalysis();
  persistCurrentState();
}

/** Agrega una nueva acción (correctiva o preventiva) */
function addAccion(tipo) {
  addAccionToDOM(tipo);

  setTimeout(() => {
    initializeDropdowns();
  }, 100);

  persistCurrentState();
}

/** Elimina una acción del DOM */
function removeAccion(btn, tipo) {
  btn.closest('.accion-card').remove();
  persistCurrentState();
}

/** Sincroniza el resumen del plan de acción */
function syncPlanFromAnalysis() {
  updateResumen();
}

/** Actualiza el resumen con los datos actuales */
function updateResumen() {
  document.getElementById('resumenProblema').textContent =
    rcaData.captura.problema || 'No definido';
  const causaRaiz = getCurrentCauseSummary();
  document.getElementById('resumenCausa').textContent = causaRaiz || 'No definida';
}

/* ==========================================================================
   LISTENERS DE DETECCIÓN DE CAMBIOS
   ========================================================================== */

/** Agrega listeners a todos los campos para detectar cambios de datos */
function addDataListeners() {
  const capturaFields = [
    'fechaEvento', 'maquina', 'tiempoParo',
    'descripcionProblema', 'sintomas', 'responsable'
  ];
  capturaFields.forEach(id => {
    const field = document.getElementById(id);
    if (field) {
      field.addEventListener('input', updateClearAllButton);
      field.addEventListener('change', updateClearAllButton);
    }
  });

  for (let i = 1; i <= 5; i++) {
    const whyField = document.getElementById(`why${i}`);
    if (whyField) {
      whyField.addEventListener('input', updateClearAllButton);
      whyField.addEventListener('change', updateClearAllButton);
    }
  }

  const ishikawaFields = ['maquina', 'metodo', 'materiales', 'manoObra', 'medicion', 'medioAmbiente'];
  ishikawaFields.forEach(cat => {
    const field = document.getElementById(`ishikawa-${cat}`);
    if (field) {
      field.addEventListener('input', updateClearAllButton);
      field.addEventListener('change', updateClearAllButton);
    }
  });

  ['accionesCorrectivas', 'accionesPreventivas'].forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener('input', persistCurrentState);
    container.addEventListener('change', persistCurrentState);
  });
}

/* ==========================================================================
   EXPORTACIÓN A EXCEL
   Genera un archivo .xlsx con hojas de Reporte, Ishikawa y Pareto
   ========================================================================== */

async function exportExcel() {
  if (typeof ExcelJS === 'undefined') {
    alert('La librería ExcelJS no se ha cargado. Verifica tu conexión a internet.');
    return;
  }

  try {
    recordRootCauseForPareto();
    const machineIshikawa = (document.getElementById('maquina')?.value || '').trim();
    const problemIshikawa = (document.getElementById('descripcionProblema')?.value || '').trim();
    if (machineIshikawa && problemIshikawa && rcaData.ishikawa) {
      updateIshikawaForMachine(machineIshikawa, rcaData.ishikawa, problemIshikawa);
    }
    const accionesCorrectivas = [];
    const accionesPreventivas = [];

    document.querySelectorAll('#accionesCorrectivas > div').forEach((div, i) => {
      accionesCorrectivas.push({
        descripcion: document.getElementById(`accion-correctiva-${i}-desc`)?.value || '',
        responsable: document.getElementById(`accion-correctiva-${i}-resp`)?.value || '',
        fecha: document.getElementById(`accion-correctiva-${i}-fecha`)?.value || '',
        prioridad: document.getElementById(`accion-correctiva-${i}-prio`)?.value || ''
      });
    });

    document.querySelectorAll('#accionesPreventivas > div').forEach((div, i) => {
      accionesPreventivas.push({
        descripcion: document.getElementById(`accion-preventiva-${i}-desc`)?.value || '',
        responsable: document.getElementById(`accion-preventiva-${i}-resp`)?.value || '',
        fecha: document.getElementById(`accion-preventiva-${i}-fecha`)?.value || '',
        prioridad: document.getElementById(`accion-preventiva-${i}-prio`)?.value || ''
      });
    });

    rcaData.acciones = { correctivas: accionesCorrectivas, preventivas: accionesPreventivas };

    const todasAcciones = [
      ...accionesCorrectivas.map(a => ({ ...a, tipo: 'Correctivo' })),
      ...accionesPreventivas.map(a => ({ ...a, tipo: 'Preventivo' }))
    ];

    const causaRaiz =
      rcaData.whys.why5 || rcaData.whys.why4 || rcaData.whys.why3 ||
      rcaData.whys.why2 || rcaData.whys.why1 || '';

    const workbook = new ExcelJS.Workbook();

    // ---- Hoja 1: Reporte de Fallas ----
    const reporteSheet = workbook.addWorksheet('Reporte de Fallas', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    const headerRow = reporteSheet.addRow([
      'Fecha', 'Máquina', 'Problema', 'Tipo de Mantenimiento',
      'Plan de Acción Correctivo', 'Plan de Acción Preventivo',
      'Status del Plan', 'Responsable', 'Fecha de Finalización', 'Causa Raíz'
    ]);
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    headerRow.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    const correctivas = todasAcciones.filter(a => a.tipo === 'Correctivo');
    const preventivas = todasAcciones.filter(a => a.tipo === 'Preventivo');
    const tipoAccion = 'Correctivo';
    const correctivoText = correctivas.map(a => a.descripcion).filter(Boolean).join('\n');
    const preventivoText = preventivas.map(a => a.descripcion).filter(Boolean).join('\n');
    const responsables = [...new Set(todasAcciones.map(a => a.responsable).filter(Boolean))].join(', ');
    const fechasFin = todasAcciones.map(a => a.fecha).filter(Boolean).join(', ');

    const currentEntry = {
      fecha: rcaData.captura.fecha || '',
      maquina: rcaData.captura.maquina || '',
      problema: rcaData.captura.problema || '',
      tipoAccion: tipoAccion,
      correctivoText: todasAcciones.length > 0 ? correctivoText : '',
      preventivoText: todasAcciones.length > 0 ? preventivoText : '',
      status: 'Pendiente',
      responsable: (todasAcciones.length > 0 ? responsables : '') || rcaData.captura.responsable || '',
      fechaFin: todasAcciones.length > 0 ? fechasFin : '',
      causaRaiz: causaRaiz,
      ishikawa: CATEGORY_ORDER.reduce((acc, key) => {
        acc[key] = (document.getElementById(`ishikawa-${key}`)?.value || '').trim();
        return acc;
      }, {})
    };

    const exportHistory = JSON.parse(localStorage.getItem('exportHistory') || '[]');
    exportHistory.push(currentEntry);
    localStorage.setItem('exportHistory', JSON.stringify(exportHistory));

    exportHistory.forEach((entry, i) => {
      const row = reporteSheet.addRow([
        entry.fecha, entry.maquina, entry.problema, entry.tipoAccion,
        entry.correctivoText, entry.preventivoText, entry.status || 'Pendiente',
        entry.responsable, entry.fechaFin, entry.causaRaiz
      ]);
      if (i > 0) row.alignment = { vertical: 'top', wrapText: true };
    });
    reporteSheet.getRow(2).alignment = { vertical: 'top', wrapText: true };

    const lastRow = exportHistory.length + 1;
    reporteSheet.autoFilter = {
      from: { row: 1, column: 1 }, to: { row: lastRow, column: 10 }
    };

    reporteSheet.columns.forEach((col, i) => {
      let maxLen = 0;
      reporteSheet.getColumn(i + 1).eachCell(cell => {
        const text = cell.value ? String(cell.value) : '';
        const lines = text.split('\n');
        lines.forEach(line => {
          maxLen = Math.max(maxLen, line.length);
        });
      });
      reporteSheet.getColumn(i + 1).width = Math.min(Math.max(maxLen + 3, 10), 55);
    });

    // ---- Hoja 2: Ishikawa ----
    const ishikawaSheet = workbook.addWorksheet('Ishikawa');

    const ishikawaHistoryData = getIshikawaHistory();
    const ishikawaMachines = Object.keys(ishikawaHistoryData).filter(m => {
      const entry = ishikawaHistoryData[m];
      return entry && entry.ishikawa && Object.values(entry.ishikawa).some(v => v);
    });

    if (ishikawaMachines.length === 0) {
      ishikawaSheet.getCell('A1').value = 'No hay diagramas Ishikawa guardados.';
      ishikawaSheet.getCell('A1').font = { italic: true, size: 11, name: 'Calibri', color: { argb: 'FF9CA3AF' } };
    } else {
      ishikawaSheet.properties.outlineProperties = { summaryBelow: false };
      let ishikawaRow = 1;
      ishikawaMachines.forEach((machine, idx) => {
        const entry = ishikawaHistoryData[machine];
        const ishikawaData = entry.ishikawa || {};
        if (!Object.values(ishikawaData).some(v => v)) return;

        ishikawaSheet.getCell(`A${ishikawaRow}`).value = machine;
        ishikawaSheet.getCell(`A${ishikawaRow}`).font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF1F4E79' } };
        const headerRow = ishikawaRow;
        ishikawaRow++;

        const imgData = createSimplifiedIshikawa(ishikawaData, entry.problema);
        if (imgData && imgData.imgData) {
          const base64Data = imgData.imgData.split(',')[1];
          const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
          ishikawaSheet.addImage(imgId, {
            tl: { col: 0, row: ishikawaRow },
            br: { col: 15, row: ishikawaRow + 30 }
          });
          for (let r = headerRow + 1; r <= ishikawaRow + 30; r++) {
            ishikawaSheet.getRow(r).outlineLevel = 1;
          }
          if (idx > 0) ishikawaSheet.getRow(headerRow).collapsed = true;
          ishikawaRow += 31;
        }
      });
    }
    ishikawaSheet.getColumn(1).width = 30;

    // ---- Hoja 3: Pareto ----
    const paretoSheet = workbook.addWorksheet('Pareto');

    const allParetoData = getParetoHistory();
    const machines = Object.keys(allParetoData).filter(m => {
      const data = allParetoData[m];
      return data && Object.keys(data).length > 0;
    });

    if (machines.length === 0) {
      paretoSheet.getCell('A1').value = 'No hay datos de Pareto acumulados.';
      paretoSheet.getCell('A1').font = { italic: true, size: 11, name: 'Calibri', color: { argb: 'FF9CA3AF' } };
    } else {
      paretoSheet.properties.outlineProperties = { summaryBelow: false };
      let paretoRow = 1;
      machines.forEach((machine, idx) => {
        const paretoItems = getAccumulatedParetoData(machine);
        if (paretoItems.length === 0) return;

        paretoSheet.getCell(`A${paretoRow}`).value = machine;
        paretoSheet.getCell(`A${paretoRow}`).font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF1F4E79' } };
        const headerRow = paretoRow;
        paretoRow++;

        const sorted = [...paretoItems].sort((a, b) => b.frecuencia - a.frecuencia);
        const imgData = createSimplifiedPareto(sorted);
        if (imgData && imgData.imgData) {
          const base64Data = imgData.imgData.split(',')[1];
          const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
          paretoSheet.addImage(imgId, {
            tl: { col: 0, row: paretoRow },
            br: { col: 15, row: paretoRow + 30 }
          });
          for (let r = headerRow + 1; r <= paretoRow + 30; r++) {
            paretoSheet.getRow(r).outlineLevel = 1;
          }
          if (idx > 0) paretoSheet.getRow(headerRow).collapsed = true;
          paretoRow += 31;
        } else {
          for (let r = headerRow + 1; r < paretoRow; r++) {
            paretoSheet.getRow(r).outlineLevel = 1;
          }
          if (idx > 0) paretoSheet.getRow(headerRow).collapsed = true;
        }
      });
    }
    paretoSheet.getColumn(1).width = 30;

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = new Uint8Array(rawBuffer);
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Diagnostico_Fallas.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (error) {
    console.error('Error en exportExcel:', error);
    alert('Error al exportar a Excel: ' + (error.message || error));
  }
}

/* ==========================================================================
   GENERACIÓN DE IMÁGENES PARA EXPORTACIÓN
   Diagramas de Ishikawa y Pareto en Canvas
   ========================================================================== */

/** Escala un canvas por un factor (para mejorar resolución) */
function upscaleCanvas(src, scale) {
  const dst = document.createElement('canvas');
  dst.width = src.width * scale;
  dst.height = src.height * scale;
  const dctx = dst.getContext('2d');
  dctx.scale(scale, scale);
  dctx.drawImage(src, 0, 0);
  return dst;
}

/** Genera una imagen del diagrama de Ishikawa en un canvas */
function createSimplifiedIshikawa(ishikawaData, problemaText) {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const categories = CATEGORY_ORDER.map(key => ({
    key,
    label: ISHIKAWA_CATEGORY_CONFIG[key].label,
    value: ishikawaData
      ? (ishikawaData[key] || '')
      : (document.getElementById(`ishikawa-${key}`)?.value || '').trim()
  }));

  const hasData = categories.some(c => c.value);
  if (!hasData) {
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('No hay datos de Ishikawa disponibles', 370, 210);
    const scNoData = upscaleCanvas(canvas, 4);
    return { imgData: scNoData.toDataURL(), width: scNoData.width, height: scNoData.height };
  }

  const spineY = 210;
  const contactXs = [205, 400, 595];
  const upperCenters = [115, 310, 505];
  const lowerCenters = [115, 310, 505];

  ctx.lineCap = 'round';

  // Cola del pescado
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(85, spineY);
  ctx.lineTo(48, 178);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(85, spineY);
  ctx.lineTo(48, 242);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(48, 178);
  ctx.lineTo(48, 242);
  ctx.stroke();

  // Espina central
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(85, spineY);
  ctx.lineTo(762, spineY);
  ctx.stroke();

  // Punta de flecha
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.moveTo(762, spineY);
  ctx.lineTo(752, spineY - 6);
  ctx.lineTo(752, spineY + 6);
  ctx.closePath();
  ctx.fill();

  // Marcas de contacto
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  contactXs.forEach(x => {
    ctx.moveTo(x, spineY - 7);
    ctx.lineTo(x, spineY + 7);
  });
  ctx.stroke();

  // Ramas superiores e inferiores
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2.5;
  upperCenters.forEach((cx, i) => {
    ctx.beginPath();
    ctx.moveTo(cx, 122);
    ctx.lineTo(contactXs[i], spineY);
    ctx.stroke();
  });
  lowerCenters.forEach((cx, i) => {
    ctx.beginPath();
    ctx.moveTo(cx, 298);
    ctx.lineTo(contactXs[i], spineY);
    ctx.stroke();
  });

  /** Dibuja una tarjeta de categoría en el canvas */
  function drawCard(x, y, w, h, r, cat) {
    const hasContent = !!cat.value;
    ctx.lineWidth = 1.5;
    if (hasContent) {
      ctx.fillStyle = '#e0f2fe';
      ctx.strokeStyle = '#3b82f6';
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#d1d5db';
    }
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 30);
    ctx.lineTo(x + w - 8, y + 30);
    ctx.stroke();

    ctx.fillStyle = '#1e3a5f';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat.label, x + w / 2, y + 16);

    if (hasContent) {
      ctx.fillStyle = '#3b82f6';
      ctx.font = '16px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('\u2713', x + w - 6, y + 6);
    }

    if (hasContent) {
      ctx.fillStyle = '#1e40af';
      ctx.font = '10px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const maxContentY = y + h - 8;
      wrapCanvasText(ctx, cat.value, x + 8, y + 38, w - 16, 14, maxContentY);
    } else {
      ctx.fillStyle = '#9ca3af';
      ctx.font = 'italic 10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sin datos', x + w / 2, y + h / 2 + 10);
    }
  }

  /** Envuelve texto en el canvas con límite de altura */
  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxY) {
    text = text.replace(/\n/g, ' ');
    const words = text.split(' ');
    let line = '';
    let ly = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        if (ly + lineHeight > maxY) {
          ctx.fillText(line.slice(0, -3) + '...', x, ly);
          return;
        }
        ctx.fillText(line, x, ly);
        line = word;
        ly += lineHeight;
      } else {
        line = test;
      }
    }
    if (line && ly + lineHeight <= maxY + lineHeight) {
      ctx.fillText(line, x, ly);
    }
  }

  // Tarjetas superiores
  const cardW = 130, cardH = 92, cardR = 8;
  const upperCardXs = [50, 245, 440];
  categories.slice(0, 3).forEach((cat, i) => {
    drawCard(upperCardXs[i], 30, cardW, cardH, cardR, cat);
  });

  // Tarjetas inferiores
  const lowerCardXs = [50, 245, 440];
  categories.slice(3, 6).forEach((cat, i) => {
    drawCard(lowerCardXs[i], 298, cardW, cardH, cardR, cat);
  });

  // Recuadro del problema
  const problema =
    problemaText ||
    (document.getElementById('descripcionProblema')?.value || '').trim() ||
    'No definido';
  const pbX = 767, pbY = 164, pbW = 220, pbH = 120, pbR = 10;
  ctx.fillStyle = '#1e3a5f';
  roundRect(ctx, pbX, pbY, pbW, pbH, pbR);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('PROBLEMA', pbX + pbW / 2, pbY + 15);

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pbX + 20, pbY + 30);
  ctx.lineTo(pbX + pbW - 20, pbY + 30);
  ctx.stroke();

  ctx.fillStyle = '#93c5fd';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  wrapCanvasText(ctx, problema, pbX + 15, pbY + 38, pbW - 30, 15, pbY + pbH - 10);

  const scIshikawa = upscaleCanvas(canvas, 4);
  return { imgData: scIshikawa.toDataURL(), width: scIshikawa.width, height: scIshikawa.height };
}

/** Genera una imagen del diagrama de Pareto en un canvas */
function createSimplifiedPareto(paretoItems) {
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const items = paretoItems || getIshikawaParetoData();

  if (items.length === 0) {
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('No hay datos de Pareto disponibles', 150, 150);
    const scParetoEmpty = upscaleCanvas(canvas, 4);
    return { imgData: scParetoEmpty.toDataURL(), width: scParetoEmpty.width, height: scParetoEmpty.height };
  }

  items.sort((a, b) => b.frecuencia - a.frecuencia);

  const margin = { top: 30, right: 55, bottom: 60, left: 55 };
  const chartWidth = canvas.width - margin.left - margin.right;
  const chartHeight = canvas.height - margin.top - margin.bottom;

  const maxFreq = Math.max(...items.map(item => item.frecuencia));
  const totalFreq = items.reduce((sum, item) => sum + item.frecuencia, 0);
  const barSpacing = chartWidth / items.length;
  const barWidth = Math.min(barSpacing * 0.65, 50);

  const startX = margin.left;
  const startY = canvas.height - margin.bottom;

  // Cuadrícula y eje Y izquierdo
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const y = startY - (i * chartHeight / gridSteps);
    const freqValue = Math.round(maxFreq * i / gridSteps);

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(canvas.width - margin.right, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'end';
    ctx.textBaseline = 'middle';
    ctx.fillText(freqValue.toString(), startX - 8, y);
  }

  // Eje Y derecho (porcentaje acumulado)
  for (let i = 0; i <= gridSteps; i++) {
    const y = startY - (i * chartHeight / gridSteps);
    const pctValue = Math.round(100 * i / gridSteps);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'middle';
    ctx.fillText(pctValue + '%', canvas.width - margin.right + 5, y);
  }

  // Ejes principales
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX, margin.top);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(canvas.width - margin.right, startY);
  ctx.stroke();

  // Línea de referencia 80%
  const eightyY = startY - (0.8 * chartHeight);
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(startX, eightyY);
  ctx.lineTo(canvas.width - margin.right, eightyY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Barras y línea acumulada
  let acumulado = 0;
  const linePoints = [];

  items.forEach((item, index) => {
    const barHeight = (item.frecuencia / maxFreq) * chartHeight;
    const x = startX + (index * barSpacing) + (barSpacing - barWidth) / 2;
    const y = startY - barHeight;

    ctx.fillStyle = '#93c5fd';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, barWidth, barHeight, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#374151';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const maxLabelWidth = barWidth - 2;
    const words = item.causa.split(' ');
    const labelLines = [];
    let currentLine = '';
    words.forEach(word => {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxLabelWidth && currentLine) {
        labelLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) labelLines.push(currentLine);
    labelLines.forEach((line, li) => {
      ctx.fillText(line, x + barWidth / 2, startY + 5 + li * 10);
    });

    acumulado += item.frecuencia;
    const cumPct = (acumulado / totalFreq) * 100;
    const lineX = x + barWidth / 2;
    const lineY = startY - (cumPct / 100) * chartHeight;
    linePoints.push({ x: lineX, y: lineY, pct: cumPct, label: cumPct.toFixed(0) + '%' });
  });

  if (linePoints.length > 0) {
    ctx.beginPath();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.moveTo(linePoints[0].x, linePoints[0].y);
    for (let i = 1; i < linePoints.length; i++) {
      ctx.lineTo(linePoints[i].x, linePoints[i].y);
    }
    ctx.stroke();

    linePoints.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (i === 0 || i === linePoints.length - 1 || pt.pct >= 75) {
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(pt.label, pt.x, pt.y - 7);
      }
    });
  }

  // Leyenda
  const legendY = canvas.height - margin.bottom + 35;
  ctx.fillStyle = '#93c5fd';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  roundRect(ctx, startX, legendY, 14, 10, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  ctx.fillText('Frecuencia', startX + 20, legendY + 5);

  const legendLineX = startX + 100;
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(legendLineX, legendY + 5);
  ctx.lineTo(legendLineX + 30, legendY + 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(legendLineX + 15, legendY + 5, 3, 0, 2 * Math.PI);
  ctx.fillStyle = '#dc2626';
  ctx.fill();
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  ctx.fillText('% Acumulado', legendLineX + 36, legendY + 5);

  const scPareto = upscaleCanvas(canvas, 4);
  return { imgData: scPareto.toDataURL(), width: scPareto.width, height: scPareto.height };
}

/** Dibuja un rectángulo con bordes redondeados en el canvas */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ==========================================================================
   EXPORTACIÓN A PDF
   Genera un reporte profesional con todos los datos del análisis
   ========================================================================== */

/** Wrapper para manejar errores de la exportación PDF */
function handlePDFExport() {
  exportPDF().catch(error => {
    console.error('Error al exportar PDF:', error);
    alert('Error al generar el PDF.');
  });
}

/** Genera y descarga un PDF con la información completa del análisis */
async function exportPDF() {
  try {
    recordRootCauseForPareto();
    const machineIshikawaPdf = (document.getElementById('maquina')?.value || '').trim();
    const problemIshikawaPdf = (document.getElementById('descripcionProblema')?.value || '').trim();
    if (machineIshikawaPdf && problemIshikawaPdf && rcaData.ishikawa) {
      updateIshikawaForMachine(machineIshikawaPdf, rcaData.ishikawa, problemIshikawaPdf);
    }
    if (!window.jspdf) {
      throw new Error('La librería jsPDF no está cargada');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    const colors = {
      navy: [30, 58, 95],
      blue: [37, 99, 235],
      sky: [224, 242, 254],
      gray: [107, 114, 128]
    };

    /** Agrega el encabezado corporativo a cada página */
    function addHeader() {
      doc.setFillColor(...colors.navy);
      doc.rect(0, 0, pageWidth, 28, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Diagnóstico de Fallas', pageWidth / 2, 11, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const fechaGeneracion = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      doc.text(`Generado: ${fechaGeneracion}`, pageWidth / 2, 21, { align: 'center' });

      doc.setFillColor(...colors.blue);
      doc.rect(0, 28, pageWidth, 1, 'F');

      yPosition = 38;
    }

    /** Agrega el pie de página corporativo */
    function addFooter() {
      const footerY = pageHeight - 12;
      doc.setFillColor(...colors.navy);
      doc.rect(0, footerY, pageWidth, 12, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text(
        'Generado por Herramienta de Diagnóstico de Fallas - Proquinal',
        pageWidth / 2, footerY + 8, { align: 'center' }
      );
    }

    /** Verifica si se necesita un salto de página */
    function checkPageBreak(requiredHeight) {
      if (yPosition + requiredHeight > pageHeight - 22) {
        addFooter();
        doc.addPage();
        addHeader();
        yPosition = 38;
        return true;
      }
      return false;
    }

    /** Agrega texto con salto de línea automático */
    function addText(text, fontSize = 11, fontStyle = 'normal', textColor = colors.gray) {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setTextColor(...textColor);
      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
      const lineHeight = fontSize * 0.4;

      checkPageBreak(lines.length * lineHeight + 10);

      lines.forEach(line => {
        doc.text(line, margin, yPosition);
        yPosition += lineHeight;
      });

      yPosition += 4;
    }

    /** Agrega un título de sección con fondo decorativo */
    function addSectionTitle(title, icon = '') {
      checkPageBreak(20);

      doc.setFillColor(...colors.sky);
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 12, 2, 2, 'F');

      doc.setTextColor(...colors.navy);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`${icon} ${title}`, margin + 5, yPosition + 8);

      yPosition += 18;
    }

    addHeader();
    yPosition += 10;

    // ---- Sección 1: Información del Problema ----
    addSectionTitle('1. INFORMACIÓN DEL PROBLEMA');

    const fechaInput = document.getElementById('fechaEvento').value || 'No especificada';
    let fechaFormateada = 'No especificada';
    if (fechaInput && fechaInput !== 'No especificada') {
      const fechaObj = new Date(fechaInput + 'T00:00:00');
      fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }
    const maquina = document.getElementById('maquina').value || 'No especificada';
    const tiempoParo = document.getElementById('tiempoParo').value || 'No especificado';
    const responsable = document.getElementById('responsable').value || 'No especificado';
    const descripcion = document.getElementById('descripcionProblema').value || 'No descrito';
    const sintomas = document.getElementById('sintomas').value || 'No descritos';

    /** Agrega una línea con etiqueta y valor */
    function addLabelValue(label, value, fontSize = 11, fontStyle = 'bold') {
      checkPageBreak(fontSize * 0.4 + 10);

      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setTextColor(...colors.navy);
      doc.text(label, margin, yPosition);

      const labelWidth = doc.getTextWidth(label);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.gray);
      doc.text(value, margin + labelWidth + 2, yPosition);

      yPosition += fontSize * 0.4 + 3;
    }

    addLabelValue('Fecha del evento:', fechaFormateada);
    addLabelValue('Máquina/Equipo:', maquina);
    addLabelValue('Tiempo de paro:', tiempoParo + ' minutos');
    addLabelValue('Responsable del análisis:', responsable);

    addText('Descripción del problema:', 11, 'bold', colors.navy);
    addText(descripcion, 11, 'normal', colors.gray);
    addText('Síntomas observados:', 11, 'bold', colors.navy);
    addText(sintomas, 11, 'normal', colors.gray);

    yPosition += 10;

    // ---- Sección 2: Análisis de 5 Porqués ----
    addSectionTitle('2. ANÁLISIS DE 5 PORQUÉS');

    let hasWhys = false;
    for (let i = 1; i <= 5; i++) {
      const whyText = document.getElementById(`why${i}`).value;
      if (whyText) {
        hasWhys = true;
        addText(`${i}. ${whyText}`, 11, 'normal', colors.gray);
      }
    }

    if (!hasWhys) {
      addText('No se registraron análisis de 5 porqués.', 11, 'normal', colors.gray);
    }

    yPosition += 5;

    const causaRaiz = document.getElementById('causaRaizResumen').textContent;
    if (causaRaiz && causaRaiz !== 'Completa los 5 porqués para ver la causa raíz resumida aquí.') {
      addText('Causa Raíz Identificada:', 11, 'bold', colors.navy);
      addText(causaRaiz, 11, 'normal', colors.gray);
      yPosition += 10;
    }

    // ---- Sección 3: Diagrama de Ishikawa ----
    addSectionTitle('3. DIAGRAMA DE ISHIKAWA');

    const hasAnyIshikawaData = CATEGORY_ORDER.some(
      cat => !!(document.getElementById(`ishikawa-${cat}`)?.value || '').trim()
    );
    if (hasAnyIshikawaData) {
      checkPageBreak(200);
      const ishikawaImage = createSimplifiedIshikawa();
      if (ishikawaImage && ishikawaImage.imgData) {
        const imgWidth = 180;
        const imgHeight = (ishikawaImage.height / ishikawaImage.width) * imgWidth;
        const imgX = (pageWidth - imgWidth) / 2;
        doc.addImage(ishikawaImage.imgData, 'PNG', imgX, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 8;
      }
    } else {
      addText('No se registraron datos en el diagrama de Ishikawa.');
    }

    yPosition += 8;

    // ---- Sección 4: Diagrama de Pareto ----
    addSectionTitle('4. DIAGRAMA DE PARETO');

    const currentMachine = (document.getElementById('maquina')?.value || '').trim();
    const paretoItems = getAccumulatedParetoData(currentMachine);

    if (paretoItems.length > 0) {
      const sorted = [...paretoItems].sort((a, b) => b.frecuencia - a.frecuencia);
      const paretoImage = createSimplifiedPareto(sorted);
      if (paretoImage && paretoImage.imgData) {
        const imgWidth = 175;
        const imgHeight = (paretoImage.height / paretoImage.width) * imgWidth;
        const imgX = (pageWidth - imgWidth) / 2;
        doc.addImage(paretoImage.imgData, 'PNG', imgX, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 6;
      }

      const totalCausas = sorted.reduce((sum, item) => sum + item.frecuencia, 0);

      addText(`Máquina: ${currentMachine}`, 11, 'bold', colors.navy);
      addText('Detalle de causas raíz:', 11, 'bold', colors.navy);

      let acumulado = 0;
      sorted.forEach((item, index) => {
        acumulado += item.frecuencia;
        const porcentaje = ((item.frecuencia / totalCausas) * 100).toFixed(1);
        const porcentajeAcumulado = ((acumulado / totalCausas) * 100).toFixed(1);
        addText(
          `${index + 1}. ${item.causa}: ${item.frecuencia} (${porcentaje}%, Acum: ${porcentajeAcumulado}%)`,
          10, 'normal', colors.gray
        );
      });
    } else {
      addText('No hay causas raíz acumuladas para esta máquina. Completa el análisis de 5 Porqués y exporta para generar datos de Pareto.');
    }

    yPosition += 15;

    // ---- Sección 5: Plan de Acción ----
    addSectionTitle('5. PLAN DE ACCIÓN');

    const accionesCorrectivas = document.getElementById('accionesCorrectivas').children;
    if (accionesCorrectivas.length > 0) {
      addText('Acciones Correctivas:', 12, 'bold', colors.navy);
      for (let i = 0; i < accionesCorrectivas.length; i++) {
        const accionDiv = accionesCorrectivas[i];
        const descripcion = accionDiv.querySelector('input[id$="-desc"]')?.value || '';
        const responsable = accionDiv.querySelector('input[id$="-resp"]')?.value || '';
        const fechaInput = accionDiv.querySelector('input[id$="-fecha"]')?.value || '';
        let fechaFormateada = '';
        if (fechaInput) {
          const fechaObj = new Date(fechaInput + 'T00:00:00');
          fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
        }

        if (descripcion) {
          addText(`${i + 1}. ${descripcion}`, 11, 'normal', colors.gray);
          if (responsable) addText(`   Responsable: ${responsable}`, 10, 'normal', colors.gray);
          if (fechaFormateada) addText(`   Fecha límite: ${fechaFormateada}`, 10, 'normal', colors.gray);
        }
      }
    } else {
      addText('No se registraron acciones correctivas.', 11, 'normal', colors.gray);
    }

    yPosition += 5;

    const accionesPreventivas = document.getElementById('accionesPreventivas').children;
    if (accionesPreventivas.length > 0) {
      addText('Acciones Preventivas:', 12, 'bold', colors.navy);
      for (let i = 0; i < accionesPreventivas.length; i++) {
        const accionDiv = accionesPreventivas[i];
        const descripcion = accionDiv.querySelector('input[id$="-desc"]')?.value || '';
        const responsable = accionDiv.querySelector('input[id$="-resp"]')?.value || '';
        const fechaInput = accionDiv.querySelector('input[id$="-fecha"]')?.value || '';
        let fechaFormateada = '';
        if (fechaInput) {
          const fechaObj = new Date(fechaInput + 'T00:00:00');
          fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
        }

        if (descripcion) {
          addText(`${i + 1}. ${descripcion}`, 11, 'normal', colors.gray);
          if (responsable) addText(`   Responsable: ${responsable}`, 10, 'normal', colors.gray);
          if (fechaFormateada) addText(`   Fecha límite: ${fechaFormateada}`, 10, 'normal', colors.gray);
        }
      }
    } else {
      addText('No se registraron acciones preventivas.', 11, 'normal', colors.gray);
    }

    addFooter();
    doc.save('Diagnostico_Fallas.pdf');

  } catch (error) {
    console.error('Error en exportación PDF:', error);
    alert('Error al generar el PDF.');
  }
}

/** Obtiene datos de Pareto a partir de las categorías de Ishikawa */
function getIshikawaParetoData() {
  return CATEGORY_ORDER.map(key => {
    const value = (document.getElementById(`ishikawa-${key}`)?.value || '').trim();
    if (!value) return null;
    const causes = value.split(/[,.\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    return { causa: ISHIKAWA_CATEGORY_CONFIG[key].label, frecuencia: causes.length };
  }).filter(Boolean);
}

/* ==========================================================================
   PARETO - DATOS ACUMULADOS POR MÁQUINA
   Almacena frecuencias de causas raíz por máquina para el análisis Pareto
   ========================================================================== */

/** Obtiene el historial acumulado de causas raíz por máquina */
function getParetoHistory() {
  return JSON.parse(localStorage.getItem('paretoHistory') || '{}');
}

/** Guarda el historial acumulado de Pareto */
function saveParetoHistory(data) {
  localStorage.setItem('paretoHistory', JSON.stringify(data));
}

/** Registra la causa raíz actual en el historial acumulado de la máquina */
function recordRootCauseForPareto() {
  const machine = (document.getElementById('maquina')?.value || '').trim();
  if (!machine) return;

  const rootCause = getCurrentCauseSummary();
  if (!rootCause) return;

  const history = getParetoHistory();
  if (!history[machine]) {
    history[machine] = {};
  }

  const normalized = normalizeText(rootCause);
  let found = false;
  for (const key of Object.keys(history[machine])) {
    if (normalizeText(key) === normalized) {
      history[machine][key]++;
      found = true;
      break;
    }
  }

  if (!found) {
    history[machine][rootCause] = 1;
  }

  saveParetoHistory(history);
}

/** Obtiene los ítems de Pareto acumulados para una máquina específica */
function getAccumulatedParetoData(machine) {
  const history = getParetoHistory();
  const machineData = history[machine] || {};
  return Object.entries(machineData).map(([causa, frecuencia]) => ({
    causa,
    frecuencia
  }));
}

/* ==========================================================================
   ISHIKAWA - DIAGRAMA HISTÓRICO POR MÁQUINA
   Almacena el último diagrama de Ishikawa por máquina (solo uno por máquina)
   ========================================================================== */

/** Obtiene el historial de diagramas Ishikawa por máquina */
function getIshikawaHistory() {
  return JSON.parse(localStorage.getItem('ishikawaHistory') || '{}');
}

/** Guarda el historial de diagramas Ishikawa */
function saveIshikawaHistory(data) {
  localStorage.setItem('ishikawaHistory', JSON.stringify(data));
}

/** Actualiza el diagrama Ishikawa de una máquina (fusiona causas nuevas con las existentes, sin duplicados) */
function updateIshikawaForMachine(machine, ishikawaData, problemText) {
  if (!machine || !problemText) return;
  const history = getIshikawaHistory();
  const existing = history[machine];
  if (existing && existing.ishikawa) {
    const merged = {};
    CATEGORY_ORDER.forEach(cat => {
      const existingVal = (existing.ishikawa[cat] || '').trim();
      const newVal = (ishikawaData[cat] || '').trim();
      if (!existingVal) {
        merged[cat] = newVal;
      } else if (!newVal) {
        merged[cat] = existingVal;
      } else {
        const all = [...existingVal.split(/,\s*/), ...newVal.split(/,\s*/)].filter(Boolean);
        merged[cat] = uniqueValues(all).join(', ');
      }
    });
    const existingProblem = (existing.problema || '').trim();
    const mergedProblem = existingProblem
      ? uniqueValues([...existingProblem.split(/\s*;\s*/), problemText].filter(Boolean)).join('; ')
      : problemText;
    history[machine] = { ishikawa: merged, problema: mergedProblem };
  } else {
    history[machine] = { ishikawa: { ...ishikawaData }, problema: problemText };
  }
  saveIshikawaHistory(history);
}

/* ==========================================================================
   LIMPIAR TODO EL ANÁLISIS
   Reinicia todos los campos, el estado y el localStorage
   ========================================================================== */

function clearAll() {
  const confirmMessage = `¿Estás seguro de que quieres limpiar TODO el análisis actual?\nEsta acción no se puede deshacer.`;

  if (confirm(confirmMessage)) {
    document.getElementById('fechaEvento').value = '';
    document.getElementById('maquina').value = '';
    document.getElementById('tiempoParo').value = '';
    document.getElementById('descripcionProblema').value = '';
    document.getElementById('sintomas').value = '';
    document.getElementById('responsable').value = '';

    for (let i = 1; i <= 5; i++) {
      document.getElementById(`why${i}`).value = '';
    }
    document.getElementById('causaRaizResumen').textContent =
      'Completa los 5 porqués para ver la causa raíz resumida aquí.';

    CATEGORY_ORDER.forEach(cat => {
      document.getElementById(`ishikawa-${cat}`).value = '';
    });

    const ishikawaDiagram = document.getElementById('ishikawa-diagram');
    if (ishikawaDiagram) {
      ishikawaDiagram.classList.add('hidden');
    }
    updateIshikawaDiagram({
      maquina: false, metodo: false, materiales: false,
      manoObra: false, medicion: false, medioAmbiente: false
    });

    document.getElementById('accionesCorrectivas').innerHTML = '';
    document.getElementById('accionesPreventivas').innerHTML = '';

    document.getElementById('resumenProblema').textContent = 'No definido';
    document.getElementById('resumenCausa').textContent = 'No definida';

    rcaData = {
      captura: {},
      whys: {},
      ishikawa: {},
      acciones: { correctivas: [], preventivas: [] }
    };

    localStorage.removeItem('rcaData');
    localStorage.removeItem('paretoHistory');
    localStorage.removeItem('ishikawaHistory');

    showTab('captura');
    updateTabLockState();
    updateClearAllButton();

    const fabMenu = document.getElementById('fab-menu');
    const fab = document.getElementById('fab');
    const icon = document.querySelector('#fab-toggle i');
    if (fabMenu && !fabMenu.classList.contains('hidden')) {
      fabMenu.classList.add('hidden');
      fab.classList.remove('fab-open');
      icon.classList.add('fa-plus');
      icon.classList.remove('fa-times');
    }
  }
}

/* ==========================================================================
   INICIALIZACIÓN DE COMPONENTES DE INTERFAZ
   ========================================================================== */

/** Configura el campo de fecha y los dropdowns al iniciar */
function initializeDatePicker() {
  const fechaInput = document.getElementById('fechaEvento');
  const today = getTodayISODate();

  fechaInput.max = today;

  if (!fechaInput.value) {
    fechaInput.value = today;
  }

  initializeDateInputs();
  initializeDropdowns();
}

/** Hace que los inputs de fecha abran el picker al hacer clic */
function initializeDateInputs(root = document) {
  const dateInputs = root.querySelectorAll ? root.querySelectorAll('input[type="date"]') : [];

  dateInputs.forEach(input => {
    if (input.dataset.datepickerInitialized === 'true') return;

    input.dataset.datepickerInitialized = 'true';

    input.addEventListener('click', function() {
      this.focus();
      if (typeof this.showPicker === 'function') {
        this.showPicker();
      }
    });

    input.addEventListener('focus', function() {
      if (typeof this.showPicker === 'function') {
        setTimeout(() => {
          this.showPicker();
        }, 0);
      }
    });
  });
}

/** Asegura que los select se desplieguen correctamente hacia abajo */
function initializeDropdowns() {
  const selects = document.querySelectorAll('select');

  selects.forEach(select => {
    select.addEventListener('mousedown', function(e) {
      const rect = this.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;

      if (spaceBelow < 200) {
        window.scrollBy({
          top: 200 - spaceBelow,
          behavior: 'smooth'
        });
      }
    });

    select.addEventListener('focus', function(e) {
      const wrapper = this.closest('.select-wrapper');
      if (wrapper) {
        wrapper.style.position = 'relative';
        wrapper.style.zIndex = '1000';
      }
    });

    select.addEventListener('blur', function(e) {
      const wrapper = this.closest('.select-wrapper');
      if (wrapper) {
        setTimeout(() => {
          wrapper.style.zIndex = '10';
        }, 300);
      }
    });
  });
}

/* ==========================================================================
   INICIALIZACIÓN AL CARGAR LA PÁGINA
   Restaura datos guardados y configura la interfaz
   ========================================================================== */

window.addEventListener('DOMContentLoaded', function() {
  initializeDatePicker();

  const saved = localStorage.getItem('rcaData');
  if (saved) {
    rcaData = JSON.parse(saved);
    rcaData.captura = rcaData.captura || {};
    rcaData.whys = rcaData.whys || {};
    rcaData.ishikawa = rcaData.ishikawa || {};
    rcaData.acciones = rcaData.acciones || { correctivas: [], preventivas: [] };

    if (rcaData.captura.fecha) document.getElementById('fechaEvento').value = rcaData.captura.fecha;
    if (rcaData.captura.maquina) document.getElementById('maquina').value = rcaData.captura.maquina;
    if (rcaData.captura.tiempoParo) document.getElementById('tiempoParo').value = rcaData.captura.tiempoParo;
    if (rcaData.captura.problema) document.getElementById('descripcionProblema').value = rcaData.captura.problema;
    if (rcaData.captura.sintomas) document.getElementById('sintomas').value = rcaData.captura.sintomas;
    if (rcaData.captura.responsable) document.getElementById('responsable').value = rcaData.captura.responsable;

    for (let i = 1; i <= 5; i++) {
      if (rcaData.whys[`why${i}`]) {
        document.getElementById(`why${i}`).value = rcaData.whys[`why${i}`];
      }
    }

    CATEGORY_ORDER.forEach(cat => {
      if (rcaData.ishikawa[cat]) {
        document.getElementById(`ishikawa-${cat}`).value = rcaData.ishikawa[cat];
      }
    });
    refreshIshikawaDiagram();

    if (rcaData.acciones.correctivas) {
      rcaData.acciones.correctivas.forEach((accion, index) => {
        addAccionToDOM('correctiva', accion, index);
      });
    }

    if (rcaData.acciones.preventivas) {
      rcaData.acciones.preventivas.forEach((accion, index) => {
        addAccionToDOM('preventiva', accion, index);
      });
    }

    initializeDropdowns();
  }

  updateRootCauseSummary();

  setTimeout(() => {
    syncPlanFromAnalysis();
  }, 500);

  addDataListeners();
  updateTabLockState();
  updateClearAllButton();
});
