// Generates clearly labelled STAND-IN inputs in ./standin so the pipeline can be proven
// before the real voice / footage arrive. Nothing here is meant to ship.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { STANDIN, mkdirp, sh, writeJSON } from './lib.mjs';

mkdirp(path.join(STANDIN, 'clips')); mkdirp(path.join(STANDIN, 'images')); mkdirp(path.join(STANDIN, 'logos'));

// ── script + timings ──
const cues = [
  [0.30, 4.20, 'كلّ مرة تفتح برنامج المونتاج، تبدأ من الصفر.'],
  [4.50, 8.30, 'الآن تكتب أمراً واحداً، وتضغط توليد.'],
  [8.60, 13.40, 'هذا هو الإصدار ٣٫٠ من «مدار».'],
  [13.70, 19.60, 'كلّ لقطة تصير بطاقة، وكلّ بطاقة تفتح مشهداً جديداً.'],
  [19.90, 24.70, 'صورة… فيديو… وصوت.'],
  [25.00, 30.60, 'يعمل مع «نقطة»، ومع «موجة»، بلا إعدادات.'],
  [30.90, 37.20, 'متاح للجميع يوم ١٤ نوفمبر، والموعد مؤكد.'],
  [37.50, 43.00, 'اكتب «مدار» في التعليقات، وأرسل لك الرابط.'],
];
const tc = (s) => { const ms = Math.round(s * 1000); const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
fs.writeFileSync(path.join(STANDIN, 'voice.srt'), cues.map((c, i) => `${i + 1}\n${tc(c[0])} --> ${tc(c[1])}\n${c[2]}\n`).join('\n'));

// ── placeholder "voice": syllable-rate tone bursts so loudness + waveform code has a signal ──
{
  const sr = 48000, dur = cues.at(-1)[1] + 0.4, n = Math.ceil(dur * sr), pcm = new Float32Array(n);
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (const [a, z] of cues) {
    let t = a;
    while (t < z - 0.08) {
      const len = 0.09 + rnd() * 0.12, f0 = 110 + rnd() * 50, f1 = 500 + rnd() * 500, f2 = 1400 + rnd() * 900, amp = 0.35 + rnd() * 0.4;
      for (let i = 0; i < len * sr; i++) {
        const k = Math.floor(t * sr) + i; if (k >= n) break; const u = i / (len * sr), env = Math.sin(Math.PI * u) ** 1.5, tt = i / sr;
        pcm[k] += amp * env * (0.5 * Math.sin(2 * Math.PI * f0 * tt) + 0.3 * Math.sin(2 * Math.PI * f1 * tt) + 0.2 * Math.sin(2 * Math.PI * f2 * tt));
      }
      t += len + (rnd() < 0.18 ? 0.16 + rnd() * 0.2 : 0.02 + rnd() * 0.05);
    }
  }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-1, Math.min(1, pcm[i] * 0.5)) * 32767 | 0, 44 + i * 2);
  fs.writeFileSync(path.join(STANDIN, 'voice.wav'), buf);
}

