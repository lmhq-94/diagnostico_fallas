import { escapeHtml } from '../utils/text';

/* ==========================================================================
   TypeScript Interfaces
   ========================================================================== */

export interface RCACaptura {
  fecha?: string;
  maquina?: string;
  tiempoParo?: string;
  problema?: string;
  sintomas?: string;
  responsable?: string;
}

export interface RCAWhys {
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  wizardLevel: number;
  causaRaiz?: string;
}

export interface RCAIshikawa {
  maquina?: string;
  metodo?: string;
  materiales?: string;
  manoObra?: string;
  medicion?: string;
  medioAmbiente?: string;
  [key: string]: string | undefined;
}

export interface Accion {
  descripcion: string;
  responsable: string;
  fecha: string;
  prioridad: 'alta' | 'media' | 'baja';
}

export interface RCAAcciones {
  correctivas: Accion[];
  preventivas: Accion[];
}

export interface RCAData {
  captura: RCACaptura;
  whys: RCAWhys;
  ishikawa: RCAIshikawa;
  acciones: RCAAcciones;
}

export interface IshikawaCategoryConfig {
  label: string;
  icon: string;
}

export interface ParetoItem {
  causa: string;
  frecuencia: number;
}

export interface ExportHistoryEntry {
  fecha: string;
  maquina: string;
  problema: string;
  tipoAccion: string;
  correctivoText: string;
  preventivoText: string;
  status: string;
  responsable: string;
  fechaFin: string;
  causaRaiz: string;
  ishikawa: RCAIshikawa;
}

/* ==========================================================================
   Ishikawa Category Configuration
   ========================================================================== */

export const ISHIKAWA_CATEGORY_CONFIG: Record<string, IshikawaCategoryConfig> = {
  maquina:       { label: 'Máquina',       icon: 'fas fa-cog' },
  metodo:        { label: 'Método',        icon: 'fas fa-clipboard-list' },
  materiales:    { label: 'Materiales',    icon: 'fas fa-box' },
  manoObra:      { label: 'Mano de obra',  icon: 'fas fa-users' },
  medicion:      { label: 'Medición',      icon: 'fas fa-chart-line' },
  medioAmbiente: { label: 'Medio ambiente', icon: 'fas fa-leaf' }
};

export const CATEGORY_ORDER: string[] = Object.keys(ISHIKAWA_CATEGORY_CONFIG);

/* ==========================================================================
   Global Application State
   ========================================================================== */

export let rcaData: RCAData = {
  captura: {},
  whys: { why1: '', why2: '', why3: '', why4: '', why5: '', wizardLevel: 1 },
  ishikawa: {},
  acciones: { correctivas: [], preventivas: [] }
};

/** Replace the entire rcaData (used during load/init) */
export function setRcaData(data: RCAData): void {
  rcaData = data;
}

/* ==========================================================================
   Persistence in localStorage
   ========================================================================== */

/** Re-index action IDs after deletion */
export function reindexAcciones(tipo: string): void {
  const container = document.getElementById(
    `acciones${tipo.charAt(0).toUpperCase() + tipo.slice(1)}s`
  );
  if (!container) return;

  Array.from(container.children).forEach((card, index) => {
    const descripcion = card.querySelector(`input[id^="accion-${tipo}-"][id$="-desc"]`) as HTMLInputElement | null;
    const responsable = card.querySelector(`input[id^="accion-${tipo}-"][id$="-resp"]`) as HTMLInputElement | null;
    const fecha = card.querySelector(`input[id^="accion-${tipo}-"][id$="-fecha"]`) as HTMLInputElement | null;
    const prioridad = card.querySelector(`select[id^="accion-${tipo}-"][id$="-prio"]`) as HTMLSelectElement | null;

    if (descripcion) descripcion.id = `accion-${tipo}-${index}-desc`;
    if (responsable) responsable.id = `accion-${tipo}-${index}-resp`;
    if (fecha) fecha.id = `accion-${tipo}-${index}-fecha`;
    if (prioridad) prioridad.id = `accion-${tipo}-${index}-prio`;
  });
}

/** Gets all actions from the DOM for a type (correctiva/preventiva) */
export function getAccionesFromDOM(tipo: string): Accion[] {
  return Array.from(
    document.querySelectorAll(`#acciones${tipo.charAt(0).toUpperCase() + tipo.slice(1)}s > div`)
  ).map((div, index) => ({
    descripcion: (document.getElementById(`accion-${tipo}-${index}-desc`) as HTMLInputElement)?.value || '',
    responsable: (document.getElementById(`accion-${tipo}-${index}-resp`) as HTMLInputElement)?.value || '',
    fecha: (document.getElementById(`accion-${tipo}-${index}-fecha`) as HTMLInputElement)?.value || '',
    prioridad: ((document.getElementById(`accion-${tipo}-${index}-prio`) as HTMLSelectElement)?.value || 'media') as 'alta' | 'media' | 'baja'
  }));
}

