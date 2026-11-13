// 07 DATE — a 3D desk calendar under a spotlight (three.js, soft shadows, depth of field). Pages flip;
// the last one flips in slow motion from a low angle and reveals the date on the exact word; a circle
// is drawn on it; a metal lock drops in slow motion with dust and camera shake.
// Exit: the camera pushes into the keyhole until its darkness is the whole frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { W, H, C, clamp, lerp, prog, smooth, ease, rgba, hash, spline } from '../lib/util.js';
import { label, serif } from '../lib/text.js';
import { getStage } from '../lib/stage3d.js';

const AL = 0.3, PW = 2.0, PL = 2.3, BH = 2.75, HT = BH * Math.cos(AL), ZT = 0.5 - BH * Math.sin(AL), NS = 18;
const PIVOT = new THREE.Vector3(0, HT - 0.1, ZT + 0.075), LOCK = new THREE.Vector3(1.75, 0, 1.9), INK = '#1B1C33';

function pageCanvas(day, month, weekday) {
  const c = document.createElement('canvas'); c.width = 800; c.height = 920; const g = c.getContext('2d');
  const paint = (circle = 0) => {
    g.fillStyle = C.paper; g.fillRect(0, 0, 800, 920); g.fillStyle = C.coral; g.fillRect(0, 0, 800, 170);
    g.fillStyle = INK; for (const x of [150, 400, 650]) { g.beginPath(); g.arc(x, 44, 17, 0, 7); g.fill(); }
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = INK; g.font = serif(82, 700); g.fillText(month || '', 400, 140);
    g.font = serif(String(day).length > 2 ? 300 : 430, 900); g.fillText(String(day), 400, 650);
    g.font = serif(66, 500); g.fillStyle = C.indigo; g.fillText(weekday || '', 400, 820);
    g.fillStyle = rgba(C.indigo, 0.35); g.fillRect(90, 858, 620, 3);
    if (circle > 0) { g.strokeStyle = '#E0524F'; g.lineWidth = 17; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); const n = 90, end = Math.round(n * 1.07 * circle);
      for (let i = 0; i <= end; i++) { const a = -2.2 + (i / n) * 6.2832, wob = 1 + 0.035 * Math.sin(a * 3 + 1) + 0.05 * (i / n), x = 400 + Math.cos(a) * 300 * wob, y = 500 + Math.sin(a) * 235 * wob - 12 * (i / n); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  };
  paint(0); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, paint: (p) => { paint(p); tex.needsUpdate = true; } };
}

function makePage(mat) { // a strip that can bend; front carries the print, back is bare paper
  const geo = new THREE.BufferGeometry(), pos = new Float32Array((NS + 1) * 2 * 3), uv = new Float32Array((NS + 1) * 2 * 2), idx = [];
  for (let i = 0; i <= NS; i++) { uv.set([0, 1 - i / NS, 1, 1 - i / NS], i * 4); if (i < NS) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const front = new THREE.Mesh(geo, mat), back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#E9E1D6', roughness: 0.85, side: THREE.BackSide }));
  front.castShadow = back.castShadow = true; front.receiveShadow = true; front.frustumCulled = back.frustumCulled = false;
  const set = (theta, bend, lift = 0) => { let y = PIVOT.y + lift * Math.sin(AL), z = PIVOT.z + lift * Math.cos(AL); const ds = PL / NS;
    for (let i = 0; i <= NS; i++) { const s = i / NS; pos.set([-PW / 2, y, z, PW / 2, y, z], i * 6); const phi = theta - bend * s * s; y += -Math.cos(phi) * ds; z += Math.sin(phi) * ds; }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); };
  return { front, back, set };
}

