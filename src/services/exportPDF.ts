import { rcaData, CATEGORY_ORDER, ISHIKAWA_CATEGORY_CONFIG, type RCAIshikawa, type ParetoItem } from '../state/store';
import { roundRect, upscaleCanvas } from '../utils/dom';
import { escapeHtml } from '../utils/text';
import { showToast } from '../utils/toast';
import { getCurrentCauseSummary } from '../state/store';
import { recordRootCauseForPareto } from './pareto';

/* ==========================================================================
   PDF Export Service
   Generates a professional report with all analysis data
   ========================================================================== */

export function handlePDFExport(
  updateIshikawaForMachine: (machine: string, data: any, problem: string) => void
): void {
  exportPDF(updateIshikawaForMachine).catch(error => {
    console.error('Error al exportar PDF:', error);
    showToast('Error al generar el PDF.', 'error');
  });
}

async function exportPDF(
  updateIshikawaForMachine: (machine: string, data: any, problem: string) => void
): Promise<void> {
  try {
    recordRootCauseForPareto(getCurrentCauseSummary);
    const machineIshikawaPdf = (document.getElementById('maquina') as HTMLSelectElement)?.value?.trim() || '';
    const problemIshikawaPdf = (document.getElementById('descripcionProblema') as HTMLTextAreaElement)?.value?.trim() || '';
    if (machineIshikawaPdf && problemIshikawaPdf && rcaData.ishikawa) {
      updateIshikawaForMachine(machineIshikawaPdf, rcaData.ishikawa, problemIshikawaPdf);
    }
    if (!(window as any).jspdf) {
      throw new Error('La librería jsPDF no está cargada');
    }

    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    const colors = {
      navy: [30, 58, 95],
      blue: [37, 99, 235],
      sky: [224, 242, 254],
      gray: [107, 114, 128]
    };

    function addHeader() {
      doc.setFillColor(...colors.navy);
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Diagnóstico de Fallas', pageWidth / 2, 11, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const fechaGeneracion = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      doc.text(`Generado: ${fechaGeneracion}`, pageWidth / 2, 21, { align: 'center' });
      doc.setFillColor(...colors.blue);
      doc.rect(0, 28, pageWidth, 1, 'F');
      yPosition = 38;
    }

    function addFooter() {
      const footerY = pageHeight - 12;
      doc.setFillColor(...colors.navy);
      doc.rect(0, footerY, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text('Generado por Herramienta de Diagnóstico de Fallas - Proquinal', pageWidth / 2, footerY + 8, { align: 'center' });
    }

    function checkPageBreak(requiredHeight: number) {
      if (yPosition + requiredHeight > pageHeight - 22) {
        addFooter();
        doc.addPage();
        addHeader();
        yPosition = 38;
      }
    }

    function addText(text: string, fontSize = 11, fontStyle = 'normal', textColor = colors.gray) {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setTextColor(...textColor);
      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
      const lineHeight = fontSize * 0.4;
      checkPageBreak(lines.length * lineHeight + 10);
      lines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += lineHeight;
      });
      yPosition += 4;
    }

    function addSectionTitle(title: string) {
      checkPageBreak(20);
      doc.setFillColor(...colors.sky);
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 12, 2, 2, 'F');
      doc.setTextColor(...colors.navy);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 5, yPosition + 8);
      yPosition += 18;
    }

    function addLabelValue(label: string, value: string, fontSize = 11, fontStyle = 'bold') {
      checkPageBreak(fontSize * 0.4 + 10);
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setTextColor(...colors.navy);
      doc.text(label, margin, yPosition);
      const labelWidth = doc.getTextWidth(label);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.gray);
      doc.text(value, margin + labelWidth + 2, yPosition);
      yPosition += fontSize * 0.4 + 3;
    }

    addHeader();
    yPosition += 10;

    // Section 1: Problem Information
    addSectionTitle('1. INFORMACIÓN DEL PROBLEMA');

    const fechaInput = (document.getElementById('fechaEvento') as HTMLInputElement)?.value || 'No especificada';
    let fechaFormateada = 'No especificada';
    if (fechaInput && fechaInput !== 'No especificada') {
      const fechaObj = new Date(fechaInput + 'T00:00:00');
      fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }

    addLabelValue('Fecha del evento:', fechaFormateada);
    addLabelValue('Máquina/Equipo:', (document.getElementById('maquina') as HTMLSelectElement)?.value || 'No especificada');
    addLabelValue('Tiempo de paro:', ((document.getElementById('tiempoParo') as HTMLInputElement)?.value || 'No especificado') + ' minutos');
    addLabelValue('Responsable del análisis:', (document.getElementById('responsable') as HTMLInputElement)?.value || 'No especificado');

    addText('Descripción del problema:', 11, 'bold', colors.navy);
    addText((document.getElementById('descripcionProblema') as HTMLTextAreaElement)?.value || 'No descrito');
    addText('Síntomas observados:', 11, 'bold', colors.navy);
    addText((document.getElementById('sintomas') as HTMLTextAreaElement)?.value || 'No descritos');

    yPosition += 10;

    // Section 2: 5 Whys
    addSectionTitle('2. ANÁLISIS DE 5 PORQUÉS');

    let hasWhys = false;
    for (let i = 1; i <= 5; i++) {
      const whyText = rcaData.whys[`why${i}` as keyof typeof rcaData.whys] || '';
      if (whyText) {
        hasWhys = true;
        addText(`${i}. ${whyText}`);
      }
    }

    if (!hasWhys) {
      addText('No se registraron análisis de 5 porqués.');
    }

    yPosition += 5;

    const causaRaiz = document.getElementById('causaRaizResumen')?.textContent || '';
    if (causaRaiz) {
      addText('Causa Raíz Identificada:', 11, 'bold', colors.navy);
      addText(causaRaiz);
      yPosition += 10;
    }

    // Section 3: Ishikawa
    addSectionTitle('3. DIAGRAMA DE ISHIKAWA');

    const hasAnyIshikawaData = CATEGORY_ORDER.some(
      cat => !!(document.getElementById(`ishikawa-${cat}`) as HTMLTextAreaElement)?.value?.trim()
    );
    if (hasAnyIshikawaData) {
      checkPageBreak(200);
      const ishikawaImage = createSimplifiedIshikawa();
      if (ishikawaImage && ishikawaImage.imgData) {
        const imgWidth = 180;
        const imgHeight = (ishikawaImage.height / ishikawaImage.width) * imgWidth;
        const imgX = (pageWidth - imgWidth) / 2;
        doc.addImage(ishikawaImage.imgData, 'PNG', imgX, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 8;
      }
    } else {
      addText('No se registraron datos en el diagrama de Ishikawa.');
    }

    yPosition += 15;

    // Section 4: Action Plan
    addSectionTitle('4. PLAN DE ACCIÓN');

    const correctivasContainer = document.getElementById('accionesCorrectivas');
    if (correctivasContainer && correctivasContainer.children.length > 0) {
      addText('Acciones Correctivas:', 12, 'bold', colors.navy);
      for (let i = 0; i < correctivasContainer.children.length; i++) {
        const accionDiv = correctivasContainer.children[i];
        const descripcion = accionDiv.querySelector('input[id$="-desc"]')?.getAttribute('value') || '';
        const responsable = accionDiv.querySelector('input[id$="-resp"]')?.getAttribute('value') || '';
        const fechaVal = accionDiv.querySelector('input[id$="-fecha"]')?.getAttribute('value') || '';
        let fechaFmt = '';
        if (fechaVal) {
          const fechaObj = new Date(fechaVal + 'T00:00:00');
          fechaFmt = fechaObj.toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
        }
        if (descripcion) {
          addText(`${i + 1}. ${descripcion}`);
          if (responsable) addText(`   Responsable: ${responsable}`, 10);
          if (fechaFmt) addText(`   Fecha límite: ${fechaFmt}`, 10);
        }
      }
    } else {
      addText('No se registraron acciones correctivas.');
    }

    yPosition += 5;

    const preventivasContainer = document.getElementById('accionesPreventivas');
    if (preventivasContainer && preventivasContainer.children.length > 0) {
      addText('Acciones Preventivas:', 12, 'bold', colors.navy);
      for (let i = 0; i < preventivasContainer.children.length; i++) {
        const accionDiv = preventivasContainer.children[i];
        const descripcion = accionDiv.querySelector('input[id$="-desc"]')?.getAttribute('value') || '';
        const responsable = accionDiv.querySelector('input[id$="-resp"]')?.getAttribute('value') || '';
        const fechaVal = accionDiv.querySelector('input[id$="-fecha"]')?.getAttribute('value') || '';
        let fechaFmt = '';
        if (fechaVal) {
          const fechaObj = new Date(fechaVal + 'T00:00:00');
          fechaFmt = fechaObj.toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
        }
        if (descripcion) {
          addText(`${i + 1}. ${descripcion}`);
          if (responsable) addText(`   Responsable: ${responsable}`, 10);
          if (fechaFmt) addText(`   Fecha límite: ${fechaFmt}`, 10);
        }
      }
    } else {
      addText('No se registraron acciones preventivas.');
    }

    addFooter();
    doc.save('Diagnostico_Fallas.pdf');

  } catch (error: any) {
    console.error('Error en exportación PDF:', error);
    showToast('Error al generar el PDF.', 'error');
  }
}

