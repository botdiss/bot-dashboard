// Step 2 — turn the inputs into things the page can read deterministically:
// clip frame sequences (so every video frame is addressed by index, never by <video> seeking),
// a per-frame voice level track for the waveform, and a manifest of everything.
import fs from 'node:fs';
import path from 'node:path';
import { BUILD, FPS, resolveInputs, sh, mkdirp, writeJSON, rel, probeVideo, probeImage, readJSON } from './lib.mjs';

const { inputs, standin } = resolveInputs();
const TL = readJSON(path.join(BUILD, 'timeline.json'));
const media = path.join(BUILD, 'media'); mkdirp(media);
const stamp = (f) => { const s = fs.statSync(f); return `${s.size}-${Math.round(s.mtimeMs)}`; };

// clips → JPEG sequences at 30 fps, original colours (no grading, full-range, high quality)
const role = (name) => (/jump|قفز/i.test(name) ? 'jump' : /danc|رقص/i.test(name) ? 'dancer' : /splash|water|ماء/i.test(name) ? 'splash' : null);
const clips = []; const fallbackRoles = ['jump', 'dancer', 'splash'];
inputs.clips.forEach((file, i) => {
  const name = path.basename(file).replace(/\.[^.]+$/, ''), v = probeVideo(file), dir = path.join(media, 'clip-' + name), mark = path.join(dir, '.stamp');
  const seconds = Math.min(v.duration, 10), w = Math.min(1280, v.width - (v.width % 2));
  if (!fs.existsSync(mark) || fs.readFileSync(mark, 'utf8') !== stamp(file)) {
    fs.rmSync(dir, { recursive: true, force: true }); mkdirp(dir);
    sh('ffmpeg', ['-y', '-v', 'error', '-i', file, '-t', String(seconds), '-vf', `fps=${FPS},scale=${w}:-2:flags=lanczos`, '-q:v', '2', path.join(dir, '%04d.jpg')]);
    fs.writeFileSync(mark, stamp(file));
  }
  const frames = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length, size = probeImage(path.join(dir, '0001.jpg'));
  clips.push({ name, role: role(name), dir: rel(dir), frames, width: size.width, height: size.height, source: rel(file) });
});
clips.forEach((c) => { if (!c.role) c.role = fallbackRoles.find((r) => !clips.some((x) => x.role === r)) || 'extra'; });

// voice → level per video frame (RMS, 0..1) + a finer 120 Hz envelope for the waveform bars
let voice = null;
if (inputs.voice) {
  const sr = 12000, raw = sh('ffmpeg', ['-v', 'error', '-i', inputs.voice, '-ac', '1', '-ar', String(sr), '-f', 's16le', '-'], { encoding: 'buffer' }).stdout;
  const n = raw.length / 2, hz = 120, hop = sr / hz, env = [];
  for (let i = 0; i < n; i += hop) { let s = 0, c = 0; for (let k = i; k < Math.min(n, i + hop * 2); k++) { const v = raw.readInt16LE(k * 2) / 32768; s += v * v; c++; } env.push(Math.sqrt(s / Math.max(1, c))); }
  const peak = [...env].sort((a, b) => a - b)[Math.floor(env.length * 0.98)] || 1;
  voice = { hz, env: env.map((v) => Math.round(Math.min(1, v / peak) * 1000) / 1000) };
}

const img = (f) => ({ src: rel(f), name: path.basename(f), ...probeImage(f) });
const fontFace = (f) => { const b = path.basename(f).toLowerCase(); const weight = /black|900/.test(b) ? 900 : /bold|700/.test(b) ? 700 : /medium|500/.test(b) ? 500 : /light|300/.test(b) ? 300 : 400;
  const family = /thmanyah/.test(b) && /display/.test(b) ? 'Thmanyah Serif Display' : /jetbrains/.test(b) ? 'JetBrains Mono' : null; return family ? { family, weight, src: rel(f) } : null; };
const fonts = inputs.fonts.map(fontFace).filter(Boolean).filter((f, i, a) => a.findIndex((x) => x.family === f.family && x.weight === f.weight) === i);
for (const fam of ['Thmanyah Serif Display', 'JetBrains Mono']) if (!fonts.some((f) => f.family === fam)) { console.error(`Font "${fam}" not found in fonts/ or vendor/fonts. Run "npm run assets".`); process.exit(2); }
const thumbs = fs.existsSync(path.join(BUILD, 'thumbs')) ? fs.readdirSync(path.join(BUILD, 'thumbs')).filter((f) => f.endsWith('.jpg')).sort().map((f) => rel(path.join(BUILD, 'thumbs', f))) : [];

writeJSON(path.join(BUILD, 'manifest.json'), { standin, photo: inputs.photo ? img(inputs.photo) : null, images: inputs.images.map(img), logos: inputs.logos.map(img), clips, fonts, thumbs, voice });
console.log(`prep: ${clips.length} clip(s) [${clips.map((c) => `${c.role}:${c.frames}f`).join(', ')}], ${inputs.images.length} image(s), ${inputs.logos.length} logo(s), ${fonts.length} font face(s), ${thumbs.length} reel thumb(s), voice env ${voice ? voice.env.length : 0} pts`);
