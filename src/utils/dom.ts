/** Dibuja un rectángulo con bordes redondeados en el canvas */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Escala un canvas por un factor (para mejorar resolución) */
export function upscaleCanvas(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = src.width * scale;
  dst.height = src.height * scale;
  const dctx = dst.getContext('2d')!;
  dctx.scale(scale, scale);
  dctx.drawImage(src, 0, 0);
  return dst;
}
