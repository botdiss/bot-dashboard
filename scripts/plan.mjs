// Step 1 — read voice.srt (never re-transcribed), pin every scene and every beat to it,
// write build/timeline.json and print the scene-timing table.
import fs from 'node:fs';
import path from 'node:path';
import { BUILD, FPS, resolveInputs, parseSRT, norm, probeDuration, readJSON, writeJSON, rel } from './lib.mjs';

const { inputs, standin } = resolveInputs();
if (!inputs.srt || !inputs.voice) { console.error('voice.srt / voice.wav not found. Run "npm run check".'); process.exit(2); }
if (!inputs.direction || (standin.includes('direction.json') && !standin.includes('voice.srt'))) {
  console.error('direction.json is missing for this script. It is the hand-written sheet that maps each scene to its SRT line and key words (see README → "Direction sheet").');
  process.exit(2);
}
const cues = parseSRT(fs.readFileSync(inputs.srt, 'utf8'));
const voiceDur = probeDuration(inputs.voice);
const dir = readJSON(inputs.direction);
const D = dir.scenes;
const ORDER = ['hook', 'prompt', 'version', 'grid', 'media', 'brands', 'date', 'cta'];
const TITLES = { hook: 'HOOK', prompt: 'PROMPT', version: 'VERSION', grid: 'GRID', media: 'MEDIA', brands: 'BRANDS', date: 'DATE', cta: 'CTA' };
const r3 = (x) => Math.round(x * 1000) / 1000;

// scene starts = start of the SRT line each scene is pinned to
const S = {}; ORDER.forEach((id) => { const c = cues[D[id].cue - 1]; if (!c) throw new Error(`scene "${id}" points at SRT line ${D[id].cue}, which does not exist`); S[id] = c.start; });
S.hook = 0;
for (let i = 1; i < ORDER.length; i++) if (S[ORDER[i]] <= S[ORDER[i - 1]] + 1.5) throw new Error(`scene "${ORDER[i]}" must start at least 1.5 s after "${ORDER[i - 1]}"`);
const nextStart = (id) => { const k = ORDER.indexOf(id); return k < ORDER.length - 1 ? S[ORDER[k + 1]] : Infinity; };

// time a word is spoken: its position inside its SRT line (lines are short, so this lands within a few frames)
const warnings = [];
function wordT(id, at, fallback) {
  if (typeof at === 'number') return at;
  const lo = D[id].cue - 1, k = ORDER.indexOf(id), hi = k < ORDER.length - 1 ? D[ORDER[k + 1]].cue - 1 : cues.length;
  if (at) for (let c = lo; c < hi; c++) {
    const text = norm(cues[c].text), idx = text.indexOf(norm(String(at)));
    if (idx >= 0) return cues[c].start + (idx / Math.max(1, text.length)) * (cues[c].end - cues[c].start);
  }
  if (at) warnings.push(`"${at}" not found in the SRT line(s) of scene ${id}; using a proportional fallback`);
  const c = cues[lo]; return c.start + fallback * (c.end - c.start);
}
// keep a run of beats ordered, inside [lo, hi], at least `gap` apart
function fit(ts, lo, hi, gap) {
  const t = ts.slice(); t[t.length - 1] = Math.min(t[t.length - 1], hi);
  for (let i = t.length - 2; i >= 0; i--) t[i] = Math.min(t[i], t[i + 1] - gap);
  t[0] = Math.max(t[0], lo); for (let i = 1; i < t.length; i++) t[i] = Math.max(t[i], t[i - 1] + gap * 0.6);
  return t;
}

// ── camera moves between scenes (never a cut): [start, end] ──
const X = {
  x12: [S.prompt - 0.50, S.prompt + 0.20],   // whip-zoom into the pupil
  x23: [S.version - 0.55, S.version + 0.30], // push into the liquid texture
  x34: [S.grid - 0.25, S.grid + 1.30],       // pull back: the frame becomes a card
  x45: [S.media - 0.85, S.media + 0.10],     // dive into the next card
  x56: [S.brands - 0.28, S.brands + 0.24],   // whip-pan
  x67: [S.date - 0.34, S.date + 0.30],       // whip-tilt down to the desk
  x78: [S.cta - 0.60, S.cta + 0.22],         // zoom into the keyhole
};
const sfx = []; const fx = (t, id, o = {}) => sfx.push({ t: r3(t), id, ...o });
const mid = (x) => (x[0] + x[1]) / 2;
const M = {};

