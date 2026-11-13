// Pure helpers: everything in the reel is a function of time, so nothing here keeps state.
export const W = 1920, H = 1080;
export const C = { base: '#11121F', deep: '#0B0C16', indigo: '#42426F', violet: '#6D5BA6', lilac: '#A99BD6', coral: '#F08A8A', peach: '#FFD6C9', paper: '#F4EEE6' };
export const MONO = "'JetBrains Mono', ui-monospace, monospace";
export const SERIF = "'Thmanyah Serif Display', serif";

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const ease = {
  in2: (x) => x * x, in3: (x) => x * x * x, in4: (x) => x * x * x * x,
  out2: (x) => 1 - (1 - x) * (1 - x), out3: (x) => 1 - (1 - x) ** 3, out4: (x) => 1 - (1 - x) ** 4, out5: (x) => 1 - (1 - x) ** 5,
  io2: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2), io3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  io5: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)), inExpo: (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2,
  // damped spring that overshoots and settles at 1
  spring: (x, freq = 3.2, damp = 6) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-damp * x) * Math.cos(freq * Math.PI * x) * (1 - x)),
};
// numerical velocity of f at t (units per second) — used for motion-blur amounts
export const vel = (f, t, d = 1 / 120) => (f(t + d) - f(t - d)) / (2 * d);

// deterministic hash / noise
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
export const hash2 = (x, y) => hash(x * 12.9898 + y * 78.233 + 0.5);
export const noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
export const noise2 = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(i, j), hash2(i + 1, j), ux), lerp(hash2(i, j + 1), hash2(i + 1, j + 1), ux), uy); };

// Catmull-Rom through keyframes [{t, v}] (v number or array), zero velocity at both ends
export function spline(keys, t) {
  const n = keys.length; if (t <= keys[0].t) return keys[0].v; if (t >= keys[n - 1].t) return keys[n - 1].v;
  let i = 0; while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[i], k1 = keys[i + 1], h = k1.t - k0.t, u = (t - k0.t) / h;
  const tan = (j, c) => { if (j === 0 || j === n - 1) return 0; const a = keys[j - 1], b = keys[j + 1]; return ((c(b.v) - c(a.v)) / (b.t - a.t)) * (keys[j].tension ?? 1); };
  const one = (c) => { const p0 = c(k0.v), p1 = c(k1.v), m0 = tan(i, c) * h, m1 = tan(i + 1, c) * h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1; };
  return Array.isArray(k0.v) ? k0.v.map((_, d) => one((v) => v[d])) : one((v) => v);
}
export const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgba = (h, a) => { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };
export const mix = (h1, h2, t) => { const a = hex2rgb(h1), b = hex2rgb(h2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], clamp(t)))).join(',')})`; };
export const pad = (n, l) => String(Math.max(0, Math.round(n))).padStart(l, '0');
export function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
// cover-fit rectangle of an image inside a box, with a focus point (0..1) and extra zoom
export function cover(iw, ih, bw, bh, zoom = 1, fx = 0.5, fy = 0.5) { const s = Math.max(bw / iw, bh / ih) * zoom, w = iw * s, h = ih * s; return { x: (bw - w) * fx, y: (bh - h) * fy, w, h }; }
