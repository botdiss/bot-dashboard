// Generative liquid texture (WebGL fragment shader): domain-warped noise in the reel palette with a
// glossy surface. It lives in "panel space", so the camera can push from a small panel right into it.
import * as THREE from 'three';
import { W, H, lerp, prog, ease, smooth } from './util.js';

export const PANEL = { x: 370, y: 300, w: 760, h: 428, r: 14 };          // scene-2 coordinates
export const PC = { x: PANEL.x + PANEL.w / 2, y: PANEL.y + PANEL.h / 2 };
const ZP = (W / PANEL.w) * 1.14;

// Camera for the push: how scene-2 space maps to the screen at time t (continues drifting in scene 3).
export function pushView(R, t) {
  const [a, b] = R.X.x23, u = ease.io3(prog(t, a, b));
  const Z = Math.exp(Math.log(ZP) * u) * (1 + 0.03 * Math.max(0, t - b));
  return { u, Z, cx: lerp(PC.x, W / 2, smooth(u)), cy: lerp(PC.y, H / 2, smooth(u)) };
}

export function makeLiquid(R) {
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { uCenter: { value: new THREE.Vector2() }, uScale: { value: 1 }, uTime: { value: 0 }, uDim: { value: 0 } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec2 uCenter; uniform float uScale, uTime, uDim;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for(int i=0;i<4;i++){ s += a*noise(p); p = m*p; a *= 0.5; } return s; }
      vec3 srgb(float r, float g, float b){ return pow(vec3(r,g,b)/255.0, vec3(2.2)); }
      void main(){
        vec2 p = (gl_FragCoord.xy - uCenter) / uScale / 428.0; float t = uTime;
        vec2 q = vec2(fbm(p*1.7 + vec2(0.0, t*0.09)), fbm(p*1.7 + vec2(5.2, 1.3) - t*0.07));
        vec2 r = vec2(fbm(p*1.7 + 3.4*q + vec2(1.7, 9.2) + t*0.12), fbm(p*1.7 + 3.4*q + vec2(8.3, 2.8) - t*0.10));
        float f = fbm(p*1.7 + 3.6*r);
        vec3 c = mix(srgb(17.,18.,31.), srgb(66.,66.,111.), smoothstep(0.15, 0.55, f));
        c = mix(c, srgb(109.,91.,166.), smoothstep(0.35, 0.8, length(q)));
        c = mix(c, srgb(169.,155.,214.), smoothstep(0.45, 0.95, r.y*1.25));
        c = mix(c, srgb(240.,138.,138.), smoothstep(0.52, 0.86, r.x*f*2.3));
        c = mix(c, srgb(255.,214.,201.), smoothstep(0.62, 0.9, f*f*2.6));
        // glossy film: screen-space gradient of the height field as a normal
        vec3 n = normalize(vec3(-dFdx(f), -dFdy(f), 0.012 * 1.0 / max(uScale, 0.2)));
        float spec = pow(max(dot(n, normalize(vec3(-0.35, 0.55, 0.75))), 0.0), 26.0);
        c += vec3(1.0, 0.92, 0.88) * spec * 0.55; c *= 0.82 + 0.3 * n.y;
        c = mix(c, srgb(17.,18.,31.), uDim);
        c = pow(max(c, 0.0), vec3(1.0/2.2)) + (hash(gl_FragCoord.xy + t) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tri = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)), mat); tri.frustumCulled = false; scene.add(tri);
  return {
    // cx, cy: where the panel centre is on screen (canvas coords, y down); scale: screen px per panel px
    render(t, { cx, cy, scale, dim = 0 }) {
      mat.uniforms.uCenter.value.set(cx, H - cy); mat.uniforms.uScale.value = scale; mat.uniforms.uTime.value = t; mat.uniforms.uDim.value = dim;
      R.renderer.render(scene, cam);
    },
  };
}
