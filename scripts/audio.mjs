// Step 4 — sound. Voice normalised to −14 LUFS (two-pass loudnorm); every SFX from the CC0 SFX Kit is
// placed by the kit's own rule — start = cue time − sync.at — at its "under voiceover" level; then the
// mix is limited and muxed onto the picture.
import fs from 'node:fs';
import path from 'node:path';
import { BUILD, OUT, VENDOR, arg, exists, mkdirp, readJSON, resolveInputs, sh, rel } from './lib.mjs';

const preview = !!arg('preview'), TL = readJSON(path.join(BUILD, 'timeline.json')), { inputs } = resolveInputs();
const video = path.join(BUILD, preview ? 'video-preview.mp4' : 'video.mp4');
if (!exists(video)) { console.error(`${rel(video)} not found — render the picture first.`); process.exit(2); }
const kitDir = path.join(VENDOR, 'sfx-kit'), kit = exists(path.join(kitDir, 'sounds.json')) ? readJSON(path.join(kitDir, 'sounds.json')) : null;
if (!kit) console.warn('SFX Kit not found (run "npm run assets") — mixing voice only.');

// pass 1: measure the voice
const meas = sh('ffmpeg', ['-hide_banner', '-i', inputs.voice, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { allowFail: true }).stderr;
const j = JSON.parse(meas.slice(meas.lastIndexOf('{'), meas.lastIndexOf('}') + 1));
const voiceChain = `aresample=48000,loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000,aformat=channel_layouts=stereo`;

const ins = ['-i', inputs.voice], parts = [`[0:a]${voiceChain}[voice]`], labels = []; const log = []; let k = 1;
for (const cue of kit ? TL.sfx : []) {
  const s = kit.sounds.find((x) => x.id === cue.id), file = s && path.join(kitDir, s.file); if (!s || !exists(file)) { log.push(`  (missing) ${cue.id}`); continue; }
  let rate = cue.rate || 1; if (cue.fit && s.span_seconds) rate = Math.min(s.adapt?.rate?.[1] ?? 1.1, Math.max(s.adapt?.rate?.[0] ?? 0.9, s.span_seconds / cue.fit));
  let start = cue.t - s.sync.at / rate, trim = 0; if (start < 0) { trim = -start * rate; start = 0; }
  const gain = (s.under_voiceover_db ?? -3) + (cue.db || 0), len = cue.len ? cue.len * rate : cue.fit && cue.fit < s.duration / rate ? cue.fit * rate : 0, f = [];
  if (trim) f.push(`atrim=start=${trim.toFixed(3)}`, 'asetpts=PTS-STARTPTS');
  if (len) f.push(`atrim=end=${len.toFixed(3)}`, `afade=t=out:st=${Math.max(0, len - 0.06).toFixed(3)}:d=0.06`);
  if (rate !== 1) f.push(`asetrate=${Math.round(48000 * rate)}`);
  f.push('aresample=48000', 'aformat=channel_layouts=stereo', `volume=${gain.toFixed(1)}dB`, `adelay=${Math.round(start * 1000)}:all=1`);
  ins.push('-i', file); parts.push(`[${k}:a]${f.join(',')}[s${k}]`); labels.push(`[s${k}]`); k++;
  log.push(`  ${cue.t.toFixed(3).padStart(7)}s  ${cue.id.padEnd(32)} start ${start.toFixed(3)}s  ${gain.toFixed(0)} dB${rate !== 1 ? `  rate ${rate.toFixed(2)}` : ''}`);
}
parts.push(`[voice]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:dropout_transition=0,alimiter=limit=0.89:level=false,apad=whole_dur=${TL.duration},atrim=end=${TL.duration}[mix]`);
mkdirp(OUT); const wav = path.join(BUILD, 'mix.wav'), out = path.join(OUT, preview ? 'showreel-preview.mp4' : 'showreel.mp4');
fs.writeFileSync(path.join(BUILD, 'audio-cues.txt'), log.join('\n'));
sh('ffmpeg', ['-y', '-v', 'error', ...ins, '-filter_complex', parts.join(';'), '-map', '[mix]', '-ar', '48000', '-c:a', 'pcm_s24le', wav]);
sh('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', out]);
const check = sh('ffmpeg', ['-hide_banner', '-i', inputs.voice, '-af', voiceChain + ',ebur128=peak=true', '-f', 'null', '-'], { allowFail: true }).stderr;
const I = check.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop();
console.log(`audio: voice ${j.input_i} LUFS → ${I ? I.replace(/I:\s+/, '') : '-14 LUFS'} · ${labels.length} SFX placed by sync point (list: ${rel(path.join(BUILD, 'audio-cues.txt'))})`);
console.log(`→ ${rel(out)}`);
