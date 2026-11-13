// 06 BRANDS — extruded 3D logos (three.js, glossy, rim-lit). The first spins in; a cursor grabs it and
// drags it off with a wobble; the second pops in and the camera flies through it until its own
// colour fills the frame, where a key word slams on top. With no logos supplied, the same technique
// runs on extruded words from the script.
import * as THREE from 'three';
import { W, H, C, clamp, lerp, prog, smooth, ease, rgba, vel } from '../lib/util.js';
import { word, label, textMask } from '../lib/text.js';
import { traceCanvas, deepestPoint, extrude } from '../lib/trace.js';
import { getStage } from '../lib/stage3d.js';
import { whip56, WHIP56 } from './s5_media.js';
import { cursor } from './s2_prompt.js';

const L = new THREE.Vector3(0, 7.5, 0), SIZE = 3.5, DEPTH = 0.6, BEV = 0.05, CAM0 = [0, 7.5, 11];

function buildItem(R, source, fallbackColour) {
  let tex, tc; const tr = document.createElement('canvas'), tg = tr.getContext('2d', { willReadFrequently: true });
  if (source.img) {
    const im = source.img, k = 440 / Math.max(im.naturalWidth, im.naturalHeight); tr.width = Math.round(im.naturalWidth * k); tr.height = Math.round(im.naturalHeight * k); tg.drawImage(im, 0, 0, tr.width, tr.height);
    const id = tg.getImageData(0, 0, tr.width, tr.height), d = id.data; let opaque = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 250) opaque++;
    if (opaque > (d.length / 4) * 0.97) { const [r0, g0, b0] = d; for (let i = 0; i < d.length; i += 4) d[i + 3] = Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) > 48 ? 255 : 0; tg.putImageData(id, 0, 0); } // flat background → key it out
    tc = document.createElement('canvas'); const k2 = 1024 / Math.max(im.naturalWidth, im.naturalHeight); tc.width = Math.round(im.naturalWidth * k2); tc.height = Math.round(im.naturalHeight * k2); tc.getContext('2d').drawImage(im, 0, 0, tc.width, tc.height);
  } else {
    const m = textMask(source.text, 300, { pad: 20 }); tr.width = m.w; tr.height = m.h; tg.drawImage(m.canvas, 0, 0);
    tc = document.createElement('canvas'); tc.width = tc.height = 8; const g = tc.getContext('2d'); g.fillStyle = fallbackColour; g.fillRect(0, 0, 8, 8);
  }
  const scale = SIZE / Math.max(tr.width, tr.height), t = traceCanvas(tr, { scale }), hw = (tr.width * scale) / 2, hh = (tr.height * scale) / 2;
  const dp = deepestPoint(t.alpha, t.w, t.h), i4 = (dp.y * t.w + dp.x) * 4;
  const colour = source.img ? `rgb(${t.data[i4]},${t.data[i4 + 1]},${t.data[i4 + 2]})` : fallbackColour;
  tex = new THREE.CanvasTexture(tc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const cap = new THREE.MeshPhysicalMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.32, roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 });
  const side = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(colour).multiplyScalar(0.62), roughness: 0.28, metalness: 0.25, clearcoat: 0.8, envMapIntensity: 1.2 });
  const mesh = new THREE.Mesh(extrude(t.shapes, { depth: DEPTH, bevel: BEV, hw, hh }), [cap, side]); mesh.castShadow = false;
  const group = new THREE.Group(); group.add(mesh); group.position.copy(L); group.visible = false;
  const c = new THREE.Color(colour), lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return { group, cap, colour, lum, pole: new THREE.Vector3((dp.x - t.w / 2) * scale, -(dp.y - t.h / 2) * scale, DEPTH / 2 + BEV), poleR: dp.r * scale, name: source.name || source.text };
}

