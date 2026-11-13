# Voice-cut showreel — one continuous shot, made from code

A 16:9 (1920×1080, 30 fps) motion-graphics showreel cut to a voiceover. Every frame is computed
from time alone inside one HTML page (`seek(t)`), rendered frame by frame with Playwright and
encoded with FFmpeg. There are no cuts and no crossfades: every scene change is a camera move.

## Inputs (put them in this folder)

| File | Use |
|---|---|
| `voice.wav` | the voiceover — the master clock |
| `voice.srt` | the script with exact timings (read as-is, never re-transcribed) |
| `photo.jpg` | portrait for the DM notification and the end card |
| `clips/` | slow-motion clips; names containing `jump`, `dancer`, `splash` are matched to those roles |
| `images/` | 2–3 photos |
| `logos/` | optional PNG logos (transparent or flat background) |
| `fonts/` | optional; otherwise Thmanyah Serif Display and JetBrains Mono are fetched into `vendor/` |
| `direction.json` | the direction sheet for *this* script (see below) |

Footage and photos are never graded: they are drawn straight to the frame in their own colours.

## Run

```bash
npm install            # playwright, three, fonts
npm run check          # Node / FFmpeg / inputs. Stops with install instructions if a tool is missing
npm run build          # plan → assets → prep → stills (out/stills) — stops here for approval
npm run build -- --final     # … then the full 1080p render + sound mix → out/showreel.mp4
npm run build -- --preview   # half-resolution draft with sound → out/showreel-preview.mp4
```

Single steps: `npm run plan` (prints the scene-timing table, writes `build/scene-timing.md`),
`npm run stills`, `npm run render`, `node scripts/audio.mjs`. To scrub by hand: `npm run serve`,
open the printed URL with `?t=12.5`, or call `seek(t)` in the console.
`node scripts/render.mjs --from 24 --to 31` renders a time range.

No inputs yet? `npm run standin` writes labelled placeholders into `standin/` so the pipeline can be
tried. Every frame rendered from them carries a "STAND-IN INPUTS" tag.

## Direction sheet

`direction.json` pins each scene to an SRT line and names the words that drive it. Times are never
typed by hand: `at` values are words from the line, and the planner turns them into timecodes
(pass a number of seconds instead to override).

```jsonc
{
  "identity": { "name": "…", "handles": ["@…", "…"] },
  "scenes": {
    "hook":    { "cue": 1, "key": "…", "keyAt": "…" },
    "prompt":  { "cue": 2, "prompt": "…", "button": "…", "clickAt": "…", "key": "…", "keyAt": "…" },
    "version": { "cue": 3, "label": "VERSION", "number": "3.0", "numberAt": "…", "name": "…", "nameAt": "…" },
    "grid":    { "cue": 4 },
    "media":   { "cue": 5, "words": [ { "text": "…", "at": "…", "fill": "image" }, { "text": "…", "at": "…", "fill": "jump" }, { "text": "…", "at": "…", "fill": "dancer" } ] },
    "brands":  { "cue": 6, "at": ["…", "…"], "key": "…", "keyAt": "…" },
    "date":    { "cue": 7, "day": "…", "month": "…", "weekday": "…", "previous": ["…", "…"], "at": "…", "lockAt": "…" },
    "cta":     { "cue": 8, "headline": "…", "keyword": "…", "keywordAt": "…", "placeholder": "…", "dm": "…", "dmAt": "…" }
  }
}
```

When the script has no version number, date or brand, the scene keeps its technique and takes other
words: the counter locks on any number or short word, the calendar page shows any short word, and
with no `logos/` the brand scene extrudes words from the script instead.

## How it is built

- **One page, one function.** `src/main.js` exposes `seek(t)`. No timers, no CSS transitions, no
  `<video>` playback: clips are pre-extracted to frame sequences and addressed by index, so frames
  can be rendered in any order and in parallel.
- **Layers.** Canvas 2D (type, UI, halftone, waveform) over WebGL (liquid shader, three.js), CSS 3D
  for the card grid, a viewfinder HUD, grain and vignette on top.
- **Arabic.** Always drawn as whole shaped words, right to left. Letters are never animated apart;
  3D type is made by tracing the shaped word's outline (`src/lib/trace.js`).
- **Transitions.** 1→2 whip-zoom into the pupil · 2→3 push into the shader · 3→4 the live frame is
  re-parented into a CSS 3D card and the camera pulls back · 4→5 dive into the next card, which is
  already running the next scene · 5→6 whip-pan · 6→7 whip-tilt · 7→8 push into the keyhole.
- **Render.** `scripts/render.mjs` uses the real GPU through ANGLE and falls back to software WebGL
  only when the machine has none (it prints which one it used).
- **Sound.** Voice normalised to −14 LUFS (two-pass loudnorm). SFX come from the CC0
  [SFX Kit](https://github.com/wyzowl/sfx-kit) and are placed by its rule: start = cue − `sync.at`.