{ // 1 HOOK
  const c = cues[D.hook.cue - 1];
  const open0 = Math.max(0.06, c.start - 0.12);
  const kw = wordT('hook', D.hook.keyAt, 0.55);
  let [open1, lock, key, strike] = fit([open0 + 0.55, open0 + 1.05, kw, Math.max(kw + 0.6, D.hook.strikeAt ? wordT('hook', D.hook.strikeAt, 0.8) : 0)], open0 + 0.4, X.x12[0] - 0.3, 0.3);
  M.hook = { open0, open1, lock, key, strike };
  fx(open0 + 0.2, 'whoosh-slow-soft', { db: -4 }); fx(lock, 'click-latch-firm'); fx(lock - 0.5, 'digital-scan-subtle', { len: 0.5, db: -3 });
  fx(key, 'pop-medium-in'); fx(strike + 0.12, 'swish-medium'); fx(mid(X.x12), 'whoosh-medium-hard'); fx(X.x12[1], 'move-zoom-in', { db: -2 });
}
{ // 2 PROMPT
  const typ0 = X.x12[1] - 0.05, typLen = Math.min(1.5, Math.max(0.8, (nextStart('prompt') - S.prompt) * 0.3));
  let [typ1, click, key] = fit([typ0 + typLen, wordT('prompt', D.prompt.clickAt, 0.55), wordT('prompt', D.prompt.keyAt, 0.8)], typ0 + 0.7, X.x23[0] - 0.45, 0.42);
  M.prompt = { typ0, typ1, click, reveal0: click + 0.1, reveal1: click + 0.7, key };
  fx(typ0, 'keyboard-typing-steady-medium', { fit: typ1 - typ0 }); fx(click, 'click-mouse-medium', { db: 2 }); fx(click + 0.12, 'shimmer-short-soft', { db: -3 });
  fx(key, 'impact-heavy-hard'); fx(key - 0.1, 'swish-hard', { db: -3 }); fx(mid(X.x23), 'whoosh-slow-medium');
}
{ // 3 VERSION
  const scr0 = X.x23[1] - 0.25;
  const lockN = Math.max(scr0 + 0.6, wordT('version', D.version.numberAt, 0.45));
  const end = X.x34[0] - 0.25, name0 = Math.min(Math.max(lockN + 0.45, wordT('version', D.version.nameAt, 0.75) - 0.2), end - 1.0);
  const d = Math.max(0.3, Math.min(0.6, (end - name0) / 3));
  M.version = { scr0, lockN, name0, stage: [name0, name0 + d, name0 + 2 * d, name0 + 3 * d], stageLen: d };
  fx(scr0, 'data-countup-medium', { fit: lockN - scr0 }); fx(lockN, 'data-number-land', { db: 2 }); fx(lockN, 'impact-medium-hard', { db: -2 });
  fx(name0, 'digital-blip-subtle'); fx(name0 + d, 'pop-large-in'); fx(name0 + 2 * d, 'swish-soft'); fx(name0 + 3 * d, 'impact-heavy-firm');
}
{ // 4 GRID
  const a = X.x34[1], b = X.x45[0], L = b - a;
  M.grid = { swap: a + 0.25, float0: a + L * 0.30, float1: a + L * 0.30 + 0.9, snap0: b - Math.min(1.25, L * 0.3), snap1: b - Math.min(1.25, L * 0.3) + 0.55, k1: a, k2: a + L * 0.30, k3: a + L * 0.62, k4: b - 0.1 };
  fx(mid(X.x34) - 0.2, 'move-zoom-out'); fx(mid(X.x34), 'whoosh-slow-soft');
  fx(M.grid.float0 + 0.35, 'whoosh-medium-soft'); fx(M.grid.snap0 + 0.38, 'click-clip-firm', { db: 2 }); fx(M.grid.snap0 + 0.38, 'impact-light-firm');
  fx(X.x45[0] + 0.55, 'whoosh-medium-hard'); fx(X.x45[1], 'move-zoom-in', { db: -2 });
}
{ // 5 MEDIA
  const end = X.x56[0] - 0.2, words = D.media.words;
  const w = fit(words.map((x, i) => wordT('media', x.at, i / words.length)), S.media, end - 0.5, 0.9);
  M.media = { w, pan: w.slice(1).map((t) => [t - 0.24, t + 0.14]), wave: w[w.length - 1] + 0.1 };
  M.media.pan.forEach((p) => fx(mid(p), 'whoosh-fast-medium')); w.forEach((t, i) => i && fx(t + 0.14, 'impact-light-soft'));
  fx(mid(X.x56), 'whoosh-fast-hard');
}
{ // 6 BRANDS
  const at = D.brands.at || [];
  const a1 = wordT('brands', at[0], 0.2), a2 = wordT('brands', at[1], 0.5), key = Math.max(a2 + 1.5, wordT('brands', D.brands.keyAt, 0.8));
  const spin0 = Math.max(X.x56[1] - 0.2, a1 - 0.5), land1 = spin0 + 0.65;
  let [grab, drop, pop2, fly0, fill] = fit([land1 + 0.45, a2 - 0.2, a2 - 0.05, a2 + 0.7, key - 0.06], land1 + 0.3, Math.min(key - 0.06, X.x67[0] - 0.7), 0.22);
  M.brands = { spin0, land1, cur0: land1 - 0.1, grab, drop, pop2, fly0, fill, key: fill + 0.06 };
  fx(spin0, 'move-spin', { len: 0.7, db: -3 }); fx(grab, 'click-mouse-firm', { db: 2 }); fx((grab + drop) / 2 + 0.1, 'whoosh-fast-soft'); fx(pop2, 'pop-large-in', { db: 2 });
  fx(fill, 'reverse-whoosh-medium-strong'); fx(M.brands.key, 'impact-heavy-hard'); fx(mid(X.x67), 'whoosh-fast-hard');
}
{ // 7 DATE
  const prev = D.date.previous || [];
  const at = wordT('date', D.date.at, 0.4), quick = Math.max(0, prev.length - 1);
  const f0 = X.x67[1] + 0.05, step = quick ? Math.min(0.34, Math.max(0.2, (at - 1.15 - f0) / quick)) : 0;
  const flips = Array.from({ length: quick }, (_, i) => [f0 + i * step, f0 + i * step + 0.5]);
  const slow = [Math.max(f0 + quick * step, at - 1.15), at];
  const lk = Math.max(at + 1.9, wordT('date', D.date.lockAt, 0.85));
  let [circle0, circle1, drop0, hit] = fit([at + 0.3, at + 1.0, lk - 0.8, lk], at + 0.2, X.x78[0] - 0.55, 0.3);
  M.date = { flips, slow, at, circle0, circle1, drop0, hit };
  flips.forEach((f) => fx(f[0], 'props-page-turn', { db: -2 })); fx(slow[0] + 0.15, 'props-page-turn', { rate: 0.7 }); fx(at, 'impact-light-firm');
  fx(circle0, 'writing-marker-draw', { len: circle1 - circle0 + 0.1 }); fx(hit, 'impact-deep-hard', { db: 2 }); fx(hit + 0.14, 'mechanical-lock-heavy', { db: 2 });
  fx(drop0 + 0.1, 'whoosh-slow-soft', { db: -4 }); fx(X.x78[1], 'reverse-whoosh-medium-soft');
}
let duration;
{ // 8 CTA
  const head = X.x78[1] - 0.2, kw = wordT('cta', D.cta.keywordAt, 0.3);
  let [typ0, typ1, send, dm] = fit([kw - 0.45, kw + 0.3, kw + 0.75, Math.max(kw + 1.45, wordT('cta', D.cta.dmAt, 0.7))], head + 0.6, voiceDur + 0.6, 0.4);
  const fly0 = dm + 1.05, fly1 = fly0 + 0.75, shrink0 = fly1 + 0.3, shrink1 = shrink0 + 0.85;
  duration = Math.max(voiceDur + 0.4, shrink1 + (dir.tail ?? 1.8));
  M.cta = { head, field: head + 0.3, typ0, typ1, send, posted: send + 0.16, dm, fly0, fly1, shrink0, shrink1, name: shrink1 - 0.3 };
  fx(head, 'pop-medium-in', { db: -2 }); fx(typ0, 'keyboard-typing-quick-short', { fit: typ1 - typ0 }); fx(send, 'click-mouse-medium', { db: 2 }); fx(send + 0.1, 'notification-message-out-soft');
  fx(dm, 'notification-message-in-clear'); fx(mid([fly0, fly1]), 'whoosh-medium-medium'); fx(shrink0 + 0.35, 'move-zoom-out', { db: -3 }); fx(shrink1 - 0.1, 'shimmer-medium-soft');
}
const frames = Math.ceil(duration * FPS); duration = frames / FPS;

