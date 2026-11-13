// One page, one function: seek(t) computes the whole frame from time alone.
// No timers, no CSS transitions, no <video> playback — so any frame can be rendered in any order.
import * as THREE from 'three';
import { W, H, C, clamp } from './lib/util.js';
import { makeHud } from './hud.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const q = new URLSearchParams(location.search);
const [TL, MF] = await Promise.all(['/build/timeline.json', '/build/manifest.json'].map((u) => fetch(u).then((r) => r.json())));
await Promise.all(MF.fonts.map(async (f) => { const ff = new FontFace(f.family, `url(/${f.src})`, { weight: String(f.weight) }); await ff.load(); document.fonts.add(ff); }));

const $ = (id) => document.getElementById(id);
const g = $('c2d').getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.autoClear = false; renderer.setClearColor(C.base, 1);
const glInfo = (() => { const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })();

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image failed: ' + src)); i.src = '/' + src; });
const R = {
  TL, MF, THREE, renderer, g, W, H, clean: q.has('clean'),
  sc: (id) => TL.scenes.find((s) => s.id === id), X: TL.transitions,
  cam: { focal: 1880, tilt: 0 }, stage: { bx: 0, by: 0, dx: 0, dy: 0, rot: 0 },
  blur(x, y = 0) { this.stage.bx = Math.max(this.stage.bx, x); this.stage.by = Math.max(this.stage.by, y); },
  shake(dx, dy, rot = 0) { this.stage.dx += dx; this.stage.dy += dy; this.stage.rot += rot; },
  images: await Promise.all(MF.images.map((i) => loadImage(i.src))),
  logos: await Promise.all(MF.logos.map((i) => loadImage(i.src))),
  photo: MF.photo ? await loadImage(MF.photo.src) : null,
  thumbs: {},
  voice(t) { const v = MF.voice; if (!v) return 0; const x = t * v.hz, i = Math.floor(x); return i < 0 || i >= v.env.length - 1 ? 0 : v.env[i] + (v.env[i + 1] - v.env[i]) * (x - i); },
};
let env = null; R.getEnv = () => { if (!env) { const p = new THREE.PMREMGenerator(renderer); env = p.fromScene(new RoomEnvironment(), 0.04).texture; p.dispose(); } return env; };
for (const src of MF.thumbs) R.thumbs[src.split('/').pop().replace('.jpg', '')] = await loadImage(src);

// clip frames, addressed by index and cached; prepare() awaits them, draw() reads them synchronously
const clipCache = new Map();
R.clip = {
  meta: (role) => MF.clips.find((c) => c.role === role) || MF.clips[0] || null,
  key(role, sec) { const m = this.meta(role); if (!m) return null; const i = ((Math.floor(sec * TL.fps) % m.frames) + m.frames) % m.frames; return `${m.dir}/${String(i + 1).padStart(4, '0')}.jpg`; },
  async want(role, sec) { const k = this.key(role, sec); if (!k || clipCache.has(k)) return; const img = await loadImage(k); clipCache.set(k, img);
    if (clipCache.size > 90) clipCache.delete(clipCache.keys().next().value); },
  get(role, sec) { return clipCache.get(this.key(role, sec)) || null; },
};

const mods = await Promise.all(['s1_hook', 's2_prompt', 's3_version', 's5_media', 's6_brands', 's7_date', 's8_cta', 's4_grid'].map((m) => import(`./scenes/${m}.js`).catch((e) => (console.warn('scene missing: ' + m, e.message), null))));
const scenes = []; for (const m of mods) if (m) scenes.push(await m.default(R));
const flat = scenes.filter((s) => s.id !== 'grid'), grid = scenes.find((s) => s.id === 'grid');
const hud = makeHud(R);

// While the frame is a card in the 3D grid, its own clock eases to a stop, then (once out of sight)
// jumps ahead so the next scene is already playing inside the card the camera will dive into.
const P0 = R.X.x34[0], SWAP = R.sc('grid').marks.swap, FREEZE = P0 + 0.6;
const flatTime = (t) => (t <= P0 ? t : t < SWAP ? P0 + 0.6 * (1 - (1 - clamp((t - P0) / 1.2)) ** 2) : t);
R.flatTime = flatTime; R.FREEZE = FREEZE;

function drawFlat(tf) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.setClearColor(C.base, 1); renderer.clear();
  for (const s of flat) { const w = R.sc(s.id).win; if (tf >= w[0] && tf <= w[1]) { g.save(); s.draw(tf); g.restore(); } }
}
R.drawFlat = drawFlat;
R.prepareFlat = (tf) => Promise.all(flat.map((s) => { const w = R.sc(s.id).win; return tf >= w[0] && tf <= w[1] && s.prepare ? s.prepare(tf) : null; }));

const world = $('world'), std = $('mblurStd');
window.seek = async (t) => {
  t = clamp(t, 0, TL.duration - 1e-4); R.t = t;
  R.cam = { focal: 1880, tilt: 0 }; R.stage.bx = R.stage.by = R.stage.dx = R.stage.dy = R.stage.rot = 0;
  const tf = flatTime(t), gw = R.sc('grid').win, inGrid = grid && t >= gw[0] && t <= gw[1];
  await Promise.all([R.prepareFlat(tf), inGrid && grid.prepare ? grid.prepare(t) : null]);
  drawFlat(tf);
  if (grid) grid.draw(t, inGrid);
  hud.draw(t);
  const s = R.stage, bx = Math.round(s.bx * 10) / 10, by = Math.round(s.by * 10) / 10;
  if (bx > 0.3 || by > 0.3) { std.setAttribute('stdDeviation', `${bx} ${by}`); world.style.filter = 'url(#mblur)'; } else world.style.filter = 'none';
  world.style.transform = s.dx || s.dy || s.rot ? `translate(${s.dx.toFixed(2)}px, ${s.dy.toFixed(2)}px) rotate(${s.rot.toFixed(4)}rad) scale(${(1 + Math.abs(s.rot) * 1.2 + (Math.abs(s.dx) + Math.abs(s.dy)) / 900).toFixed(4)})` : 'none';
  await new Promise((r) => requestAnimationFrame(() => r()));
};
window.__info = { gl: glInfo, duration: TL.duration, frames: TL.frames, fps: TL.fps, scenes: scenes.map((s) => s.id) };
if (q.has('t')) await window.seek(parseFloat(q.get('t')));
window.__ready = true;
