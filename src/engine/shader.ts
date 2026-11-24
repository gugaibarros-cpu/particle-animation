import { subscribe, prefersReducedMotion } from './loop';
import { PointerTracker } from './pointer';

export type Uniform = number | number[];
export type TexSource = HTMLCanvasElement | HTMLImageElement | ImageBitmap;
export interface ShaderOptions {
  /** GLSL ES 3.00 fragment body. Built-ins: uTime, uResolution (px), uPointer (0..1, y up), uPresence. */
  fragment: string;
  uniforms?: Record<string, Uniform>;
  dpr?: number;
  /** Named sampler2D inputs (declare `uniform sampler2D <name>;` in GLSL). `<name>Size` (vec2 px) is set automatically. */
  textures?: Record<string, TexSource>;
  /** Time multiplier; 0 freezes. Reduced-motion forces a single static frame. */
  speed?: number;
}

const VERT = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const HEADER = `#version 300 es
precision highp float;
uniform float uTime; uniform vec2 uResolution; uniform vec2 uPointer; uniform float uPresence;
out vec4 fragColor;
`;

/** Chunks reusable across effects. */
export const GLSL = {
  noise: `
vec3 _perm(vec3 x){ return mod(((x*34.)+1.)*x,289.); }
float snoise(vec2 v){
  const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod(i,289.);
  vec3 p=_perm(_perm(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.); m=m*m; m=m*m;
  vec3 x=2.*fract(p*C.www)-1.; vec3 h=abs(x)-.5; vec3 ox=floor(x+.5); vec3 a0=x-ox;
  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*snoise(p); p*=2.02; a*=.5; } return s; }`,
};

/** Minimal fullscreen-quad runner on raw WebGL2. Returns a disposer and a uniform setter. */
export function createShader(canvas: HTMLCanvasElement, opts: ShaderOptions) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, HEADER + opts.fragment));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link error');
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // oversized triangle
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const locs = new Map<string, WebGLUniformLocation | null>();
  const u = (n: string) => { if (!locs.has(n)) locs.set(n, gl.getUniformLocation(prog, n)); return locs.get(n)!; };
  const setU = (n: string, v: Uniform) => {
    const l = u(n); if (!l) return;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (v.length === 2) gl.uniform2fv(l, v); else if (v.length === 3) gl.uniform3fv(l, v); else if (v.length === 4) gl.uniform4fv(l, v);
    else gl.uniform3fv(l, v); // flat vec3 arrays
  };

  const texs: Record<string, { tex: WebGLTexture; src: TexSource; unit: number }> = {};
  Object.entries(opts.textures ?? {}).forEach(([name, src], unit) => {
    const tex = gl.createTexture()!; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texs[name] = { tex, src, unit }; const l = u(name); if (l) gl.uniform1i(l, unit); upload(name);
  });
  function upload(name: string) {
    const t = texs[name]; if (!t) return; gl!.activeTexture(gl!.TEXTURE0 + t.unit); gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
    gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, true); gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, t.src as TexImageSource);
    const w = (t.src as HTMLCanvasElement).width, h = (t.src as HTMLCanvasElement).height; const l = u(name + 'Size'); if (l) gl!.uniform2f(l, w, h);
  }
  const user = { ...(opts.uniforms ?? {}) };
  const pointer = new PointerTracker(canvas.parentElement ?? canvas, 6);
  const dprCap = opts.dpr ?? Math.min(devicePixelRatio || 1, 2);
  const still = prefersReducedMotion();
  let visible = true;

  const resize = () => {
    const w = Math.max(1, Math.floor(canvas.clientWidth * dprCap)), h = Math.max(1, Math.floor(canvas.clientHeight * dprCap));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(canvas);

  let t = 0;
  const draw = () => {
    for (const k in user) setU(k, user[k]);
    setU('uTime', t); setU('uResolution', [canvas.width, canvas.height]);
    setU('uPointer', [pointer.sx / Math.max(1, canvas.clientWidth), 1 - pointer.sy / Math.max(1, canvas.clientHeight)]);
    setU('uPresence', pointer.presence);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let stop = () => {};
  if (still) { draw(); } else {
    stop = subscribe((_, dt) => {
      if (!visible) return;
      t += dt * (opts.speed ?? 1); pointer.update(dt); resize(); draw();
    });
  }

  return {
    set(name: string, v: Uniform) { user[name] = v; },
    /** Re-upload a texture whose source canvas changed. */
    update(name: string, src?: TexSource) { if (src && texs[name]) texs[name].src = src; upload(name); },
    destroy() { stop(); ro.disconnect(); io.disconnect(); pointer.destroy(); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}
