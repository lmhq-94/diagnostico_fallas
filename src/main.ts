import './style.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { rcaData, setRcaData, setSavedRcaData, commitWizardDataToSaved, persistCurrentState, hasData, CATEGORY_ORDER, type RCAData } from './state/store';
import { escapeHtml, getTodayISODate } from './utils/text';
import { showToast } from './utils/toast';
import { confirmAction, confirmDanger } from './utils/confirm';
import { saveAnalysisFile, updateAnalysisFile, checkAnalysisFile, loadAnalysis, deleteAnalysis } from './services/analysisStorage';
import { getCurrentCauseSummary } from './state/store';
import {
  renderWhysWizard, updateRootCauseSummary,
  whysNext, whysPrev, whysFinish, whysEdit, toggleWhysTimeline, clearWhys
} from './components/whys-wizard';
import {
  refreshIshikawaDiagram, updateIshikawaDiagram, editCategory,
  saveIshikawa, clearIshikawa
} from './components/ishikawa';
import { addAccion, removeAccion, addAccionToDOM, clearActionPlan } from './components/plan';
import { toggleReviewDrawer, openReviewDrawer, closeReviewDrawer, renderDrawerTable } from './components/drawer';
import { toggleTableView, openTableView, closeTableView, renderDataTable, startEdit, saveEdit, cancelEdit, deleteField, deleteSection, deletePlanRow, switchDataTab } from './components/data-table';
import { exportExcel } from './services/exportExcel';
import { handlePDFExport, createSimplifiedIshikawa, createSimplifiedPareto } from './services/exportPDF';
import { recordRootCauseForPareto, getIshikawaParetoData, getAccumulatedParetoData } from './services/pareto';
import { getIshikawaHistory, updateIshikawaForMachine } from './services/ishikawaHistory';

/* ==========================================================================
   Global API for Inline Event Handlers
   ========================================================================== */

declare global {
  interface Window {
    __showTab: (name: string) => void;
    __saveCaptura: () => void;
    __clearCaptura: () => void;
    __toggleTableView: () => void;
    __toggleReviewDrawer: (e?: Event) => void;
    __closeReviewDrawer: () => void;
    __closeTableView: () => void;
    __clearAll: () => void;
    __clearAllFromTable: () => void;
    __whysNext: () => void;
    __whysPrev: () => void;
    __whysFinish: () => void;
    __whysEdit: (level: number) => void;
    __toggleWhysTimeline: () => void;
    __clearWhys: () => void;
    __saveIshikawa: () => void;
    __clearIshikawa: () => void;
    __editCategory: (cat: string) => void;
    __addAccion: (tipo: string) => void;
    __removeAccion: (btn: HTMLElement, tipo: string) => void;
    __handlePDFExport: () => void;
    __exportExcel: () => void;
    __navigateStep: (dir: number) => void;
    __toggleStepMenu: (e: Event) => void;
    __clearCurrentStep: () => void;
    __saveAnalysis: () => void;
    __generateIshikawa: () => void;
    __startEdit: (key: string) => void;
    __saveEdit: (key: string) => void;
    __cancelEdit: () => void;
    __deleteField: (key: string) => void;
    __deleteSection: (section: string) => void;
    __deletePlanRow: (tipo: string, index: number) => void;
    __loadAnalysis: () => Promise<void>;
    __deleteAnalysis: () => Promise<void>;
    __switchDataTab: (section: string) => void;
    __viewIshikawaFullscreen: () => void;
    __closeIshikawaModal: () => void;
  }
}

