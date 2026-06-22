import { rcaData, type RCAIshikawa, CATEGORY_ORDER, ISHIKAWA_CATEGORY_CONFIG } from '../state/store';
import { normalizeText } from '../utils/text';

/* ==========================================================================
   Pareto - Accumulated Data per Machine
   Stores root cause frequencies per machine for Pareto analysis
   ========================================================================== */

/** Gets accumulated Pareto history */
export function getParetoHistory(): Record<string, Record<string, number>> {
  return JSON.parse(localStorage.getItem('paretoHistory') || '{}');
}

/** Saves Pareto history */
function saveParetoHistory(data: Record<string, Record<string, number>>): void {
  localStorage.setItem('paretoHistory', JSON.stringify(data));
}

/** Records the current root cause in the machine's accumulated history */
export function recordRootCauseForPareto(getCurrentCauseSummary: () => string): void {
  const machine = (document.getElementById('maquina') as HTMLSelectElement)?.value?.trim() || '';
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

/** Gets accumulated Pareto items for a specific machine */
export function getAccumulatedParetoData(machine: string): { causa: string; frecuencia: number }[] {
  const history = getParetoHistory();
  const machineData = history[machine] || {};
  return Object.entries(machineData).map(([causa, frecuencia]) => ({
    causa,
    frecuencia
  }));
}

/** Gets Pareto data from Ishikawa categories */
export function getIshikawaParetoData(): { causa: string; frecuencia: number }[] {
  return CATEGORY_ORDER.map(key => {
    const value = (document.getElementById(`ishikawa-${key}`) as HTMLTextAreaElement)?.value?.trim() || '';
    if (!value) return null;
    const causes = value.split(/[,.\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    return { causa: ISHIKAWA_CATEGORY_CONFIG[key].label, frecuencia: causes.length };
  }).filter((item): item is { causa: string; frecuencia: number } => item !== null);
}
