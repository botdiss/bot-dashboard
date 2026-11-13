// Fetches what is not in the folder already: fonts (Thmanyah Serif Display, JetBrains Mono) and the
// CC0 SFX Kit sounds this timeline uses (github.com/wyzowl/sfx-kit). Everything lands in ./vendor.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, VENDOR, BUILD, mkdirp, exists, readJSON, resolveInputs, sh } from './lib.mjs';

async function get(url, file) {
  if (exists(file) && fs.statSync(file).size > 0) return true;
  try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); mkdirp(path.dirname(file)); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return true; }
  catch { const c = sh('curl', ['-sSfL', '--max-time', '60', '-o', file, url], { allowFail: true }); if (c.status === 0) return true; fs.rmSync(file, { force: true }); return false; }
}
const fdir = path.join(VENDOR, 'fonts'); mkdirp(fdir);
const have = resolveInputs().inputs.fonts.map((f) => path.basename(f).toLowerCase());
if (!have.some((f) => f.includes('thmanyah') && f.includes('display'))) {
  const bases = ['https://raw.githubusercontent.com/engdawood/thmanyah-font-web/main/fonts/thmanyah-serif-display/woff2/', 'https://cdn.jsdelivr.net/gh/engdawood/thmanyah-font-web@main/fonts/thmanyah-serif-display/woff2/'];
  for (const w of ['Light', 'Regular', 'Medium', 'Bold', 'Black']) { const name = `thmanyah-serif-display-${w}.woff2`; let ok = false; for (const b of bases) if (!ok) ok = await get(b + name, path.join(fdir, name)); console.log(`${ok ? '✓' : '✗'} ${name}`); }
} else console.log('✓ Thmanyah Serif Display already present');
if (!have.some((f) => f.includes('jetbrains'))) for (const w of [400, 500, 700]) { const name = `jetbrains-mono-latin-${w}-normal.woff2`, src = path.join(ROOT, 'node_modules/@fontsource/jetbrains-mono/files', name);
  if (exists(src)) { fs.copyFileSync(src, path.join(fdir, name)); console.log('✓ ' + name); } else console.log(`✗ ${name} — run "npm install" first`); }
else console.log('✓ JetBrains Mono already present');

const sdir = path.join(VENDOR, 'sfx-kit'), RAW = 'https://raw.githubusercontent.com/wyzowl/sfx-kit/main/';
if (!(await get(RAW + 'sounds.json', path.join(sdir, 'sounds.json')))) { console.error('✗ could not reach github.com/wyzowl/sfx-kit — clone it into vendor/sfx-kit by hand'); process.exit(1); }
await get(RAW + 'LICENSE', path.join(sdir, 'LICENSE'));
const kit = readJSON(path.join(sdir, 'sounds.json')), tl = exists(path.join(BUILD, 'timeline.json')) ? readJSON(path.join(BUILD, 'timeline.json')) : null;
const ids = tl ? [...new Set(tl.sfx.map((s) => s.id))] : []; let n = 0;
for (const id of ids) { const s = kit.sounds.find((x) => x.id === id); if (!s) { console.log(`✗ unknown sound id ${id}`); continue; } if (await get(RAW + s.file, path.join(sdir, s.file))) n++; else console.log(`✗ ${s.file}`); }
console.log(`✓ SFX Kit ${kit.version} (CC0): ${n}/${ids.length} sounds for this timeline`);