function registerGlobalAPI(): void {
  const syncPlan = () => { updateResumen(); };
  const updateClearAll = () => updateClearAllButton();

  window.__showTab = showTab;
  window.__saveCaptura = saveCaptura;
  window.__clearCaptura = clearCaptura;
  window.__toggleTableView = toggleTableView;
  window.__toggleReviewDrawer = toggleReviewDrawer;
  window.__closeReviewDrawer = closeReviewDrawer;
  window.__closeTableView = closeTableView;
  window.__clearAll = clearAll;
  window.__clearAllFromTable = clearAllFromTable;
  window.__whysNext = () => {
    whysNext(syncPlan, persistCurrentState);
    updateStepNav();
    updateTabLockState();
  };
  window.__whysPrev = () => {
    whysPrev(syncPlan, persistCurrentState);
    updateStepNav();
    updateTabLockState();
  };
  window.__whysFinish = () => {
    whysFinish(syncPlan, persistCurrentState);
    updateStepNav();
    updateTabLockState();
  };
  window.__whysEdit = whysEdit;
  window.__toggleWhysTimeline = toggleWhysTimeline;
  window.__clearWhys = () => {
    clearWhys(resetWhysState, syncPlan, persistCurrentState);
    updateTabLockState();
  };
  window.__saveIshikawa = () => saveIshikawa(syncPlan, persistCurrentState, updateIshikawaForMachine);
  window.__clearIshikawa = () => clearIshikawa(syncPlan, persistCurrentState);
  window.__editCategory = editCategory;
  window.__addAccion = (tipo: string) => addAccion(tipo, persistCurrentState);
  window.__removeAccion = (btn: HTMLElement, tipo: string) => removeAccion(btn, tipo, persistCurrentState);
  window.__handlePDFExport = () => handlePDFExport(updateIshikawaForMachine);
  window.__exportExcel = () => exportExcel(updateIshikawaForMachine);
  window.__startEdit = startEdit;
  window.__saveEdit = (key: string) => saveEdit(key, renderWhysWizard, refreshIshikawaDiagram, persistCurrentState);
  window.__cancelEdit = cancelEdit;
  window.__deleteField = (key: string) => deleteField(key, renderWhysWizard, refreshIshikawaDiagram, persistCurrentState);
  window.__deleteSection = (section: string) => deleteSection(section, renderWhysWizard, refreshIshikawaDiagram, persistCurrentState);
  window.__deletePlanRow = (tipo: string, index: number) => deletePlanRow(tipo, index, persistCurrentState);
  window.__switchDataTab = (section: string) => switchDataTab(section as any);
  window.__loadAnalysis = loadAnalysisFromJson;
  window.__deleteAnalysis = deleteAnalysisFile;
  window.__navigateStep = (dir: number) => navigateStep(dir);
  window.__toggleStepMenu = toggleStepMenu;
  window.__clearCurrentStep = clearCurrentStep;
  window.__generateIshikawa = generateIshikawa;
  window.__viewIshikawaFullscreen = viewIshikawaFullscreen;
  window.__closeIshikawaModal = closeIshikawaModal;
  window.__saveAnalysis = saveAnalysis;

  // Close step menu on outside click
  document.addEventListener('click', function(e: Event) {
    const menu = document.getElementById('step-nav-menu');
    const btn = document.querySelector('.step-nav-btn-ghost');
    if (menu && menu.classList.contains('open') &&
        btn && !btn.contains(e.target as Node) &&
        !menu.contains(e.target as Node)) {
      menu.classList.remove('open');
    }
  });
}

/* ==========================================================================
   Tab Navigation
   ========================================================================== */

