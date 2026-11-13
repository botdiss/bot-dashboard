// 04 GRID — CSS 3D. The previous frame literally becomes a card: the live canvas element is re-parented
// into a 3D-transformed card, the camera pulls back and tilts (focal 1880, tilt 58°), glides over the
// floor, flies between floating cards with depth of field, the cards snap into a neat wall grid, and
// the camera dives into the next card — which already holds the next scene, live.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { W, H, C, clamp, lerp, prog, smooth, ease, hash, spline, cover, rgba, vel } from '../lib/util.js';

const FOCAL = 1880, FOV = (2 * Math.atan(H / 2 / FOCAL) * 180) / Math.PI, COLS = 5, ROWS = 3, ZW = -2700, WY = 430;

export default function (R) {
  const S = R.sc('grid'), m = S.marks, X = R.X, host = document.getElementById('grid3d'), flatEl = document.getElementById('flat'), world = document.getElementById('world');
  const css = new CSS3DRenderer({ element: host }); css.setSize(W, H);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(FOV, W / H, 1, 30000);

  // floor
  const floorEl = document.createElement('div');
  floorEl.style.cssText = `width:4000px;height:4000px;background-image:linear-gradient(${rgba(C.lilac, 0.2)} 1.5px, transparent 1.5px),linear-gradient(90deg, ${rgba(C.lilac, 0.2)} 1.5px, transparent 1.5px);background-size:100px 100px;background-position:50px 50px;-webkit-mask-image:radial-gradient(circle, #000 12%, transparent 66%);mask-image:radial-gradient(circle, #000 12%, transparent 66%);`;
  const floor = new CSS3DObject(floorEl); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -6, -900); floor.scale.setScalar(2.4); scene.add(floor);

  // cards: 0 = the frame we came from, 1 = the frame we dive into, the rest hold clips / photos / frames of this reel
  const kinds = ['live', 'live', 'clip:jump', 'thumb:hook', 'img:0', 'clip:splash', 'thumb:prompt', 'clip:dancer', 'img:1', 'thumb:brands', 'clip:splash', 'thumb:date', 'img:2', 'thumb:cta', 'clip:jump'];
  const floorSlot = [7, 3, 0, 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14], wallSlot = [0, 7, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14];
  const names = { hook: '01 · HOOK', prompt: '02 · PROMPT', brands: '06 · BRANDS', date: '07 · DATE', cta: '08 · CTA' };
  const cards = kinds.map((kind, i) => {
    const live = kind === 'live', el = document.createElement('div'); el.className = 'card'; el.style.width = (live ? 1920 : 960) + 'px'; el.style.height = (live ? 1080 : 540) + 'px'; el.style.borderRadius = (live ? 56 : 28) + 'px';
    const [type, key] = kind.split(':'); let cv = null, tag = '';
    if (live) { cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; el.appendChild(cv); tag = i === 0 ? '03 · VERSION' : '05 · MEDIA'; }
    else if (type === 'clip') { cv = document.createElement('canvas'); cv.width = 960; cv.height = 540; el.appendChild(cv); tag = `CLIP · ${key.toUpperCase()} · SLOW`; }
    else { cv = document.createElement('canvas'); cv.width = 960; cv.height = 540; el.appendChild(cv); const g = cv.getContext('2d'), img = type === 'img' ? R.images[+key % Math.max(1, R.images.length)] : R.thumbs[key];
      if (img) { const c = cover(img.naturalWidth, img.naturalHeight, 960, 540); g.drawImage(img, c.x, c.y, c.w, c.h); }
      else { g.fillStyle = '#171930'; g.fillRect(0, 0, 960, 540); g.fillStyle = rgba(C.lilac, 0.5); g.font = "700 150px 'JetBrains Mono'"; g.textAlign = 'center'; g.fillText((names[key] || 'IMG').slice(0, 2), 480, 320); }
      tag = type === 'img' ? `PHOTO · ${String(+key + 1).padStart(2, '0')}` : names[key] || key.toUpperCase(); }
    const rim = document.createElement('div'); rim.className = 'rim'; el.appendChild(rim);
    const tg = document.createElement('div'); tg.className = 'tag'; tg.textContent = tag; tg.style.fontSize = (live ? 44 : 22) + 'px'; tg.style.left = tg.style.bottom = (live ? 40 : 20) + 'px'; tg.style.padding = live ? '10px 22px' : '5px 11px'; el.appendChild(tg);
    const obj = new CSS3DObject(el); obj.scale.setScalar(live ? 0.25 : 0.5); scene.add(obj);
    const fs = floorSlot[i], ws = wallSlot[i], h = (k) => hash(i * 7.13 + k * 3.7 + 0.5);
    const A = { p: new THREE.Vector3(((fs % COLS) - 2) * 560, 0, (Math.floor(fs / COLS) - 1) * 345), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)) };
    const B = { p: new THREE.Vector3((i % 2 ? 1 : -1) * lerp(560, 1650, h(1)),   // cards flank a clear corridor for the camera
      lerp(160, 900, h(2)), lerp(-2500, -350, h(3))), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(lerp(-0.3, 0.2, h(4)), lerp(-0.6, 0.6, h(5)), lerp(-0.14, 0.14, h(6)))) };
    const Cp = { p: new THREE.Vector3(((ws % COLS) - 2) * 520, WY + (1 - Math.floor(ws / COLS)) * 312, ZW), q: new THREE.Quaternion() };
    return { i, el, obj, cv, rim, tg, type, key, live, A, B, C: Cp, d1: h(7), d2: h(8) };
  });
  const src = cards[0], dst = cards[1];

  // camera path: target, ln(distance), tilt° (from straight-down), yaw
  const d0 = FOCAL * 0.25;
  const keys = [
    { t: X.x34[0], v: [0, 0, 0, Math.log(d0), 0, 0] },
    { t: m.k1, v: [0, 0, -140, Math.log(1780), 58, 0] },
    { t: m.k2, v: [240, 40, -560, Math.log(1560), 60, 0.16] },
    { t: m.k3, v: [-160, 440, -1500, Math.log(1080), 82, -0.12] },
    { t: m.k4, v: [dst.C.p.x, WY, ZW, Math.log(2700), 90, 0] },
    { t: X.x45[1], v: [dst.C.p.x, dst.C.p.y, ZW, Math.log(d0), 90, 0] },
  ];
  const camAt = (t) => { const v = spline(keys, t); return { tx: v[0], ty: v[1], tz: v[2], d: Math.exp(v[3]), tilt: v[4], yaw: v[5] }; };

  // snapshots of the flat frame: A = the frozen scene-3 frame, B = the first frame of scene 5
  const snaps = {}; const flatCanvases = [...flatEl.querySelectorAll('canvas')];
  async function snapshot(name, tf, card) { if (snaps[name]) return; await R.prepareFlat(tf); R.drawFlat(tf); const g = card.cv.getContext('2d'); for (const c of flatCanvases) g.drawImage(c, 0, 0, card.cv.width, card.cv.height); snaps[name] = true; }

  let attached = null;
  const attach = (card) => { if (attached === card) return; if (card) { card.el.insertBefore(flatEl, card.rim); } else world.appendChild(flatEl); attached = card; };
  const pose = (c, t) => {
    const a = ease.io3(prog(t, m.float0 + c.d1 * 0.55, m.float0 + c.d1 * 0.55 + 1.15)), b = ease.outBack(prog(t, m.snap0 + c.d2 * 0.18, m.snap0 + c.d2 * 0.18 + 0.42), 1.25), bob = Math.sin(t * 1.3 + c.i * 1.7) * 14 * a * (1 - clamp(b));
    c.obj.position.copy(c.A.p).lerp(c.B.p, a).lerp(c.C.p, b); c.obj.position.y += bob;
    c.obj.quaternion.copy(c.A.q).slerp(c.B.q, a).slerp(c.C.q, clamp(b)); 
  };

  return {
    id: 'grid',
    async prepare(t) {
      await snapshot('A', R.FREEZE, src); await snapshot('B', m.swap, dst);
      await Promise.all(cards.filter((c) => c.type === 'clip').map((c) => R.clip.want(c.key, t + c.i * 0.77)));
    },
    draw(t, on) {
      if (!on) { if (attached) attach(null); host.style.display = 'none'; return; }
      host.style.display = 'block';
      const liveCard = t < m.swap ? src : dst; attach(liveCard);
      src.cv.style.display = liveCard === src ? 'none' : 'block'; dst.cv.style.display = liveCard === dst ? 'none' : 'block';
      for (const c of cards) { pose(c, t); if (c.type === 'clip') { const img = R.clip.get(c.key, t + c.i * 0.77); if (img) { const k = cover(img.naturalWidth, img.naturalHeight, 960, 540); c.cv.getContext('2d').drawImage(img, k.x, k.y, k.w, k.h); } } }
      const k = camAt(t), th = (k.tilt * Math.PI) / 180, sy = Math.sin(k.yaw), cy = Math.cos(k.yaw);
      cam.position.set(k.tx + k.d * Math.sin(th) * sy, k.ty + k.d * Math.cos(th), k.tz + k.d * Math.sin(th) * cy);
      cam.up.set(-Math.cos(th) * sy, Math.sin(th), -Math.cos(th) * cy); cam.lookAt(k.tx, k.ty, k.tz); cam.updateMatrixWorld(true);
      // card chrome appears as the frame turns into a card, and dissolves again as the next card fills the frame
      const chrome = (card) => { const zc = card.obj.position.clone().applyMatrix4(cam.matrixWorldInverse).z, f = smooth(clamp((-zc / d0 - 1) / 0.5)); card.el.style.borderRadius = (56 * f).toFixed(1) + 'px'; card.rim.style.opacity = f.toFixed(3); card.tg.style.opacity = smooth(clamp((-zc / d0 - 1.6) / 0.8)).toFixed(3); };
      chrome(src); chrome(dst);
      // depth of field: blur each card by its distance from the focus plane (the camera target)
      const ap = 7000 * smooth(prog(t, m.k1 - 0.6, m.k2)) * (1 - smooth(prog(t, m.snap0, m.snap1)));
      for (const c of cards) { const zc = -c.obj.position.clone().applyMatrix4(cam.matrixWorldInverse).z, b = zc <= 30 ? 0 : clamp(Math.abs(1 / zc - 1 / k.d) * ap, 0, 16); c.el.style.filter = b > 0.4 ? `blur(${(b / c.obj.scale.x).toFixed(1)}px)` : 'none'; c.obj.visible = zc > 20; if (!c.live) c.el.style.opacity = smooth(clamp((zc - 120) / 260)).toFixed(3); }
      floorEl.style.opacity = (0.9 * smooth(prog(t, X.x34[0], X.x34[0] + 0.5)) * (1 - 0.75 * smooth(prog(t, m.snap0, m.snap1 + 0.4)))).toFixed(3);
      css.render(scene, cam);
      const sp = Math.abs(vel((x) => Math.log(camAt(x).d), t)); if (sp > 0.25) { const b = clamp((sp - 0.25) * 2.2, 0, 7); R.blur(b, b); }
      const pan = Math.abs(vel((x) => camAt(x).tx, t)) / 260; if (pan > 0.5) R.blur(clamp(pan, 0, 6), 0);
      R.cam = { focal: FOCAL, tilt: k.tilt };
    },
  };
}
