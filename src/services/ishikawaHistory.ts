import { CATEGORY_ORDER, type RCAIshikawa } from '../state/store';
import { uniqueValues } from '../utils/text';

/* ==========================================================================
   Ishikawa - Historical Diagram per Machine
   Stores the latest Ishikawa diagram per machine (one per machine)
   ========================================================================== */

export interface IshikawaHistoryEntry {
  ishikawa: RCAIshikawa;
  problema: string;
}

/** Gets Ishikawa history by machine */
export function getIshikawaHistory(): Record<string, IshikawaHistoryEntry> {
  return JSON.parse(localStorage.getItem('ishikawaHistory') || '{}');
}

/** Saves Ishikawa history */
function saveIshikawaHistory(data: Record<string, IshikawaHistoryEntry>): void {
  localStorage.setItem('ishikawaHistory', JSON.stringify(data));
}

/** Updates the Ishikawa diagram for a machine (merges new causes with existing, no duplicates) */
export function updateIshikawaForMachine(
  machine: string,
  ishikawaData: RCAIshikawa,
  problemText: string
): void {
  if (!machine || !problemText) return;
  const history = getIshikawaHistory();
  const existing = history[machine];

  if (existing && existing.ishikawa) {
    const merged: RCAIshikawa = {};
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
