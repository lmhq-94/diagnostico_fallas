import { buildSectionRows, setEditingKey, getEditingKey, rcaData, type RCAWhys, type RCAIshikawa, type DataSection } from '../state/store';
import { closeReviewDrawer, renderDrawerTable } from './drawer';

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

/** Renders the current section's data table */
export function renderDataTable(): void {
  const tbody = document.getElementById('data-table-body');
  if (!tbody) return;
  tbody.innerHTML = buildSectionRows(currentDataTab);
  if (getEditingKey()) {
    requestAnimationFrame(() => {
      const input = tbody.querySelector(`tr[data-key="${getEditingKey()}"] .inline-input`) as HTMLInputElement | null;
      if (input) input.focus();
    });
  }
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
  const input = document.querySelector(`#data-table-body tr[data-key="${key}"] .inline-input`) as HTMLInputElement
             || document.querySelector(`#drawer-table-body tr[data-key="${key}"] .inline-input`) as HTMLInputElement;
  if (!input) return;
  const newVal = input.value.trim();
  applyFieldEdit(key, newVal);
  setEditingKey(null);
  persist();
  if (key.startsWith('whys.')) renderWhysWizard();
  if (key.startsWith('ishikawa.')) refreshIshikawaDiagram();
  renderDataTable();
  renderDrawerTable();
}

/** Cancels editing */
export function cancelEdit(): void {
  setEditingKey(null);
  renderDataTable();
  renderDrawerTable();
}

/** Deletes (clears) a field */
export function deleteField(
  key: string,
  renderWhysWizard: () => void,
  refreshIshikawaDiagram: () => void,
  persist: () => void
): void {
  if (!confirm('¿Eliminar este campo?')) return;
  applyFieldEdit(key, '');
  setEditingKey(null);
  persist();
  if (key.startsWith('whys.')) renderWhysWizard();
  if (key.startsWith('ishikawa.')) refreshIshikawaDiagram();
  renderDataTable();
  renderDrawerTable();
}

/** Applies a change to rcaData and the DOM */
function applyFieldEdit(key: string, value: string): void {
  const parts = key.split('.');
  const field = parts[1];

  if (parts[0] === 'captura') {
    rcaData.captura = rcaData.captura || {};
    (rcaData.captura as Record<string, string>)[field] = value;
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
  } else if (parts[0] === 'whys') {
    rcaData.whys = rcaData.whys || { why1: '', why2: '', why3: '', why4: '', why5: '', wizardLevel: 1 };
    (rcaData.whys as Record<string, string | number>)[field] = value;
  } else if (parts[0] === 'ishikawa') {
    rcaData.ishikawa = rcaData.ishikawa || {};
    (rcaData.ishikawa as Record<string, string>)[field] = value;
    const el = document.getElementById(`ishikawa-${field}`) as HTMLTextAreaElement | null;
    if (el) el.value = value;
  }
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