/* ==========================================================================
   Canvas Image Generation for Exports
   ========================================================================== */

interface IshikawaImageResult {
  imgData: string;
  width: number;
  height: number;
}

/** Generates an Ishikawa diagram image on a canvas */
export function createSimplifiedIshikawa(
  ishikawaData?: RCAIshikawa,
  problemaText?: string
): IshikawaImageResult | null {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  let canvasH = 420;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvasH);

  const categories = CATEGORY_ORDER.map(key => ({
    key,
    label: ISHIKAWA_CATEGORY_CONFIG[key].label,
    value: ishikawaData
      ? (ishikawaData[key] || '')
      : ((document.getElementById(`ishikawa-${key}`) as HTMLTextAreaElement)?.value || '').trim()
  }));

  const hasData = categories.some(c => c.value);
  if (!hasData) {
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('No hay datos de Ishikawa disponibles', 370, 210);
    const scNoData = upscaleCanvas(canvas, 4);
    return { imgData: scNoData.toDataURL(), width: scNoData.width, height: scNoData.height };
  }

  const spineY = 210;
  const contactXs = [205, 400, 595];
  const upperCenters = [115, 310, 505];
  const lowerCenters = [115, 310, 505];
  const CARD_W = 130, CARD_R = 8;
  const HEADER_H = 30, CONTENT_PAD = 38, CONTENT_BOT = 8;
  const MIN_CARD_H = 92;
  const LINE_H = 14;

  function measureWrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): number {
    if (!text) return 0;
    text = text.replace(/\n/g, ' ');
    const words = text.split(' ');
    let line = '';
    let lines = 0;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines++;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines++;
    return lines;
  }

  function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
    text = text.replace(/\n/g, ' ');
    const words = text.split(' ');
    let line = '';
    let ly = y;
    let lines = 0;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, ly);
        line = word;
        ly += lineHeight;
        lines++;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, ly);
      lines++;
    }
    return lines;
  }

  // Calculate dynamic heights
  ctx.font = '10px Arial, sans-serif';
  const cardHeights = categories.map(cat => {
    if (!cat.value) return MIN_CARD_H;
    const lines = measureWrapLines(ctx, cat.value, CARD_W - 16);
    const contentH = lines * LINE_H;
    return Math.max(MIN_CARD_H, HEADER_H + CONTENT_PAD + contentH + CONTENT_BOT);
  });

  const upperCardY = 30;
  const lowerCardY = 298;
  let maxUpperBottom = 0;
  cardHeights.slice(0, 3).forEach(h => {
    maxUpperBottom = Math.max(maxUpperBottom, upperCardY + h);
  });

  const MIN_GAP = 30;
  let spineShift = 0;
  if (maxUpperBottom + MIN_GAP > spineY) {
    spineShift = maxUpperBottom + MIN_GAP - spineY;
  }
  const newSpineY = spineY + spineShift;
  const newLowerY = lowerCardY + spineShift;

  cardHeights.slice(3, 6).forEach(h => {
    const bottom = newLowerY + h;
    if (bottom + 30 > canvasH) canvasH = bottom + 30;
  });

  const problema =
    problemaText ||
    (document.getElementById('descripcionProblema') as HTMLTextAreaElement)?.value?.trim() ||
    'No definido';
  ctx.font = '11px Arial, sans-serif';
  const pbLines = measureWrapLines(ctx, problema, 220 - 30);
  const pbContentH = pbLines * 15;
  const pbH = Math.max(120, 50 + pbContentH);
  const pbY = Math.max(164, newSpineY - 46);
  if (pbY + pbH + 30 > canvasH) canvasH = pbY + pbH + 30;

  canvas.height = canvasH;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvasH);
  ctx.lineCap = 'round';

  // Fish tail
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(85, newSpineY);
  ctx.lineTo(48, newSpineY - 32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(85, newSpineY);
  ctx.lineTo(48, newSpineY + 32);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(48, newSpineY - 32);
  ctx.lineTo(48, newSpineY + 32);
  ctx.stroke();

  // Spine
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(85, newSpineY);
  ctx.lineTo(762, newSpineY);
  ctx.stroke();

  // Arrow tip
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.moveTo(762, newSpineY);
  ctx.lineTo(752, newSpineY - 6);
  ctx.lineTo(752, newSpineY + 6);
  ctx.closePath();
  ctx.fill();

  // Contact marks
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  contactXs.forEach(x => {
    ctx.moveTo(x, newSpineY - 7);
    ctx.lineTo(x, newSpineY + 7);
  });
  ctx.stroke();

  // Branches
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2.5;
  categories.slice(0, 3).forEach((cat, i) => {
    const ch = cardHeights[i];
    const branchY1 = upperCardY + ch;
    ctx.beginPath();
    ctx.moveTo(upperCenters[i], branchY1);
    ctx.lineTo(contactXs[i], newSpineY);
    ctx.stroke();
  });
  categories.slice(3, 6).forEach((cat, i) => {
    ctx.beginPath();
    ctx.moveTo(lowerCenters[i], newLowerY);
    ctx.lineTo(contactXs[i], newSpineY);
    ctx.stroke();
  });

  // Cards
  const upperCardXs = [50, 245, 440];
  const lowerCardXs = [50, 245, 440];

  categories.forEach((cat, i) => {
    const isUpper = i < 3;
    const x = isUpper ? upperCardXs[i] : lowerCardXs[i - 3];
    const y = isUpper ? upperCardY : newLowerY;
    const h = cardHeights[i];
    const hasContent = !!cat.value;

    ctx.lineWidth = 1.5;
    if (hasContent) {
      ctx.fillStyle = '#e0f2fe';
      ctx.strokeStyle = '#3b82f6';
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#d1d5db';
    }
    roundRect(ctx, x, y, CARD_W, h, CARD_R);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 30);
    ctx.lineTo(x + CARD_W - 8, y + 30);
    ctx.stroke();

    ctx.fillStyle = '#1e3a5f';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat.label, x + CARD_W / 2, y + 16);

    if (hasContent) {
      ctx.fillStyle = '#3b82f6';
      ctx.font = '16px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('\u2713', x + CARD_W - 6, y + 6);
    }

    ctx.fillStyle = hasContent ? '#1e40af' : '#9ca3af';
    ctx.font = hasContent ? '10px Arial, sans-serif' : 'italic 10px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (hasContent) {
      wrapCanvasText(ctx, cat.value, x + 8, y + 38, CARD_W - 16, LINE_H);
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sin datos', x + CARD_W / 2, y + h / 2 + 10);
    }
  });

  // Problem box
  const pbX = 767, pbW = 220;
  ctx.fillStyle = '#1e3a5f';
  roundRect(ctx, pbX, pbY, pbW, pbH, 10);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('PROBLEMA', pbX + pbW / 2, pbY + 15);

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pbX + 20, pbY + 30);
  ctx.lineTo(pbX + pbW - 20, pbY + 30);
  ctx.stroke();

  ctx.fillStyle = '#93c5fd';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  wrapCanvasText(ctx, problema, pbX + 15, pbY + 38, pbW - 30, 15);

  const scIshikawa = upscaleCanvas(canvas, 4);
  return { imgData: scIshikawa.toDataURL(), width: scIshikawa.width, height: scIshikawa.height };
}

