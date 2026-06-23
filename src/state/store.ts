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

export type WhyKey = 'why1' | 'why2' | 'why3' | 'why4' | 'why5';

export function getWhy(whys: RCAWhys, i: number): string {
  const key = `why${i}` as WhyKey;
  return whys[key] || '';
}

export function setWhy(whys: RCAWhys, i: number, value: string): void {
  const key = `why${i}` as WhyKey;
  whys[key] = value;
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

/** Replaces rcaData (used during load/init) */
export function setRcaData(data: RCAData): void {
  rcaData = data;
}

/* ── Committed (saved) data for the data table ───────── */

export let savedRcaData: RCAData = {
  captura: {},
  whys: { why1: '', why2: '', why3: '', why4: '', why5: '', wizardLevel: 1 },
  ishikawa: {},
  acciones: { correctivas: [], preventivas: [] }
};

export function setSavedRcaData(data: RCAData): void {
  savedRcaData = data;
}

/** Copies the current rcaData into savedRcaData (called on explicit Save) */
export function commitWizardDataToSaved(): void {
  savedRcaData = JSON.parse(JSON.stringify(rcaData));
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


/** Builds a horizontal table for a single section: field names as headers, values in one row */
export function buildSectionRows(section: DataSection, source?: RCAData): string {
  const data = source || rcaData;
  const captura = data.captura || {};
  const whys = data.whys || {};
  const ishikawa = data.ishikawa || {};
  const acciones = data.acciones || { correctivas: [], preventivas: [] };

  let headers: { label: string; key: string; format?: (v: string) => string }[] = [];

  if (section === 'captura') {
    headers = [
      { key: 'maquina', label: 'Máquina' },
      { key: 'problema', label: 'Problema' },
      { key: 'fecha', label: 'Fecha', format: formatDate },
      { key: 'tiempoParo', label: 'Tiempo Paro', format: formatTiempoParo },
      { key: 'sintomas', label: 'Síntomas' },
      { key: 'responsable', label: 'Responsable' }
    ];
  } else if (section === 'ishikawa') {
    headers = [
      { key: 'maquina', label: 'Máquina' },
      { key: 'metodo', label: 'Método' },
      { key: 'materiales', label: 'Materiales' },
      { key: 'manoObra', label: 'Mano de obra' },
      { key: 'medicion', label: 'Medición' },
      { key: 'medioAmbiente', label: 'Medio Ambiente' }
    ];
  } else if (section === '5whys') {
    for (let i = 1; i <= 5; i++) {
      headers.push({ key: `why${i}`, label: `Por qué ${i}` });
    }
    headers.push({ key: 'causaRaiz', label: 'Causa Raíz' });
  } else if (section === 'plan') {
    return buildHorizontalPlanTable(acciones);
  }

  // Build header row (field names + Acciones column)
  const headerRow = `<tr>${headers.map(h => `<th>${escapeHtml(h.label)}</th>`).join('')}<th>Acciones</th></tr>`;
  const dataRow = buildHorizontalDataRow(section, headers, data);

  return `<div class="data-table-scroll"><table class="data-table data-table-h">
    <thead>${headerRow}</thead>
    <tbody>${dataRow}</tbody>
  </table></div>`;
}

/** Builds a single horizontal data row for the given section */
function buildHorizontalDataRow(
  section: DataSection,
  headers: { key: string; label: string; format?: (v: string) => string }[],
  source?: RCAData
): string {
  const data = source || rcaData;
  const captura = data.captura || {};
  const whys = data.whys || {};
  const ishikawa = data.ishikawa || {};

  const cells = headers.map(h => {
    let value = '';
    const key = `${section}.${h.key}`;
    if (section === 'captura') {
      value = captura[h.key as keyof RCACaptura] || '';
      if (h.format) value = h.format(value);
    } else if (section === 'ishikawa') {
      value = ishikawa[h.key] || '';
    } else if (section === '5whys') {
      if (h.key === 'causaRaiz') {
        // Causa raíz = el último why con contenido
        for (let i = 5; i >= 1; i--) {
          if (whys[`why${i}` as keyof RCAWhys]) {
            value = whys[`why${i}` as keyof RCAWhys] as string;
            break;
          }
        }
      } else {
        value = (whys[h.key as keyof RCAWhys] as string) || '';
      }
    }
    return buildHorizontalCell(key, value);
  });

  // Add actions column with delete-section button at the end
  const deleteBtn = `<td class="cell-h cell-h-actions-col">
    <button class="cell-btn cell-btn-inline cell-btn-delete-row" onclick="window.__deleteSection('${section}')" title="Limpiar sección"><i class="fas fa-trash-alt"></i></button>
  </td>`;
  return `<tr>${cells.join('')}${deleteBtn}</tr>`;
}

/** Builds a single cell in the horizontal table (edit button per cell, no delete) */
function buildHorizontalCell(key: string, value: string): string {
  const editingKey = _editingKey;
  const isEditing = editingKey === key;
  const displayVal = value ? escapeHtml(value) : '<span class="val-empty">—</span>';

  let cellContent: string;
  if (isEditing) {
    cellContent = `<div class="inline-edit-h">
      <input type="text" class="inline-input" value="${escapeHtml(value)}">
      <button class="inline-save" onclick="window.__saveEdit('${key}')"><i class="fas fa-check"></i></button>
      <button class="inline-cancel" onclick="window.__cancelEdit()"><i class="fas fa-times"></i></button>
    </div>`;
  } else {
    const editBtn = `<button class="cell-btn cell-btn-inline" onclick="window.__startEdit('${key}')" title="Editar"><i class="fas fa-pen"></i></button>`;
    cellContent = `<span class="cell-h-val">${displayVal}</span><span class="cell-h-actions">${editBtn}</span>`;
  }

  return `<td data-key="${key}" class="cell-h">${cellContent}</td>`;
}

/** Builds a single editable cell for a plan action field */
function buildPlanHorizontalCell(key: string, value: string, displayValue: string): string {
  const editingKey = _editingKey;
  const isEditing = editingKey === key;
  const displayVal = value ? displayValue : '<span class="val-empty">—</span>';

  let cellContent: string;
  if (isEditing) {
    cellContent = `<div class="inline-edit-h">
      <input type="text" class="inline-input" value="${escapeHtml(value)}">
      <button class="inline-save" onclick="window.__saveEdit('${key}')"><i class="fas fa-check"></i></button>
      <button class="inline-cancel" onclick="window.__cancelEdit()"><i class="fas fa-times"></i></button>
    </div>`;
  } else {
    const editBtn = `<button class="cell-btn cell-btn-inline" onclick="window.__startEdit('${key}')" title="Editar"><i class="fas fa-pen"></i></button>`;
    cellContent = `<span class="cell-h-val">${displayVal}</span><span class="cell-h-actions">${editBtn}</span>`;
  }

  return `<td data-key="${key}" class="cell-h">${cellContent}</td>`;
}

/** Builds the Plan section as a horizontal table with inline editing and row deletion */
function buildHorizontalPlanTable(acciones: RCAAcciones): string {
  const prioLabels: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  const prioColors: Record<string, string> = { alta: '#ef4444', media: '#f59e0b', baja: '#22c55e' };

  const buildActionRows = (list: Accion[], tipo: string): string => {
    if (list.length === 0) {
      return `<tr><td class="cell-h" colspan="5"><span class="val-empty">Sin acciones</span></td></tr>`;
    }
    return list.map((a, i) => {
      const keyPrefix = `plan.${tipo}.${i}`;
      const descCell = buildPlanHorizontalCell(`${keyPrefix}.descripcion`, a.descripcion, escapeHtml(a.descripcion || '—'));
      const respCell = buildPlanHorizontalCell(`${keyPrefix}.responsable`, a.responsable, escapeHtml(a.responsable || '—'));
      const fechaCell = buildPlanHorizontalCell(`${keyPrefix}.fecha`, a.fecha, escapeHtml(formatDate(a.fecha) || '—'));
      const prioDisplay = `<span class="plan-prio" style="background:${prioColors[a.prioridad] || '#6b7280'}">${prioLabels[a.prioridad] || a.prioridad}</span>`;
      const prioCell = buildPlanHorizontalCell(`${keyPrefix}.prioridad`, a.prioridad, prioDisplay);
      const deleteCell = `<td class="cell-h cell-h-actions-col">
        <button class="cell-btn cell-btn-inline cell-btn-delete-row" onclick="window.__deletePlanRow('${tipo}', ${i})" title="Eliminar acción"><i class="fas fa-trash-alt"></i></button>
      </td>`;
      return `<tr>${descCell}${respCell}${fechaCell}${prioCell}${deleteCell}</tr>`;
    }).join('');
  };

  const correctivasHtml = `<div style="margin-bottom:16px">
    <h5 style="font-size:13px;font-weight:700;color:#059669;margin-bottom:6px;display:flex;align-items:center;gap:6px">
      <i class="fas fa-check-circle"></i> Correctivas (${acciones.correctivas.length})
    </h5>
    <div class="data-table-scroll">
      <table class="data-table data-table-h">
        <thead><tr><th>Descripción</th><th>Responsable</th><th>Fecha</th><th>Prioridad</th><th>Acciones</th></tr></thead>
        <tbody>${buildActionRows(acciones.correctivas, 'correctivas')}</tbody>
      </table>
    </div>
  </div>`;

  const preventivasHtml = `<div style="margin-bottom:4px">
    <h5 style="font-size:13px;font-weight:700;color:#2563eb;margin-bottom:6px;display:flex;align-items:center;gap:6px">
      <i class="fas fa-shield-alt"></i> Preventivas (${acciones.preventivas.length})
    </h5>
    <div class="data-table-scroll">
      <table class="data-table data-table-h">
        <thead><tr><th>Descripción</th><th>Responsable</th><th>Fecha</th><th>Prioridad</th><th>Acciones</th></tr></thead>
        <tbody>${buildActionRows(acciones.preventivas, 'preventivas')}</tbody>
      </table>
    </div>
  </div>`;

  const deleteBtn = `<button class="cell-btn cell-btn-inline cell-btn-delete-row" onclick="window.__deleteSection('plan')" title="Limpiar sección"><i class="fas fa-trash-alt"></i></button>`;

  return `${correctivasHtml}${preventivasHtml}
  <div style="display:flex;justify-content:flex-end;margin-top:4px">${deleteBtn}</div>`;
}

/* ==========================================================================
   Data Table / Drawer Builders (shared between drawer and full table)
   ========================================================================== */

/** Builds vertical tables (Campo | Valor) for the review drawer */
export function buildDataRows(): string {
  const captura = rcaData.captura || {};
  const whys = rcaData.whys || {};
  const ishikawa = rcaData.ishikawa || {};
  const acciones = rcaData.acciones || { correctivas: [], preventivas: [] };

  const tables: string[] = [];

  // --- Captura (solo si hay datos) ---
  const hasCapturaData = Object.values(captura).some(v => v && String(v).trim());
  if (hasCapturaData) {
    const capturaFields = [
      { key: 'maquina', label: 'Máquina' },
      { key: 'problema', label: 'Problema' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'tiempoParo', label: 'Tiempo Paro' },
      { key: 'sintomas', label: 'Síntomas' },
      { key: 'responsable', label: 'Responsable' }
    ];
    tables.push(buildDrawerVerticalSectionTable('Captura', 'fa-clipboard text-blue-600', capturaFields.map(f => {
      let value = captura[f.key as keyof RCACaptura] || '';
      if (f.key === 'fecha') value = formatDate(value);
      if (f.key === 'tiempoParo') value = formatTiempoParo(value);
      return { key: `captura.${f.key}`, label: f.label, value };
    })));
  }

  // --- Ishikawa (solo si hay datos) ---
  const hasIshikawaData = CATEGORY_ORDER.some(cat => !!(ishikawa[cat] || '').trim());
  if (hasIshikawaData) {
    const ishikawaCats = [
      { key: 'maquina', label: 'Máquina' },
      { key: 'metodo', label: 'Método' },
      { key: 'materiales', label: 'Materiales' },
      { key: 'manoObra', label: 'Mano de obra' },
      { key: 'medicion', label: 'Medición' },
      { key: 'medioAmbiente', label: 'Medio Ambiente' }
    ];
    tables.push(buildDrawerVerticalSectionTable('Ishikawa', 'fa-project-diagram text-emerald-600', ishikawaCats.map(c => ({
      key: `ishikawa.${c.key}`,
      label: c.label,
      value: ishikawa[c.key] || ''
    }))));
  }

  // --- 5 Porqués (solo si hay datos) ---
  const hasWhysData = (whys.why1 || whys.why2 || whys.why3 || whys.why4 || whys.why5);
  if (hasWhysData) {
    const whysItems: { key: string; label: string; value: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      const val = (whys[`why${i}` as keyof RCAWhys] as string) || '';
      whysItems.push({ key: `whys.why${i}`, label: `Por qué ${i}`, value: val });
    }
    const causaRaiz = getCurrentCauseSummary();
    whysItems.push({ key: 'whys.causaRaiz', label: 'Causa Raíz', value: causaRaiz });
    tables.push(buildDrawerVerticalSectionTable('5 Porqués', 'fa-question-circle text-amber-500', whysItems));
  }

  // --- Plan de Acción (solo si hay datos) ---
  const hasPlanData = acciones.correctivas.length > 0 || acciones.preventivas.length > 0;
  if (hasPlanData) {
    tables.push(buildDrawerPlanSection(acciones));
  }

  return tables.join('');
}

/** Builds a vertical (Campo | Valor) table for a drawer section */
function buildDrawerVerticalSectionTable(
  title: string,
  icon: string,
  items: { key: string; label: string; value: string }[],
): string {
  const rows = items.map(item => {
    const displayVal = item.value ? escapeHtml(item.value) : '<span class="val-empty">—</span>';
    return `<tr>
      <th scope="row" class="cell-field">${escapeHtml(item.label)}</th>
      <td class="cell-value">${displayVal}</td>
    </tr>`;
  }).join('');

  return `<div class="drawer-section">
    <h4 class="drawer-section-title"><i class="fas ${icon}"></i> ${escapeHtml(title)}</h4>
    <div class="data-table-scroll">
      <table class="data-table drawer-vertical-table">
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

/** Builds the Plan drawer section with full action details */
function buildDrawerPlanSection(acciones: RCAAcciones): string {
  const prioLabels: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  const prioColors: Record<string, string> = { alta: '#ef4444', media: '#f59e0b', baja: '#22c55e' };

  const buildActionTable = (list: Accion[], icon: string, label: string, color: string): string => {
    if (list.length === 0) {
      return `<div class="plan-subsection">
        <h5 class="plan-subsection-title" style="color:${color}"><i class="fas ${icon}"></i> ${label}</h5>
        <p class="plan-empty">Sin acciones</p>
      </div>`;
    }

    const rows = list.map((a, i) => `
      <tr>
        <th scope="row" class="cell-field">${escapeHtml(a.descripcion || '—')}</th>
        <td class="cell-value">
          <span class="plan-action-meta">
            <span><i class="fas fa-user"></i> ${escapeHtml(a.responsable || '—')}</span>
            <span><i class="fas fa-calendar"></i> ${escapeHtml(formatDate(a.fecha) || '—')}</span>
            <span class="plan-prio" style="background:${prioColors[a.prioridad] || '#6b7280'}">${prioLabels[a.prioridad] || a.prioridad}</span>
          </span>
        </td>
      </tr>`).join('');

    return `<div class="plan-subsection">
      <h5 class="plan-subsection-title" style="color:${color}"><i class="fas ${icon}"></i> ${label} (${list.length})</h5>
      <div class="data-table-scroll">
        <table class="data-table drawer-vertical-table">
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  };

  const correctivas = buildActionTable(acciones.correctivas, 'fa-check-circle', 'Correctivas', '#059669');
  const preventivas = buildActionTable(acciones.preventivas, 'fa-shield-alt', 'Preventivas', '#2563eb');

  return `<div class="drawer-section">
    <h4 class="drawer-section-title"><i class="fas fa-tasks text-red-500"></i> Plan de Acción</h4>
    ${correctivas}
    ${preventivas}
  </div>`;
}

let _editingKey: string | null = null;
export function getEditingKey(): string | null { return _editingKey; }
export function setEditingKey(val: string | null): void { _editingKey = val; }

/** Removes a single action from rcaData by tipo and index (persists, no DOM) */
export function removeActionFromState(tipo: string, index: number): void {
  const acciones = rcaData.acciones || { correctivas: [], preventivas: [] };
  const list = tipo === 'correctivas' ? acciones.correctivas : acciones.preventivas;
  if (index >= 0 && index < list.length) {
    list.splice(index, 1);
    rcaData.acciones[tipo === 'correctivas' ? 'correctivas' : 'preventivas'] = list;
  }
  // We don't call persistCurrentState here because it reads from DOM
  // Instead the caller (data-table.ts) will handle persistence
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
    return getWhy(whys, getLastWhyLevel());
  }
  const level = getWizardLevel();
  for (let i = level; i >= 1; i--) {
    const v = getWhy(whys, i);
    if (v) return v;
  }
  return '';
}

/** Gets all 5 why texts from state */
export function getWhyTexts(): string[] {
  const whys = rcaData.whys || {};
  const values: string[] = [];
  for (let i = 1; i <= 5; i++) {
    values.push(getWhy(whys, i));
  }
  return values;
}