// active window of each scene in "flat" time (transitions make neighbours overlap)
const WIN = { hook: [0, X.x12[1]], prompt: [X.x12[0], X.x23[1] + 0.05], version: [X.x23[0], S.grid + 0.36], grid: [X.x34[0], X.x45[1]],
  media: [M.grid.swap, X.x56[1]], brands: [X.x56[0], X.x67[1] + 0.4], date: [X.x56[0], X.x78[1]], cta: [X.x78[0], duration + 1] };

const scenes = ORDER.map((id, k) => ({ id, n: k + 1, title: TITLES[id], cue: D[id].cue, start: r3(S[id]), end: r3(k < ORDER.length - 1 ? S[ORDER[k + 1]] : duration),
  win: WIN[id].map(r3), marks: JSON.parse(JSON.stringify(M[id], (k2, v) => (typeof v === 'number' ? r3(v) : v))), ...D[id] }));
const timeline = { fps: FPS, width: 1920, height: 1080, duration, frames, voiceDuration: voiceDur, standin, identity: dir.identity, cues,
  transitions: Object.fromEntries(Object.entries(X).map(([k, v]) => [k, v.map(r3)])), scenes, sfx: sfx.sort((a, b) => a.t - b.t) };
writeJSON(path.join(BUILD, 'timeline.json'), timeline);

