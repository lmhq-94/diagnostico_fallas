/* ==========================================================================
   Analysis Storage Service
   Communicates with the Vite API middleware to save/load/check/delete
   a single analysis file (analisis.json) in the project's analyses/ directory.
   ========================================================================== */

import type { RCAData } from '../state/store';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Error en la comunicación con el servidor');
  }
  return res.json();
}

/** Saves the current analysis to analisis.json */
export async function saveAnalysisFile(data: RCAData): Promise<void> {
  await apiFetch<{ success: boolean }>('/api/save-analysis', {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}

/** Checks if analisis.json exists and returns its metadata */
export async function checkAnalysisFile(): Promise<{
  exists: boolean;
  savedAt?: string;
  captura?: any;
  whys?: any;
  ishikawa?: any;
  acciones?: any;
}> {
  return apiFetch('/api/check-analysis');
}

/** Loads the full data from analisis.json */
export async function loadAnalysis(): Promise<{ savedAt: string; data: RCAData }> {
  return apiFetch('/api/load-analysis');
}

/** Overwrites analisis.json with new data */
export async function updateAnalysisFile(data: RCAData): Promise<void> {
  await apiFetch<{ success: boolean }>('/api/update-analysis', {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });
}

/** Deletes analisis.json */
export async function deleteAnalysis(): Promise<void> {
  await apiFetch<{ success: boolean }>('/api/delete-analysis', {
    method: 'DELETE',
  });
}
