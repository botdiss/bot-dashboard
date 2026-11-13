// Viewfinder overlay: it belongs to the "camera", so it never moves or blurs with the world.
import { W, H, C, pad, clamp, hash, rgba } from './lib/util.js';
import { label } from './lib/text.js';

export function makeHud(R) {
  const c = document.getElementById('hud'), g = c.getContext('2d');
  const grain = document.getElementById('grain');
  { // one static noise tile; each frame only its offset changes (deterministic per frame index)
    const n = document.createElement('canvas'); n.width = n.height = 512; const ng = n.getContext('2d'), id = ng.createImageData(512, 512);
    let seed = 1234567; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (rnd() + rnd() + rnd() - 1.5) * 96; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    ng.putImageData(id, 0, 0); grain.style.backgroundImage = `url(${n.toDataURL()})`;
  }
  const bracket = (x, y, sx, sy, len) => { g.beginPath(); g.moveTo(x + sx * len, y); g.lineTo(x, y); g.lineTo(x, y + sy * len); g.stroke(); };
  return {
    draw(t) {
      const { TL } = R, f = Math.min(TL.frames - 1, Math.round(t * TL.fps)), fps = TL.fps;
      grain.style.transform = `translate(${-Math.floor(hash(f + 0.5) * 512)}px, ${-Math.floor(hash(f * 1.7 + 9.1) * 512)}px)`;
      g.clearRect(0, 0, W, H); if (R.clean) return;
      const sc = [...TL.scenes].reverse().find((s) => t >= s.start - 1e-6) || TL.scenes[0];
      const a = 0.9, ink = rgba(C.lilac, a), m = 44;
      g.lineWidth = 1.5; g.strokeStyle = rgba(C.lilac, 0.5);
      bracket(m, m, 1, 1, 26); bracket(W - m, m, -1, 1, 26); bracket(m, H - m, 1, -1, 26); bracket(W - m, H - m, -1, -1, 26);
      // centre cross + edge ticks
      g.strokeStyle = rgba(C.lilac, 0.28); g.beginPath(); g.moveTo(W / 2 - 9, H / 2); g.lineTo(W / 2 + 9, H / 2); g.moveTo(W / 2, H / 2 - 9); g.lineTo(W / 2, H / 2 + 9);
      for (let i = 1; i < 12; i++) { const x = (W / 12) * i; g.moveTo(x, H - m + 4); g.lineTo(x, H - m + (i % 3 ? 8 : 13)); } g.stroke();
      // REC
      const blink = (t * 1.25) % 1 < 0.62; g.fillStyle = blink ? C.coral : rgba(C.coral, 0.25); g.beginPath(); g.arc(m + 36, m + 31, 6.5, 0, 7); g.fill();
      const tcode = `${pad(Math.floor(f / fps / 60), 2)}:${pad(Math.floor(f / fps) % 60, 2)}:${pad(f % fps, 2)}`;
      label(g, `REC  00:${tcode}`, m + 52, m + 37, 16, { fill: ink, weight: 700 });
      label(g, `${pad(sc.n, 2)}/${pad(TL.scenes.length, 2)} · ${sc.title}`, W - m - 30, m + 37, 16, { fill: ink, align: 'right', weight: 700 });
      // scene index pips
      TL.scenes.forEach((s, i) => { g.fillStyle = s.n === sc.n ? C.coral : rgba(C.lilac, s.n < sc.n ? 0.55 : 0.2); g.fillRect(W - m - 30 - (TL.scenes.length - i) * 16 + 4, m + 50, 11, 3); });
      const cam = R.cam;
      label(g, `CAM 01 · focal ${Math.round(clamp(cam.focal, 1, 99999))} · tilt ${Math.round(cam.tilt)}°${cam.note ? ' · ' + cam.note : ''}`, m + 30, H - m - 24, 15, { fill: ink });
      label(g, `F ${pad(f, 6)} / ${pad(TL.frames, 6)} · ${fps} fps · ${W}×${H}`, W - m - 30, H - m - 24, 15, { fill: ink, align: 'right' });
      // progress hairline
      g.fillStyle = rgba(C.lilac, 0.18); g.fillRect(m + 30, H - m - 12, W - 2 * m - 60, 1.5); g.fillStyle = C.coral; g.fillRect(m + 30, H - m - 12, (W - 2 * m - 60) * (f / Math.max(1, TL.frames - 1)), 1.5);
      if (TL.standin?.length) { label(g, 'STAND-IN INPUTS · NOT THE FINAL SCRIPT', W / 2, H - m - 24, 14, { fill: C.coral, align: 'center', weight: 700 }); }
    },
  };
}
