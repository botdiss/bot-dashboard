// Step 0 — tools and inputs. Exits non-zero (and says how to fix it) if Node or FFmpeg is missing.
import { has, resolveInputs, rel, ROOT } from './lib.mjs';
import path from 'node:path';

const major = +process.versions.node.split('.')[0];
const ff = has('ffmpeg'), fp = has('ffprobe');
console.log(`Node.js  ${process.version}${major < 18 ? '   ✗ need 18+' : '   ✓'}`);
console.log(`FFmpeg   ${ff ? ff.replace(/ Copyright.*/, '') + '   ✓' : '✗ not found'}`);
console.log(`ffprobe  ${fp ? '✓' : '✗ not found'}`);
if (major < 18 || !ff || !fp) {
  console.log(`
Install what is missing, then run this again:
  Node.js 18+   macOS: brew install node          Windows: winget install OpenJS.NodeJS.LTS    Linux: https://nodejs.org or nvm
  FFmpeg        macOS: brew install ffmpeg        Windows: winget install Gyan.FFmpeg          Linux: sudo apt install ffmpeg`);
  process.exit(1);
}

const { inputs, standin } = resolveInputs();
const row = (label, v, optional) => {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  const tag = !arr.length ? (optional ? '— (optional, skipped)' : '✗ MISSING') : arr.map((p) => rel(p)).join(', ');
  console.log(`  ${label.padEnd(12)} ${tag}`);
};
console.log('\nInputs');
row('voice.wav', inputs.voice); row('voice.srt', inputs.srt); row('photo.jpg', inputs.photo);
row('clips/', inputs.clips); row('images/', inputs.images); row('logos/', inputs.logos, true);
row('fonts', inputs.fonts.map((f) => path.join(path.dirname(f), path.basename(f))));
row('direction', inputs.direction);
if (standin.length) console.log(`\n⚠ STAND-IN inputs in use for: ${standin.join(', ')}\n  Put your real files in ${ROOT} and re-run; stand-ins are only there to prove the pipeline.`);
const missing = ['voice', 'srt', 'photo'].filter((k) => !inputs[k]);
if (missing.length) { console.log(`\nMissing required inputs: ${missing.join(', ')}. Run "npm run standin" to generate labelled stand-ins.`); process.exit(2); }
