import { rcaData, CATEGORY_ORDER, ISHIKAWA_CATEGORY_CONFIG, type ExportHistoryEntry } from '../state/store';
import { escapeHtml } from '../utils/text';
import { showToast } from '../utils/toast';
import { getCurrentCauseSummary } from '../state/store';
import { createSimplifiedIshikawa, createSimplifiedPareto } from './exportPDF';
import { recordRootCauseForPareto } from './pareto';
import { getIshikawaHistory, type IshikawaHistoryEntry } from './ishikawaHistory';
import { getAccumulatedParetoData } from './pareto';

/* ==========================================================================
   Excel Export Service
   Generates an .xlsx file with Report, Ishikawa, and Pareto sheets
   ========================================================================== */

export async function exportExcel(
  updateIshikawaForMachine: (machine: string, data: any, problem: string) => void
): Promise<void> {
  if (typeof (window as any).ExcelJS === 'undefined') {
    showToast('La librería ExcelJS no se ha cargado. Verifica tu conexión a internet.', 'error');
    return;
  }

  try {
    recordRootCauseForPareto(getCurrentCauseSummary);
    const machineIshikawa = (document.getElementById('maquina') as HTMLSelectElement)?.value?.trim() || '';
    const problemIshikawa = (document.getElementById('descripcionProblema') as HTMLTextAreaElement)?.value?.trim() || '';
    if (machineIshikawa && problemIshikawa && rcaData.ishikawa) {
      updateIshikawaForMachine(machineIshikawa, rcaData.ishikawa, problemIshikawa);
    }

    const accionesCorrectivas = rcaData.acciones?.correctivas || [];
    const accionesPreventivas = rcaData.acciones?.preventivas || [];
    const todasAcciones = [
      ...accionesCorrectivas.map(a => ({ ...a, tipo: 'Correctivo' })),
      ...accionesPreventivas.map(a => ({ ...a, tipo: 'Preventivo' }))
    ];

    const causaRaiz =
      rcaData.whys.why5 || rcaData.whys.why4 || rcaData.whys.why3 ||
      rcaData.whys.why2 || rcaData.whys.why1 || '';

    const ExcelJS = (window as any).ExcelJS;
    const workbook = new ExcelJS.Workbook();

    // ---- Sheet 1: Fault Report ----
    const reporteSheet = workbook.addWorksheet('Reporte de Fallas', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    const headerRow = reporteSheet.addRow([
      'Fecha', 'Máquina', 'Problema', 'Tipo de Mantenimiento',
      'Plan de Acción Correctivo', 'Plan de Acción Preventivo',
      'Status del Plan', 'Responsable', 'Fecha de Finalización', 'Causa Raíz'
    ]);
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    headerRow.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    const correctivas = todasAcciones.filter(a => a.tipo === 'Correctivo');
    const preventivas = todasAcciones.filter(a => a.tipo === 'Preventivo');
    const tipoAccion = 'Correctivo';
    const correctivoText = correctivas.map(a => a.descripcion).filter(Boolean).join('\n');
    const preventivoText = preventivas.map(a => a.descripcion).filter(Boolean).join('\n');
    const responsables = [...new Set(todasAcciones.map(a => a.responsable).filter(Boolean))].join(', ');
    const fechasFin = todasAcciones.map(a => a.fecha).filter(Boolean).join(', ');

    const currentEntry: ExportHistoryEntry = {
      fecha: rcaData.captura.fecha || '',
      maquina: rcaData.captura.maquina || '',
      problema: rcaData.captura.problema || '',
      tipoAccion,
      correctivoText: todasAcciones.length > 0 ? correctivoText : '',
      preventivoText: todasAcciones.length > 0 ? preventivoText : '',
      status: 'Pendiente',
      responsable: (todasAcciones.length > 0 ? responsables : '') || rcaData.captura.responsable || '',
      fechaFin: todasAcciones.length > 0 ? fechasFin : '',
      causaRaiz,
      ishikawa: CATEGORY_ORDER.reduce((acc, key) => {
        acc[key] = (document.getElementById(`ishikawa-${key}`) as HTMLTextAreaElement)?.value?.trim() || '';
        return acc;
      }, {} as Record<string, string>)
    };

    const exportHistory: ExportHistoryEntry[] = JSON.parse(localStorage.getItem('exportHistory') || '[]');
    exportHistory.push(currentEntry);
    localStorage.setItem('exportHistory', JSON.stringify(exportHistory));

    exportHistory.forEach((entry, i) => {
      const row = reporteSheet.addRow([
        entry.fecha, entry.maquina, entry.problema, entry.tipoAccion,
        entry.correctivoText, entry.preventivoText, entry.status || 'Pendiente',
        entry.responsable, entry.fechaFin, entry.causaRaiz
      ]);
      if (i > 0) row.alignment = { vertical: 'top', wrapText: true };
    });
    reporteSheet.getRow(2).alignment = { vertical: 'top', wrapText: true };

    const lastRow = exportHistory.length + 1;
    reporteSheet.autoFilter = {
      from: { row: 1, column: 1 }, to: { row: lastRow, column: 10 }
    };

    const maxWidths = [15, 25, 60, 22, 80, 80, 18, 30, 20, 60];
    reporteSheet.columns.forEach((col: any, i: number) => {
      let maxLen = 0;
      col.eachCell((cell: any) => {
        const text = cell.value ? String(cell.value) : '';
        const lines = text.split('\n');
        lines.forEach((line: string) => {
          maxLen = Math.max(maxLen, line.length);
        });
      });
      const cap = maxWidths[i] || 60;
      col.width = Math.min(Math.max(maxLen + 3, 10), cap);
    });

    // ---- Sheet 2: Ishikawa ----
    const ishikawaSheet = workbook.addWorksheet('Ishikawa');
    const ishikawaHistoryData = getIshikawaHistory();
    const ishikawaMachines = Object.keys(ishikawaHistoryData).filter(m => {
      const entry = ishikawaHistoryData[m];
      return entry && entry.ishikawa && Object.values(entry.ishikawa).some(v => v);
    });

    if (ishikawaMachines.length === 0) {
      ishikawaSheet.getCell('A1').value = 'No hay diagramas Ishikawa guardados.';
      ishikawaSheet.getCell('A1').font = { italic: true, size: 11, name: 'Calibri', color: { argb: 'FF9CA3AF' } };
    } else {
      ishikawaSheet.getCell('A1').value = 'Máquina';
      ishikawaSheet.getCell('A1').font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF1F4E79' } };
      let ishikawaRow = 1;
      ishikawaMachines.forEach(machine => {
        const entry = ishikawaHistoryData[machine];
        const ishikawaData = entry.ishikawa || {};
        if (!Object.values(ishikawaData).some(v => v)) return;

        ishikawaRow++;
        ishikawaSheet.getCell(`A${ishikawaRow}`).value = machine;
        ishikawaSheet.getCell(`A${ishikawaRow}`).font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF1F4E79' } };

        const imgData = createSimplifiedIshikawa(ishikawaData, entry.problema);
        const hasImage = imgData && imgData.imgData;

        for (let r = ishikawaRow; r <= ishikawaRow + 30; r++) {
          ishikawaSheet.getCell(`A${r}`).value = machine;
        }

        if (hasImage) {
          const base64Data = imgData!.imgData.split(',')[1];
          const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
          ishikawaSheet.addImage(imgId, {
            tl: { col: 0, row: ishikawaRow },
            br: { col: 15, row: ishikawaRow + 30 }
          });
        }
        ishikawaRow += 31;
      });

      if (ishikawaRow > 2) {
        ishikawaSheet.autoFilter = {
          from: { row: 1, column: 1 }, to: { row: ishikawaRow - 1, column: 1 }
        };
      }
    }
    ishikawaSheet.getColumn(1).width = 30;

    // ---- Sheet 3: Pareto ----
    const paretoSheet = workbook.addWorksheet('Pareto');
    const allParetoData = JSON.parse(localStorage.getItem('paretoHistory') || '{}');
    const machines = Object.keys(allParetoData).filter(m => {
      const data = allParetoData[m];
      return data && Object.keys(data).length > 0;
    });

    if (machines.length === 0) {
      paretoSheet.getCell('A1').value = 'No hay datos de Pareto acumulados.';
      paretoSheet.getCell('A1').font = { italic: true, size: 11, name: 'Calibri', color: { argb: 'FF9CA3AF' } };
    } else {
      paretoSheet.getCell('A1').value = 'Máquina';
      paretoSheet.getCell('A1').font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF1F4E79' } };
      let paretoRow = 1;
      machines.forEach(machine => {
        const paretoItems = getAccumulatedParetoData(machine);
        if (paretoItems.length === 0) return;

        paretoRow++;
        paretoSheet.getCell(`A${paretoRow}`).value = machine;
        paretoSheet.getCell(`A${paretoRow}`).font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF1F4E79' } };

        const sorted = [...paretoItems].sort((a, b) => b.frecuencia - a.frecuencia);
        const imgData = createSimplifiedPareto(sorted);
        const hasImage = imgData && imgData.imgData;

        for (let r = paretoRow; r <= paretoRow + 30; r++) {
          paretoSheet.getCell(`A${r}`).value = machine;
        }

        if (hasImage) {
          const base64Data = imgData!.imgData.split(',')[1];
          const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
          paretoSheet.addImage(imgId, {
            tl: { col: 0, row: paretoRow },
            br: { col: 15, row: paretoRow + 30 }
          });
        }
        paretoRow += 31;
      });

      paretoSheet.autoFilter = {
        from: { row: 1, column: 1 }, to: { row: paretoRow - 1, column: 1 }
      };
    }
    paretoSheet.getColumn(1).width = 30;

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = new Uint8Array(rawBuffer);
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Diagnostico_Fallas.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (error: any) {
    console.error('Error en exportExcel:', error);
    showToast('Error al exportar a Excel: ' + (error.message || error), 'error');
  }
}
