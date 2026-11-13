// 02 PROMPT — arrives out of the pupil. A prompt card types a command, the cursor clicks "Generate",
// the preview panel wipes open onto a live generative liquid shader, a key word slams in.
// Exit: the camera pushes into the panel until the texture is the whole frame.
import { W, H, C, clamp, lerp, prog, smooth, ease, rgba, rrect, hash } from '../lib/util.js';
import { word, label, serif } from '../lib/text.js';
import { pupilZoom } from './s1_hook.js';
import { makeLiquid, pushView, PANEL, PC } from '../lib/liquid.js';

const CARD = { x: 330, y: 215, w: 1260, h: 650, r: 26 }, IN = { x: 1170, y: 318, w: 380, h: 260, r: 14 }, BTN = { x: 1170, y: 640, w: 380, h: 88 };
export const liquidDim = (R, t) => 0.66 * smooth(prog(t, R.X.x23[0] + 0.15, R.X.x23[1] + 0.35));

export function cursor(g, x, y, press = 0, s = 1) {
  g.save(); g.translate(x, y); g.scale(s * (1 - 0.14 * press), s * (1 - 0.14 * press));
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 38); g.lineTo(10, 29); g.lineTo(17, 45); g.lineTo(24, 42); g.lineTo(17, 26); g.lineTo(30, 26); g.closePath();
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 14; g.shadowOffsetY = 5; g.fillStyle = '#FFFFFF'; g.fill(); g.shadowColor = 'transparent'; g.lineWidth = 2.5; g.strokeStyle = C.base; g.lineJoin = 'round'; g.stroke(); g.restore();
}

