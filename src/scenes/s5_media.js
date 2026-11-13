// 05 MEDIA — three giant words, each one a window onto real media in its real colours:
// a photo, a slow-motion jump, a slow-motion dancer. A voice-reactive waveform runs under the last.
// The camera whip-pans from word to word on the voice. Exit: the same whip carries on into scene 6.
import { W, H, C, clamp, lerp, prog, smooth, ease, rgba, cover, vel } from '../lib/util.js';
import { label, textMask, fitSize } from '../lib/text.js';

const GAP = 2300, CY = 470, D56 = 1300;
// one continuous pan across the cut-less join between scene 5 and scene 6
export const whip56 = (R, t) => 2 * D56 * ease.io3(prog(t, R.X.x56[0], R.X.x56[1]));
export const WHIP56 = 2 * D56;

export default function (R) {
  const S = R.sc('media'), m = S.marks;
  const items = S.words.map((w, i) => {
    const size = Math.min(640, fitSize(w.text, 1480, 520)), mask = textMask(w.text, size, { pad: 30 });
    const off = document.createElement('canvas'); off.width = mask.w; off.height = mask.h;
    const [kind, idx] = String(w.fill).split(':'); const isImg = kind === 'image' || kind === 'photo';
    const img = kind === 'photo' ? R.photo : isImg ? R.images[(+idx || i) % Math.max(1, R.images.length)] || R.photo : null;
    const meta = isImg ? (kind === 'photo' ? R.MF.photo : R.MF.images[(+idx || i) % Math.max(1, R.MF.images.length)]) : R.clip.meta(kind);
    return { ...w, i, mask, off, og: off.getContext('2d'), isImg, img, role: kind, meta, x: -i * GAP };
  });
  const camX = (t) => { let x = 0; m.pan.forEach((p, i) => { x = lerp(x, -(i + 1) * GAP, ease.io5(prog(t, p[0], p[1]))); }); return x - whip56(R, t) - 26 * smooth(prog(t, m.w[0], m.w[0] + 6)); };
  const src = (it, t) => (it.isImg ? it.img : R.clip.get(it.role, t - m.w[it.i] + 1.2));

  return {
    id: 'media',
    prepare: (t) => Promise.all(items.filter((it) => !it.isImg).map((it) => R.clip.want(it.role, t - m.w[it.i] + 1.2))),
    draw(t) {
      const g = R.g, cx = camX(t), v = vel(camX, t);
      for (const it of items) {
        const sx = it.x - cx + W / 2; if (sx < -1200 || sx > W + 1200) continue;
        const im = src(it, t), { mask, off, og } = it, local = t - m.w[it.i];
        // media, cover-fitted to the word's box with a slow push, then cut to the word's shape
        og.globalCompositeOperation = 'source-over'; og.clearRect(0, 0, off.width, off.height);
        if (im) { const iw = im.naturalWidth, ih = im.naturalHeight, k = cover(iw, ih, off.width, off.height, 1.08 + 0.018 * clamp(local, -2, 8), 0.5, 0.45); og.drawImage(im, k.x, k.y, k.w, k.h); } else { og.fillStyle = C.violet; og.fillRect(0, 0, off.width, off.height); }
        og.globalCompositeOperation = 'destination-in'; og.drawImage(mask.canvas, 0, 0);
        const arrive = ease.out4(prog(t, m.w[it.i] - 0.3, m.w[it.i] + 0.25)), sc = it.i === 0 ? 1 : lerp(1.12, 1, arrive);
        g.save(); g.translate(sx, CY); g.scale(sc, sc);
        // outline first (so only its outer half shows and joined letters keep one clean silhouette), then the media
        g.font = mask.font; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.strokeStyle = rgba(C.peach, 0.8); g.lineWidth = 5;
        g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 50; g.shadowOffsetY = 22; g.strokeText(it.text, mask.ax, mask.ay); g.shadowColor = 'transparent';
        g.fillStyle = C.base; g.fillText(it.text, mask.ax, mask.ay); g.drawImage(off, -off.width / 2, -off.height / 2);
        g.restore();
        // pro-tool read-outs + the untouched source frame
        const L = sx - 760, Rr = sx + 760, by = 838;
        label(g, `0${it.i + 1}/0${items.length}`, L, 150, 30, { fill: C.coral, weight: 700 });
        label(g, `${it.isImg ? 'IMAGE' : 'VIDEO · SLOW MOTION'} · ${it.meta ? (it.meta.name || it.meta.source?.split('/').pop() || it.role) : it.role}`, L + 110, 146, 16, { fill: rgba(C.lilac, 0.9) });
        if (it.meta) label(g, `${it.meta.width}×${it.meta.height} · original colour · no grade`, Rr, 146, 16, { fill: rgba(C.lilac, 0.7), align: 'right' });
        g.fillStyle = rgba(C.lilac, 0.22); g.fillRect(L, 170, Rr - L, 1.5);
        if (im) { const tw = 256, th = 144, tx = L, ty = by; const k = cover(im.naturalWidth, im.naturalHeight, tw, th); g.save(); g.beginPath(); g.roundRect(tx, ty, tw, th, 8); g.clip(); g.drawImage(im, tx + k.x, ty + k.y, k.w, k.h); g.restore();
          g.strokeStyle = rgba(C.lilac, 0.6); g.lineWidth = 1.5; g.beginPath(); g.roundRect(tx, ty, tw, th, 8); g.stroke(); label(g, 'SOURCE', tx, ty - 12, 14, { fill: rgba(C.lilac, 0.8) });
          if (!it.isImg && it.meta) { const fr = (((Math.floor((t - m.w[it.i] + 1.2) * 30) % it.meta.frames) + it.meta.frames) % it.meta.frames); label(g, `f ${String(fr).padStart(4, '0')} / ${String(it.meta.frames).padStart(4, '0')}`, tx + tw + 20, ty + th - 6, 14, { fill: rgba(C.lilac, 0.7) }); } }
        // waveform under the last word, driven by the actual voice track
        if (it.i === items.length - 1 && t > m.wave - 0.2) {
          const on = ease.out3(prog(t, m.wave - 0.2, m.wave + 0.3)), n = 110, w0 = 1120, bx = Rr - w0, midY = by + 72, lvl = R.voice(t);
          g.save(); for (let j = 0; j < n; j++) { const d = Math.abs(j - (n - 1) / 2) / ((n - 1) / 2), e = R.voice(t - d * 0.42), hgt = (5 + 128 * Math.pow(e, 0.8) * (1 - 0.72 * d * d)) * on;
            g.fillStyle = d < 0.04 ? '#FFFFFF' : j % 2 ? C.coral : C.peach; g.globalAlpha = 0.95 - 0.5 * d; g.beginPath(); g.roundRect(bx + (j / n) * w0, midY - hgt / 2, (w0 / n) * 0.56, hgt, 3); g.fill(); }
          g.restore(); label(g, `AUDIO · voice.wav · level ${String(Math.round(lvl * 100)).padStart(3, '0')}`, Rr, by - 12, 14, { fill: rgba(C.lilac, 0.8 * on), align: 'right' });
        }
      }
      const b = clamp(Math.abs(v) / 75, 0, 46); if (b > 0.5) R.blur(b, 0);
      R.cam = { focal: 1880, tilt: 0, note: `pan ${Math.round(-cx)}` };
    },
  };
}