function showTab(tabName: string): void {
  if (tabName !== 'captura') {
    const tabBtn = document.getElementById(`tab-${tabName}`);
    if (tabBtn && tabBtn.classList.contains('tab-locked')) {
      return;
    }
  }

  document.querySelectorAll('[id^="content-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.remove('tab-active'));

  document.getElementById(`content-${tabName}`)?.classList.remove('hidden');
  document.getElementById(`tab-${tabName}`)?.classList.add('tab-active');

  if (tabName === 'ishikawa') {
    refreshIshikawaDiagram();
    updateIshikawaGenerateBtn();
  }

  if (tabName === 'plan') {
    syncPlanFromAnalysis();
  }

  if (tabName === '5whys') {
    updateTabLockState();
  }

  // Persist current step so it's restored on refresh
  localStorage.setItem('rcaCurrentStep', tabName);

  updateStepNav();
}

/* ==========================================================================
   Step Navigation
   ========================================================================== */

const STEPS = ['captura', 'ishikawa', '5whys', 'plan'] as const;
type StepName = (typeof STEPS)[number];

function navigateStep(dir: number): void {
  const currentTab = document.querySelector('[id^="content-"]:not(.hidden)');
  if (!currentTab) return;
  const currentId = currentTab.id.replace('content-', '');
  const currentIndex = STEPS.indexOf(currentId as StepName);
  if (currentIndex === -1) return;

  const nextIndex = currentIndex + dir;
  if (nextIndex < 0 || nextIndex >= STEPS.length) return;

  const nextTab = STEPS[nextIndex];

  // Save current step data before navigating
  if (currentId === 'captura') {
    saveCaptura();
    if (!rcaData.captura.problema) return; // validation failed
  } else if (currentId === 'ishikawa') {
    saveIshikawaData();
  } else if (currentId === '5whys') {
    // Capture the active why input before navigating
    const input = document.getElementById('why-active-input') as HTMLInputElement | null;
    if (input) {
      const level = rcaData.whys.wizardLevel;
      if (level >= 1 && level <= 5) {
      if (level === 1) rcaData.whys.why1 = input.value.trim();
      else if (level === 2) rcaData.whys.why2 = input.value.trim();
      else if (level === 3) rcaData.whys.why3 = input.value.trim();
      else if (level === 4) rcaData.whys.why4 = input.value.trim();
      else if (level === 5) rcaData.whys.why5 = input.value.trim();
      }
    }
    persistCurrentState();
  }

  showTab(nextTab);

  if (currentId === '5whys') {
    updateTabLockState();
  }
}

function saveIshikawaData(): void {
  CATEGORY_ORDER.forEach(cat => {
    const field = document.getElementById(`ishikawa-${cat}`) as HTMLTextAreaElement | null;
    if (field && field.value.trim()) {
      rcaData.ishikawa[cat] = field.value.trim();
    }
  });
  refreshIshikawaDiagram();
  syncPlanFromAnalysis();
  persistCurrentState();
  updateTabLockState();
}

function updateStepNav(): void {
  const currentTab = document.querySelector('[id^="content-"]:not(.hidden)');
  if (!currentTab) return;
  const currentId = currentTab.id.replace('content-', '');
  const currentIndex = STEPS.indexOf(currentId as StepName);
  if (currentIndex === -1) return;

  // Update dots
  const dots = document.querySelectorAll('.step-nav-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
    dot.classList.toggle('completed', i < currentIndex);
  });

  // Hide prev button on first step (captura), enable otherwise
  const prevBtn = document.getElementById('step-nav-prev') as HTMLButtonElement | null;
  if (prevBtn) {
    prevBtn.style.display = currentIndex === 0 ? 'none' : '';
    prevBtn.disabled = false;
  }

  // Show "Acciones" label only on the first step
  const accionesLabel = document.querySelector('#step-nav-more button span');
  if (accionesLabel) {
    (accionesLabel as HTMLElement).style.display = currentIndex === 0 ? '' : 'none';
  }

  // Update the right side
  const navRight = document.getElementById('step-nav-right');
  if (!navRight) return;

  if (currentId === 'plan') {
    // Last step - show "Guardar" button
    navRight.innerHTML = `
      <button id="step-nav-save" class="step-nav-btn step-nav-btn-success" onclick="window.__saveAnalysis()">
        <i class="fas fa-save"></i>
        <span>Guardar</span>
      </button>
    `;
    return;
  }

  // Show "Siguiente" button (always says "Siguiente" and blue for the whys tab)
  const isLast = currentIndex === STEPS.length - 2;
  const isWhys = currentId === '5whys';
  const nextLabel = isWhys ? 'Siguiente' : (isLast ? 'Finalizar' : 'Siguiente');
  const nextIcon = isWhys ? 'fa-arrow-right' : (isLast ? 'fa-check-circle' : 'fa-arrow-right');
  const nextClass = isWhys ? 'step-nav-btn-primary' : (isLast ? 'step-nav-btn-success' : 'step-nav-btn-primary');

  navRight.innerHTML = `
    <button id="step-nav-next" class="step-nav-btn ${nextClass}" onclick="window.__navigateStep(1)" disabled>
      <span>${nextLabel}</span>
      <i class="fas ${nextIcon}"></i>
    </button>
  `;

  updateNextButtonState(currentId);
}

function updateNextButtonState(tabId: string): void {
  const nextBtn = document.getElementById('step-nav-next') as HTMLButtonElement | null;
  if (!nextBtn) return;

  // Only validate Captura - other steps are always enabled
  if (tabId === 'captura') {
    const problema = (document.getElementById('descripcionProblema') as HTMLTextAreaElement)?.value?.trim() || '';
    nextBtn.disabled = !problema;
  } else {
    nextBtn.disabled = false;
  }
}

/* ==========================================================================
   Stepper State Management
   ========================================================================== */