export default function (R) {
  const S = R.sc('prompt'), m = S.marks; R.liquid ??= makeLiquid(R);
  const view = (t) => {
    if (t < R.X.x12[1]) { const z = pupilZoom(R, t), s = z.Z / z.ZEND; return { s, ox: z.px - (W / 2) * s, oy: z.py - (H / 2) * s }; }
    const v = pushView(R, t); return { s: v.Z, ox: v.cx - PC.x * v.Z, oy: v.cy - PC.y * v.Z };
  };
  function wrap(g, text, maxW) { const out = []; let line = ''; for (const w of text.split(' ')) { const next = line ? line + ' ' + w : w; if (g.measureText(next).width > maxW && line) { out.push(line); line = w; } else line = next; } out.push(line); return out; }

  return {
    id: 'prompt',
    draw(t) {
      const g = R.g, v = view(t), rev = ease.io3(prog(t, m.reveal0, m.reveal1));
      if (rev > 0) { // the shader is only visible through the panel: scissor it to the panel's rectangle on screen
        const x0 = clamp(Math.floor(v.ox + PANEL.x * v.s), 0, W), x1 = clamp(Math.ceil(v.ox + (PANEL.x + PANEL.w) * v.s), 0, W), y0 = clamp(Math.floor(v.oy + PANEL.y * v.s), 0, H), y1 = clamp(Math.ceil(v.oy + (PANEL.y + PANEL.h) * v.s), 0, H), r = R.renderer;
        r.setScissorTest(true); r.setScissor(x0, H - y1, x1 - x0, y1 - y0); R.liquid.render(t, { cx: v.ox + PC.x * v.s, cy: v.oy + PC.y * v.s, scale: v.s, dim: liquidDim(R, t) }); r.setScissorTest(false);
      }
      g.setTransform(v.s, 0, 0, v.s, v.ox, v.oy);
      // card
      g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 70; g.shadowOffsetY = 34; rrect(g, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r); g.fillStyle = '#171930'; g.fill(); g.restore();
      rrect(g, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r); g.strokeStyle = rgba(C.lilac, 0.35); g.lineWidth = 1.5; g.stroke();
      [C.coral, C.peach, C.lilac].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(CARD.x + 34 + i * 24, CARD.y + 34, 6.5, 0, 7); g.fill(); });
      label(g, '02 · PROMPT → FRAME', CARD.x + CARD.w / 2, CARD.y + 40, 15, { fill: rgba(C.lilac, 0.85), align: 'center' });
      label(g, 'seed 0421 · 16:9 · 30 fps', CARD.x + CARD.w - 34, CARD.y + 40, 14, { fill: rgba(C.lilac, 0.55), align: 'right' });
      g.fillStyle = rgba(C.lilac, 0.14); g.fillRect(CARD.x, CARD.y + 62, CARD.w, 1.5);
      // preview panel (placeholder until generated)
      rrect(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, PANEL.r); g.fillStyle = '#0E0F1C'; g.fill();
      g.save(); g.setLineDash([10, 9]); g.strokeStyle = rgba(C.lilac, 0.4); g.lineWidth = 1.5; rrect(g, PANEL.x + 14, PANEL.y + 14, PANEL.w - 28, PANEL.h - 28, 8); g.stroke(); g.restore();
      g.strokeStyle = rgba(C.lilac, 0.35); g.beginPath(); g.moveTo(PC.x - 16, PC.y); g.lineTo(PC.x + 16, PC.y); g.moveTo(PC.x, PC.y - 16); g.lineTo(PC.x, PC.y + 16); g.stroke();
      label(g, 'PREVIEW · EMPTY', PC.x, PC.y + 52, 15, { fill: rgba(C.lilac, 0.6), align: 'center' });
      // progress line under the panel
      const pr = prog(t, m.click, m.reveal1); g.fillStyle = rgba(C.lilac, 0.18); g.fillRect(PANEL.x, PANEL.y + PANEL.h + 30, PANEL.w, 3); g.fillStyle = C.coral; g.fillRect(PANEL.x + PANEL.w * (1 - pr), PANEL.y + PANEL.h + 30, PANEL.w * pr, 3);
      label(g, pr <= 0 ? 'IDLE' : pr < 1 ? `GENERATING ${String(Math.round(pr * 100)).padStart(2, '0')}%` : 'DONE · 1920×1080', PANEL.x, PANEL.y + PANEL.h + 62, 14, { fill: pr >= 1 ? C.peach : rgba(C.lilac, 0.8) });
      label(g, 'frame 0001', PANEL.x + PANEL.w, PANEL.y + PANEL.h + 62, 14, { fill: rgba(C.lilac, 0.55), align: 'right' });
      // prompt field
      label(g, 'PROMPT', IN.x + IN.w, IN.y - 18, 14, { fill: rgba(C.lilac, 0.8), align: 'right' });
      rrect(g, IN.x, IN.y, IN.w, IN.h, IN.r); g.fillStyle = '#0F1020'; g.fill(); g.strokeStyle = rgba(C.lilac, t < m.typ1 + 0.2 ? 0.75 : 0.3); g.lineWidth = 1.5; g.stroke();
      const n = Math.round(S.prompt.length * prog(t, m.typ0, m.typ1)), shown = S.prompt.slice(0, n);
      g.save(); g.font = serif(40, 500); g.direction = 'rtl'; g.textAlign = 'right'; g.fillStyle = C.peach; g.textBaseline = 'alphabetic';
      const lines = wrap(g, shown, IN.w - 52); lines.forEach((l, i) => g.fillText(l, IN.x + IN.w - 26, IN.y + 66 + i * 58));
      const lw = g.measureText(lines[lines.length - 1]).width; g.restore();
      if (t < m.click && Math.floor(t * 2.4) % 2 === 0 || (t > m.typ0 && t < m.typ1)) { g.fillStyle = C.coral; g.fillRect(IN.x + IN.w - 26 - lw - 7, IN.y + 30 + (lines.length - 1) * 58, 3, 46); }
      // button
      const press = Math.exp(-Math.max(0, t - m.click) * 14) * (t >= m.click ? 1 : 0), hover = smooth(prog(t, m.click - 0.3, m.click - 0.1));
      g.save(); g.translate(BTN.x + BTN.w / 2, BTN.y + BTN.h / 2); g.scale(1 - 0.05 * press, 1 - 0.05 * press);
      rrect(g, -BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h, 44); g.fillStyle = C.coral; g.shadowColor = rgba(C.coral, 0.25 + 0.35 * hover); g.shadowBlur = 30 + 20 * hover; g.fill(); g.restore();
      word(g, S.button, BTN.x + BTN.w / 2, BTN.y + 60, 46, { weight: 700, fill: C.base });
      if (t >= m.click) { const rp = prog(t, m.click, m.click + 0.45); g.strokeStyle = rgba(C.peach, 0.9 * (1 - rp)); g.lineWidth = 3; rrect(g, BTN.x - 30 * rp, BTN.y - 30 * rp, BTN.w + 60 * rp, BTN.h + 60 * rp, 44 + 30 * rp); g.stroke(); }
      // the panel wipes open (right → left) onto the live shader underneath
      if (rev > 0) {
        const xw = PANEL.x + PANEL.w * (1 - rev);
        g.save(); rrect(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, PANEL.r); g.clip(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(xw, PANEL.y - 2, PANEL.x + PANEL.w - xw + 2, PANEL.h + 4);
        g.globalCompositeOperation = 'source-over'; if (rev < 1) { g.fillStyle = C.peach; g.fillRect(xw - 2, PANEL.y, 4, PANEL.h); g.fillStyle = rgba(C.peach, 0.25); g.fillRect(xw - 26, PANEL.y, 24, PANEL.h); } g.restore();
        rrect(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, PANEL.r); g.strokeStyle = rgba(C.peach, 0.5 * (1 - prog(t, R.X.x23[0], R.X.x23[0] + 0.3))); g.lineWidth = 1.5; g.stroke();
      }
      // cursor: glides in, presses the button
      const ca = ease.io3(prog(t, m.typ1 - 0.15, m.click - 0.1));
      if (t > m.typ1 - 0.15) { const bx = BTN.x + BTN.w / 2 + 40, by = BTN.y + BTN.h / 2 + 4, drift = smooth(prog(t, m.click + 0.2, m.click + 1.2));
        cursor(g, lerp(1760, bx, ca) + drift * 60, lerp(1010, by, ca) + Math.sin(ca * Math.PI) * -50 + drift * 90, press, 1.25); }
      // key word slam, with a motion-blur trail (whole word, never split)
      if (t >= m.key - 0.1) {
        const pose = (tt) => { const p = ease.outExpo(prog(tt, m.key - 0.1, m.key + 0.07)); return { sc: lerp(4.2, 1, p), a: clamp(p * 4) }; };
        const kx = 1290, ky = 935, size = 190, shake = Math.exp(-Math.max(0, t - m.key) * 11) * (t >= m.key ? 1 : 0);
        const put = (tt, alpha, fill) => { const p = pose(tt); g.save(); g.translate(kx + Math.sin(t * 90) * 9 * shake, ky - 70 + Math.cos(t * 70) * 7 * shake); g.rotate(-0.055); g.scale(p.sc, p.sc); word(g, S.key, 0, 70, size, { fill, alpha: alpha * p.a }); g.restore(); };
        for (let k = 7; k >= 1; k--) put(t - k * 0.011, 0.13, C.coral);
        put(t, 1, C.peach);
        if (shake > 0.02) { R.shake(Math.sin(t * 83) * 7 * shake, Math.cos(t * 97) * 6 * shake, Math.sin(t * 61) * 0.004 * shake); }
      }
      const pv = pushView(R, t); if (pv.u > 0 && pv.u < 1) { const k = Math.sin(pv.u * Math.PI); R.blur(k * 5, k * 5); }
      R.cam = { focal: 1880 * (t < R.X.x12[1] ? pupilZoom(R, t).Z : v.s), tilt: 0 };
    },
  };
}
