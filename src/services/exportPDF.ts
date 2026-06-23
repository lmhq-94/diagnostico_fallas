import { rcaData, CATEGORY_ORDER, ISHIKAWA_CATEGORY_CONFIG, type RCAIshikawa, type ParetoItem } from '../state/store';
import { roundRect, upscaleCanvas } from '../utils/dom';
import { escapeHtml } from '../utils/text';
import { showToast } from '../utils/toast';
import { getCurrentCauseSummary } from '../state/store';
import { recordRootCauseForPareto } from './pareto';
import { jsPDF } from 'jspdf';

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

async function loadLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch('/src/assets/logo.png');
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function exportPDF(
  updateIshikawaForMachine: (machine: string, data: any, problem: string) => void
): Promise<void> {
  try {
    recordRootCauseForPareto(getCurrentCauseSummary);
    const machineIshikawaPdf = rcaData.captura?.maquina || '';
    const problemIshikawaPdf = rcaData.captura?.problema || '';
    if (machineIshikawaPdf && problemIshikawaPdf && rcaData.ishikawa) {
      updateIshikawaForMachine(machineIshikawaPdf, rcaData.ishikawa, problemIshikawaPdf);
    }

    const doc = new jsPDF('p', 'mm', 'a4');

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 15;
    const cw = pw - 2 * m;
    let y = m;

    const colors = {
      navy: [30, 58, 95] as const,
      blue: [37, 99, 235] as const,
      sky: [224, 242, 254] as const,
      slate: [100, 116, 139] as const,
      slateDark: [30, 41, 59] as const,
      grayBg: [249, 250, 251] as const,
      grayBorder: [229, 231, 235] as const,
      white: [255, 255, 255] as const,
      green: [22, 163, 74] as const,
      amber: [217, 119, 6] as const,
      red: [220, 38, 38] as const,
    };

    const logoData = await loadLogoBase64();

    function addHeader() {
      doc.setFillColor(...colors.navy);
      doc.rect(0, 0, pw, 28, 'F');
      if (logoData) {
        doc.addImage(logoData, 'PNG', m, 4, 24, 15);
      }
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const tx = logoData ? m + 28 : m;
      doc.text('Reporte de Diagnóstico de Fallas', tx, 11);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      const fg = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Generado: ${fg}`, tx, 19);
      doc.setDrawColor(...colors.blue);
      doc.setLineWidth(0.6);
      doc.line(0, 28, pw, 28);
      y = 36;
    }

    function addFooter() {
      const fy = ph - 10;
      doc.setFillColor(...colors.navy);
      doc.rect(0, fy, pw, 10, 'F');
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text('Herramienta de Diagnóstico de Fallas', pw / 2, fy + 6, { align: 'center' });
    }

    function checkPageBreak(h: number) {
      if (y + h > ph - 18) {
        addFooter();
        doc.addPage();
        addHeader();
      }
    }

    /** Section title with min bar + color badge, then content starts immediately below */
    function addSectionTitle(title: string) {
      checkPageBreak(16);
      doc.setFillColor(...colors.blue);
      doc.rect(m, y, 3, 12, 'F');
      doc.setFillColor(...colors.sky);
      doc.roundedRect(m + 3, y, cw - 3, 12, 2, 2, 'F');
      doc.setTextColor(...colors.navy);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(title, m + 10, y + 8.5);
      y += 16;
    }

    /** Two-column label/value pairs */
    function addField(label: string, value: string) {
      if (!value) return;
      checkPageBreak(7);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.slateDark);
      const lw = doc.getTextWidth(label);
      doc.text(label, m + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.slate);
      doc.text(value, m + 4 + lw + 2, y);
      y += 5;
    }

    /** Text block with word-wrap */
    function addTextBlock(
      text: string,
      fontSize = 9,
      fontStyle: 'normal' | 'bold' | 'italic' = 'normal',
      textColor: readonly [number, number, number] = colors.slate
    ) {
      if (!text) return;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setTextColor(...textColor);
      const lines = doc.splitTextToSize(text, cw - 8);
      const lh = fontSize * 0.38;
      checkPageBreak(lines.length * lh + 4);
      lines.forEach((line: string) => {
        doc.text(line, m + 4, y);
        y += lh;
      });
      y += 1;
    }

    /** Light horizontal rule */
    function addHR() {
      checkPageBreak(5);
      y += 1;
      doc.setDrawColor(...colors.grayBorder);
      doc.setLineWidth(0.4);
      doc.line(m + 4, y, m + cw - 4, y);
      y += 4;
    }

    /** Priority badge */
    function drawPriorityBadge(x: number, cy: number, prioridad: string) {
      const map: Record<string, readonly [number, number, number]> = { alta: colors.red, media: colors.amber, baja: colors.green };
      const c = map[prioridad] || colors.slate;
      doc.setFillColor(...c);
      doc.roundedRect(x, cy - 2.5, 14, 6, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.text(prioridad.toUpperCase(), x + 7, cy + 0.5, { align: 'center' });
    }

    /* ═══════════ BUILD REPORT ═══════════ */

    addHeader();

    // ── 1. PROBLEM INFO ──
    addSectionTitle('1. Información del Problema');

    const captura = rcaData.captura || {};
    const fechaInput = captura.fecha || '';
    let fechaStr = 'No especificada';
    if (fechaInput) {
      fechaStr = new Date(fechaInput + 'T00:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }

    addField('Fecha del evento:', fechaStr);
    addField('Máquina / Equipo:', captura.maquina || 'No especificada');
    addField('Tiempo de paro:', captura.tiempoParo ? `${captura.tiempoParo} minutos` : 'No especificado');
    addField('Responsable:', captura.responsable || 'No especificado');

    addHR();
    addTextBlock(captura.problema || 'No descrito', 9, 'bold', colors.navy);
    addHR();
    addTextBlock(captura.sintomas || 'No descritos');
    y += 3;

    // ── 2. 5 WHYS ──
    addSectionTitle('2. Análisis de 5 Porqués');

    const whys = rcaData.whys || {};
    let hasWhys = false;
    for (let i = 1; i <= 5; i++) {
      const wt = whys[`why${i}` as keyof typeof whys];
      if (wt) {
        hasWhys = true;
        checkPageBreak(6);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.blue);
        doc.text(`¿Por qué #${i}?`, m + 4, y);
        y += 4.5;
        addTextBlock(String(wt));
      }
    }
    if (!hasWhys) addTextBlock('No se registraron análisis de 5 porqués.');

    const causaRaiz = whys.causaRaiz || '';
    if (causaRaiz) {
      addHR();
      checkPageBreak(10);
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(m + 4, y, cw - 8, 10, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.green);
      doc.text('Causa Raíz:', m + 10, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.slateDark);
      doc.text(causaRaiz, m + 10 + doc.getTextWidth('Causa Raíz:') + 2, y + 7);
      y += 14;
    }
    y += 2;

    // ── 3. ISHIKAWA ──
    addSectionTitle('3. Diagrama de Ishikawa');

    const ishikawa = rcaData.ishikawa || {};
    const hasIshikawa = CATEGORY_ORDER.some(cat => ishikawa[cat]?.trim());
    if (hasIshikawa) {
      checkPageBreak(170);
      const img = createSimplifiedIshikawa();
      if (img && img.imgData) {
        const iw = 170;
        const ih = (img.height / img.width) * iw;
        doc.addImage(img.imgData, 'PNG', (pw - iw) / 2, y, iw, ih);
        y += ih + 6;
      }
    } else {
      addTextBlock('No se registraron datos en el diagrama de Ishikawa.');
    }
    y += 3;

    // ── 4. ACTION PLAN ──
    addSectionTitle('4. Plan de Acción');

    const acciones = rcaData.acciones || { correctivas: [], preventivas: [] };

    function renderActions(list: typeof acciones.correctivas, label: string, labelColor: readonly [number, number, number]) {
      if (list.length === 0) {
        addTextBlock(`No se registraron acciones ${label.toLowerCase()}.`);
        return;
      }

      checkPageBreak(10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...labelColor);
      doc.text(label, m + 4, y);
      y += 7;

      list.forEach((accion, i) => {
        checkPageBreak(22);
        doc.setFillColor(...colors.white);
        doc.setDrawColor(...colors.grayBorder);
        doc.roundedRect(m + 4, y, cw - 8, 18, 3, 3, 'FD');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.slateDark);
        const desc = `${i + 1}. ${accion.descripcion || ''}`;
        doc.text(desc, m + 10, y + 6);

        let dx = m + 10;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.slate);
        doc.setFontSize(7.5);
        if (accion.responsable) {
          const rtxt = `Resp: ${accion.responsable}`;
          doc.text(rtxt, dx, y + 13);
          dx += doc.getTextWidth(rtxt) + 8;
        }
        if (accion.fecha) {
          doc.text(`Fecha: ${accion.fecha}`, dx, y + 13);
        }
        if (accion.prioridad) {
          drawPriorityBadge(m + cw - 24, y + 9, accion.prioridad);
        }
        y += 22;
      });
      y += 2;
    }

    renderActions(acciones.correctivas, 'Acciones Correctivas', colors.green);
    renderActions(acciones.preventivas, 'Acciones Preventivas', colors.blue);

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
  tempCtx.font = 'bold 9px Inter, Arial, sans-serif';

  // Wider canvas for a more spacious look
  const CANVAS_W = 560;
  const barSpacing = (CANVAS_W - 120) / items.length;
  const barWidth = Math.min(barSpacing * 0.6, 52);
  const maxLabelWidth = barWidth + 4;

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

  const extra = Math.max(0, maxLines - 2) * 11;
  const bottomPad = 68 + extra;
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = 340 + extra;
  const ctx = canvas.getContext('2d')!;

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#f8fafc');
  gradient.addColorStop(1, '#ffffff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#1e3a5f';
  ctx.font = 'bold 14px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Análisis de Pareto', canvas.width / 2, 10);

  // Subtitle
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px Inter, Arial, sans-serif';
  const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.fillText(`Generado: ${dateStr}`, canvas.width / 2, 28);

  const m = { top: 50, right: 60, bottom: bottomPad, left: 60 };
  const chartWidth = canvas.width - m.left - m.right;
  const chartHeight = canvas.height - m.top - m.bottom;
  const startX = m.left;
  const startY = canvas.height - m.bottom;

  // ── Grid lines (subtle) ──
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = startY - (i * chartHeight / gridSteps);
    const freqValue = Math.round(maxFreq * i / gridSteps);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(canvas.width - m.right, y);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 9px Inter, Arial, sans-serif';
    ctx.textAlign = 'end';
    ctx.textBaseline = 'middle';
    ctx.fillText(freqValue.toString(), startX - 10, y);
  }

  // ── Right axis (cumulative %) ──
  for (let i = 0; i <= gridSteps; i++) {
    const y = startY - (i * chartHeight / gridSteps);
    const pctValue = Math.round(100 * i / gridSteps);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 9px Inter, Arial, sans-serif';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'middle';
    ctx.fillText(pctValue + '%', canvas.width - m.right + 10, y);
  }

  // ── Axes ──
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(startX, m.top);
  ctx.lineTo(startX, startY);
  ctx.lineTo(canvas.width - m.right, startY);
  ctx.stroke();

  // ── 80% reference line ──
  const eightyY = startY - (0.8 * chartHeight);
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(startX, eightyY);
  ctx.lineTo(canvas.width - m.right, eightyY);
  ctx.stroke();
  ctx.setLineDash([]);

  // "80%" label on the reference line
  ctx.fillStyle = 'rgba(220, 38, 38, 0.5)';
  ctx.font = 'italic 8px Inter, Arial, sans-serif';
  ctx.textAlign = 'end';
  ctx.textBaseline = 'bottom';
  ctx.fillText('80%', canvas.width - m.right - 4, eightyY - 2);

  // ── Bars ──
  const barColors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];
  let acumulado = 0;
  const linePoints: { x: number; y: number; pct: number; label: string; count: number }[] = [];

  items.forEach((item, index) => {
    const barHeight = Math.max((item.frecuencia / maxFreq) * chartHeight, 2);
    const x = startX + (index * barSpacing) + (barSpacing - barWidth) / 2;
    const y = startY - barHeight;

    // Bar shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    roundRect(ctx, x + 2, y + 2, barWidth, barHeight, 3);
    ctx.fill();

    // Bar fill with gradient
    const barColor = barColors[index % barColors.length];
    const grad = ctx.createLinearGradient(x, y, x, startY);
    grad.addColorStop(0, barColor);
    grad.addColorStop(1, barColor + '99');
    ctx.fillStyle = grad;
    ctx.strokeStyle = barColor;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, barWidth, barHeight, 3);
    ctx.fill();
    ctx.stroke();

    // Frequency count inside bar (if tall enough)
    if (barHeight > 20) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(item.frecuencia), x + barWidth / 2, y + barHeight / 2);
    }

    // X-axis label (word-wrapped cause)
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 9px Inter, Arial, sans-serif';
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
      ctx.fillText(line, x + barWidth / 2, startY + 6 + li * 11);
    });

    acumulado += item.frecuencia;
    const cumPct = (acumulado / totalFreq) * 100;
    const lineX = x + barWidth / 2;
    const lineY = startY - (cumPct / 100) * chartHeight;
    linePoints.push({ x: lineX, y: lineY, pct: cumPct, label: cumPct.toFixed(0) + '%', count: item.frecuencia });
  });

  // ── Cumulative line ──
  if (linePoints.length > 0) {
    // Area under curve
    ctx.beginPath();
    ctx.moveTo(linePoints[0].x, startY);
    linePoints.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(linePoints[linePoints.length - 1].x, startY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(220, 38, 38, 0.04)';
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.moveTo(linePoints[0].x, linePoints[0].y);
    for (let i = 1; i < linePoints.length; i++) {
      ctx.lineTo(linePoints[i].x, linePoints[i].y);
    }
    ctx.stroke();

    // Dots
    linePoints.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Percentage label for key points
      if (i === 0 || i === linePoints.length - 1 || pt.pct >= 75) {
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 9px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const label = pt.label;
        const labelW = ctx.measureText(label).width;
        const lx = pt.x;
        const ly = pt.y - 10;
        // Small label background
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        roundRect(ctx, lx - labelW / 2 - 3, ly - 6, labelW + 6, 14, 4);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 9px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx, ly + 1);
      }
    });
  }

  // ── Legend ──
  const legendY = startY + maxLines * 11 + 18;
  ctx.fillStyle = '#64748b';
  ctx.font = '8px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Bar legend
  const barLegendX = canvas.width / 2 - 80;
  ctx.fillStyle = barColors[0];
  roundRect(ctx, barLegendX, legendY, 12, 10, 2);
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 9px Inter, Arial, sans-serif';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'top';
  ctx.fillText('Frecuencia', barLegendX + 17, legendY);

  // Line legend
  const lineLegendX = canvas.width / 2 + 20;
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(lineLegendX, legendY + 5);
  ctx.lineTo(lineLegendX + 24, legendY + 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(lineLegendX + 12, legendY + 5, 3, 0, 2 * Math.PI);
  ctx.fillStyle = '#dc2626';
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 9px Inter, Arial, sans-serif';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'top';
  ctx.fillText('% Acumulado', lineLegendX + 30, legendY);

  const scPareto = upscaleCanvas(canvas, 4);
  return { imgData: scPareto.toDataURL(), width: scPareto.width, height: scPareto.height };
}