function updateTabLockState(): void {
  const c = rcaData.captura || {};
  const w = rcaData.whys || {};
  const ish = rcaData.ishikawa || {};
  const acciones = rcaData.acciones || { correctivas: [], preventivas: [] };

  // Step 1: Captura — checked only when ALL fields are filled
  const allCapturaFields = [c.fecha, c.maquina, c.tiempoParo, c.problema, c.sintomas, c.responsable];
  const capturaCompleta = allCapturaFields.every(val => !!val);

  // Step 2: Ishikawa — checked only when ALL 6 cards are filled
  const ishikawaCompleto = CATEGORY_ORDER.every(cat => !!ish[cat]);

  // Step 3: 5 Porqués — checked only after navigating away (Siguiente) with at least 1 why
  const onWhysTab = !document.getElementById('content-5whys')?.classList.contains('hidden');
  const whysCompleto = !onWhysTab && !!(w.why1 || w.why2 || w.why3 || w.why4 || w.why5);

  // Step 4: Plan — checked when at least 1 correctiva OR 1 preventiva
  const planCompleto = !!(acciones.correctivas.length > 0 || acciones.preventivas.length > 0);

  // Captura unlocks tabs when just the problem is filled
  const capturaDesbloqueada = !!c.problema;

  // Unlock tabs based on captura having at least the problem
  const lockedTabs = ['ishikawa', '5whys', 'plan'];
  lockedTabs.forEach(tabName => {
    const btn = document.getElementById(`tab-${tabName}`);
    if (!btn) return;
    if (capturaDesbloqueada) {
      btn.classList.remove('tab-locked');
      btn.onclick = null;
      btn.onclick = function() { showTab(tabName); };
    } else {
      btn.classList.add('tab-locked');
    }
  });

  // Show/hide "Resumen" buttons only when captura has data
  document.querySelectorAll('.step-header-actions').forEach(el => {
    el.classList.toggle('hidden', !capturaDesbloqueada);
  });

  const toggleComplete = (id: string, condition: boolean) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('completed', condition);
  };

  toggleComplete('tab-captura', capturaCompleta);
  toggleComplete('conn-0', capturaCompleta);
  toggleComplete('tab-ishikawa', ishikawaCompleto && capturaDesbloqueada);
  toggleComplete('conn-1', ishikawaCompleto && capturaDesbloqueada);
  toggleComplete('tab-5whys', whysCompleto && capturaDesbloqueada);
  toggleComplete('conn-2', whysCompleto && capturaDesbloqueada);
  toggleComplete('tab-plan', planCompleto && capturaDesbloqueada);
}

/* ==========================================================================
   Clear All Button Visibility
   ========================================================================== */

function updateClearAllButton(): void {
  const hasDataVal = hasData();
  ['clearAllBtnDrawer', 'clearAllBtnTable'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('hidden', !hasDataVal);
  });
}

/* ==========================================================================
   Save Captura
   ========================================================================== */

function saveCaptura(): void {
  rcaData.captura = {
    fecha: (document.getElementById('fechaEvento') as HTMLInputElement)?.value || '',
    maquina: (document.getElementById('maquina') as HTMLSelectElement)?.value || '',
    tiempoParo: (document.getElementById('tiempoParo') as HTMLInputElement)?.value || '',
    problema: (document.getElementById('descripcionProblema') as HTMLTextAreaElement)?.value || '',
    sintomas: (document.getElementById('sintomas') as HTMLTextAreaElement)?.value || '',
    responsable: (document.getElementById('responsable') as HTMLInputElement)?.value || ''
  };

  if (!rcaData.captura.problema) {
    showToast('Describe el problema antes de continuar.', 'warning');
    return;
  }

  syncPlanFromAnalysis();
  persistCurrentState();
  updateTabLockState();
}

function clearCaptura(): void {
  const ids = ['fechaEvento', 'maquina', 'tiempoParo', 'descripcionProblema', 'sintomas', 'responsable'];
  ids.forEach(id => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el) el.value = '';
  });
  rcaData.captura = {};
  syncPlanFromAnalysis();
  persistCurrentState();
}

function resetWhysState(): void {
  rcaData.whys = { why1: '', why2: '', why3: '', why4: '', why5: '', wizardLevel: 1 };
}

/* ==========================================================================
   Ishikawa Generate & Button State
   ========================================================================== */

const ISHIKAWA_FIELDS = ['maquina', 'metodo', 'materiales', 'manoObra', 'medicion', 'medioAmbiente'];

