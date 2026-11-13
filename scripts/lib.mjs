// Shared helpers for the build scripts.
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BUILD = path.join(ROOT, 'build');
export const OUT = path.join(ROOT, 'out');
export const VENDOR = path.join(ROOT, 'vendor');
export const STANDIN = path.join(ROOT, 'standin');
export const FPS = 30, W = 1920, H = 1080;

export const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
export const exists = (p) => fs.existsSync(p);
export const mkdirp = (p) => fs.mkdirSync(p, { recursive: true });
export const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const writeJSON = (p, v) => { mkdirp(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(v, null, 1)); };

export function arg(name, fallback = undefined) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

export function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0 && !opts.allowFail) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr}`);
  return r;
}
export function has(cmd) {
  const r = spawnSync(cmd, ['-version'], { encoding: 'utf8' });
  return !r.error && r.status === 0 ? (r.stdout || r.stderr).split('\n')[0] : null;
}
export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
    p.on('error', reject);
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
  });
}

// ── Inputs: the real file in the project root wins; otherwise the labelled stand-in. ──
const IMG = /\.(jpe?g|png|webp)$/i, VID = /\.(mp4|mov|m4v|webm|mkv)$/i, FONT = /\.(woff2?|ttf|otf)$/i;
const list = (dir, re) => (exists(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => path.join(dir, f)) : []);

export function resolveInputs() {
  const standin = [];
  const one = (name) => {
    const real = path.join(ROOT, name);
    if (exists(real)) return real;
    const alt = path.join(STANDIN, name);
    if (exists(alt)) { standin.push(name); return alt; }
    return null;
  };
  const many = (dir, re) => {
    const real = list(path.join(ROOT, dir), re);
    if (real.length) return real;
    const alt = list(path.join(STANDIN, dir), re);
    if (alt.length) standin.push(dir + '/');
    return alt;
  };
  const inputs = {
    voice: one('voice.wav'),
    srt: one('voice.srt'),
    photo: one('photo.jpg'),
    direction: one('direction.json'),
    clips: many('clips', VID),
    images: many('images', IMG),
    // logos are optional: never fall back to stand-ins when the real script is in use
    logos: list(path.join(ROOT, 'logos'), /\.png$/i),
    fonts: [...list(path.join(ROOT, 'fonts'), FONT), ...list(path.join(VENDOR, 'fonts'), FONT)],
  };
  if (!inputs.logos.length && standin.includes('voice.srt')) {
    inputs.logos = list(path.join(STANDIN, 'logos'), /\.png$/i);
    if (inputs.logos.length) standin.push('logos/');
  }
  return { inputs, standin };
}

// ── SRT ──
const ts = (s) => { const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0').slice(0, 3) / 1000; };
export function parseSRT(text) {
  const blocks = text.replace(/^﻿/, '').replace(/\r/g, '').split(/\n{2,}/);
  const cues = [];
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, z] = lines[ti].split('-->');
    cues.push({ i: cues.length + 1, start: ts(a), end: ts(z), text: lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '') });
  }
  return cues;
}

// Arabic-aware normalisation so a key word can be found inside its SRT line.
export const norm = (s) => s.normalize('NFKC')
  .replace(/[ً-ٰٟـ‌-‏]/g, '')
  .replace(/[آأإٱ]/g, 'ا').replace(/ى/g, 'ي')
  .replace(/[«»"“”'’.,،؛:!?؟…()\[\]–—-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

export function probeDuration(file) {
  const r = sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(r.stdout.trim());
}
export function probeVideo(file) {
  const r = sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,duration:format=duration', '-of', 'json', file]);
  const j = JSON.parse(r.stdout); const s = j.streams[0]; const [n, d] = s.r_frame_rate.split('/').map(Number);
  return { width: s.width, height: s.height, fps: n / (d || 1), duration: parseFloat(s.duration || j.format.duration) };
}
export function probeImage(file) {
  const r = sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]);
  const [w, h] = r.stdout.trim().split(',').map(Number); return { width: w, height: h };
}