/** Saves the current state to localStorage */
export function persistCurrentState(): void {
  reindexAcciones('correctiva');
  reindexAcciones('preventiva');
  rcaData.acciones = {
    correctivas: getAccionesFromDOM('correctiva'),
    preventivas: getAccionesFromDOM('preventiva')
  };
  localStorage.setItem('rcaData', JSON.stringify(rcaData));
  // updateClearAllButton is called from main after all modules are loaded
}

/* ==========================================================================
   Data Detection & UI State
   ========================================================================== */

/** Checks if any data has been entered in any field */
export function hasData(): boolean {
  const f = rcaData.captura;
  const w = rcaData.whys || {};
  const ish = rcaData.ishikawa || {};

  return !!(
    f.fecha || f.maquina || f.tiempoParo || f.problema || f.sintomas || f.responsable ||
    w.why1 || w.why2 || w.why3 || w.why4 || w.why5 ||
    ish.maquina || ish.metodo || ish.materiales || ish.manoObra || ish.medicion || ish.medioAmbiente ||
    rcaData.acciones.correctivas.length > 0 || rcaData.acciones.preventivas.length > 0
  );
}

/** Checks if the problem capture is complete */
export function hasCapturaData(): boolean {
  return !!(rcaData.captura && rcaData.captura.problema);
}

/* ==========================================================================
   Data Formatting Helpers
   ========================================================================== */

function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const d = new Date(isoDate + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }
  }
  return isoDate;
}

function formatTiempoParo(minutes: string): string {
  if (!minutes) return '';
  const total = parseInt(minutes, 10);
  if (isNaN(total) || total < 0) return minutes;
  if (total === 0) return '0 min';
  if (total < 60) return `${total} min`;
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (mins === 0) {
    return `${hrs}h`;
  }
  return `${hrs}h ${mins}min`;
}

/* ==========================================================================
   Section data for sub-tabs inside the full data table
   ========================================================================== */

export const DATA_SECTIONS = ['captura', 'ishikawa', '5whys', 'plan'] as const;
export type DataSection = (typeof DATA_SECTIONS)[number];


/** Builds HTML rows for a single section with 3 columns: Campo | Valor | Acciones */
export function buildSectionRows(section: DataSection): string {
  const rows: string[] = [];
  const captura = rcaData.captura || {};
  const whys = rcaData.whys || {};
  const ishikawa = rcaData.ishikawa || {};
  const acciones = rcaData.acciones || { correctivas: [], preventivas: [] };

  if (section === 'captura') {
    const capturaFields: { key: string; label: string; format?: (v: string) => string }[] = [
      { key: 'maquina', label: 'Máquina' },
      { key: 'problema', label: 'Problema' },
      { key: 'fecha', label: 'Fecha', format: formatDate },
      { key: 'tiempoParo', label: 'Tiempo Paro', format: formatTiempoParo },
      { key: 'sintomas', label: 'Síntomas' },
      { key: 'responsable', label: 'Responsable' }
    ];
    capturaFields.forEach(f => {
      let value = captura[f.key as keyof RCACaptura] || '';
      if (f.format) value = f.format(value);
      rows.push(buildSectionFieldRow(`captura.${f.key}`, f.label, value));
    });
  } else if (section === 'ishikawa') {
    const ishikawaCats: { key: string; label: string }[] = [
      { key: 'maquina', label: 'Máquina' },
      { key: 'metodo', label: 'Método' },
      { key: 'materiales', label: 'Materiales' },
      { key: 'manoObra', label: 'Mano de obra' },
      { key: 'medicion', label: 'Medición' },
      { key: 'medioAmbiente', label: 'Medio Ambiente' }
    ];
    ishikawaCats.forEach(c => {
      const val = ishikawa[c.key] || '';
      rows.push(buildSectionFieldRow(`ishikawa.${c.key}`, c.label, val));
    });
  } else if (section === '5whys') {
    for (let i = 1; i <= 5; i++) {
      const val = whys[`why${i}` as keyof RCAWhys] || '';
      rows.push(buildSectionFieldRow(`whys.why${i}`, `Por qué ${i}`, val));
    }
    const causaRaiz = getCurrentCauseSummary();
    rows.push(buildSectionFieldRow(`whys.causaRaiz`, 'Causa Raíz', causaRaiz, true));
  } else if (section === 'plan') {
    const countC = acciones.correctivas.length;
    const countP = acciones.preventivas.length;
    rows.push(buildSectionPlanRow('correctiva', countC));
    rows.push(buildSectionPlanRow('preventiva', countP));
  }

  return rows.join('');
}

