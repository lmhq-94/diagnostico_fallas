import './style.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { rcaData, setRcaData, persistCurrentState, hasData, CATEGORY_ORDER, type RCAData } from './state/store';
import { escapeHtml, getTodayISODate } from './utils/text';
import { showToast } from './utils/toast';
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
import { toggleTableView, openTableView, closeTableView, renderDataTable, startEdit, saveEdit, cancelEdit, deleteField } from './components/data-table';
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
    __generateIshikawa: () => void;
    __startEdit: (key: string) => void;
    __saveEdit: (key: string) => void;
    __cancelEdit: () => void;
    __deleteField: (key: string) => void;
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
  window.__whysNext = () => {
    whysNext(syncPlan, persistCurrentState);
    updateStepNav();
  };
  window.__whysPrev = () => {
    whysPrev(syncPlan, persistCurrentState);
    updateStepNav();
  };
  window.__whysFinish = () => {
    whysFinish(syncPlan, persistCurrentState);
    updateStepNav();
  };
  window.__whysEdit = whysEdit;
  window.__toggleWhysTimeline = toggleWhysTimeline;
  window.__clearWhys = () => clearWhys(resetWhysState, syncPlan, persistCurrentState);
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
  window.__navigateStep = (dir: number) => navigateStep(dir);
  window.__toggleStepMenu = toggleStepMenu;
  window.__clearCurrentStep = clearCurrentStep;
  window.__generateIshikawa = generateIshikawa;

  // Close step menu on outside click
  document.addEventListener('click', function(e: Event) {
    const menu = document.getElementById('step-nav-menu');
    const btn = document.querySelector('.step-nav-btn-more');
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
        rcaData.whys[`why${level}` as keyof typeof rcaData.whys] = input.value.trim();
      }
    }
    persistCurrentState();
  }

  showTab(nextTab);
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

  // Update prev button
  const prevBtn = document.getElementById('step-nav-prev') as HTMLButtonElement | null;
  if (prevBtn) {
    prevBtn.disabled = currentIndex === 0;
  }

  // Update the right side
  const navRight = document.getElementById('step-nav-right');
  if (!navRight) return;

  if (currentId === 'plan') {
    // Last step - no "Siguiente"
    navRight.innerHTML = '';
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
  const capturaCompleta = !!(rcaData.captura && rcaData.captura.problema);
  const whysCompleto = !!(rcaData.whys && (rcaData.whys.wizardLevel === 0 || rcaData.whys.causaRaiz));
  const acciones = rcaData.acciones || { correctivas: [], preventivas: [] };
  const ishikawaCompleto = !!(rcaData.ishikawa && CATEGORY_ORDER.some(cat => rcaData.ishikawa[cat]));
  const planCompleto = !!(acciones.correctivas.length > 0 || acciones.preventivas.length > 0);

  const lockedTabs = ['ishikawa', '5whys', 'plan'];
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

  const toggleComplete = (id: string, condition: boolean) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('completed', condition);
  };

  toggleComplete('tab-captura', capturaCompleta);
  toggleComplete('conn-0', capturaCompleta);
  toggleComplete('tab-ishikawa', ishikawaCompleto && capturaCompleta);
  toggleComplete('conn-1', ishikawaCompleto && capturaCompleta);
  toggleComplete('tab-5whys', whysCompleto && capturaCompleta);
  toggleComplete('conn-2', whysCompleto && capturaCompleta);
  toggleComplete('tab-plan', planCompleto && capturaCompleta);
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
    return field?.value?.trim()?.length > 0;
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
   Step Menu & Clear Current Step
   ========================================================================== */

function toggleStepMenu(e: Event): void {
  e.stopPropagation();
  const menu = document.getElementById('step-nav-menu');
  if (menu) menu.classList.toggle('open');
}

function clearCurrentStep(): void {
  const menu = document.getElementById('step-nav-menu');
  if (menu) menu.classList.remove('open');

  const currentTab = document.querySelector('[id^="content-"]:not(.hidden)');
  if (!currentTab) return;
  const currentId = currentTab.id.replace('content-', '');

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
   Clear All
   ========================================================================== */

function clearAll(): void {
  const confirmMessage = `¿Estás seguro de que quieres limpiar TODO el análisis actual?\nEsta acción no se puede deshacer.`;

  if (confirm(confirmMessage)) {
    const ids = ['fechaEvento', 'maquina', 'tiempoParo', 'descripcionProblema', 'sintomas', 'responsable'];
    ids.forEach(id => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (el) el.value = '';
    });

    const causaRaizBox = document.getElementById('causaRaizBox');
    if (causaRaizBox) causaRaizBox.classList.add('hidden');

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

    setRcaData({
      captura: {},
      whys: { why1: '', why2: '', why3: '', why4: '', why5: '', wizardLevel: 1 },
      ishikawa: {},
      acciones: { correctivas: [], preventivas: [] }
    });

    renderWhysWizard();
    localStorage.removeItem('rcaData');

    showTab('captura');
    updateTabLockState();
    updateClearAllButton();
  }
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
    setRcaData({
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
    });

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

  // Remove loading class to reveal content after everything is initialized and painted
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove('loading');
    });
  });
});
