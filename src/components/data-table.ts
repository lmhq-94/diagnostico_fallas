import { buildSectionRows, setEditingKey, getEditingKey, rcaData, savedRcaData, setSavedRcaData, removeActionFromState, persistCurrentState, DATA_SECTIONS, type DataSection, type RCAWhys, type RCAIshikawa } from '../state/store';
import { confirmAction } from '../utils/confirm';
import { closeReviewDrawer, renderDrawerTable } from './drawer';
import { addAccionToDOM } from './plan';
import { updateAnalysisFile } from '../services/analysisStorage';

/* ==========================================================================
   Full Data Table View Component — Section Tabs
   ========================================================================== */

let previousTab: string | null = null;
let currentDataTab: DataSection = 'captura';

/** Opens or closes the data table view */
export function toggleTableView(): void {
  const tabla = document.getElementById('content-tabla');
  if (tabla && !tabla.classList.contains('hidden')) {
    closeTableView();
  } else {
    openTableView();
  }
}

/** Opens the full data table view */
export function openTableView(): void {
  closeReviewDrawer();
  document.querySelectorAll('[id^="content-"]').forEach(el => {
    if (!el.classList.contains('hidden') && el.id !== 'content-tabla') {
      previousTab = el.id.replace('content-', '');
    }
  });
  document.querySelectorAll('[id^="content-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.remove('tab-active'));
  const tabla = document.getElementById('content-tabla');
  if (tabla) tabla.classList.remove('hidden');
  currentDataTab = 'captura';
  renderToolbar();
  renderDataTable();
  updateSubtabUI();
  const fab = document.getElementById('fab');
  if (fab) fab.classList.add('hidden');
  // Hide stepper and bottom nav for more space
  const stepper = document.querySelector('.stepper-wrap') as HTMLElement | null;
  const stepNav = document.getElementById('step-nav') as HTMLElement | null;
  if (stepper) stepper.style.display = 'none';
  if (stepNav) stepNav.style.display = 'none';
}

/** Closes the data table view and returns to previous tab */
export function closeTableView(): void {
  const tabla = document.getElementById('content-tabla');
  if (tabla) tabla.classList.add('hidden');
  // Restore stepper and bottom nav
  const stepper = document.querySelector('.stepper-wrap') as HTMLElement | null;
  const stepNav = document.getElementById('step-nav') as HTMLElement | null;
  if (stepper) stepper.style.display = '';
  if (stepNav) stepNav.style.display = '';
  if (previousTab && previousTab !== 'tabla') {
    window.__showTab(previousTab);
  } else {
    window.__showTab('captura');
  }
}

/** Switch sub-tab within the data table */
export function switchDataTab(section: DataSection): void {
  currentDataTab = section;
  renderDataTable();
  updateSubtabUI();
}

/** Updates the sub-tab button active states */
function updateSubtabUI(): void {
  document.querySelectorAll('.data-subtab').forEach(btn => {
    const section = btn.getAttribute('data-section');
    btn.classList.toggle('active', section === currentDataTab);
  });
}

/** Renders the sticky toolbar with export/clear actions */
export function renderToolbar(): void {
  const toolbar = document.getElementById('data-table-toolbar');
  if (!toolbar) return;
  toolbar.innerHTML = `
    <div class="toolbar-group">
      <span class="toolbar-label">Exportar</span>
      <button class="toolbar-btn" onclick="window.__handlePDFExport()" title="Exportar PDF">
        <i class="fas fa-file-pdf"></i>
        <span>PDF</span>
      </button>
      <button class="toolbar-btn" onclick="window.__exportExcel()" title="Exportar Excel">
        <i class="fas fa-file-excel"></i>
        <span>Excel</span>
      </button>
    </div>
    <div class="toolbar-divider"></div>
    <div class="toolbar-group">
      <button class="toolbar-btn toolbar-btn-danger" onclick="window.__clearAllFromTable()" title="Limpiar todo">
        <i class="fas fa-trash-alt"></i>
        <span>Limpiar Todo</span>
      </button>
    </div>
  `;
}

/** Renders the current sub-tab's section table from the loaded JSON data */
export function renderDataTable(): void {
  const container = document.getElementById('data-table-body');
  if (!container) return;

  const sectionHtml = buildSectionRows(currentDataTab, savedRcaData);

  container.innerHTML = `<div class="data-section-block">${sectionHtml}</div>`;

  if (getEditingKey()) {
    requestAnimationFrame(() => {
      const input = container.querySelector(`[data-key="${getEditingKey()}"] .inline-input`) as HTMLInputElement | null;
      if (input) input.focus();
    });
  }
}

/** Auto-syncs the current data to the saved file */
function tryAutoSyncFile(): void {
  // Fire-and-forget: silently update the file in background
  (async () => {
    try {
      persistCurrentState(); // ensure DOM data is captured
      await updateAnalysisFile(savedRcaData);
    } catch {
      // Silently fail
    }
  })();
}

/** Starts inline editing of a row */
export function startEdit(key: string): void {
  setEditingKey(key);
  const drawer = document.getElementById('review-drawer');
  if (drawer && drawer.classList.contains('open')) {
    renderDrawerTable();
  } else {
    renderDataTable();
  }
}

/** Saves the edited value */
export function saveEdit(
  key: string,
  renderWhysWizard: () => void,
  refreshIshikawaDiagram: () => void,
  persist: () => void
): void {
  const input = document.querySelector(`#data-table-body [data-key="${key}"] .inline-input`) as HTMLInputElement
             || document.querySelector(`#drawer-tables-container [data-key="${key}"] .inline-input`) as HTMLInputElement;
  if (!input) return;
  const newVal = input.value.trim();
  applyFieldEdit(key, newVal);
  setEditingKey(null);
  persist();
  if (key.startsWith('whys.') || key.startsWith('5whys.')) renderWhysWizard();
  if (key.startsWith('ishikawa.')) refreshIshikawaDiagram();
  renderDataTable();
  renderDrawerTable();
  // Auto-sync to saved file
  tryAutoSyncFile();
}

/** Cancels editing */
export function cancelEdit(): void {
  setEditingKey(null);
  renderDataTable();
  renderDrawerTable();
}

/** Deletes (clears) a field */
export async function deleteField(
  key: string,
  renderWhysWizard: () => void,
  refreshIshikawaDiagram: () => void,
  persist: () => void
): Promise<void> {
  const confirmed = await confirmAction('¿Eliminar este campo?');
  if (!confirmed) return;
  applyFieldEdit(key, '');
  setEditingKey(null);
  persist();
  if (key.startsWith('whys.') || key.startsWith('5whys.')) renderWhysWizard();
  if (key.startsWith('ishikawa.')) refreshIshikawaDiagram();
  renderDataTable();
  renderDrawerTable();
  // Auto-sync to saved file
  tryAutoSyncFile();
}

/** Applies a change to rcaData, savedRcaData, and the DOM */
function applyFieldEdit(key: string, value: string): void {
  const parts = key.split('.');
  const field = parts[1];

  if (parts[0] === 'captura') {
    rcaData.captura = rcaData.captura || {};
    (rcaData.captura as Record<string, string>)[field] = value;
    savedRcaData.captura = savedRcaData.captura || {};
    (savedRcaData.captura as Record<string, string>)[field] = value;
    const domMap: Record<string, string> = {
      maquina: 'maquina',
      problema: 'descripcionProblema',
      fecha: 'fechaEvento',
      tiempoParo: 'tiempoParo',
      sintomas: 'sintomas',
      responsable: 'responsable'
    };
    const elId = domMap[field];
    if (elId) {
      const el = document.getElementById(elId) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (el) el.value = value;
    }
  } else if (parts[0] === 'whys' || parts[0] === '5whys') {
    rcaData.whys = rcaData.whys || { why1: '', why2: '', why3: '', why4: '', why5: '', wizardLevel: 1 };
    (rcaData.whys as unknown as Record<string, string | number>)[field] = value;
    savedRcaData.whys = savedRcaData.whys || { why1: '', why2: '', why3: '', why4: '', why5: '', wizardLevel: 1 };
    (savedRcaData.whys as unknown as Record<string, string | number>)[field] = value;
  } else if (parts[0] === 'ishikawa') {
    rcaData.ishikawa = rcaData.ishikawa || {};
    (rcaData.ishikawa as Record<string, string>)[field] = value;
    savedRcaData.ishikawa = savedRcaData.ishikawa || {};
    (savedRcaData.ishikawa as Record<string, string>)[field] = value;
    const el = document.getElementById(`ishikawa-${field}`) as HTMLTextAreaElement | null;
    if (el) el.value = value;
  } else if (parts[0] === 'plan') {
    const tipo = parts[1];
    const index = parseInt(parts[2], 10);
    const planField = parts[3];
    const acciones = rcaData.acciones || { correctivas: [], preventivas: [] };
    const list = tipo === 'correctivas' ? acciones.correctivas : acciones.preventivas;
    if (index >= 0 && index < list.length && planField) {
      const action = list[index];
      if (planField === 'descripcion') action.descripcion = value;
      else if (planField === 'responsable') action.responsable = value;
      else if (planField === 'fecha') action.fecha = value;
      else if (planField === 'prioridad') action.prioridad = value as 'alta' | 'media' | 'baja';

      const fieldSuffix: Record<string, string> = {
        descripcion: 'desc',
        responsable: 'resp',
        fecha: 'fecha',
        prioridad: 'prio'
      };
      const domFieldId = fieldSuffix[planField] || planField;
      const domTipo = tipo === 'correctivas' ? 'correctiva' : 'preventiva';
      const domInput = document.getElementById(`accion-${domTipo}-${index}-${domFieldId}`) as HTMLInputElement | HTMLSelectElement | null;
      if (domInput) domInput.value = value;
    }
    rcaData.acciones = acciones;
    // Also update savedRcaData.acciones
    const savedAcciones = savedRcaData.acciones || { correctivas: [], preventivas: [] };
    const savedList = tipo === 'correctivas' ? savedAcciones.correctivas : savedAcciones.preventivas;
    if (index >= 0 && index < savedList.length && planField) {
      const savedAction = savedList[index];
      if (planField === 'descripcion') savedAction.descripcion = value;
      else if (planField === 'responsable') savedAction.responsable = value;
      else if (planField === 'fecha') savedAction.fecha = value;
      else if (planField === 'prioridad') savedAction.prioridad = value as 'alta' | 'media' | 'baja';
    }
    savedRcaData.acciones = savedAcciones;
  }
}

/** Deletes a single action row from the Plan section */
export async function deletePlanRow(
  tipo: string,
  index: number,
  persist: () => void
): Promise<void> {
  const list = tipo === 'correctivas' ? rcaData.acciones.correctivas : rcaData.acciones.preventivas;
  if (index < 0 || index >= list.length) return;
  const confirmed = await confirmAction('¿Eliminar esta acción?');
  if (!confirmed) return;

  removeActionFromState(tipo, index);
  // Also remove from savedRcaData
  const savedList = tipo === 'correctivas' ? savedRcaData.acciones.correctivas : savedRcaData.acciones.preventivas;
  if (index >= 0 && index < savedList.length) savedList.splice(index, 1);

  const containerId = `acciones${tipo === 'correctivas' ? 'Correctivas' : 'Preventivas'}`;
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
    const updatedList = tipo === 'correctivas' ? rcaData.acciones.correctivas : rcaData.acciones.preventivas;
    updatedList.forEach((a, i) => {
      addAccionToDOM(tipo === 'correctivas' ? 'correctiva' : 'preventiva', a, i);
    });
  }

  setEditingKey(null);
  persist();
  renderDataTable();
  renderDrawerTable();
  tryAutoSyncFile();
}