function updateIshikawaGenerateBtn(): void {
  const allFilled = ISHIKAWA_FIELDS.every(cat => {
    const field = document.getElementById(`ishikawa-${cat}`) as HTMLTextAreaElement | null;
    return (field?.value?.trim()?.length ?? 0) > 0;
  });
  const btn = document.getElementById('btn-generar-ishikawa') as HTMLButtonElement | null;
  const area = document.getElementById('ishikawa-generate-area');
  if (btn) btn.disabled = !allFilled;
  if (area) area.classList.toggle('ready', allFilled);
}

function generateIshikawa(): void {
  saveIshikawaData();

  // Scroll to the diagram after a small delay to let it render
  setTimeout(() => {
    const diagram = document.getElementById('ishikawa-diagram');
    if (diagram && !diagram.classList.contains('hidden')) {
      diagram.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 100);
}

/* ==========================================================================
   Ishikawa Fullscreen Modal
   ========================================================================== */

function viewIshikawaFullscreen(): void {
  const overlay = document.getElementById('ish-modal-overlay');
  const modalSvg = overlay?.querySelector('.ish-modal-content svg');
  const sourceSvg = document.querySelector('#ishikawa-diagram svg');
  if (!overlay || !modalSvg || !sourceSvg) return;

  modalSvg.innerHTML = sourceSvg.innerHTML;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeIshikawaModal(): void {
  const overlay = document.getElementById('ish-modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ==========================================================================
   Step Menu & Clear Current Step
   ========================================================================== */

function toggleStepMenu(e: Event): void {
  e.stopPropagation();
  const menu = document.getElementById('step-nav-menu');
  if (menu) menu.classList.toggle('open');
}

async function clearCurrentStep(): Promise<void> {
  const menu = document.getElementById('step-nav-menu');
  if (menu) menu.classList.remove('open');

  const currentTab = document.querySelector('[id^="content-"]:not(.hidden)');
  if (!currentTab) return;
  const currentId = currentTab.id.replace('content-', '');

  const labelMap: Record<string, string> = {
    captura: 'Captura del Problema',
    ishikawa: 'Diagrama de Ishikawa',
    '5whys': '5 Porqués',
    plan: 'Plan de Acción'
  };
  const confirmed = await confirmAction(`¿Limpiar todos los datos de ${labelMap[currentId] || currentId}?`);
  if (!confirmed) return;

  switch (currentId) {
    case 'captura':
      clearCaptura();
      break;
    case 'ishikawa':
      clearIshikawa(syncPlanFromAnalysis, persistCurrentState);
      updateIshikawaGenerateBtn();
      break;
    case '5whys':
      clearWhys(resetWhysState, syncPlanFromAnalysis, persistCurrentState);
      break;
    case 'plan':
      clearActionPlan();
      persistCurrentState();
      break;
  }

  updateTabLockState();
  updateClearAllButton();
  updateStepNav();
}

/* ==========================================================================
   Sync Plan from Analysis
   ========================================================================== */

function syncPlanFromAnalysis(): void {
  updateResumen();
}

function updateResumen(): void {
  const resumenProblema = document.getElementById('resumenProblema');
  const resumenCausa = document.getElementById('resumenCausa');
  if (resumenProblema) resumenProblema.textContent = rcaData.captura.problema || 'No definido';
  const causaRaiz = getCurrentCauseSummary();
  if (resumenCausa) resumenCausa.textContent = causaRaiz || 'No definida';
}

/* ==========================================================================
   Save Analysis (from Plan step)
   ========================================================================== */

async function saveAnalysis(): Promise<void> {
  // Save current plan data from DOM
  persistCurrentState();

  // Check if there's data to save
  if (!rcaData.captura?.problema) {
    showToast('No hay datos para guardar.', 'warning');
    return;
  }

  try {
    // Snapshot the data before clearing
    const savedData = JSON.parse(JSON.stringify(rcaData));

    // Always overwrite the single analisis.json file
    await saveAnalysisFile(rcaData);
    commitWizardDataToSaved();
    showToast('Guardado correctamente.', 'success');

    // Clear everything silently (DOM + state) and start fresh
    await clearAll(true);

    // Restore rcaData so the data table / review drawer can show the saved data,
    // while the wizard forms stay clean
    setRcaData(savedData);
  } catch (err) {
    showToast('Error al guardar el análisis: ' + err, 'error');
  }
}

/* ==========================================================================
   Clear All (wizard only — keeps rcaData intact for the table view)
   ========================================================================== */

async function clearAll(skipConfirm = false): Promise<void> {
  if (!skipConfirm) {
    const confirmed = await confirmDanger(
      'Esta acción no se puede deshacer.',
      '¿Limpiar TODO el análisis?'
    );
    if (!confirmed) return;
  }

  const ids = ['fechaEvento', 'maquina', 'tiempoParo', 'descripcionProblema', 'sintomas', 'responsable'];
  ids.forEach(id => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el) el.value = '';
  });

  CATEGORY_ORDER.forEach(cat => {
    const el = document.getElementById(`ishikawa-${cat}`) as HTMLTextAreaElement | null;
    if (el) el.value = '';
  });

  const ishikawaDiagram = document.getElementById('ishikawa-diagram');
  if (ishikawaDiagram) ishikawaDiagram.classList.add('hidden');
  updateIshikawaDiagram({
    maquina: false, metodo: false, materiales: false,
    manoObra: false, medicion: false, medioAmbiente: false
  });

  clearActionPlan();

  const resumenProblema = document.getElementById('resumenProblema');
  const resumenCausa = document.getElementById('resumenCausa');
  if (resumenProblema) resumenProblema.textContent = 'No definido';
  if (resumenCausa) resumenCausa.textContent = 'No definida';

  renderWhysWizard();
  updateIshikawaGenerateBtn();

  // Lock all tabs visually and reset step indicators (rcaData is preserved for the table view)
  const allStepIds = ['tab-captura', 'conn-0', 'tab-ishikawa', 'conn-1', 'tab-5whys', 'conn-2', 'tab-plan'];
  allStepIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('completed');
  });
  const lockedTabs = ['ishikawa', '5whys', 'plan'];
  lockedTabs.forEach(tabName => {
    const btn = document.getElementById(`tab-${tabName}`);
    if (btn) {
      btn.classList.add('tab-locked');
      btn.onclick = null;
    }
  });
  const capturaBtn = document.getElementById('tab-captura');
  if (capturaBtn) capturaBtn.classList.remove('tab-active');

  document.querySelectorAll('.step-header-actions').forEach(el => {
    el.classList.add('hidden');
  });

  showTab('captura');
  updateClearAllButton();
}

/* ==========================================================================
   Clear All from Table View (deletes file + resets rcaData, leaves wizard)
   ========================================================================== */

async function clearAllFromTable(): Promise<void> {
  const confirmed = await confirmDanger(
    'Se eliminará el archivo guardado y se limpiarán los datos de la tabla.',
    '¿Limpiar todo?'
  );
  if (!confirmed) return;

  const empty: RCAData = {
    captura: {},
    whys: { why1: '', why2: '', why3: '', why4: '', why5: '', wizardLevel: 1 },
    ishikawa: {},
    acciones: { correctivas: [], preventivas: [] }
  };
  setRcaData(empty);
  setSavedRcaData(empty);

  localStorage.removeItem('rcaData');

  try {
    await deleteAnalysis();
  } catch {
    // Silently fail if file doesn't exist
  }

  renderDataTable();
}

/* ==========================================================================
   Data Change Listeners
   ========================================================================== */

function addDataListeners(): void {
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

  const whysContainer = document.getElementById('content-5whys');
  if (whysContainer) {
    whysContainer.addEventListener('input', function(e) {
      if ((e.target as HTMLElement).id === 'why-active-input') updateClearAllButton();
    });
    whysContainer.addEventListener('change', function(e) {
      if ((e.target as HTMLElement).id === 'why-active-input') updateClearAllButton();
    });
  }

  // Validation listeners for step-nav buttons
  const problemaField = document.getElementById('descripcionProblema');
  if (problemaField) {
    problemaField.addEventListener('input', () => updateNextButtonState('captura'));
    problemaField.addEventListener('change', () => updateNextButtonState('captura'));
  }

  // Ishikawa fields - check all-filled state for generar button
  ISHIKAWA_FIELDS.forEach(cat => {
    const field = document.getElementById(`ishikawa-${cat}`);
    if (field) {
      field.addEventListener('input', () => {
        updateClearAllButton();
        updateIshikawaGenerateBtn();
      });
      field.addEventListener('change', () => {
        updateClearAllButton();
        updateIshikawaGenerateBtn();
      });
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
   UI Initialization
   ========================================================================== */

function initializeDatePicker(): void {
  const fechaInput = document.getElementById('fechaEvento') as HTMLInputElement | null;
  const today = getTodayISODate();
  if (fechaInput) {
    fechaInput.max = today;
    if (!fechaInput.value) fechaInput.value = today;
  }
  initializeDateInputs();
  initializeDropdowns();
}

function initializeDateInputs(root: Document | HTMLElement = document): void {
  const dateInputs = root.querySelectorAll ? root.querySelectorAll('input[type="date"]') : [];
  dateInputs.forEach(input => {
    const el = input as HTMLInputElement;
    if (el.dataset.datepickerInitialized === 'true') return;
    el.dataset.datepickerInitialized = 'true';
    el.addEventListener('click', function() {
      this.focus();
      if (typeof this.showPicker === 'function') {
        this.showPicker();
      }
    });
    el.addEventListener('focus', function() {
      if (typeof this.showPicker === 'function') {
        setTimeout(() => { this.showPicker(); }, 0);
      }
    });
  });
}

function initializeDropdowns(): void {
  const selects = document.querySelectorAll('select');
  selects.forEach(select => {
    select.addEventListener('mousedown', function(this: HTMLSelectElement, e: MouseEvent) {
      const rect = this.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      if (spaceBelow < 200) {
        window.scrollBy({ top: 200 - spaceBelow, behavior: 'smooth' });
      }
    });
    select.addEventListener('focus', function() {
      const wrapper = this.closest('.select-wrapper') as HTMLElement | null;
      if (wrapper) {
        wrapper.style.position = 'relative';
        wrapper.style.zIndex = '1000';
      }
    });
    select.addEventListener('blur', function() {
      const wrapper = this.closest('.select-wrapper') as HTMLElement | null;
      if (wrapper) {
        setTimeout(() => { wrapper.style.zIndex = '10'; }, 300);
      }
    });
  });
}

/* ==========================================================================
   Initialization on DOMContentLoaded
   ========================================================================== */

window.addEventListener('DOMContentLoaded', function() {
  registerGlobalAPI();
  initializeDatePicker();

  // Restore saved data
  const saved = localStorage.getItem('rcaData');
  if (saved) {
    const parsed = JSON.parse(saved);
    const restored: RCAData = {
      captura: parsed.captura || {},
      whys: {
        why1: parsed.whys?.why1 || '',
        why2: parsed.whys?.why2 || '',
        why3: parsed.whys?.why3 || '',
        why4: parsed.whys?.why4 || '',
        why5: parsed.whys?.why5 || '',
        wizardLevel: parsed.whys?.wizardLevel ?? 1,
        causaRaiz: parsed.whys?.causaRaiz
      },
      ishikawa: parsed.ishikawa || {},
      acciones: parsed.acciones || { correctivas: [], preventivas: [] }
    };
    setRcaData(restored);
    setSavedRcaData(JSON.parse(JSON.stringify(restored)));

    if (rcaData.captura.fecha) {
      const el = document.getElementById('fechaEvento') as HTMLInputElement | null;
      if (el) el.value = rcaData.captura.fecha;
    }
    if (rcaData.captura.maquina) {
      const el = document.getElementById('maquina') as HTMLSelectElement | null;
      if (el) el.value = rcaData.captura.maquina;
    }
    if (rcaData.captura.tiempoParo) {
      const el = document.getElementById('tiempoParo') as HTMLInputElement | null;
      if (el) el.value = rcaData.captura.tiempoParo;
    }
    if (rcaData.captura.problema) {
      const el = document.getElementById('descripcionProblema') as HTMLTextAreaElement | null;
      if (el) el.value = rcaData.captura.problema;
    }
    if (rcaData.captura.sintomas) {
      const el = document.getElementById('sintomas') as HTMLTextAreaElement | null;
      if (el) el.value = rcaData.captura.sintomas;
    }
    if (rcaData.captura.responsable) {
      const el = document.getElementById('responsable') as HTMLInputElement | null;
      if (el) el.value = rcaData.captura.responsable;
    }

    if (typeof rcaData.whys.wizardLevel !== 'number') {
      let hasFilled = false;
      let lastLevel = 0;
      for (let i = 1; i <= 5; i++) {
        if (rcaData.whys[`why${i}` as keyof typeof rcaData.whys]) { hasFilled = true; lastLevel = i; }
      }
      rcaData.whys.wizardLevel = hasFilled ? 0 : 1;
    }

    CATEGORY_ORDER.forEach(cat => {
      if (rcaData.ishikawa[cat]) {
        const el = document.getElementById(`ishikawa-${cat}`) as HTMLTextAreaElement | null;
        if (el) el.value = rcaData.ishikawa[cat]!;
      }
    });
    refreshIshikawaDiagram();
    updateIshikawaGenerateBtn();

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

  renderWhysWizard();

  setTimeout(() => {
    syncPlanFromAnalysis();
  }, 500);

  addDataListeners();
  updateTabLockState();
  updateClearAllButton();
  updateStepNav();

  // Restore last active step (defaulting to captura if none saved or invalid)
  const savedStep = localStorage.getItem('rcaCurrentStep');
  const initialStep = savedStep && (STEPS as readonly string[]).includes(savedStep) ? savedStep : 'captura';
  showTab(initialStep);

  // Auto-load analysis JSON file if it exists
  loadAnalysisFromJson();

  // Remove loading class to reveal content after everything is initialized and painted
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove('loading');
    });
  });
});

/* ==========================================================================
   Auto-load / Delete the single analysis JSON file
   ========================================================================== */

async function loadAnalysisFromJson(): Promise<void> {
  try {
    const result = await checkAnalysisFile();
    if (!result.exists) return;

    const record = await loadAnalysis();
    if (!record.data) return;

    // Restore data to state and DOM
    const data = record.data;
    const restored: RCAData = {
      captura: data.captura || {},
      whys: {
        why1: data.whys?.why1 || '',
        why2: data.whys?.why2 || '',
        why3: data.whys?.why3 || '',
        why4: data.whys?.why4 || '',
        why5: data.whys?.why5 || '',
        wizardLevel: data.whys?.wizardLevel ?? 1,
        causaRaiz: data.whys?.causaRaiz
      },
      ishikawa: data.ishikawa || {},
      acciones: data.acciones || { correctivas: [], preventivas: [] }
    };
    setRcaData(restored);
    setSavedRcaData(JSON.parse(JSON.stringify(restored)));

    // Restore DOM fields
    const cap = rcaData.captura;
    const fechaEl = document.getElementById('fechaEvento') as HTMLInputElement | null;
    if (fechaEl && cap.fecha) fechaEl.value = cap.fecha;
    const maqEl = document.getElementById('maquina') as HTMLSelectElement | null;
    if (maqEl && cap.maquina) maqEl.value = cap.maquina;
    const tpEl = document.getElementById('tiempoParo') as HTMLInputElement | null;
    if (tpEl && cap.tiempoParo) tpEl.value = cap.tiempoParo;
    const probEl = document.getElementById('descripcionProblema') as HTMLTextAreaElement | null;
    if (probEl && cap.problema) probEl.value = cap.problema;
    const sintEl = document.getElementById('sintomas') as HTMLTextAreaElement | null;
    if (sintEl && cap.sintomas) sintEl.value = cap.sintomas;
    const respEl = document.getElementById('responsable') as HTMLInputElement | null;
    if (respEl && cap.responsable) respEl.value = cap.responsable;

    CATEGORY_ORDER.forEach(cat => {
      if (rcaData.ishikawa[cat]) {
        const el = document.getElementById(`ishikawa-${cat}`) as HTMLTextAreaElement | null;
        if (el) el.value = rcaData.ishikawa[cat]!;
      }
    });
    refreshIshikawaDiagram();
    updateIshikawaGenerateBtn();

    if (rcaData.acciones.correctivas.length > 0) {
      rcaData.acciones.correctivas.forEach((accion, index) => {
        addAccionToDOM('correctiva', accion, index);
      });
    }
    if (rcaData.acciones.preventivas.length > 0) {
      rcaData.acciones.preventivas.forEach((accion, index) => {
        addAccionToDOM('preventiva', accion, index);
      });
    }

    updateTabLockState();
    updateClearAllButton();
    syncPlanFromAnalysis();
    renderWhysWizard();
  } catch {
    // Silently fail — start fresh if JSON can't be loaded
  }
}

async function deleteAnalysisFile(): Promise<void> {
  const confirmed = await confirmDanger(
    'Esta acción no se puede deshacer.',
    '¿Eliminar el análisis guardado?'
  );
  if (!confirmed) return;

  try {
    await deleteAnalysis();
    showToast('Análisis eliminado.', 'success');
    await clearAll(true);
  } catch (err) {
    showToast('Error al eliminar: ' + err, 'error');
  }
}