// ── scene-timing table ──
const tc = (t) => { const f = Math.round(t * FPS); return `${String(Math.floor(f / FPS / 60)).padStart(2, '0')}:${String(Math.floor(f / FPS) % 60).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`; };
const MOVE = ['—', 'whip-zoom into the pupil', 'push into the liquid texture', 'pull back → frame becomes a card', 'dive into the next card', 'whip-pan + motion blur', 'whip-tilt down to the desk', 'zoom into the keyhole'];
const BEATS = {
  hook: (m) => `eye opens ${tc(m.open0)} · REC lock ${tc(m.lock)} · "${D.hook.key}" ${tc(m.key)} · strike ${tc(m.strike)}`,
  prompt: (m) => `typing ${tc(m.typ0)} · click "${D.prompt.button}" ${tc(m.click)} · liquid ${tc(m.reveal0)} · "${D.prompt.key}" slams ${tc(m.key)}`,
  version: (m) => `scramble ${tc(m.scr0)} · locks on ${D.version.number} ${tc(m.lockN)} · "${D.version.name}" dots ${tc(m.stage[0])} → extrude ${tc(m.stage[1])} → rings ${tc(m.stage[2])} → clean ${tc(m.stage[3])}`,
  grid: (m) => `floor glide ${tc(m.k1)} · cards float ${tc(m.float0)} · snap to grid ${tc(m.snap0)} · dive ${tc(X.x45[0])}`,
  media: (m) => D.media.words.map((w, i) => `"${w.text}" ${tc(m.w[i])} (${w.fill})`).join(' · ') + ` · waveform ${tc(m.wave)}`,
  brands: (m) => `logo 1 spins in ${tc(m.spin0)} · grabbed ${tc(m.grab)} · logo 2 pops ${tc(m.pop2)} · fly-through ${tc(m.fly0)} · colour fills + "${D.brands.key}" ${tc(m.key)}`,
  date: (m) => `${m.flips.length} quick flips ${tc(m.flips[0]?.[0] ?? m.slow[0])} · slow flip ${tc(m.slow[0])} · "${D.date.day} ${D.date.month}" revealed ${tc(m.at)} · circle ${tc(m.circle0)} · lock lands ${tc(m.hit)}`,
  cta: (m) => `headline ${tc(m.head)} · types "${D.cta.keyword}" ${tc(m.typ0)} · send ${tc(m.send)} · DM ${tc(m.dm)} · into photo ${tc(m.fly0)} · end card ${tc(m.shrink1)}`,
};
let md = `# Scene timing — pinned to ${rel(inputs.srt)}\n\nVoice ${voiceDur.toFixed(2)} s · reel ${duration.toFixed(2)} s · ${frames} frames @ ${FPS} fps · timecodes are MM:SS:FF\n`;
if (standin.length) md += `\n> ⚠ STAND-IN inputs: ${standin.join(', ')} — this table is for the placeholder script, not yours.\n`;
md += `\n| # | Scene | SRT line | In | Out | Camera move in | Line |\n|---|---|---|---|---|---|---|\n`;
scenes.forEach((s, k) => { md += `| ${String(s.n).padStart(2, '0')} | ${s.title} | ${s.cue} | ${tc(s.start)} | ${tc(s.end)} | ${MOVE[k]} | ${cues[s.cue - 1].text} |\n`; });
md += `\n| # | Beats (all computed from the SRT) |\n|---|---|\n`;
scenes.forEach((s) => { md += `| ${String(s.n).padStart(2, '0')} | ${BEATS[s.id](M[s.id])} |\n`; });
if (warnings.length) md += `\nWarnings:\n${warnings.map((w) => '- ' + w).join('\n')}\n`;
fs.writeFileSync(path.join(BUILD, 'scene-timing.md'), md);
console.log(md);
console.log(`→ ${rel(path.join(BUILD, 'timeline.json'))} (${sfx.length} SFX cues)`);
