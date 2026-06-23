import { rcaData, CATEGORY_ORDER, ISHIKAWA_CATEGORY_CONFIG, type ExportHistoryEntry } from '../state/store';
import { escapeHtml } from '../utils/text';
import { showToast } from '../utils/toast';
import { getCurrentCauseSummary } from '../state/store';
import { createSimplifiedIshikawa, createSimplifiedPareto } from './exportPDF';
import { recordRootCauseForPareto } from './pareto';
import { getIshikawaHistory, type IshikawaHistoryEntry } from './ishikawaHistory';
import { getAccumulatedParetoData } from './pareto';
import ExcelJS from 'exceljs';

/* ==========================================================================
   Excel Export Service
   Generates an .xlsx file with Report, Ishikawa, and Pareto sheets
   ========================================================================== */

export async function exportExcel(
  updateIshikawaForMachine: (machine: string, data: any, problem: string) => void
): Promise<void> {
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

    const workbook = new ExcelJS.Workbook();
    const colors = {
      navy: 'FF1E3A5F', blue: 'FF2563EB', sky: 'FFE0F2FE',
      slate: 'FF64748B', slateDark: 'FF1E293B', white: 'FFFFFFFF',
      grayBg: 'FFF9FAFB', grayBorder: 'FFE5E7EB',
      green: 'FF16A34A', amber: 'FFD97706', red: 'FFDC2626',
    };

    // ============ SHEET 1: FAULT REPORT ============
    const reporteSheet = workbook.addWorksheet('Reporte de Fallas', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    const headers = [
      'Fecha', 'Máquina', 'Problema', 'Tipo de Mantenimiento',
      'Plan de Acción Correctivo', 'Plan de Acción Preventivo',
      'Status del Plan', 'Responsable', 'Fecha de Finalización', 'Causa Raíz'
    ];

    const headerRow = reporteSheet.addRow(headers);
    headerRow.eachCell((cell: any) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
      cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: colors.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: colors.navy } },
        bottom: { style: 'thin', color: { argb: colors.navy } },
        left: { style: 'thin', color: { argb: colors.navy } },
        right: { style: 'thin', color: { argb: colors.navy } },
      };
    });
    headerRow.height = 22;

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
      row.alignment = { vertical: 'top', wrapText: true };
      row.eachCell((cell: any, colIdx: number) => {
        // Alternating rows
        cell.fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: i % 2 === 0 ? colors.white : colors.grayBg }
        };
        cell.font = { size: 9.5, name: 'Calibri', color: { argb: colors.slateDark } };
        cell.border = {
          top: { style: 'thin', color: { argb: colors.grayBorder } },
          bottom: { style: 'thin', color: { argb: colors.grayBorder } },
          left: { style: 'thin', color: { argb: colors.grayBorder } },
          right: { style: 'thin', color: { argb: colors.grayBorder } },
        };
        // Center narrow columns
        if ([1, 4, 7].includes(colIdx)) {
          cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
        }
      });
    });

    const lastRow = exportHistory.length + 1;
    reporteSheet.autoFilter = {
      from: { row: 1, column: 1 }, to: { row: lastRow, column: 10 }
    };

    const maxWidths = [14, 22, 55, 20, 70, 70, 16, 28, 18, 55];
    reporteSheet.columns.forEach((col: any, i: number) => {
      let maxLen = 0;
      col.eachCell((cell: any) => {
        const text = cell.value ? String(cell.value) : '';
        text.split('\n').forEach((line: string) => {
          maxLen = Math.max(maxLen, line.length);
        });
      });
      col.width = Math.min(Math.max(maxLen + 3, 10), maxWidths[i] || 55);
    });

    // ============ SHEET 2: ISHIKAWA ============
    const ishikawaSheet = workbook.addWorksheet('Ishikawa');
    const ishikawaHistoryData = getIshikawaHistory();
    const ishikawaMachines = Object.keys(ishikawaHistoryData).filter(m => {
      const entry = ishikawaHistoryData[m];
      return entry && entry.ishikawa && Object.values(entry.ishikawa).some(v => v);
    });

    if (ishikawaMachines.length === 0) {
      ishikawaSheet.getCell('A1').value = 'No hay diagramas Ishikawa guardados.';
      ishikawaSheet.getCell('A1').font = { italic: true, size: 11, name: 'Calibri', color: { argb: colors.slate } };
    } else {
      const hCell = ishikawaSheet.getCell('A1');
      hCell.value = 'Máquina';
      hCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: colors.white } };
      hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
      hCell.alignment = { vertical: 'middle', horizontal: 'center' };
      hCell.border = {
        top: { style: 'thin', color: { argb: colors.navy } },
        bottom: { style: 'thin', color: { argb: colors.navy } },
        left: { style: 'thin', color: { argb: colors.navy } },
        right: { style: 'thin', color: { argb: colors.navy } },
      };

      let ishikawaRow = 1;
      ishikawaMachines.forEach(machine => {
        const entry = ishikawaHistoryData[machine];
        const ishikawaData = entry.ishikawa || {};
        if (!Object.values(ishikawaData).some(v => v)) return;

        ishikawaRow++;
        const mCell = ishikawaSheet.getCell(`A${ishikawaRow}`);
        mCell.value = machine;
        mCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: colors.blue } };
        mCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.sky } };

        const imgData = createSimplifiedIshikawa(ishikawaData, entry.problema);
        const hasImage = imgData && imgData.imgData;

        for (let r = ishikawaRow; r <= ishikawaRow + 30; r++) {
          ishikawaSheet.getCell(`A${r}`).value = machine;
        }

        if (hasImage) {
          const base64Data = imgData!.imgData.split(',')[1];
          const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
          ishikawaSheet.addImage(imgId, {
            tl: { col: 0.125, row: ishikawaRow + 0.125 } as any,
            br: { col: 14.875, row: ishikawaRow + 29.875 } as any
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

    // ============ SHEET 3: PARETO ============
    const paretoSheet = workbook.addWorksheet('Pareto');
    const allParetoData = JSON.parse(localStorage.getItem('paretoHistory') || '{}');
    const machines = Object.keys(allParetoData).filter(m => {
      const data = allParetoData[m];
      return data && Object.keys(data).length > 0;
    });

    if (machines.length === 0) {
      paretoSheet.getCell('A1').value = 'No hay datos de Pareto acumulados.';
      paretoSheet.getCell('A1').font = { italic: true, size: 11, name: 'Calibri', color: { argb: colors.slate } };
    } else {
      const hCell = paretoSheet.getCell('A1');
      hCell.value = 'Máquina';
      hCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: colors.white } };
      hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
      hCell.alignment = { vertical: 'middle', horizontal: 'center' };
      hCell.border = {
        top: { style: 'thin', color: { argb: colors.navy } },
        bottom: { style: 'thin', color: { argb: colors.navy } },
        left: { style: 'thin', color: { argb: colors.navy } },
        right: { style: 'thin', color: { argb: colors.navy } },
      };

      let paretoRow = 1;
      machines.forEach(machine => {
        const paretoItems = getAccumulatedParetoData(machine);
        if (paretoItems.length === 0) return;

        paretoRow++;
        const mCell = paretoSheet.getCell(`A${paretoRow}`);
        mCell.value = machine;
        mCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: colors.blue } };
        mCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.sky } };

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
            tl: { col: 0.125, row: paretoRow + 0.125 } as any,
            br: { col: 14.875, row: paretoRow + 29.875 } as any
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
