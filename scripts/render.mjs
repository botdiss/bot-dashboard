// Step 3 — render. Playwright drives the page frame by frame (await seek(t) → screenshot) and
// pipes the frames into FFmpeg (H.264). Frames are a pure function of t, so the timeline is split
// across parallel browser workers and the segments are joined losslessly.
//   --stills            key-moment PNGs to out/stills (+ clean thumbs for the grid cards)
//   --scale 0.5         half-resolution preview        --jpeg   faster capture for previews
//   --from 10 --to 14   render a time range only       --workers N
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { BUILD, OUT, FPS, W, H, arg, mkdirp, readJSON, sh, rel } from './lib.mjs';
import { serve } from './serve.mjs';

const TL = readJSON(path.join(BUILD, 'timeline.json'));
const scale = parseFloat(arg('scale', '1')), jpeg = !!arg('jpeg'), stills = !!arg('stills');
const { server, port } = await serve(0);
const url = `http://127.0.0.1:${port}/src/index.html`;

// Real GPU first (ANGLE picks Metal / D3D11 / GL); software WebGL only as a fallback on GPU-less machines.
const GPU = ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=default', '--enable-webgl', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--hide-scrollbars'];
const SOFT = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--hide-scrollbars'];
let mode = arg('gpu', 'auto');
async function open(flags) {
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error('[page error]', e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text().slice(0, 300)); });
  await page.goto(url); await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
  return { browser, page, cdp: await page.context().newCDPSession(page), info: await page.evaluate('window.__info') };
}
async function launch() {
  if (mode === 'auto' || mode === 'gpu') {
    try { const s = await open(GPU); if (!/swiftshader|llvmpipe|software/i.test(s.info.gl) || mode === 'gpu') { mode = 'gpu'; return s; } await s.browser.close(); } catch (e) { if (mode === 'gpu') throw e; }
    mode = 'soft';
  }
  return open(SOFT);
}
const shot = async (s, clean = false) => Buffer.from((await s.cdp.send('Page.captureScreenshot', { format: jpeg || clean ? 'jpeg' : 'png', quality: 95, optimizeForSpeed: true, captureBeyondViewport: false })).data, 'base64');

if (stills) {
  const s = await launch(); console.log(`renderer: ${s.info.gl}`);
  const dir = path.join(OUT, 'stills'), tdir = path.join(BUILD, 'thumbs'); mkdirp(dir); mkdirp(tdir);
  const only = arg('only'), X = TL.transitions, sc = Object.fromEntries(TL.scenes.map((x) => [x.id, x])), m = (id) => sc[id].marks;
  const mids = (a, b) => (a + b) / 2;
  let list = [
    ['01a-hook-eye-lock', m('hook').lock + 0.5], ['01b-hook-strike', m('hook').strike + 0.5], ['x12-into-pupil', mids(...X.x12) - 0.02],
    ['02a-prompt-typing', m('prompt').typ1 + 0.1], ['02b-prompt-liquid-slam', m('prompt').key + 0.3], ['x23-push-texture', mids(...X.x23)],
    ['03a-version-lock', m('version').lockN + 0.25], ['03b-name-dots', m('version').stage[0] + m('version').stageLen * 0.7], ['03c-name-extrude', m('version').stage[1] + m('version').stageLen * 0.7],
    ['03d-name-rings', m('version').stage[2] + m('version').stageLen * 0.7], ['03e-name-clean', m('version').stage[3] + 0.3], ['x34-pull-back', X.x34[0] + 0.75],
    ['04a-grid-floor', m('grid').k1 + 0.5], ['04b-grid-float', m('grid').k3], ['04c-grid-snap', m('grid').snap1 + 0.25], ['x45-dive', X.x45[0] + 0.5],
    ['05a-media-word1', m('media').w[0] + 0.8], ['05b-media-word2', m('media').w[1] + 0.8], ['05c-media-word3-wave', m('media').w[2] + 0.7], ['x56-whip', mids(...X.x56)],
    ['06a-brand-spin', m('brands').land1 + 0.15], ['06b-brand-drag', mids(m('brands').grab, m('brands').drop) + 0.1], ['06c-brand-pop', m('brands').pop2 + 0.5], ['06d-brand-fill-slam', m('brands').key + 0.3],
    ['x67-tilt', mids(...X.x67)], ['07a-date-flip', (m('date').flips[0]?.[0] ?? m('date').slow[0]) + 0.25], ['07b-date-slow-flip', mids(...m('date').slow)], ['07c-date-circle', m('date').circle1 + 0.2],
    ['07d-date-lock', m('date').hit + 0.12], ['x78-keyhole', mids(...X.x78) - 0.05], ['08a-cta-typing', m('cta').typ1 + 0.1], ['08b-cta-dm', m('cta').dm + 0.6], ['08c-cta-into-photo', mids(m('cta').fly0, m('cta').fly1)], ['08d-end-card', m('cta').shrink1 + 1.0],
  ];
  if (only) list = list.filter(([n]) => only.split(',').some((o) => n.startsWith(o)));
  for (const [name, t] of list) {
    const tt = Math.round(t * FPS) / FPS, t0 = Date.now();
    await s.page.evaluate((x) => window.seek(x), tt);
    fs.writeFileSync(path.join(dir, `${name}.png`), await shot(s));
    console.log(`  ${name.padEnd(26)} t=${tt.toFixed(3)}s  ${Date.now() - t0} ms`);
  }
  if (!only) { // clean (no viewfinder) frames, one per scene, used as "frames from this reel" on the grid cards
    await s.page.evaluate(() => { document.getElementById('hud').style.display = 'none'; });
    const picks = { hook: m('hook').strike - 0.1, prompt: m('prompt').key + 0.4, version: m('version').stage[3] + 0.3, media: m('media').w[1] + 0.9, brands: m('brands').pop2 + 0.5, date: m('date').circle1 + 0.2, cta: m('cta').shrink1 + 1 };
    for (const [id, t] of Object.entries(picks)) { await s.page.evaluate((x) => window.seek(x), t); const f = path.join(tdir, `${id}.full.jpg`); fs.writeFileSync(f, await shot(s, true));
      sh('ffmpeg', ['-y', '-v', 'error', '-i', f, '-vf', 'scale=960:540:flags=lanczos', '-q:v', '3', path.join(tdir, `${id}.jpg`)]); fs.rmSync(f); }
  }
  await s.browser.close(); server.close();
  console.log(`stills → ${rel(dir)}`); process.exit(0);
}

