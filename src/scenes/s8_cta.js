// 08 CTA — arrives through the keyhole. Headline; a comment field types the keyword and sends; a DM
// notification arrives with the portrait; the camera flies into the portrait, which then shrinks
// into the end-card mark above the name and handles.
import { W, H, C, clamp, lerp, prog, smooth, ease, rgba, rrect, cover, mix, vel } from '../lib/util.js';
import { word, label, serif } from '../lib/text.js';
import { cursor } from './s2_prompt.js';

const F = { x: 510, y: 560, w: 900, h: 110 }, SEND = { x: 572, y: 615, r: 40 }, DM = { x: 1190, y: 128, w: 650, h: 150 }, AV = { x: DM.x + DM.w - 78, y: DM.y + 75, r: 50 }, MARK = { x: W / 2, y: 392, r: 150 };
export const keyholeIn = (R, t) => { const u = prog(t, R.X.x78[0], R.X.x78[1]); return { u, s: Math.exp(Math.log(1 / 9) * (1 - ease.io3(u))), a: smooth(prog(u, 0.55, 0.95)) }; };

export default function (R) {
  const S = R.sc('cta'), m = S.marks, id = R.TL.identity || {}, photo = R.photo;
  const ZF = 2400 / (AV.r * 2);
  const fly = (t) => { const u = ease.io3(prog(t, m.fly0, m.fly1)); return { u, Z: Math.exp(Math.log(ZF) * u), cx: lerp(AV.x, W / 2, smooth(u * 1.4)), cy: lerp(AV.y, H / 2, smooth(u * 1.4)) }; };
  function portrait(g, x, y, r) { // circular window onto the portrait, real colours
    g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip();
    if (photo) { const k = cover(photo.naturalWidth, photo.naturalHeight, 2 * r, 2 * r, 1, 0.5, 0.28); g.drawImage(photo, x - r + k.x, y - r + k.y, k.w, k.h); } else { g.fillStyle = C.violet; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    g.restore();
  }
  const person = (g, x, y, r) => { g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = C.indigo; g.fill(); g.clip(); g.fillStyle = C.lilac; g.beginPath(); g.arc(x, y - r * 0.18, r * 0.36, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, y + r * 0.82, r * 0.66, r * 0.5, 0, 0, 7); g.fill(); g.restore(); };

  return {
    id: 'cta',
    draw(t) {
      const g = R.g, kin = keyholeIn(R, t), f = fly(t), end = t >= m.fly1;
      if (!end) {
        const s = kin.s * f.Z, ox = (kin.u < 1 ? W / 2 - (W / 2) * kin.s : f.cx - AV.x * f.Z), oy = (kin.u < 1 ? H / 2 - (H / 2) * kin.s : f.cy - AV.y * f.Z);
        g.setTransform(s, 0, 0, s, ox, oy); g.globalAlpha = kin.a;
        // headline
        const hA = ease.out4(prog(t, m.head, m.head + 0.5));
        g.save(); g.translate(0, (1 - hA) * 40); word(g, S.headline, W / 2, 440, 112, { fill: C.peach, alpha: hA }); g.restore();
        label(g, '08 · CTA', W / 2, 300, 16, { fill: rgba(C.lilac, 0.85 * hA), align: 'center', weight: 700 }); g.fillStyle = rgba(C.coral, hA); g.fillRect(W / 2 - 30, 318, 60, 3);
        // comment field
        const fA = ease.out4(prog(t, m.field, m.field + 0.45)), typed = S.keyword.slice(0, Math.round(S.keyword.length * prog(t, m.typ0, m.typ1))), sent = t >= m.send, active = t >= m.typ0 - 0.2 && !sent;
        g.save(); g.globalAlpha *= fA; g.translate(0, (1 - fA) * 50);
        g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 50; g.shadowOffsetY = 20; rrect(g, F.x, F.y, F.w, F.h, 55); g.fillStyle = '#171930'; g.fill(); g.shadowColor = 'transparent';
        g.strokeStyle = rgba(active ? C.peach : C.lilac, active ? 0.9 : 0.4); g.lineWidth = 2; g.stroke();
        person(g, F.x + F.w - 62, F.y + 55, 36);
        const tx = F.x + F.w - 120;
        if (!sent && typed) { g.font = serif(54, 700); g.direction = 'rtl'; g.textAlign = 'right'; g.fillStyle = C.peach; g.fillText(typed, tx, F.y + 74); const tw = g.measureText(typed).width; if (t < m.send) { g.fillStyle = C.coral; g.fillRect(tx - tw - 9, F.y + 30, 3.5, 52); } }
        else { word(g, S.placeholder || '', tx, F.y + 72, 44, { weight: 400, fill: rgba(C.lilac, 0.45), align: 'right' }); if (active && Math.floor(t * 2.4) % 2 === 0) { g.fillStyle = C.coral; g.fillRect(tx + 8, F.y + 30, 3.5, 52); } }
        const press = sent ? Math.exp(-(t - m.send) * 13) : 0, ready = typed.length === S.keyword.length && !sent;
        g.save(); g.translate(SEND.x, SEND.y); g.scale(1 - 0.12 * press, 1 - 0.12 * press); g.beginPath(); g.arc(0, 0, SEND.r, 0, 7); g.fillStyle = ready || press > 0.02 ? C.coral : rgba(C.coral, 0.4); g.fill();
        g.strokeStyle = C.base; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(0, 15); g.lineTo(0, -15); g.moveTo(-13, -2); g.lineTo(0, -15); g.lineTo(13, -2); g.stroke(); g.restore();
        if (sent) { const rp = prog(t, m.send, m.send + 0.45); g.strokeStyle = rgba(C.peach, 0.9 * (1 - rp)); g.lineWidth = 3; g.beginPath(); g.arc(SEND.x, SEND.y, SEND.r + 46 * rp, 0, 7); g.stroke(); }
        g.restore();
        // the posted comment
        if (t >= m.posted) { const p = ease.spring(prog(t, m.posted, m.posted + 0.6), 2.2, 6), by = lerp(F.y + 20, 738, p), bw = 470, bx = F.x + F.w - bw; g.save(); g.globalAlpha *= clamp(prog(t, m.posted, m.posted + 0.12));
          rrect(g, bx, by, bw, 96, 30); g.fillStyle = C.indigo; g.fill(); person(g, bx + bw - 54, by + 48, 30); word(g, S.keyword, bx + bw - 104, by + 66, 50, { weight: 700, fill: C.peach, align: 'right' });
          label(g, 'COMMENT · SENT', bx + 30, by + 56, 15, { fill: rgba(C.peach, 0.75) }); g.fillStyle = C.coral; g.beginPath(); g.arc(bx + 16, by + 50, 5, 0, 7); g.fill(); g.restore(); }
        // DM notification
        if (t >= m.dm - 0.05) { const p = ease.spring(prog(t, m.dm - 0.05, m.dm + 0.6), 2.4, 6.5), dy = lerp(-320, 0, p); g.save(); g.translate(0, dy);
          g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 60; g.shadowOffsetY = 24; rrect(g, DM.x, DM.y, DM.w, DM.h, 34); g.fillStyle = '#1D1F3A'; g.fill(); g.shadowColor = 'transparent'; g.strokeStyle = rgba(C.peach, 0.55); g.lineWidth = 2; g.stroke();
          portrait(g, AV.x, AV.y, AV.r); g.strokeStyle = C.coral; g.lineWidth = 3; g.beginPath(); g.arc(AV.x, AV.y, AV.r + 5, 0, 7); g.stroke();
          word(g, id.name || '', AV.x - AV.r - 26, DM.y + 64, 38, { weight: 700, fill: C.peach, align: 'right' }); word(g, S.dm || '', AV.x - AV.r - 26, DM.y + 116, 34, { weight: 400, fill: C.lilac, align: 'right' });
          label(g, 'DM · NOW', DM.x + 30, DM.y + 44, 15, { fill: rgba(C.lilac, 0.85), weight: 700 }); g.fillStyle = C.coral; g.beginPath(); g.arc(DM.x + 38, DM.y + 104, 9, 0, 7); g.fill(); g.restore(); }
        // cursor: to the send button, later to the notification
        if (t > m.typ1 - 0.1 && f.u <= 0) { const a = ease.io3(prog(t, m.typ1 - 0.05, m.send - 0.06)), b = ease.io3(prog(t, m.dm + 0.25, m.fly0 - 0.1));
          cursor(g, lerp(lerp(900, SEND.x + 6, a), AV.x - 6, b), lerp(lerp(900, SEND.y + 6, a), AV.y + 10, b) - Math.sin(b * Math.PI) * 80, press + (t >= m.fly0 - 0.1 ? 1 : 0) * Math.exp(-Math.max(0, t - m.fly0 + 0.1) * 12), 1.25); }
        if (f.u > 0) { // flying in: the portrait opens up from the avatar to the whole frame
          portrait(g, AV.x, AV.y, AV.r); const sp = Math.abs(vel((x) => Math.log(fly(x).Z), t)); R.blur(clamp(sp * 1.2, 0, 8), clamp(sp * 1.2, 0, 8)); }
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
        R.cam = { focal: 1880 * s, tilt: 0 };
      } else { // end card: the full-frame portrait contracts into the mark
        const p = ease.io3(prog(t, m.shrink0, m.shrink1)), r = Math.exp(lerp(Math.log(1200), Math.log(MARK.r), p)), x = W / 2, y = lerp(H / 2, MARK.y, p);
        portrait(g, x, y, r);
        const ring = smooth(prog(t, m.shrink1 - 0.25, m.shrink1 + 0.2)); g.strokeStyle = rgba(C.peach, ring); g.lineWidth = 3; g.beginPath(); g.arc(x, y, r + 12, 0, 7); g.stroke();
        g.strokeStyle = rgba(C.coral, ring); g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(x, y, r + 26, -1.2 + t * 0.5, -1.2 + t * 0.5 + 1.5 * ring); g.stroke();
        const nA = ease.out4(prog(t, m.name, m.name + 0.5)), hA = ease.out4(prog(t, m.name + 0.25, m.name + 0.75));
        g.save(); g.translate(0, (1 - nA) * 36); word(g, id.name || '', W / 2, 716, 120, { fill: C.peach, alpha: nA }); g.restore();
        g.fillStyle = rgba(C.coral, hA); g.fillRect(W / 2 - 34 * hA, 772, 68 * hA, 3);
        label(g, (id.handles || []).join('   ·   '), W / 2, 836, 30, { fill: rgba(C.lilac, hA), align: 'center', weight: 500, spacing: 2 });
        label(g, 'END CARD · 08/08', W / 2, 906, 15, { fill: rgba(C.lilac, 0.6 * hA), align: 'center' });
        R.cam = { focal: 1880 * lerp(ZF, 1, p), tilt: 0 };
      }
    },
  };
}
