import React, { useEffect, useRef } from 'react';
import { Renderer, Program, Triangle, Mesh } from 'ogl';

// WebGL light rays for the workspace chooser's background.
//
// Ported from the TypeScript/Tailwind original, with four changes that matter
// for how this app uses it:
//
// 1. TWO colours, not one. The shader mixes petrol into violet across the
//    beam, so the light carries the Siemens Energy pair rather than a single
//    flat tint. That is the whole reason it is here.
//
// 2. The GL context is explicitly released on unmount. The original only
//    removed the canvas, which is fine for a page that mounts the effect once.
//    This chooser mounts and unmounts on every workspace switch, and browsers
//    cap a page at roughly 16 live WebGL contexts -- without releasing them,
//    switching workspaces a dozen times would exhaust the cap and the effect
//    would silently stop appearing.
//
// 3. It fails quietly. If WebGL is unavailable or the context is refused, the
//    component renders nothing and the CSS aurora underneath simply remains.
//    A background effect must never be able to take the screen down with it.
//
// 4. Reduced motion slows it to a drift rather than removing it, matching how
//    the rest of this app treats that preference.

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [1, 1, 1];
};

function anchorAndDir(origin, w, h) {
  const outside = 0.2;
  switch (origin) {
    case 'top-left': return { anchor: [0, -outside * h], dir: [0.7, 0.7] };
    case 'top-right': return { anchor: [w, -outside * h], dir: [-0.7, 0.7] };
    case 'left': return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
    case 'right': return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
    case 'bottom-left': return { anchor: [0, (1 + outside) * h], dir: [0.7, -0.7] };
    case 'bottom-center': return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-right': return { anchor: [w, (1 + outside) * h], dir: [-0.7, -0.7] };
    default: return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
  }
}

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform vec3  raysColor2;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float d = distortion * sin(iTime * 1.5 + length(sourceToCoord) * 0.005);
  float distortedAngle = cosAngle + d;

  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float dist = length(sourceToCoord);
  float maxDistance = max(iResolution.x, iResolution.y) * rayLength;
  float lengthFalloff = clamp((maxDistance - dist) / maxDistance, 0.0, 1.0);

  float fadeFactor = fadeDistance * max(iResolution.x, iResolution.y);
  float fadeFalloff = clamp((fadeFactor - dist) / fadeFactor, 0.0, 1.0);

  float pulse = pulsating > 0.5 ? (0.85 + 0.15 * sin(iTime * speed * 4.0)) : 1.0;

  float baseStrength = clamp(
    (0.5 + 0.2 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed * 0.8)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void main() {
  vec2 coord = gl_FragCoord.xy;

  vec2 finalRayDir = normalize(rayDir);
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(finalRayDir, mouseDirection, mouseInfluence));
  }

  float r1 = rayStrength(rayPos, finalRayDir, coord, 45.2, 31.4, 0.8 * raysSpeed);
  float r2 = rayStrength(rayPos, finalRayDir, coord, 28.5, 19.8, 1.2 * raysSpeed);
  float r3 = rayStrength(rayPos, finalRayDir, coord, 12.1, 56.2, 0.5 * raysSpeed);

  float combined = (r1 * 0.4 + r2 * 0.4 + r3 * 0.2);
  combined = pow(combined, 0.7);
  combined *= 1.5;

  // The brand pair, mixed across the screen and drifting slowly, so the beam
  // reads as petrol running into violet rather than one flat colour.
  float blend = clamp(vUv.x * 0.85 + 0.18 * sin(iTime * 0.18), 0.0, 1.0);
  vec3 tint = mix(raysColor, raysColor2, blend);
  vec3 finalColor = tint * combined;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.05);
    finalColor *= (1.0 - noiseAmount + noiseAmount * n);
  }

  if (saturation != 1.0) {
    float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));
    finalColor = mix(vec3(gray), finalColor, saturation);
  }

  gl_FragColor = vec4(finalColor, combined);
}`;

export default function LightRays({
  raysOrigin = 'top-center',
  raysColor = '#009999',
  raysColor2 = '#641e8c',
  raysSpeed = 1,
  lightSpread = 1,
  rayLength = 2,
  pulsating = false,
  fadeDistance = 1,
  saturation = 1,
  followMouse = true,
  mouseInfluence = 0.1,
  noiseAmount = 0,
  distortion = 0,
  className = '',
}) {
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const speed = reduced ? raysSpeed * 0.25 : raysSpeed;

    let renderer;
    let frame = 0;
    let disposed = false;
    const smooth = { x: 0.5, y: 0.5 };

    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: true });
    } catch (e) {
      // No WebGL, or the context was refused. The CSS aurora underneath stands
      // in on its own; a background flourish must not break the screen.
      return undefined;
    }

    const gl = renderer.gl;
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.display = 'block';
    container.appendChild(gl.canvas);

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },
      raysColor: { value: hexToRgb(raysColor) },
      raysColor2: { value: hexToRgb(raysColor2) },
      raysSpeed: { value: speed },
      lightSpread: { value: lightSpread },
      rayLength: { value: rayLength },
      pulsating: { value: pulsating ? 1 : 0 },
      fadeDistance: { value: fadeDistance },
      saturation: { value: saturation },
      mousePos: { value: [0.5, 0.5] },
      mouseInfluence: { value: reduced ? 0 : mouseInfluence },
      noiseAmount: { value: noiseAmount },
      distortion: { value: distortion },
    };

    const mesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program: new Program(gl, { vertex: VERT, fragment: FRAG, uniforms, transparent: true }),
    });

    const place = () => {
      if (!containerRef.current) return;
      const { clientWidth: wCss, clientHeight: hCss } = containerRef.current;
      renderer.setSize(wCss, hCss);
      const w = wCss * renderer.dpr;
      const h = hCss * renderer.dpr;
      uniforms.iResolution.value = [w, h];
      const { anchor, dir } = anchorAndDir(raysOrigin, w, h);
      uniforms.rayPos.value = anchor;
      uniforms.rayDir.value = dir;
    };

    const loop = (t) => {
      if (disposed) return;
      uniforms.iTime.value = t * 0.001;
      if (followMouse && !reduced && mouseInfluence > 0) {
        const s = 0.95;
        smooth.x = smooth.x * s + mouseRef.current.x * (1 - s);
        smooth.y = smooth.y * s + mouseRef.current.y * (1 - s);
        uniforms.mousePos.value = [smooth.x, 1 - smooth.y];
      }
      renderer.render({ scene: mesh });
      frame = requestAnimationFrame(loop);
    };

    const onMove = (e) => {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return;
      mouseRef.current = {
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
      };
    };

    window.addEventListener('resize', place);
    if (followMouse && !reduced) window.addEventListener('mousemove', onMove);
    place();
    frame = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.removeEventListener('mousemove', onMove);
      gl.canvas.parentNode?.removeChild(gl.canvas);
      // Hand the context back. Browsers allow only a handful per page, and this
      // component remounts on every workspace switch.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    raysOrigin, raysColor, raysColor2, raysSpeed, lightSpread, rayLength,
    pulsating, fadeDistance, saturation, followMouse, mouseInfluence,
    noiseAmount, distortion,
  ]);

  return <div ref={containerRef} className={`light-rays ${className}`.trim()} aria-hidden="true" />;
}