// ── stills drawn in a browser canvas ──
const browser = await chromium.launch();
const page = await browser.newPage();
const shots = await page.evaluate(() => {
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tag = (g, w, h, s) => { g.font = `600 ${Math.round(h * 0.022)}px monospace`; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, h - h * 0.05, w, h * 0.05); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText('STAND-IN · ' + s, w * 0.02, h - h * 0.025); };
  const out = {};
  // portrait
  { const [c, g] = mk(1600, 2000); const bg = g.createLinearGradient(0, 0, 1600, 2000); bg.addColorStop(0, '#2c6e7f'); bg.addColorStop(1, '#e8b56b'); g.fillStyle = bg; g.fillRect(0, 0, 1600, 2000);
    g.fillStyle = '#3b2a2a'; g.beginPath(); g.ellipse(800, 2050, 720, 760, 0, 0, 7); g.fill();          // shoulders
    g.fillStyle = '#d9a37c'; g.beginPath(); g.ellipse(800, 1180, 150, 220, 0, 0, 7); g.fill();            // neck
    g.beginPath(); g.ellipse(800, 820, 330, 420, 0, 0, 7); g.fill();                                      // head
    g.fillStyle = '#2a1c18'; g.beginPath(); g.ellipse(800, 560, 350, 250, 0, Math.PI, 0); g.fill();       // hair
    tag(g, 1600, 2000, 'photo.jpg'); out['photo.jpg'] = c.toDataURL('image/jpeg', 0.92); }
  // three "photos"
  const pal = [['#ff9966', '#ff5e62', '#2b1055'], ['#56ccf2', '#2f80ed', '#0b3d2e'], ['#f7d794', '#e15f41', '#3d3d6b']];
  pal.forEach((p, i) => { const [c, g] = mk(2400, 1600); const sky = g.createLinearGradient(0, 0, 0, 1600); sky.addColorStop(0, p[1]); sky.addColorStop(0.7, p[0]); g.fillStyle = sky; g.fillRect(0, 0, 2400, 1600);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(700 + i * 500, 620, 190, 0, 7); g.fill();
    for (let k = 0; k < 4; k++) { g.fillStyle = p[2]; g.globalAlpha = 0.45 + k * 0.18; g.beginPath(); g.moveTo(0, 1600);
      for (let x = 0; x <= 2400; x += 40) g.lineTo(x, 1000 + k * 140 + Math.sin(x / (210 + k * 60) + i * 2 + k) * (110 - k * 18)); g.lineTo(2400, 1600); g.fill(); }
    g.globalAlpha = 1; tag(g, 2400, 1600, `images/0${i + 1}.jpg`); out[`images/0${i + 1}.jpg`] = c.toDataURL('image/jpeg', 0.92); });
  // two flat logos with alpha (brand colours deliberately outside the reel palette)
  { const [c, g] = mk(1024, 1024); g.fillStyle = '#12B5A0'; g.beginPath(); g.arc(512, 512, 420, 0, 7); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(690, 340, 120, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#0A6F63'; g.beginPath(); g.arc(690, 340, 62, 0, 7); g.fill(); out['logos/01-nuqta.png'] = c.toDataURL('image/png'); }
  { const [c, g] = mk(1024, 1024); g.fillStyle = '#FF7A1A'; g.beginPath(); g.roundRect(92, 92, 840, 840, 210); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.lineWidth = 78; g.lineCap = 'round'; g.beginPath();
    for (let x = 250; x <= 774; x += 8) { const y = 690 + Math.sin((x - 250) / 524 * Math.PI * 3) * 70; x === 250 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
    out['logos/02-mawja.png'] = c.toDataURL('image/png'); }
  return out;
});
for (const [name, url] of Object.entries(shots)) fs.writeFileSync(path.join(STANDIN, name), Buffer.from(url.split(',')[1], 'base64'));
await browser.close();

// ── placeholder "slow-motion" clips ──
const font = ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', '/System/Library/Fonts/Menlo.ttc', 'C\\:/Windows/Fonts/consolab.ttf'].find((f) => fs.existsSync(f.replace('\\:', ':')));
const clip = (name, src) => sh('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', src, '-t', '5', '-r', '30',
  '-vf', (font ? `drawtext=fontfile=${font}:text='STAND-IN · ${name}':fontcolor=white:fontsize=30:x=36:y=h-66:box=1:boxcolor=black@0.55:boxborderw=12,` : '') + 'format=yuv420p',
  '-c:v', 'libx264', '-crf', '18', path.join(STANDIN, 'clips', name + '.mp4')]);
clip('jump', 'gradients=s=1280x720:c0=0x1D976C:c1=0x93F9B9:c2=0x0B486B:c3=0xF56217:nb_colors=4:speed=0.012:r=30');
clip('dancer', 'gradients=s=1280x720:c0=0xC33764:c1=0x1D2671:c2=0xF7971E:c3=0xFFD200:nb_colors=4:speed=0.010:r=30');
clip('splash', 'gradients=s=1280x720:c0=0x00C6FF:c1=0x0072FF:c2=0xE0F7FA:c3=0x003366:nb_colors=4:speed=0.016:r=30');

// ── direction sheet for the stand-in script (see README: the same file is written by hand for the real script) ──
writeJSON(path.join(STANDIN, 'direction.json'), {
  identity: { name: 'اسمك هنا', handles: ['@yourhandle', 'yourname.com'] },
  scenes: {
    hook: { cue: 1, key: 'من الصفر', keyAt: 'تبدأ' },
    prompt: { cue: 2, prompt: 'اصنع عرضاً متحركاً من صوتي', button: 'توليد', clickAt: 'وتضغط', key: 'توليد', keyAt: 'توليد' },
    version: { cue: 3, label: 'VERSION', number: '٣٫٠', numberAt: '٣٫٠', name: 'مدار', nameAt: 'مدار' },
    grid: { cue: 4 },
    media: { cue: 5, words: [{ text: 'صورة', at: 'صورة', fill: 'image' }, { text: 'فيديو', at: 'فيديو', fill: 'jump' }, { text: 'صوت', at: 'وصوت', fill: 'dancer' }] },
    brands: { cue: 6, at: ['نقطة', 'موجة'], key: 'بلا إعدادات', keyAt: 'بلا' },
    date: { cue: 7, day: '١٤', month: 'نوفمبر', weekday: 'السبت', previous: ['١١', '١٢', '١٣'], at: '١٤', lockAt: 'مؤكد' },
    cta: { cue: 8, headline: 'الرابط في رسالة خاصة', keyword: 'مدار', keywordAt: 'مدار', placeholder: 'اكتب تعليقاً…', dm: 'تفضّل، هذا الرابط', dmAt: 'وأرسل' },
  },
});
console.log('Stand-in inputs written to ./standin (voice.wav, voice.srt, photo.jpg, clips/, images/, logos/, direction.json)');
