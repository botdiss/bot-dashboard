// The three.js world shared by scenes 6 and 7 (one camera, never cut): glossy extruded logos floating
// above a spot-lit desk with the calendar and the lock. Rendered through a depth-of-field pass.
import * as THREE from 'three';
import { W, H, C } from './util.js';

export const FOV = (2 * Math.atan(H / 2 / 1880) * 180) / Math.PI;

export function getStage(R) {
  if (R.stage3d) return R.stage3d;
  const r = R.renderer; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(C.base);
  scene.environment = R.getEnv(); scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.02, 120);
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(W, H) });
  const post = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uNear: { value: camera.near }, uFar: { value: camera.far }, uFocus: { value: 5 }, uAperture: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, uSeed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      precision highp float; varying vec2 vUv;
      uniform sampler2D tColor, tDepth; uniform float uNear, uFar, uFocus, uAperture, uSeed; uniform vec2 uRes;
      float viewZ(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
      float coc(float z){ return clamp(abs(1.0 / z - 1.0 / uFocus) * uAperture, 0.0, 15.0); }
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        float z0 = viewZ(vUv), c0 = coc(z0); vec3 acc = texture2D(tColor, vUv).rgb; float wsum = 1.0;
        if (uAperture > 0.0) { float rot = hash(gl_FragCoord.xy + uSeed) * 6.2832;
          for (int i = 1; i <= 28; i++) { float fi = float(i), rad = sqrt(fi / 28.0), a = fi * 2.39996 + rot; vec2 o = vec2(cos(a), sin(a)) * rad;
            vec2 uv = vUv + o * 15.0 / uRes; float zt = viewZ(uv), ct = coc(zt), reach = rad * 15.0;
            float w = step(reach, max(ct, zt > z0 ? c0 : 0.0)); acc += texture2D(tColor, uv).rgb * w; wsum += w; } }
        gl_FragColor = vec4(acc / wsum, 1.0);
        #include <colorspace_fragment>
        gl_FragColor.rgb += (hash(gl_FragCoord.xy * 1.7 + uSeed) - 0.5) / 255.0;
      }`,
  });
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tri = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)), post); tri.frustumCulled = false; quadScene.add(tri);
  const stage = {
    scene, camera, pose6: null, pose7: null, handover: 0, shiftX: 0,
    // place the camera for time t (idempotent); both scenes project 2D overlays with it
    setCamera(t) { const p = (t < this.handover ? this.pose6 : this.pose7)(t); camera.position.set(...p.pos); camera.up.set(0, 1, 0); camera.lookAt(...p.target); if (p.roll) camera.rotateZ(p.roll);
      if (this.shiftX) camera.setViewOffset(W, H, -this.shiftX, 0, W, H); else camera.clearViewOffset(); camera.updateMatrixWorld(true); this.focus = p.focus ?? Math.hypot(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]); this.aperture = p.aperture ?? 0; return p; },
    project(v) { const q = v.clone().project(camera); return { x: (q.x * 0.5 + 0.5) * W, y: (-q.y * 0.5 + 0.5) * H, z: q.z }; },
    // world point under a screen position, on the plane z = planeZ
    unproject(x, y, planeZ) { const n = new THREE.Vector3((x / W) * 2 - 1, -(y / H) * 2 + 1, 0.5).unproject(camera), d = n.sub(camera.position).normalize(), k = (planeZ - camera.position.z) / d.z; return camera.position.clone().add(d.multiplyScalar(k)); },
    render(t) { post.uniforms.uFocus.value = this.focus; post.uniforms.uAperture.value = this.aperture; post.uniforms.uSeed.value = (t * 30) % 97;
      r.setRenderTarget(rt); r.setClearColor(C.base, 1); r.clear(); r.render(scene, camera); r.setRenderTarget(null); r.render(quadScene, quadCam); },
  };
  return (R.stage3d = stage);
}