// ── full / ranged render ──
const f0 = Math.max(0, Math.round(parseFloat(arg('from', '0')) * FPS)), f1 = Math.min(TL.frames, arg('to') ? Math.round(parseFloat(arg('to')) * FPS) : TL.frames);
const total = f1 - f0, first = await launch(); console.log(`renderer: ${first.info.gl}  (${mode === 'gpu' ? 'hardware GPU' : 'software fallback — no GPU on this machine'})`);
const nWorkers = Math.max(1, Math.min(+arg('workers', mode === 'gpu' ? 2 : Math.max(1, Math.min(4, os.cpus().length - 1))), Math.ceil(total / 30)));
const segDir = path.join(BUILD, 'segments'); fs.rmSync(segDir, { recursive: true, force: true }); mkdirp(segDir); mkdirp(OUT);
const per = Math.ceil(total / nWorkers), t00 = Date.now(); let done = 0;
const tick = setInterval(() => { const el = (Date.now() - t00) / 1000, fps = done / el; process.stdout.write(`\r  ${done}/${total} frames · ${fps.toFixed(2)} fps · ETA ${fps ? Math.ceil((total - done) / fps / 60) : '?'} min   `); }, 2000);
await Promise.all(Array.from({ length: nWorkers }, async (_, k) => {
  const a = f0 + k * per, b = Math.min(f1, a + per); if (a >= b) return;
  const s = k === 0 ? first : await open(mode === 'gpu' ? GPU : SOFT);
  const seg = path.join(segDir, `seg-${String(k).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', jpeg ? 'mjpeg' : 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', scale < 1 ? 'veryfast' : 'slow', '-crf', scale < 1 ? '20' : '15',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-r', String(FPS), '-g', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
  for (let f = a; f < b; f++) {
    await s.page.evaluate((x) => window.seek(x), f / FPS);
    if (!ff.stdin.write(await shot(s))) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
  }
  ff.stdin.end(); await closed; await s.browser.close();
}));
clearInterval(tick);
const segs = fs.readdirSync(segDir).filter((f) => f.endsWith('.mp4')).sort();
fs.writeFileSync(path.join(segDir, 'list.txt'), segs.map((s) => `file '${s}'`).join('\n'));
const video = path.join(BUILD, total === TL.frames ? (scale < 1 ? 'video-preview.mp4' : 'video.mp4') : 'video-range.mp4');
sh('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(segDir, 'list.txt'), '-c', 'copy', '-movflags', '+faststart', video]);
server.close();
console.log(`\nvideo (silent) → ${rel(video)} · ${total} frames in ${((Date.now() - t00) / 60000).toFixed(1)} min with ${nWorkers} worker(s)`);