/** Builds a single field row with 3 columns for the section table */
function buildSectionFieldRow(key: string, field: string, value: string, isCauseRoot = false): string {
  const editingKey = _editingKey;
  const isEditing = editingKey === key;
  const displayVal = value ? escapeHtml(value) : '<span class="val-empty">—</span>';

  let valueCell: string;
  if (isEditing) {
    valueCell = `<div class="inline-edit">
      <input type="text" class="inline-input" value="${escapeHtml(value)}">
      <button class="inline-save" onclick="window.__saveEdit('${key}')"><i class="fas fa-check"></i></button>
      <button class="inline-cancel" onclick="window.__cancelEdit()"><i class="fas fa-times"></i></button>
    </div>`;
  } else {
    valueCell = displayVal;
  }

  const actions = isEditing ? '' : `
    <button class="cell-btn" onclick="window.__startEdit('${key}')" title="Editar"><i class="fas fa-pen"></i></button>
    ${isCauseRoot ? '' : `<button class="cell-btn btn-danger" onclick="window.__deleteField('${key}')" title="Eliminar"><i class="fas fa-trash-alt"></i></button>`}
  `;

  return `<tr data-key="${key}">
    <td class="cell-field">${field}</td>
    <td class="cell-value">${valueCell}</td>
    <td class="cell-actions">${actions}</td>
  </tr>`;
}

/** Builds a plan row for the section table */
function buildSectionPlanRow(tipo: string, count: number): string {
  const field = tipo === 'correctiva' ? 'Correctivas' : 'Preventivas';
  const icon = tipo === 'correctiva' ? 'fa-check-circle text-green-600' : 'fa-shield-alt text-blue-600';
  const displayVal = count > 0
    ? `<span style="display:inline-flex;align-items:center;gap:4px"><i class="fas ${icon}"></i>${count} accione(s)</span>`
    : '<span class="val-empty">Sin acciones</span>';
  const key = `plan.${tipo}`;
  const actions = `<button class="cell-btn" onclick="window.__showTab('plan')" title="Ir a Plan"><i class="fas fa-external-link-alt"></i></button>`;

  return `<tr data-key="${key}">
    <td class="cell-field">${field}</td>
    <td class="cell-value">${displayVal}</td>
    <td class="cell-actions">${actions}</td>
  </tr>`;
}

/* ==========================================================================
   Data Table / Drawer Builders (shared between drawer and full table)
   ========================================================================== */

export function buildDataRows(closeFn: string, readonly = false): string[] {
  const r: string[] = [];
  const captura = rcaData.captura || {};
  const whys = rcaData.whys || {};
  const ishikawa = rcaData.ishikawa || {};
  const acciones = rcaData.acciones || { correctivas: [], preventivas: [] };

  // --- Captura ---
  r.push(`<tr class="section-header-row"><td colspan="2"><i class="fas fa-clipboard text-blue-600"></i>Captura</td></tr>`);
  const capturaFields = [
    { key: 'maquina', label: 'Máquina' },
    { key: 'problema', label: 'Problema' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'tiempoParo', label: 'Tiempo Paro' },
    { key: 'sintomas', label: 'Síntomas' },
    { key: 'responsable', label: 'Responsable' }
  ];
  capturaFields.forEach(f => {
    let value = captura[f.key as keyof RCACaptura] || '';
    // Apply formatting
    if (f.key === 'fecha') value = formatDate(value);
    if (f.key === 'tiempoParo') value = formatTiempoParo(value);
    r.push(buildFieldRow(`captura.${f.key}`, 'Captura', f.label, value, false, readonly));
  });

  // --- Ishikawa ---
  r.push(`<tr class="section-header-row"><td colspan="2"><i class="fas fa-project-diagram text-emerald-600"></i>Ishikawa</td></tr>`);
  const ishikawaCats = [
    { key: 'maquina', label: 'Máquina' },
    { key: 'metodo', label: 'Método' },
    { key: 'materiales', label: 'Materiales' },
    { key: 'manoObra', label: 'Mano de obra' },
    { key: 'medicion', label: 'Medición' },
    { key: 'medioAmbiente', label: 'Medio Ambiente' }
  ];
  ishikawaCats.forEach(c => {
    const val = ishikawa[c.key] || '';
    r.push(buildFieldRow(`ishikawa.${c.key}`, 'Ishikawa', c.label, val, false, readonly));
  });

  // --- 5 Porqués ---
  r.push(`<tr class="section-header-row"><td colspan="2"><i class="fas fa-question-circle text-amber-500"></i>5 Porqués</td></tr>`);
  for (let i = 1; i <= 5; i++) {
    const val = whys[`why${i}` as keyof RCAWhys] || '';
    r.push(buildFieldRow(`whys.why${i}`, '5 Porqués', `Por qué ${i}`, val, false, readonly));
  }
  const causaRaiz = getCurrentCauseSummary();
  r.push(buildFieldRow(`whys.causaRaiz`, '5 Porqués', 'Causa Raíz', causaRaiz, true, readonly));

  // --- Plan de Acción ---
  r.push(`<tr class="section-header-row"><td colspan="2"><i class="fas fa-tasks text-red-500"></i>Plan de Acción</td></tr>`);
  r.push(buildPlanRow('correctiva', acciones.correctivas.length, closeFn));
  r.push(buildPlanRow('preventiva', acciones.preventivas.length, closeFn));

  return r;
}

