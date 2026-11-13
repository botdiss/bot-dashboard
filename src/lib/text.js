// Arabic is always drawn as whole shaped words (canvas text shaping, RTL) — never letter by letter.
import { SERIF, MONO } from './util.js';

export const serif = (size, weight = 900) => `${weight} ${size}px ${SERIF}`;
export const mono = (size, weight = 500) => `${weight} ${size}px ${MONO}`;

export function word(g, text, x, y, size, { weight = 900, fill = '#fff', align = 'center', alpha = 1, stroke = null, lineWidth = 2, baseline = 'alphabetic' } = {}) {
  g.save(); g.font = serif(size, weight); g.direction = 'rtl'; g.textAlign = align; g.textBaseline = baseline; g.globalAlpha *= alpha;
  if (fill) { g.fillStyle = fill; g.fillText(text, x, y); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lineWidth; g.lineJoin = 'round'; g.strokeText(text, x, y); }
  g.restore();
}
export function label(g, text, x, y, size = 15, { fill = '#A99BD6', align = 'left', alpha = 1, weight = 500, spacing = 1.2, baseline = 'alphabetic' } = {}) {
  g.save(); g.font = mono(size, weight); g.direction = 'ltr'; g.textAlign = align; g.textBaseline = baseline; g.fillStyle = fill; g.globalAlpha *= alpha;
  try { g.letterSpacing = spacing + 'px'; } catch {}
  g.fillText(text, x, y); g.restore();
}
const mctx = document.createElement('canvas').getContext('2d');
export function measure(text, font, dir = 'rtl') {
  mctx.font = font; mctx.direction = dir; mctx.textAlign = 'center'; const m = mctx.measureText(text);   // left/right are measured from the centre anchor
  return { width: m.width, left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent };
}
// largest size at which `text` fits in maxW × maxH (ink box)
export function fitSize(text, maxW, maxH, weight = 900, family = SERIF) {
  const m = measure(text, `${weight} 200px ${family}`); const w = m.left + m.right, h = m.ascent + m.descent;
  return Math.floor(200 * Math.min(maxW / w, maxH / h));
}
// White-on-transparent mask of a word, with its ink box. cx/cy = where the alphabetic-baseline centre sits.
const maskCache = new Map();
export function textMask(text, size, { weight = 900, pad = 24, family = SERIF, dir = 'rtl' } = {}) {
  const key = [text, size, weight, pad, family].join('|'); if (maskCache.has(key)) return maskCache.get(key);
  const font = `${weight} ${size}px ${family}`, m = measure(text, font, dir);
  const w = Math.ceil(m.left + m.right + pad * 2), h = Math.ceil(m.ascent + m.descent + pad * 2);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
  g.font = font; g.direction = dir; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
  const ox = pad + m.left, oy = pad + m.ascent; g.fillText(text, ox, oy);
  const out = { canvas: c, g, w, h, ox, oy, inkW: m.left + m.right, inkH: m.ascent + m.descent, font,
    // offset from "centre of ink box" to the fillText anchor
    ax: ox - w / 2, ay: oy - h / 2 };
  maskCache.set(key, out); return out;
}
// Sample a mask on a grid → dots [{x, y, a}] relative to the mask centre.
export function maskDots(mask, step, thr = 0.12) {
  const { w, h } = mask, data = mask.g.getImageData(0, 0, w, h).data, dots = [], r = Math.max(1, Math.floor(step / 2) - 1);
  const cols = Math.floor(w / step), rows = Math.floor(h / step), offX = (w - cols * step) / 2 + step / 2, offY = (h - rows * step) / 2 + step / 2;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const cx = Math.round(offX + i * step), cy = Math.round(offY + j * step); let s = 0, n = 0;
    for (let y = cy - r; y <= cy + r; y += 2) for (let x = cx - r; x <= cx + r; x += 2) { if (x < 0 || y < 0 || x >= w || y >= h) continue; s += data[(y * w + x) * 4 + 3]; n++; }
    const a = n ? s / n / 255 : 0; if (a > thr) dots.push({ x: cx - w / 2, y: cy - h / 2, a, i, j });
  }
  return dots;
}