/** Deletes (clears) all fields in a section */
export async function deleteSection(
  section: string,
  renderWhysWizard: () => void,
  refreshIshikawaDiagram: () => void,
  persist: () => void
): Promise<void> {
  const labelMap: Record<string, string> = {
    captura: 'Captura',
    ishikawa: 'Ishikawa',
    '5whys': '5 Porqués',
    plan: 'Plan de Acción'
  };
  const confirmed = await confirmAction(`¿Limpiar todos los datos de ${labelMap[section] || section}?`);
  if (!confirmed) return;

  if (section === 'captura') {
    rcaData.captura = {};
    savedRcaData.captura = {};
    ['maquina', 'descripcionProblema', 'fechaEvento', 'tiempoParo', 'sintomas', 'responsable'].forEach(id => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (el) el.value = '';
    });
  } else if (section === 'ishikawa') {
    rcaData.ishikawa = {};
    savedRcaData.ishikawa = {};
    ['maquina', 'metodo', 'materiales', 'manoObra', 'medicion', 'medioAmbiente'].forEach(field => {
      const el = document.getElementById(`ishikawa-${field}`) as HTMLTextAreaElement | null;
      if (el) el.value = '';
    });
  } else if (section === '5whys') {
    rcaData.whys = { why1: '', why2: '', why3: '', why4: '', why5: '', wizardLevel: 1 };
    savedRcaData.whys = { why1: '', why2: '', why3: '', why4: '', why5: '', wizardLevel: 1 };
  } else if (section === 'plan') {
    rcaData.acciones = { correctivas: [], preventivas: [] };
    savedRcaData.acciones = { correctivas: [], preventivas: [] };
    const corrContainer = document.getElementById('accionesCorrectivas');
    const prevContainer = document.getElementById('accionesPreventivas');
    if (corrContainer) corrContainer.innerHTML = '';
    if (prevContainer) prevContainer.innerHTML = '';
  }

  setEditingKey(null);
  persist();
  if (section === '5whys') renderWhysWizard();
  if (section === 'ishikawa') refreshIshikawaDiagram();
  renderDataTable();
  renderDrawerTable();
  tryAutoSyncFile();
}

/** Needed by drawer close buttons */
declare global {
  interface Window {
    __closeReviewDrawer: () => void;
    __closeTableView: () => void;
    __showTab: (name: string) => void;
    __switchDataTab: (section: string) => void;
  }
}