export default function (R) {
  const S = R.sc('date'), m = S.marks, st = getStage(R), X = R.X, sc = st.scene;
  // desk + spotlight
  // the desk is a pool of light: a disc whose edge dissolves into the base colour, so there is never a horizon line
  const fade = document.createElement('canvas'); fade.width = fade.height = 256; { const g = fade.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  const desk = new THREE.Mesh(new THREE.CircleGeometry(15, 64), new THREE.MeshStandardMaterial({ color: '#2A2B4C', roughness: 0.45, metalness: 0.2, envMapIntensity: 0.6, transparent: true, alphaMap: new THREE.CanvasTexture(fade) })); desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; sc.add(desk);
  const spot = new THREE.SpotLight('#FFE8DC', 300, 30, 0.44, 0.9, 2); spot.position.set(-3.2, 8.5, 6.2); spot.target.position.set(0.4, 0.8, 0.4); spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.radius = 5; spot.shadow.bias = -0.0015; spot.shadow.normalBias = 0.035; spot.shadow.camera.near = 2; spot.shadow.camera.far = 24;
  const back = new THREE.SpotLight(C.coral, 70, 20, 0.6, 1, 2); back.position.set(4.5, 3.2, -5); back.target.position.set(0, 1.2, 0); sc.add(spot, spot.target, back, back.target);
  // calendar stand
  const board = new THREE.MeshStandardMaterial({ color: '#35365E', roughness: 0.75 }), metal = new THREE.MeshStandardMaterial({ color: '#D9D4E6', metalness: 1, roughness: 0.22, envMapIntensity: 5 });
  const fb = new THREE.Mesh(new THREE.BoxGeometry(2.3, BH, 0.06), board); fb.position.set(0, HT / 2, (0.5 + ZT) / 2); fb.rotation.x = -AL;
  const bb = new THREE.Mesh(new THREE.BoxGeometry(2.3, BH, 0.06), board); bb.position.set(0, HT / 2, ZT - (0.5 - ZT) / 2); bb.rotation.x = AL;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 1.7), board); foot.position.set(0, 0.025, ZT);
  for (const o of [fb, bb, foot]) { o.castShadow = o.receiveShadow = true; sc.add(o); }
  for (let i = 0; i < 9; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.016, 8, 28), metal); ring.rotation.y = Math.PI / 2; ring.position.set(-0.88 + i * 0.22, HT - 0.03, ZT + 0.02); ring.castShadow = true; sc.add(ring); }
  const block = new THREE.Mesh(new THREE.BoxGeometry(PW, PL, 0.05), new THREE.MeshStandardMaterial({ color: '#DDD5C9', roughness: 0.9 })); block.rotation.x = -AL;
  block.position.set(0, PIVOT.y - (PL / 2) * Math.cos(AL) - 0.05 * Math.sin(AL), PIVOT.z + (PL / 2) * Math.sin(AL) - 0.05 * Math.cos(AL)); block.castShadow = block.receiveShadow = true; sc.add(block);
  // pages: every earlier day, then the date
  const days = [...(S.previous || []), S.day], sheets = days.map((d) => pageCanvas(d, S.month, d === S.day ? S.weekday : ''));
  const flips = [...m.flips, m.slow], paperMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.FrontSide });
  const under = makePage(paperMat(sheets[0].tex)), flip = makePage(paperMat(sheets[0].tex)); sc.add(under.front, under.back, flip.front, flip.back);
  // lock
  const lock = new THREE.Group(), body = new THREE.Mesh(new RoundedBoxGeometry(0.98, 0.78, 0.34, 6, 0.1), new THREE.MeshStandardMaterial({ color: '#C9B48F', metalness: 1, roughness: 0.3, envMapIntensity: 4.5 })); body.position.y = 0.39;
  const pts = [new THREE.Vector3(-0.27, -0.2, 0), new THREE.Vector3(-0.27, 0.22, 0)]; for (let i = 0; i <= 12; i++) { const a = Math.PI - (i / 12) * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * 0.27, 0.22 + Math.sin(a) * 0.27, 0)); } pts.push(new THREE.Vector3(0.27, -0.05, 0));
  const shackle = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.01), 60, 0.062, 14), metal), sh = new THREE.Group(); shackle.position.x = 0.27; sh.position.set(-0.27, 0.78, 0); sh.add(shackle);
  const dark = new THREE.MeshBasicMaterial({ color: C.base, fog: false, toneMapped: false }), hole = new THREE.Mesh(new THREE.CircleGeometry(0.1, 40), dark); hole.position.set(0, 0.45, 0.1715);
  const slotShape = new THREE.Shape([new THREE.Vector2(-0.035, 0), new THREE.Vector2(0.035, 0), new THREE.Vector2(0.06, -0.2), new THREE.Vector2(-0.06, -0.2)]), slot = new THREE.Mesh(new THREE.ShapeGeometry(slotShape), dark); slot.position.set(0, 0.4, 0.1715);
  const plate = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 10, 40), metal); plate.position.set(0, 0.45, 0.168);
  for (const o of [body, shackle]) o.castShadow = o.receiveShadow = true; lock.add(body, sh, hole, slot, plate); lock.position.copy(LOCK); lock.rotation.y = -0.22; lock.visible = false; sc.add(lock);
  const KH = new THREE.Vector3(0, 0.45, 0.1715).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.22).add(LOCK), KN = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.22);
  // dust
  const ND = 320, dpos = new Float32Array(ND * 3), dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const spr = document.createElement('canvas'); spr.width = spr.height = 64; { const g = spr.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  const dmat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(spr), color: C.peach, size: 0.2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }), dust = new THREE.Points(dgeo, dmat); dust.frustumCulled = false; sc.add(dust);

  // camera: wide on arrival → slow push during the quick flips → low angle for the slow flip → the date → the lock
  const keys = [
    { t: X.x67[0], v: [0, 2.5, 8.2, 0, 1.25, 0] },
    { t: X.x67[1], v: [0.1, 2.35, 7.3, 0, 1.25, 0] },
    { t: m.slow[0] - 0.15, v: [-0.5, 1.9, 6.0, 0, 1.3, 0] },
    { t: m.slow[0] + 0.5, v: [1.75, 0.4, 3.9, 0, 1.45, 0.1] },
    { t: m.at - 0.05, v: [1.5, 0.48, 3.75, 0, 1.4, 0.1] },
    { t: m.circle0 + 0.25, v: [0.4, 1.55, 5.0, 0, 1.4, 0.2] },
    { t: m.circle1, v: [0.32, 1.52, 4.8, 0, 1.4, 0.2] },
    { t: m.hit - 0.25, v: [1.5, 0.95, 5.9, 0.95, 0.8, 0.9] },
    { t: X.x78[0], v: [1.9, 0.85, 5.3, 1.3, 0.62, 1.4] },
  ];
  const last = keys[keys.length - 1].v, dEnd = 0.075;
  st.pose7 = (t) => {
    const up = 7 * (1 - ease.io3(prog(t, X.x67[0], X.x67[1])));     // arriving: the camera tilts down onto the desk
    if (t <= X.x78[0]) { const v = spline(keys, t), low = smooth(prog(t, m.slow[0], m.slow[0] + 0.5)) * (1 - smooth(prog(t, m.circle0, m.circle0 + 0.3)));
      return { pos: [v[0], v[1], v[2]], target: [v[3], v[4] + up, v[5]], aperture: lerp(34, 90, low) * (1 - smooth(prog(t, X.x67[0], X.x67[0] + 0.1)) * 0 ) }; }
    const u = ease.io3(prog(t, X.x78[0], X.x78[1])), p0 = new THREE.Vector3(last[0], last[1], last[2]), d0 = p0.distanceTo(KH), dir = p0.clone().sub(KH).normalize().lerp(KN, smooth(u * 1.3)).normalize(), d = Math.exp(lerp(Math.log(d0), Math.log(dEnd), u));
    const pos = KH.clone().add(dir.multiplyScalar(d)), tg = new THREE.Vector3(last[3], last[4], last[5]).lerp(KH, smooth(u * 2.2));
    return { pos: pos.toArray(), target: tg.toArray(), aperture: 34 * (1 - smooth(u * 2.5)), focus: d };
  };

  return {
    id: 'date',
    draw(t) {
      const g = R.g, desk6 = t < st.handover; st.setCamera(t);
      sc.environmentIntensity = desk6 ? 0.55 : 0.2; for (const l of st.logoLights || []) l.visible = desk6; spot.visible = back.visible = !desk6;   // the swap happens while the colour plate fills the frame
      // which page is turning
      let k = 0; while (k < flips.length && t >= flips[k][1]) k++;
      const done = k >= flips.length, pIdx = Math.min(k, flips.length - 1), slow = pIdx === flips.length - 1;
      const raw = done ? 1 : prog(t, flips[pIdx][0], flips[pIdx][1]), p = slow ? ease.io2(raw) * 0.55 + smooth(raw) * 0.45 : ease.io3(raw);
      under.front.material.map = sheets[Math.min(days.length - 1, done ? days.length - 1 : pIdx + 1)].tex; under.set(AL, 0, -0.012);
      flip.front.visible = flip.back.visible = !done;
      if (!done) { flip.front.material.map = sheets[pIdx].tex; flip.set(lerp(AL, 2 * Math.PI - AL, p), (slow ? 1.5 : 1.15) * Math.sin(Math.PI * p) * (1 - 0.35 * p)); }
      const cp = prog(t, m.circle0, m.circle1); sheets[days.length - 1].paint(t >= m.circle0 ? ease.io2(cp) : 0);
      // lock: slow-motion drop, bounce, shackle snaps shut
      lock.visible = t >= m.drop0;
      if (lock.visible) { const u = prog(t, m.drop0, m.hit), tau = t - m.hit, fall = t < m.hit ? 5.2 * (1 - Math.pow(u, 1.7)) : 0.16 * Math.abs(Math.sin(tau * 11)) * Math.exp(-tau * 6);
        lock.position.set(LOCK.x, fall, LOCK.z); const settle = t < m.hit ? 1 - u : 0;
        lock.rotation.set(-0.5 * settle + (tau > 0 ? 0.08 * Math.sin(tau * 16) * Math.exp(-tau * 5) : 0), -0.22 + 1.1 * settle, 0.7 * settle + (tau > 0 ? 0.1 * Math.sin(tau * 13) * Math.exp(-tau * 5) : 0));
        const cl = ease.out3(prog(t, m.hit + 0.1, m.hit + 0.2)); sh.position.y = 0.78 + 0.2 * (1 - cl); sh.rotation.y = 1.0 * (1 - cl); }
      // dust burst from the impact, drifting slowly
      const td = t - m.hit;
      if (td > 0) { for (let i = 0; i < ND; i++) { const a = hash(i) * 6.2832, sp = 0.7 + hash(i + 0.3) * 2.6, r = 0.35 + (sp * (1 - Math.exp(-2.4 * td))) / 2.4, up = (0.15 + hash(i + 0.7) * 1.3) * (1 - Math.exp(-1.6 * td)) - 0.06 * td;
          dpos.set([LOCK.x + Math.cos(a) * r, 0.04 + Math.max(0, up) * (0.4 + hash(i + 0.9)), LOCK.z + Math.sin(a) * r * 0.9], i * 3); }
        dgeo.attributes.position.needsUpdate = true; dmat.opacity = 0.34 * Math.exp(-td * 0.9) * smooth(prog(td, 0, 0.06));
        const sk = Math.exp(-td * 5.5); if (sk > 0.02) R.shake(Math.sin(t * 71) * 20 * sk, Math.cos(t * 89) * 26 * sk, Math.sin(t * 53) * 0.012 * sk); } else dmat.opacity = 0;
      st.render(t);
      // viewfinder notes that belong to this shot
      if (t >= st.handover) {
        const a = smooth(prog(t, X.x67[1], X.x67[1] + 0.3)) * (1 - smooth(prog(t, X.x78[0], X.x78[0] + 0.25)));
        const slowmo = (t > m.slow[0] && t < m.at + 0.1) || (t > m.drop0 && t < m.hit + 0.5);
        label(g, `07 · DATE · ${days.length - 1 - Math.min(k, flips.length)} PAGE${days.length - 1 - k === 1 ? '' : 'S'} TO GO`.replace('-1', '0'), 96, 124, 16, { fill: rgba(C.lilac, 0.9 * a), weight: 700 });
        if (slowmo) { g.fillStyle = rgba(C.coral, a); g.fillRect(96, 140, 9, 9); label(g, 'SLOW MOTION · 240 → 30 fps', 116, 150, 15, { fill: rgba(C.peach, a) }); }
        const u = prog(t, X.x78[0], X.x78[1]); if (u > 0 && u < 1) { const b = Math.sin(u * Math.PI) * 9; R.blur(b, b); }
        const fl = st.focus; R.cam = { focal: 1880, tilt: Math.round((Math.atan2(st.camera.position.y - 1.2, Math.max(0.01, st.camera.position.z)) * 180) / Math.PI), note: `focus ${fl.toFixed(2)} m` };
      }
    },
  };
}