/** Generates a Pareto chart image on a canvas */
export function createSimplifiedPareto(paretoItems?: ParetoItem[]): IshikawaImageResult | null {
  const items = (paretoItems || []).slice().sort((a, b) => b.frecuencia - a.frecuencia);

  if (items.length === 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('No hay datos de Pareto disponibles', 150, 150);
    const scParetoEmpty = upscaleCanvas(canvas, 4);
    return { imgData: scParetoEmpty.toDataURL(), width: scParetoEmpty.width, height: scParetoEmpty.height };
  }

  const maxFreq = Math.max(...items.map(item => item.frecuencia));
  const totalFreq = items.reduce((sum, item) => sum + item.frecuencia, 0);

  const tempCtx = document.createElement('canvas').getContext('2d')!;
  tempCtx.font = 'bold 8px Arial';

  const barSpacing = (500 - 55 - 55) / items.length;
  const barWidth = Math.min(barSpacing * 0.65, 50);
  const maxLabelWidth = barWidth - 2;

  let maxLines = 0;
  items.forEach(item => {
    const words = item.causa.split(' ');
    let lines = 1;
    let currentLine = '';
    words.forEach(word => {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (tempCtx.measureText(testLine).width > maxLabelWidth && currentLine) {
        lines++;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    maxLines = Math.max(maxLines, lines);
  });

  const extra = Math.max(0, maxLines - 2) * 10;
  const bottomPad = 60 + extra;
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 300 + extra;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const m = { top: 30, right: 55, bottom: bottomPad, left: 55 };
  const chartWidth = canvas.width - m.left - m.right;
  const chartHeight = canvas.height - m.top - m.bottom;
  const startX = m.left;
  const startY = canvas.height - m.bottom;

  // Grid and Y axis
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const y = startY - (i * chartHeight / gridSteps);
    const freqValue = Math.round(maxFreq * i / gridSteps);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(canvas.width - m.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'end';
    ctx.textBaseline = 'middle';
    ctx.fillText(freqValue.toString(), startX - 8, y);
  }

  // Right Y axis (cumulative %)
  for (let i = 0; i <= gridSteps; i++) {
    const y = startY - (i * chartHeight / gridSteps);
    const pctValue = Math.round(100 * i / gridSteps);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'middle';
    ctx.fillText(pctValue + '%', canvas.width - m.right + 5, y);
  }

  // Main axes
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX, m.top);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(canvas.width - m.right, startY);
  ctx.stroke();

  // 80% reference line
  const eightyY = startY - (0.8 * chartHeight);
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(startX, eightyY);
  ctx.lineTo(canvas.width - m.right, eightyY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bars and cumulative line
  let acumulado = 0;
  const linePoints: { x: number; y: number; pct: number; label: string }[] = [];

  items.forEach((item, index) => {
    const barHeight = (item.frecuencia / maxFreq) * chartHeight;
    const x = startX + (index * barSpacing) + (barSpacing - barWidth) / 2;
    const y = startY - barHeight;

    ctx.fillStyle = '#93c5fd';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, barWidth, barHeight, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#374151';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const words = item.causa.split(' ');
    const labelLines: string[] = [];
    let currentLine = '';
    words.forEach(word => {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxLabelWidth && currentLine) {
        labelLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) labelLines.push(currentLine);
    labelLines.forEach((line, li) => {
      ctx.fillText(line, x + barWidth / 2, startY + 5 + li * 10);
    });

    acumulado += item.frecuencia;
    const cumPct = (acumulado / totalFreq) * 100;
    const lineX = x + barWidth / 2;
    const lineY = startY - (cumPct / 100) * chartHeight;
    linePoints.push({ x: lineX, y: lineY, pct: cumPct, label: cumPct.toFixed(0) + '%' });
  });

  if (linePoints.length > 0) {
    ctx.beginPath();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.moveTo(linePoints[0].x, linePoints[0].y);
    for (let i = 1; i < linePoints.length; i++) {
      ctx.lineTo(linePoints[i].x, linePoints[i].y);
    }
    ctx.stroke();

    linePoints.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (i === 0 || i === linePoints.length - 1 || pt.pct >= 75) {
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(pt.label, pt.x, pt.y - 7);
      }
    });
  }

  // Legend
  const legendY = startY + maxLines * 10 + 10;
  ctx.fillStyle = '#93c5fd';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  roundRect(ctx, startX, legendY, 14, 10, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  ctx.fillText('Frecuencia', startX + 20, legendY + 5);

  const legendLineX = startX + 100;
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(legendLineX, legendY + 5);
  ctx.lineTo(legendLineX + 30, legendY + 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(legendLineX + 15, legendY + 5, 3, 0, 2 * Math.PI);
  ctx.fillStyle = '#dc2626';
  ctx.fill();
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  ctx.fillText('% Acumulado', legendLineX + 36, legendY + 5);

  const scPareto = upscaleCanvas(canvas, 4);
  return { imgData: scPareto.toDataURL(), width: scPareto.width, height: scPareto.height };
}
