// 03 VERSION — inside the liquid. A dot-matrix counter scrambles and locks on the number with the voice;
// the product name builds in four stages: dots → 3D extrude → outline rings → clean.
// Exit: the camera pulls back and this whole frame becomes one card in a 3D grid (scene 4).
import * as THREE from 'three';
import { W, H, C, clamp, lerp, prog, smooth, ease, rgba, hash, hash2, mix } from '../lib/util.js';
import { label, textMask, maskDots, fitSize, serif } from '../lib/text.js';
import { traceCanvas, extrude } from '../lib/trace.js';
import { makeLiquid, pushView } from '../lib/liquid.js';
import { liquidDim } from './s2_prompt.js';

const COLS = 9, ROWS = 13, PITCH = 25;
function glyphMatrix(ch, size, baseY, cols) {
  const k = 8, c = document.createElement('canvas'); c.width = cols * k; c.height = ROWS * k; const g = c.getContext('2d', { willReadFrequently: true });
  g.font = `700 ${size}px 'JetBrains Mono', 'Thmanyah Serif Display'`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.fillText(ch, c.width / 2, baseY);
  const d = g.getImageData(0, 0, c.width, c.height).data, out = [];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < cols; i++) { let s = 0; for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) s += d[((j * k + y) * c.width + i * k + x) * 4 + 3]; out.push(s / (k * k * 255) > 0.4 ? 1 : 0); }
  return out;
}