let _editingKey: string | null = null;
export function getEditingKey(): string | null { return _editingKey; }
export function setEditingKey(val: string | null): void { _editingKey = val; }

function buildFieldRow(key: string, section: string, field: string, value: string, isCauseRoot = false, readonly = false): string {
  const editingKey = _editingKey;
  const isEditing = editingKey === key;
  const displayVal = value ? escapeHtml(value) : '<span class="val-empty">—</span>';

  let valueCell: string;
  if (isEditing) {
    valueCell = `<div class="inline-edit">
      <input type="text" class="inline-input" value="${escapeHtml(value)}">
      <button class="inline-save" onclick="window.__saveEdit('${key}')"><i class="fas fa-check"></i></button>
      <button class="inline-cancel" onclick="window.__cancelEdit()"><i class="fas fa-times"></i></button>
    </div>`;
  } else {
    valueCell = displayVal;
  }

  const actions = (isEditing || readonly) ? '' : `
    <button class="cell-btn" onclick="window.__startEdit('${key}')" title="Editar"><i class="fas fa-pen"></i></button>
    ${isCauseRoot ? '' : `<button class="cell-btn btn-danger" onclick="window.__deleteField('${key}')" title="Eliminar"><i class="fas fa-trash-alt"></i></button>`}
  `;

  return `<tr data-key="${key}">
    <td class="cell-field">${field}</td>
    <td class="cell-value">${valueCell}<span class="cell-actions-inline">${actions}</span></td>
  </tr>`;
}

function buildPlanRow(tipo: string, count: number, closeFn: string): string {
  const field = tipo === 'correctiva' ? 'Correctivas' : 'Preventivas';
  const icon = tipo === 'correctiva' ? 'fa-check-circle text-green-600' : 'fa-shield-alt text-blue-600';
  const displayVal = count > 0
    ? `<span style="display:inline-flex;align-items:center;gap:4px"><i class="fas ${icon}"></i>${count} accione(s)</span>`
    : '<span class="val-empty">Sin acciones</span>';
  const actions = `<button class="cell-btn" onclick="window.__${closeFn}(); window.__showTab('plan')" title="Ir a Plan"><i class="fas fa-external-link-alt"></i></button>`;

  return `<tr data-key="plan.${tipo}">
    <td class="cell-field">${field}</td>
    <td class="cell-value cell-plan-actions">${displayVal}${actions}</td>
  </tr>`;
}

/* ==========================================================================
   Shared Logic: 5 Whys Cause Summary
   ========================================================================== */

/* ==========================================================================
   Shared Logic: 5 Whys Cause Summary
   Pure state queries used by multiple modules
   ========================================================================== */

/** Gets the deepest level with content */
export function getLastWhyLevel(): number {
  const whys = rcaData.whys || {};
  for (let i = 5; i >= 1; i--) {
    if (whys[`why${i}` as keyof RCAWhys]) return i;
  }
  return 0;
}

/** Determines if the wizard is completed */
export function isWizardCompleted(): boolean {
  return !!(rcaData.whys && rcaData.whys.wizardLevel === 0);
}

/** Gets the current wizard level (1-5 active, 0 completed) */
export function getWizardLevel(): number {
  if (isWizardCompleted()) return 0;
  return (rcaData.whys && rcaData.whys.wizardLevel) || 1;
}

/** Gets the root cause: deepest why with content */
export function getCurrentCauseSummary(): string {
  const whys = rcaData.whys || {};
  if (isWizardCompleted()) {
    return whys[`why${getLastWhyLevel()}` as keyof RCAWhys] || '';
  }
  const level = getWizardLevel();
  for (let i = level - 1; i >= 1; i--) {
    if (whys[`why${i}` as keyof RCAWhys]) return whys[`why${i}` as keyof RCAWhys]!;
  }
  return '';
}

/** Gets all 5 why texts from state */
export function getWhyTexts(): string[] {
  const whys = rcaData.whys || {};
  const values: string[] = [];
  for (let i = 1; i <= 5; i++) {
    values.push(whys[`why${i}` as keyof RCAWhys] || '');
  }
  return values;
}
