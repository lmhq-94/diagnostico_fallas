import { rcaData, CATEGORY_ORDER, ISHIKAWA_CATEGORY_CONFIG, type RCAIshikawa } from '../state/store';
import { normalizeText, uniqueValues, splitTextValues, sanitizeKeywordEntries } from '../utils/text';
import { showToast } from '../utils/toast';

/* ==========================================================================
   Ishikawa Diagram Functions
   ========================================================================== */

/** Gets Ishikawa categories that have content */
export function getFilledIshikawaEntries(): { categoryKey: string; label: string; value: string }[] {
  return CATEGORY_ORDER
    .map(categoryKey => ({
      categoryKey,
      label: ISHIKAWA_CATEGORY_CONFIG[categoryKey].label,
      value: (document.getElementById(`ishikawa-${categoryKey}`) as HTMLTextAreaElement)?.value?.trim() || ''
    }))
    .filter(entry => entry.value);
}

/** Refreshes the SVG diagram with current data */
export function refreshIshikawaDiagram(): void {
  const diagram = document.getElementById('ishikawa-diagram');
  if (!diagram) return;

  const filledEntries = getFilledIshikawaEntries();
  if (filledEntries.length === 0) {
    diagram.classList.add('hidden');
    return;
  }
  diagram.classList.remove('hidden');

  const svg = diagram.querySelector('svg');
  if (!svg) return;

  // 1. Assign all text content
  CATEGORY_ORDER.forEach(categoryKey => {
    const value = (document.getElementById(`ishikawa-${categoryKey}`) as HTMLTextAreaElement)?.value?.trim() || '';
    const contentDiv = document.getElementById(`ishikawa-content-${categoryKey}`);
    if (contentDiv) contentDiv.textContent = value;
  });

  // 2. Problem / effect box
  const problema = (document.getElementById('descripcionProblema') as HTMLTextAreaElement)?.value?.trim() || '';
  const causeText = document.getElementById('ishikawa-cause-text');
  const causeG = document.getElementById('ishikawa-cause');
  if (causeText) {
    causeText.textContent = problema || 'No definido';
    const causeFo = causeG?.querySelector('foreignObject') as SVGForeignObjectElement | null;
    const causeRect = causeG?.querySelector('rect') as SVGRectElement | null;
    if (causeFo && causeRect) {
      const textScroll = causeText.scrollHeight;
      const newPbH = Math.max(120, textScroll + 50);
      causeRect.setAttribute('height', String(newPbH));
      causeFo.setAttribute('height', String(newPbH));
      const pbBottom = parseFloat(causeRect.getAttribute('y') || '0') + newPbH;
      const vb = svg.getAttribute('viewBox')!.split(' ').map(Number);
      if (pbBottom + 20 > vb[3]) {
        vb[3] = pbBottom + 20;
        svg.setAttribute('viewBox', vb.join(' '));
      }
    }
  }
}

/** Updates the diagram visuals (simplified — no cards to color, kept for API compatibility) */
export function updateIshikawaDiagram(_detectedCategories: Record<string, boolean>): void {
  // Cards were removed; this is kept for API compatibility
}

/** Focuses the textarea of a category when clicking on the diagram */
export function editCategory(cat: string): void {
  const el = document.getElementById(`ishikawa-${cat}`) as HTMLTextAreaElement | null;
  if (el) {
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/** Saves the Ishikawa data */
export function saveIshikawa(
  syncPlan: () => void,
  persist: () => void,
  updateIshikawaForMachine: (machine: string, data: RCAIshikawa, problem: string) => void
): void {
  const emptyCategories: string[] = [];
  CATEGORY_ORDER.forEach(cat => {
    const field = document.getElementById(`ishikawa-${cat}`) as HTMLTextAreaElement;
    if (!field.value.trim()) {
      emptyCategories.push(cat);
    }
  });

  if (emptyCategories.length > 0) {
    const missingNames = emptyCategories.map(cat => ISHIKAWA_CATEGORY_CONFIG[cat].label).join(', ');
    showToast(`Completa todas las categorías: ${missingNames}`, 'warning');
    return;
  }

  CATEGORY_ORDER.forEach(cat => {
    const field = document.getElementById(`ishikawa-${cat}`) as HTMLTextAreaElement;
    const sanitizedValue = sanitizeKeywordEntries(splitTextValues(field.value)).join(', ');
    field.value = sanitizedValue;
    rcaData.ishikawa[cat] = sanitizedValue;
  });
  refreshIshikawaDiagram();

  const machine = (document.getElementById('maquina') as HTMLSelectElement)?.value?.trim() || '';
  const problemText = (document.getElementById('descripcionProblema') as HTMLTextAreaElement)?.value?.trim() || '';
  if (machine && problemText) {
    updateIshikawaForMachine(machine, rcaData.ishikawa, problemText);
  }

  syncPlan();
  persist();
}

/** Clears all Ishikawa data */
export function clearIshikawa(syncPlan: () => void, persist: () => void): void {
  CATEGORY_ORDER.forEach(cat => {
    const el = document.getElementById(`ishikawa-${cat}`) as HTMLTextAreaElement;
    if (el) el.value = '';
    rcaData.ishikawa[cat] = '';
  });

  const diagram = document.getElementById('ishikawa-diagram');
  if (diagram) diagram.classList.add('hidden');

  const emptyState: Record<string, boolean> = {};
  CATEGORY_ORDER.forEach(cat => { emptyState[cat] = false; });
  updateIshikawaDiagram(emptyState);
  syncPlan();
  persist();
}