export default function (R) {
  const S = R.sc('version'), m = S.marks, P = R.sc('prompt'); R.liquid ??= makeLiquid(R);
  // ── counter glyphs ──
  const chars = [...String(S.number)], arabic = /[٠-٩]/.test(S.number), pool = arabic ? '٠١٢٣٤٥٦٧٨٩' : '0123456789';
  const mc = document.createElement('canvas').getContext('2d'); mc.font = `700 100px 'JetBrains Mono', 'Thmanyah Serif Display'`;
  const asc = Math.max(...[...pool].map((d) => mc.measureText(d).actualBoundingBoxAscent)), size = (100 * (ROWS * 8 * 0.86)) / asc, baseY = ROWS * 8 * 0.93;
  const isDigit = (ch) => pool.includes(ch) || /[0-9٠-٩]/.test(ch);
  const mats = Object.fromEntries([...new Set([...pool, ...chars])].map((ch) => [ch, glyphMatrix(ch, size, baseY, isDigit(ch) ? COLS : 4)]));
  const cells = chars.map((ch) => ({ ch, cols: isDigit(ch) ? COLS : 4 })), digitIdx = cells.map((c, i) => (isDigit(c.ch) ? i : -1)).filter((i) => i >= 0);
  const totalCols = cells.reduce((s, c) => s + c.cols + 1, -1);
  const lockAt = (i) => { const k = digitIdx.indexOf(i); return k < 0 ? m.scr0 : m.lockN - (digitIdx.length - 1 - k) * 0.16; };

  // ── product name: one mask drives all four stages ──
  const NAME = { x: W / 2, y: 690 }, nsize = Math.min(380, fitSize(S.name, 1080, 330)), mask = textMask(S.name, nsize, { pad: 40 });
  const dots = maskDots(mask, 13), tr = traceCanvas(mask.canvas);
  const geo = extrude(tr.shapes, { depth: 120, bevel: 5, hw: mask.w / 2, hh: mask.h / 2 });
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera((2 * Math.atan(H / 2 / 1880) * 180) / Math.PI, W / H, 50, 6000); cam.position.set(0, 0, 1880);
  const mesh = new THREE.Mesh(geo, [new THREE.MeshPhysicalMaterial({ color: C.lilac, roughness: 0.2, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, envMap: R.getEnv(), envMapIntensity: 0.9 }),
    new THREE.MeshPhysicalMaterial({ color: C.violet, roughness: 0.3, metalness: 0.3, clearcoat: 0.6, envMap: R.getEnv(), envMapIntensity: 0.7 })]);
  mesh.position.set(NAME.x - W / 2, H / 2 - NAME.y, 0); scene.add(mesh);
  const key = new THREE.DirectionalLight('#FFE9E0', 2.6); key.position.set(-500, 900, 1300); const rim = new THREE.DirectionalLight(C.coral, 4.5); rim.position.set(900, -150, -600);
  const rim2 = new THREE.DirectionalLight(C.peach, 2.2); rim2.position.set(-900, 300, -500); scene.add(key, rim, rim2, new THREE.AmbientLight(C.lilac, 0.5));
  const ringC = document.createElement('canvas'); ringC.width = mask.w + 260; ringC.height = mask.h + 260; const rg = ringC.getContext('2d');
  const boxL = NAME.x - mask.w / 2 - 90, boxR = NAME.x + mask.w / 2 + 90;
  const wipeX = (k, t) => boxR - (boxR - boxL) * ease.io3(prog(t, m.stage[k] - 0.02, m.stage[k] + 0.24));   // stage k is visible to the right of this line

  function counter(g, t, v) {
    const appear = smooth(prog(t, R.X.x23[0] + 0.3, R.X.x23[1])), up = ease.io3(prog(t, m.lockN + 0.3, m.lockN + 0.95));
    if (appear <= 0) return;
    const sc = lerp(1.35, 1, appear) * lerp(1, 0.56, up), cy = lerp(470, 262, up), w = totalCols * PITCH, h = ROWS * PITCH, locked = t >= m.lockN, flash = locked ? Math.exp(-(t - m.lockN) * 7) : 0;
    g.save(); g.translate(W / 2, cy); g.scale(sc, sc); g.globalAlpha = appear;
    g.fillStyle = rgba(C.deep, 0.5); g.beginPath(); g.roundRect(-w / 2 - 44, -h / 2 - 40, w + 88, h + 80, 18); g.fill();
    g.strokeStyle = rgba(locked ? C.peach : C.lilac, 0.75); g.lineWidth = 2.5;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = sx * (w / 2 + 44), y = sy * (h / 2 + 40); g.beginPath(); g.moveTo(x - sx * 30, y); g.lineTo(x, y); g.lineTo(x, y - sy * 30); g.stroke(); }
    let col0 = 0; const on = [], off = [];
    cells.forEach((cell, i) => {
      const done = t >= lockAt(i), ch = done || !isDigit(cell.ch) ? cell.ch : pool[Math.floor(hash2(Math.floor(t * 15), i * 7.3) * 10)], mat = mats[ch];
      for (let j = 0; j < ROWS; j++) for (let k = 0; k < cell.cols; k++) (mat[j * cell.cols + k] ? on : off).push(-w / 2 + (col0 + k + 0.5) * PITCH, -h / 2 + (j + 0.5) * PITCH);
      col0 += cell.cols + 1;
    });
    g.fillStyle = rgba(C.lilac, 0.16); g.beginPath(); for (let k = 0; k < off.length; k += 2) { g.moveTo(off[k] + 3.2, off[k + 1]); g.arc(off[k], off[k + 1], 3.2, 0, 7); } g.fill();
    g.fillStyle = rgba(C.coral, 0.22 + 0.3 * flash); g.beginPath(); for (let k = 0; k < on.length; k += 2) { g.moveTo(on[k] + 15, on[k + 1]); g.arc(on[k], on[k + 1], 15, 0, 7); } g.fill();
    g.fillStyle = mix(locked ? C.peach : C.coral, '#FFFFFF', flash * 0.8); g.beginPath(); for (let k = 0; k < on.length; k += 2) { g.moveTo(on[k] + 10, on[k + 1]); g.arc(on[k], on[k + 1], 10, 0, 7); } g.fill();
    label(g, `03 · ${S.label || 'VERSION'}`, -w / 2 - 44, -h / 2 - 58, 20, { fill: C.lilac, weight: 700 });
    label(g, locked ? 'LOCKED' : `SCAN ${String(Math.floor(hash(Math.floor(t * 15)) * 9999)).padStart(4, '0')}`, w / 2 + 44, -h / 2 - 58, 20, { fill: locked ? C.peach : rgba(C.lilac, 0.8), align: 'right', weight: 700 });
    if (flash > 0.02) { g.strokeStyle = rgba('#FFFFFF', flash); g.lineWidth = 3; g.beginPath(); g.roundRect(-w / 2 - 44 - 20 * (1 - flash), -h / 2 - 40 - 20 * (1 - flash), w + 88 + 40 * (1 - flash), h + 80 + 40 * (1 - flash), 18); g.stroke(); }
    g.restore();
  }

  function nameStage(g, t) {
    if (t < m.stage[0]) return;
    const x = [0, 1, 2, 3].map((k) => wipeX(k, t)), region = (k) => [x[k], k < 3 ? x[k + 1] : boxR + 400];   // [left, right] of stage k
    const clipTo = (k, fn) => { const [l, r] = region(k); if (r - l < 1) return; g.save(); g.beginPath(); g.rect(l, 0, r - l, H); g.clip(); fn(); g.restore(); };
    // 1 dots
    clipTo(0, () => { const col = []; g.fillStyle = C.lilac; g.beginPath();
      for (const d of dots) { const a = ease.outBack(prog(t, m.stage[0] + hash2(d.i, d.j) * 0.2, m.stage[0] + hash2(d.i, d.j) * 0.2 + 0.16)); if (a <= 0) continue; const r = 5.4 * Math.sqrt(d.a) * a; g.moveTo(NAME.x + d.x + r, NAME.y + d.y); g.arc(NAME.x + d.x, NAME.y + d.y, r, 0, 7); } g.fill(); });
    // 3 outline rings (drawn on an offscreen so the punch-outs do not eat the frame)
    if (x[2] < boxR) clipTo(2, () => { const cx = ringC.width / 2 + mask.ax, cy = ringC.height / 2 + mask.ay, ph = (t * 0.55) % 1; rg.clearRect(0, 0, ringC.width, ringC.height);
      rg.font = mask.font; rg.direction = 'rtl'; rg.textAlign = 'center'; rg.textBaseline = 'alphabetic'; rg.lineJoin = 'round';
      for (let k = 5; k >= 0; k--) { const off = (k + ph) * 17, a = clamp(1 - off / 100); rg.globalCompositeOperation = 'source-over'; rg.strokeStyle = k % 2 ? rgba(C.coral, a) : rgba(C.peach, a); rg.lineWidth = off * 2 + 3.2; rg.strokeText(S.name, cx, cy);
        rg.globalCompositeOperation = 'destination-out'; rg.strokeStyle = '#000'; rg.lineWidth = Math.max(0.01, off * 2 - 1.2); rg.strokeText(S.name, cx, cy); if (off < 1) rg.fillText(S.name, cx, cy); }
      rg.globalCompositeOperation = 'destination-out'; rg.fillStyle = '#000'; rg.fillText(S.name, cx, cy); rg.globalCompositeOperation = 'source-over'; rg.strokeStyle = C.peach; rg.lineWidth = 3; rg.strokeText(S.name, cx, cy);
      g.drawImage(ringC, NAME.x - ringC.width / 2, NAME.y - ringC.height / 2); });
    // 4 clean
    if (x[3] < boxR) clipTo(3, () => { const pop = 1 + 0.045 * Math.exp(-Math.max(0, t - m.stage[3] - 0.2) * 9); g.save(); g.translate(NAME.x, NAME.y); g.scale(pop, pop);
      g.font = mask.font; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.shadowColor = rgba(C.deep, 0.6); g.shadowBlur = 40; g.shadowOffsetY = 14; g.fillStyle = C.peach; g.fillText(S.name, mask.ax, mask.ay); g.restore(); });
    // wipe lines + stage read-out
    for (let k = 0; k < 4; k++) if (x[k] > boxL + 1 && x[k] < boxR - 1) { g.fillStyle = C.peach; g.fillRect(x[k] - 1.5, NAME.y - mask.h / 2 - 30, 3, mask.h + 60); g.fillStyle = rgba(C.peach, 0.18); g.fillRect(x[k], NAME.y - mask.h / 2 - 30, 26, mask.h + 60); }
    const names = ['DOTS', 'EXTRUDE', 'OUTLINE', 'FINAL'], cur = m.stage.filter((s) => t >= s).length - 1, y = NAME.y + mask.h / 2 + 36;
    names.forEach((n, k) => label(g, `${k + 1} ${n}`, W / 2 - 330 + k * 220, y, 16, { fill: k === cur ? C.peach : rgba(C.lilac, k < cur ? 0.7 : 0.3), align: 'center', weight: k === cur ? 700 : 500 }));
    g.fillStyle = rgba(C.lilac, 0.25); g.fillRect(W / 2 - 400, y + 14, 800, 1.5); g.fillStyle = C.coral; g.fillRect(W / 2 - 400, y + 14, 800 * clamp((cur + prog(t, m.stage[Math.max(0, cur)], m.stage[Math.max(0, cur)] + m.stageLen)) / 4), 1.5);
    return region(1);
  }

  return {
    id: 'version',
    draw(t) {
      const g = R.g, v = pushView(R, t);
      if (t > P.win[1]) R.liquid.render(t, { cx: v.cx, cy: v.cy, scale: v.Z, dim: liquidDim(R, t) });
      counter(g, t, v);
      const reg = nameStage(g, t);
      if (reg && reg[1] - reg[0] > 1) { // 2 the extruded stage is real 3D, scissored to its slice of the wipe
        const p = ease.out3(prog(t, m.stage[1], m.stage[2] + 0.22));
        mesh.rotation.set(lerp(-0.42, 0, p), lerp(0.85, 0, p), lerp(0.06, 0, p)); mesh.scale.setScalar(lerp(0.9, 1, p));
        const r = R.renderer; r.clearDepth(); r.setScissorTest(true); r.setScissor(Math.max(0, reg[0]), 0, Math.min(W, reg[1]) - Math.max(0, reg[0]), H); r.render(scene, cam); r.setScissorTest(false);
      }
      R.cam = { focal: 1880 * v.Z, tilt: 0 };
    },
  };
}