export default function (R) {
  const S = R.sc('brands'), m = S.marks, st = getStage(R), X = R.X;
  const sources = R.logos.slice(0, 2).map((img, i) => ({ img, name: R.MF.logos[i].name }));
  while (sources.length < 2) sources.push({ text: (S.at || [])[sources.length] || S.key });
  const [A, B] = sources.map((s, i) => buildItem(R, s, i ? C.coral : C.peach)); st.scene.add(A.group, B.group);
  // lights for the logo volume: soft key, two coloured rims from behind
  const key = new THREE.DirectionalLight('#ffffff', 1.5); key.position.set(-4, 12, 9); key.target.position.copy(L);
  const rimA = new THREE.DirectionalLight(C.peach, 5); rimA.position.set(7, 10, -7); rimA.target.position.copy(L);
  const rimB = new THREE.DirectionalLight(C.lilac, 4.5); rimB.position.set(-8, 6.5, -6); rimB.target.position.copy(L);
  const amb = new THREE.AmbientLight(C.lilac, 0.25); st.scene.add(key, key.target, rimA, rimA.target, rimB, rimB.target, amb); st.logoLights = [key, rimA, rimB, amb];

  const dn = Math.max(0.06, (B.poleR / 0.585) * 0.62), poleW = B.pole.clone().add(L);
  st.handover = m.fill + 0.02;
  st.pose6 = (t) => {
    const u = ease.in3(prog(t, m.fly0, m.fill)), drift = 0.25 * Math.sin(t * 0.6), tx = lerp(L.x, poleW.x, smooth(u * 1.5)), ty = lerp(L.y, poleW.y, smooth(u * 1.5));
    const dist = Math.exp(lerp(Math.log(CAM0[2]), Math.log(dn), u));
    return { pos: [lerp(CAM0[0] + drift, poleW.x, smooth(u * 1.5)), lerp(CAM0[1] + 0.25, poleW.y, smooth(u * 1.5)), B.pole.z + dist], target: [tx, ty, 0], aperture: 60 * (1 - smooth(u * 2)), focus: dist };
  };
  // cursor path in screen space (frame coordinates)
  const curAt = (t) => { const a = ease.io3(prog(t, m.cur0, m.grab)), b = ease.in3(prog(t, m.grab, m.drop)), c0 = st.project(L); return { x: lerp(lerp(1560, c0.x + 40, a), 2500, b) , y: lerp(lerp(930, c0.y + 30, a), 120, b) - Math.sin(b * Math.PI) * 120 }; };

  return {
    id: 'brands',
    draw(t) {
      const g = R.g, off = whip56(R, t) - WHIP56, u67 = ease.io3(prog(t, X.x67[0], X.x67[1]));
      st.shiftX = off; st.setCamera(t);
      // logo 1: spin in → idle → grabbed and dragged off with a wobble
      const p1 = prog(t, m.spin0, m.land1), gone = t > m.drop + 0.05;
      A.group.visible = p1 > 0 && !gone;
      if (A.group.visible) {
        const idle = Math.max(0, t - m.land1), tau = t - m.grab, held = tau >= 0, sc = ease.outBack(clamp(p1), 1.4) * (held ? 1 - 0.06 * Math.exp(-tau * 10) : 1);
        A.group.scale.setScalar(Math.max(0.001, sc));
        A.group.rotation.set(0.1 * Math.sin(idle * 1.1) + (1 - ease.out3(clamp(p1))) * 0.6, (1 - ease.out4(clamp(p1))) * Math.PI * 3.5 + 0.3 * Math.sin(idle * 1.5) * (held ? Math.exp(-tau * 3) : 1) + (held ? 0.7 * Math.sin(tau * 9) * Math.exp(-tau * 2.2) : 0),
          held ? -0.5 * Math.sin(tau * 13) * Math.exp(-tau * 2.6) - 0.35 * ease.in2(prog(t, m.grab, m.drop)) : 0);
        if (held) { const c = curAt(t), w = st.unproject(c.x - 40 - off, c.y - 30, 0); A.group.position.set(w.x, w.y, 0); } else A.group.position.copy(L);
      }
      // logo 2: pop in, settle square to camera for the fly-through
      const p2 = prog(t, m.pop2, m.pop2 + 0.45); B.group.visible = p2 > 0 && t < st.handover + X.x67[1] - m.fill + 1;
      if (B.group.visible) { const idle = t - m.pop2, calm = 1 - smooth(prog(t, m.fly0 - 0.2, m.fly0 + 0.35)); B.group.scale.setScalar(Math.max(0.001, ease.outBack(clamp(p2), 2.2)));
        B.group.rotation.set(0.12 * Math.sin(idle * 1.3) * calm, (0.42 * Math.sin(idle * 1.2 + 0.5) + (1 - ease.out3(clamp(p2))) * -1.2) * calm, 0.05 * Math.sin(idle) * calm); }
      // 2D: labels, cursor, then the colour plate + key word
      g.save(); g.translate(off, 0);
      const la = smooth(prog(t, m.spin0, m.land1)) * (1 - smooth(prog(t, m.fly0, m.fly0 + 0.4)));
      if (la > 0) { const which = t < m.pop2 ? A : B, n = t < m.pop2 ? 1 : 2;
        label(g, `0${n}/02`, 250, 300, 30, { fill: rgba(C.coral, la), weight: 700 }); label(g, `LOGO · ${String(which.name).toUpperCase()}`, 250, 338, 16, { fill: rgba(C.lilac, 0.9 * la) });
        label(g, 'EXTRUDE 0.60 · BEVEL 0.05 · CLEARCOAT · RIM ×2', 250, 364, 14, { fill: rgba(C.lilac, 0.6 * la) }); g.fillStyle = rgba(C.lilac, 0.25 * la); g.fillRect(250, 382, 420, 1.5); }
      if (t > m.cur0 && t < m.drop + 0.1) { const c = curAt(t); cursor(g, c.x - off, c.y, t >= m.grab ? 1 : 0, 1.3);
        if (t >= m.grab) { const rp = prog(t, m.grab, m.grab + 0.4); g.strokeStyle = rgba(C.peach, 0.9 * (1 - rp)); g.lineWidth = 3; g.beginPath(); g.arc(c.x - off, c.y, 16 + 60 * rp, 0, 7); g.stroke(); } }
      g.restore();
      const plate = prog(t, m.fill - 0.1, m.fill);
      if (plate > 0) {
        const dy = -H * 1.35 * u67; g.save(); g.translate(0, dy); g.fillStyle = B.colour; g.globalAlpha = plate; g.fillRect(-20, -20, W + 40, H * 1.2 + 40); g.globalAlpha = 1;
        if (t >= m.key - 0.1) { const ink = B.lum > 0.2 ? C.base : C.peach, sh = t >= m.key ? Math.exp(-(t - m.key) * 11) : 0;
          const put = (tt, a) => { const p = ease.outExpo(prog(tt, m.key - 0.1, m.key + 0.07)), s = lerp(4.5, 1, p); g.save(); g.translate(W / 2 + Math.sin(t * 90) * 10 * sh, H / 2 + 20 + Math.cos(t * 70) * 8 * sh); g.scale(s, s); word(g, S.key, 0, 60, 250, { fill: ink, alpha: a * clamp(p * 4) }); g.restore(); };
          for (let k = 7; k >= 1; k--) put(t - k * 0.011, 0.12); put(t, 1);
          if (sh > 0.02) R.shake(Math.sin(t * 83) * 9 * sh, Math.cos(t * 97) * 7 * sh, Math.sin(t * 61) * 0.005 * sh);
          label(g, '06 · KEY', W / 2, H / 2 + 190, 16, { fill: rgba(ink, 0.7 * prog(t, m.key + 0.1, m.key + 0.3)), align: 'center', weight: 700 }); }
        g.restore();
      }
      // motion blur: horizontal for the whip-pan in, vertical for the whip-tilt out, radial-ish for the fly-through
      const vx = Math.abs(vel((x) => whip56(R, x), t)); if (vx > 30) R.blur(clamp(vx / 75, 0, 46), 0);
      if (u67 > 0 && u67 < 1) R.blur(0, clamp(Math.abs(vel((x) => ease.io3(prog(x, X.x67[0], X.x67[1])), t)) * 9, 0, 44));
      const fu = prog(t, m.fly0, m.fill); if (fu > 0.5 && fu < 1) { const b = (fu - 0.5) * 12; R.blur(b, b); }
      if (t < st.handover) R.cam = { focal: 1880 * (CAM0[2] / st.focus), tilt: 0 };
    },
  };
}
