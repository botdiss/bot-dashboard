// Whole pipeline. `npm run build` stops after the stills so they can be approved;
// `npm run build -- --final` goes on to the full-resolution render and the sound mix.
import { run, arg } from './lib.mjs';
const node = (script, ...a) => run(process.execPath, [`scripts/${script}`, ...a]);
await node('check.mjs'); await node('plan.mjs'); await node('fetch-assets.mjs'); await node('prep.mjs');
await node('render.mjs', '--stills'); await node('prep.mjs');   // second prep registers the reel frames used on the grid cards
if (arg('final')) { await node('render.mjs'); await node('audio.mjs'); }
else if (arg('preview')) { await node('render.mjs', '--scale', '0.5', '--jpeg'); await node('audio.mjs', '--preview'); }
else console.log('\nStills are in out/stills. When they look right:  npm run build -- --final');
