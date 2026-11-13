// Bitmap → vector: marching squares over an alpha mask, so any PNG logo or any shaped Arabic word
// (letters stay joined, exactly as the font draws them) can be extruded in three.js.
import * as THREE from 'three';

export function traceAlpha(alpha, w, h, thr = 0.5) {
  const PW = w + 2, PH = h + 2, f = new Float32Array(PW * PH);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f[(y + 1) * PW + x + 1] = alpha[y * w + x];
  const F = (i, j) => f[j * PW + i];
  const starts = new Map();               // start-edge key → { to, x, y }
  const hKey = (i, j) => (j * PW + i) * 2, vKey = (i, j) => (j * PW + i) * 2 + 1;
  const cut = (a, b) => (thr - a) / (b - a);
  for (let j = 0; j < PH - 1; j++) for (let i = 0; i < PW - 1; i++) {
    const tl = F(i, j), tr = F(i + 1, j), br = F(i + 1, j + 1), bl = F(i, j + 1);
    const idx = (tl > thr ? 8 : 0) | (tr > thr ? 4 : 0) | (br > thr ? 2 : 0) | (bl > thr ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const E = { T: () => [hKey(i, j), i + cut(tl, tr), j], B: () => [hKey(i, j + 1), i + cut(bl, br), j + 1], L: () => [vKey(i, j), i, j + cut(tl, bl)], R: () => [vKey(i + 1, j), i + 1, j + cut(tr, br)] };
    const seg = (a, b) => { const p = E[a](), q = E[b](); starts.set(p[0], { to: q[0], x: p[1] - 1, y: p[2] - 1 }); };
    switch (idx) { // filled side stays on the walker's left
      case 1: seg('B', 'L'); break; case 2: seg('R', 'B'); break; case 4: seg('T', 'R'); break; case 8: seg('L', 'T'); break;
      case 3: seg('R', 'L'); break; case 6: seg('T', 'B'); break; case 12: seg('L', 'R'); break; case 9: seg('B', 'T'); break;
      case 7: seg('T', 'L'); break; case 11: seg('R', 'T'); break; case 13: seg('B', 'R'); break; case 14: seg('L', 'B'); break;
      case 5: seg('B', 'L'); seg('T', 'R'); break; case 10: seg('L', 'T'); seg('R', 'B'); break;
    }
  }
  const loops = [];
  for (const k0 of [...starts.keys()]) {
    if (!starts.has(k0)) continue; const pts = []; let k = k0, guard = 0;
    while (starts.has(k) && guard++ < 1e6) { const s = starts.get(k); starts.delete(k); pts.push([s.x, s.y]); k = s.to; }
    if (pts.length > 5) loops.push(pts);
  }
  return loops;
}
const area = (p) => { let a = 0; for (let i = 0, n = p.length; i < n; i++) { const q = p[(i + 1) % n]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
function rdp(pts, eps) {
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const stack = [[0, pts.length - 1]];
  while (stack.length) { const [a, b] = stack.pop(); let md = 0, mi = -1; const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}
const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
  if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };

// loops → THREE.Shape[] centred on (cx, cy), y flipped, scaled to world units
export function loopsToShapes(loops, { cx, cy, scale, eps = 0.45, minArea = 6 }) {
  const L = loops.map((p) => { const half = Math.floor(p.length / 2); const s = [...rdp(p.slice(0, half + 1), eps), ...rdp(p.slice(half), eps).slice(1, -1)]; return { pts: s, a: area(s) }; })
    .filter((l) => l.pts.length >= 3 && Math.abs(l.a) > minArea);
  if (!L.length) return [];
  const outerSign = Math.sign(L.reduce((m, l) => (Math.abs(l.a) > Math.abs(m.a) ? l : m)).a);
  const outers = L.filter((l) => Math.sign(l.a) === outerSign), holes = L.filter((l) => Math.sign(l.a) !== outerSign);
  const map = (p) => new THREE.Vector2((p[0] - cx) * scale, -(p[1] - cy) * scale);
  const shapes = outers.map((o) => ({ o, shape: new THREE.Shape(o.pts.map(map)) }));
  for (const hole of holes) { let best = null; for (const s of shapes) if (inside(hole.pts[0], s.o.pts) && (!best || Math.abs(s.o.a) < Math.abs(best.o.a))) best = s;
    if (best) best.shape.holes.push(new THREE.Path(hole.pts.map(map))); }
  return shapes.map((s) => s.shape);
}
// Canvas (alpha channel) → shapes. Returns shapes plus the mask data for later sampling.
export function traceCanvas(canvas, opts = {}) {
  const w = canvas.width, h = canvas.height, d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = d[i * 4 + 3] / 255;
  return { shapes: loopsToShapes(traceAlpha(alpha, w, h), { cx: w / 2, cy: h / 2, scale: 1, ...opts }), alpha, w, h, data: d };
}
// Deepest point inside the mask (max distance to the edge): where a camera can fly "through" and see only colour.
export function deepestPoint(alpha, w, h) {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = alpha[i] > 0.5 ? INF : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); }
  let best = 0, bi = 0; for (let i = 0; i < w * h; i++) if (d[i] > best) { best = d[i]; bi = i; }
  return { x: bi % w, y: Math.floor(bi / w), r: best };
}
// Extruded, bevelled mesh geometry whose caps carry planar UVs over [-hw..hw] × [-hh..hh]
export function extrude(shapes, { depth, bevel, hw, hh, curveSegments = 6 }) {
  const uv = { generateTopUV: (g, v, a, b, c) => [a, b, c].map((i) => new THREE.Vector2((v[i * 3] + hw) / (2 * hw), (v[i * 3 + 1] + hh) / (2 * hh))),
    generateSideWallUV: (g, v, a, b, c, d) => [a, b, c, d].map((i) => new THREE.Vector2((v[i * 3] + hw) / (2 * hw), (v[i * 3 + 1] + hh) / (2 * hh))) };
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 4, curveSegments, UVGenerator: uv });
  geo.translate(0, 0, -depth / 2); return geo;
}
