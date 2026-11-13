// 01 HOOK — a macro eye built from halftone dots opens on the first word, REC brackets lock on the
// iris, a key word lands and is struck through. Exit: whip-zoom into the pupil.
import { W, H, C, clamp, lerp, prog, smooth, ease, hash2, noise2, rgba, mix, vel } from '../lib/util.js';
import { word, label, measure, serif } from '../lib/text.js';

const E = { x: 960, y: 478 }, U = 770, STEP = 15, ZEND = 36;
const IRIS = 0.37, PUPIL = 0.128;

// The camera move shared with scene 2: zoom factor and where the pupil sits on screen.
export function pupilZoom(R, t) {
  const [a, b] = R.X.x12, u = ease.io3(prog(t, a, b)), Z = Math.exp(Math.log(ZEND) * u);
  return { u, Z, px: lerp(E.x, W / 2, smooth(u * 1.6)), py: lerp(E.y, H / 2, smooth(u * 1.6)), ZEND };
}

export default function (R) {
  const S = R.sc('hook'), m = S.marks;
  const lidU = (x, o) => -0.43 * o * Math.pow(Math.max(0, 1 - x * x), 0.72) + 0.045 * x;
  const lidL = (x, o) => 0.25 * o * Math.pow(Math.max(0, 1 - x * x), 0.9) + 0.045 * x;

  // brightness + colour of the eye image at a point (eye units), for a given lid opening
  function eye(x, y, o, t, gx, pup) {
    const ax = Math.abs(x);
    if (ax < 1) {
      const yu = lidU(x, o), yl = lidL(x, o);
      if (y > yu && y < yl) {
        const dx = x - gx, dy = y + 0.055, r = Math.hypot(dx, dy);
        const lidShade = 1 - 0.55 * Math.exp(-(y - yu) / 0.07) - 0.25 * Math.exp(-(yl - y) / 0.03);
        if (r < IRIS) {
          const hl = Math.hypot(dx + 0.115, dy + 0.125);
          if (hl < 0.05) return [1, 3];
          if (r < pup) return [0, 0];
          const k = (r - pup) / (IRIS - pup), ang = Math.atan2(dy, dx);
          let b = 0.5 + 0.3 * (noise2(ang * 9.5 + 20, k * 2.2) - 0.5) * 2 + 0.2 * Math.exp(-((k - 0.3) ** 2) / 0.02);
          b *= k > 0.86 ? lerp(1, 0.35, (k - 0.86) / 0.14) : 1; b *= k < 0.1 ? lerp(0.5, 1, k / 0.1) : 1;
          return [clamp(b * lidShade, 0.06, 1), k < 0.42 ? 4 : 2];
        }
        return [clamp((0.95 - 0.42 * ax * ax) * lidShade, 0.1, 1), 1];
      }
      const dU = yu - y, dL = y - yl;                       // outside: distance above the upper / below the lower lid
      if (dU > 0 && dU < 0.035 * (0.4 + o)) return [0.0, 0]; // lash line
      if (dU > 0 && Math.abs(dU - 0.15 * o - 0.02) < 0.012) return [0.04, 0]; // lid crease
      if (dL > 0 && dL < 0.012) return [0.05, 0];
    }
    const brow = y + 0.86 - 0.16 * Math.cos((x + 0.1) * 1.25);
    if (Math.abs(brow) < 0.075 * (1 - 0.35 * x) && x > -1.25 && x < 1.2) return [0.035 + 0.05 * hash2(Math.floor(x * 60), 3), 0];
    const light = 0.2 - 0.1 * y - 0.06 * x + 0.05 * Math.sin(x * 2.1 + y * 1.7);
    return [clamp(light * (0.7 + 0.3 * smooth(1 - Math.hypot(x * 0.5, y * 0.9) * 0.6)), 0.05, 0.42), 0];
  }
  const COL = [null, C.peach, C.lilac, '#FFF6F2', C.coral];

  function drawEye(g, t, z) {
    const o = t < m.open0 ? 0.015 : lerp(0.015, 1, ease.spring(prog(t, m.open0, m.open0 + 0.8), 2.2, 5.5));
    const gx = 0.02 * Math.sin(t * 1.1) + 0.035 * smooth(prog(t, m.lock - 0.5, m.lock - 0.3)) - 0.035 * smooth(prog(t, m.lock - 0.12, m.lock));
    const pup = PUPIL * (1 + 0.05 * Math.sin(t * 2.3) - 0.14 * smooth(prog(t, m.lock - 0.1, m.lock + 0.25)) + 0.5 * z.u);
    const inv = 1 / z.Z, x0 = E.x + (0 - z.px) * inv, x1 = E.x + (W - z.px) * inv, y0 = E.y + (0 - z.py) * inv, y1 = E.y + (H - z.py) * inv;
    const rowH = STEP * 0.866, j0 = Math.floor(y0 / rowH) - 1, j1 = Math.ceil(y1 / rowH) + 1;
    const buckets = [[], [], [], [], [], []];
    for (let j = j0; j <= j1; j++) {
      const off = (j & 1) * 0.5, i0 = Math.floor(x0 / STEP - off) - 1, i1 = Math.ceil(x1 / STEP - off) + 1, wy = j * rowH;
      for (let i = i0; i <= i1; i++) {
        const wx = (i + off) * STEP, [b, c] = eye((wx - E.x) / U, (wy - E.y) / U, o, t, gx, pup);
        if (b <= 0.012) continue;
        const tw = 1 + 0.07 * Math.sin(t * 2.6 + hash2(i, j) * 6.283), r = STEP * 0.52 * Math.sqrt(b) * tw * z.Z;
        const sx = (wx - E.x) * z.Z + z.px, sy = (wy - E.y) * z.Z + z.py;
        if (sx < -r || sy < -r || sx > W + r || sy > H + r) continue;
        buckets[c === 0 ? (b > 0.2 ? 5 : 0) : c].push(sx, sy, r);
      }
    }
    const paint = (list, colour) => { if (!list.length) return; g.fillStyle = colour; g.beginPath(); for (let k = 0; k < list.length; k += 3) { g.moveTo(list[k] + list[k + 2], list[k + 1]); g.arc(list[k], list[k + 1], list[k + 2], 0, 6.2832); } g.fill(); };
    paint(buckets[0], C.indigo); paint(buckets[5], C.violet); for (let c = 1; c <= 4; c++) paint(buckets[c], COL[c]);
    return { gx };
  }

  function drawBrackets(g, t, gx) {
    const a = prog(t, m.open1, m.lock), on = t >= m.lock; if (a <= 0) return;
    const half = lerp(560, IRIS * U * 1.13, ease.out4(a)), cx = E.x + gx * U + (1 - ease.out3(a)) * 90 * Math.sin(t * 9), cy = E.y - 0.055 * U + (1 - ease.out3(a)) * 50 * Math.cos(t * 7);
    const flash = on ? Math.exp(-(t - m.lock) * 9) : 0, col = mix(C.coral, '#FFFFFF', flash), L = 54;
    g.save(); g.globalAlpha = clamp(a * 3); g.strokeStyle = col; g.lineWidth = 4 + flash * 3; g.lineCap = 'square';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = cx + sx * half, y = cy + sy * half; g.beginPath(); g.moveTo(x - sx * L, y); g.lineTo(x, y); g.lineTo(x, y - sy * L); g.stroke(); }
    g.lineWidth = 1.5; g.strokeStyle = rgba(C.peach, 0.7 * (on ? 1 : a)); g.beginPath(); g.arc(cx, cy, IRIS * U * 1.04, 0, 7); g.stroke();
    for (let k = 0; k < 48; k++) { const an = (k / 48) * 6.2832 + t * 0.25, r0 = IRIS * U * 1.04, r1 = r0 + (k % 4 ? 8 : 18); g.beginPath(); g.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); g.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); g.stroke(); }
    g.globalAlpha = 1;
    const tagA = on ? 1 : (Math.floor(t * 12) % 2 ? 0.75 : 0.25);
    g.fillStyle = rgba(C.coral, tagA); g.beginPath(); g.arc(cx - half + 12, cy - half - 26, 7, 0, 7); g.fill();
    label(g, on ? 'REC · IRIS LOCK' : 'REC · SEARCHING', cx - half + 30, cy - half - 19, 19, { fill: on ? C.peach : C.lilac, weight: 700 });
    label(g, `AF-C · 1/50 · f2.8 · ${on ? 'x' + (1.0).toFixed(1) : '···'}`, cx + half, cy + half + 34, 16, { fill: rgba(C.lilac, 0.9), align: 'right' });
    g.restore();
  }

  function drawWord(g, t) {
    const a = prog(t, m.key, m.key + 0.28); if (a <= 0) return;
    const size = 150, x = W / 2, y = 952, e = ease.out4(a), st = prog(t, m.strike, m.strike + 0.3), mt = measure(S.key, serif(size));
    g.save();
    g.save(); g.translate(x, y - 50); g.scale(1, 0.3);
    const gr = g.createRadialGradient(0, 0, 60, 0, 0, 760); gr.addColorStop(0, rgba(C.deep, 0.95 * e)); gr.addColorStop(0.6, rgba(C.deep, 0.8 * e)); gr.addColorStop(1, rgba(C.deep, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 760, 0, 7); g.fill(); g.restore();
    g.translate(x, y - 50); g.scale(lerp(1.22, 1, e), lerp(1.22, 1, e)); g.translate(-x, -(y - 50));
    word(g, S.key, x, y, size, { fill: mix(C.peach, C.violet, ease.out2(st) * 0.85), alpha: e });
    if (st > 0) { const wI = mt.left + mt.right + 70, xr = x + wI / 2, len = wI * ease.io3(st); g.strokeStyle = C.coral; g.lineWidth = 13; g.lineCap = 'round'; g.beginPath(); g.moveTo(xr, y - 46); g.lineTo(xr - len, y - 54); g.stroke(); }
    g.restore();
    label(g, '01 · KEY', x - (mt.left + mt.right) / 2 - 30, y - 128, 15, { fill: rgba(C.lilac, 0.85 * e), align: 'right' });
  }

  return {
    id: 'hook',
    draw(t) {
      const g = R.g, z = pupilZoom(R, t);
      const { gx } = drawEye(g, t, z);
      g.save(); g.translate(z.px, z.py); g.scale(z.Z, z.Z); g.translate(-E.x, -E.y); drawBrackets(g, t, gx); drawWord(g, t); g.restore();
      if (z.u > 0) { // speed streaks radiating from the pupil while the camera whips in
        const v = Math.abs(vel((x) => Math.log(pupilZoom(R, x).Z), t)), k = clamp(v / 9);
        g.save(); g.globalAlpha = 0.5 * k; g.strokeStyle = C.lilac;
        for (let i = 0; i < 70; i++) { const an = hash2(i, 1) * 6.2832, r0 = 140 + hash2(i, 2) * 900, len = (60 + hash2(i, 3) * 260) * k; g.lineWidth = 1 + hash2(i, 4) * 2.5;
          g.beginPath(); g.moveTo(z.px + Math.cos(an) * r0, z.py + Math.sin(an) * r0); g.lineTo(z.px + Math.cos(an) * (r0 + len), z.py + Math.sin(an) * (r0 + len)); g.stroke(); }
        g.restore(); R.blur(k * 7, k * 7);
      }
      R.cam = { focal: 1880 * z.Z, tilt: 0 };
    },
  };
}
