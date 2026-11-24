/** 2D stable-fluids on WebGL2 (semi-Lagrangian advection + Jacobi pressure solve), ping-pong half-float textures. */
const VS = `#version 300 es
in vec2 p; out vec2 vUv; void main(){ vUv=p*.5+.5; gl_Position=vec4(p,0.,1.); }`;
const HDR = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform vec2 uTexel;`;
const FS = {
  advect: `${HDR} uniform sampler2D uVel, uSrc; uniform float uDt, uDiss;
    void main(){ vec2 c=vUv-uDt*texture(uVel,vUv).xy*uTexel; o=texture(uSrc,c)/(1.+uDiss); }`,
  splat: `${HDR} uniform sampler2D uSrc; uniform vec2 uPoint; uniform vec3 uColor; uniform float uAspect, uRadius;
    void main(){ vec2 d=vUv-uPoint; d.x*=uAspect; vec3 s=exp(-dot(d,d)/uRadius)*uColor; o=vec4(texture(uSrc,vUv).rgb+s,1.); }`,
  div: `${HDR} uniform sampler2D uVel;
    void main(){ float L=texture(uVel,vUv-vec2(uTexel.x,0.)).x,R=texture(uVel,vUv+vec2(uTexel.x,0.)).x,B=texture(uVel,vUv-vec2(0.,uTexel.y)).y,T=texture(uVel,vUv+vec2(0.,uTexel.y)).y; o=vec4(.5*(R-L+T-B),0.,0.,1.); }`,
  press: `${HDR} uniform sampler2D uP, uDiv;
    void main(){ float L=texture(uP,vUv-vec2(uTexel.x,0.)).x,R=texture(uP,vUv+vec2(uTexel.x,0.)).x,B=texture(uP,vUv-vec2(0.,uTexel.y)).x,T=texture(uP,vUv+vec2(0.,uTexel.y)).x; o=vec4((L+R+B+T-texture(uDiv,vUv).x)*.25,0.,0.,1.); }`,
  grad: `${HDR} uniform sampler2D uP, uVel;
    void main(){ float L=texture(uP,vUv-vec2(uTexel.x,0.)).x,R=texture(uP,vUv+vec2(uTexel.x,0.)).x,B=texture(uP,vUv-vec2(0.,uTexel.y)).x,T=texture(uP,vUv+vec2(0.,uTexel.y)).x; o=vec4(texture(uVel,vUv).xy-.5*vec2(R-L,T-B),0.,1.); }`,
  show: `${HDR} uniform sampler2D uSrc; void main(){ vec3 c=texture(uSrc,vUv).rgb; c=1.-exp(-c*1.6); o=vec4(c,max(max(c.r,c.g),c.b)); }`,
};

type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };
type Pair = { read: Target; write: Target; swap(): void };

export function createFluid(canvas: HTMLCanvasElement, opts: { simRes?: number; dyeRes?: number } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false }); if (!gl) return null;
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;
  const sim = opts.simRes ?? 128, dye = opts.dyeRes ?? 512;
  const mk = (t: number, s: string) => { const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader'); return sh; };
  const progs: Record<string, { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }> = {}; const vs = mk(gl.VERTEX_SHADER, VS);
  for (const [k, src] of Object.entries(FS)) { const p = gl.createProgram()!; gl.attachShader(p, vs); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, src)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link'); progs[k] = { p, u: new Proxy({}, { get: (_t, n: string) => gl.getUniformLocation(p, n) }) as any }; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const target = (w: number, h: number): Target => { const tex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null); const fbo = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); return { tex, fbo, w, h }; };
  const pair = (w: number, h: number): Pair => { const a = target(w, h), b = target(w, h); const p: Pair = { read: a, write: b, swap() { const t = p.read; p.read = p.write; p.write = t; } }; return p; };
  const aspect = () => canvas.width / Math.max(1, canvas.height); const sz = (r: number) => { const a = aspect(); return a >= 1 ? [Math.round(r * a), r] : [r, Math.round(r / a)]; };
  let [sw, sh] = sz(sim), [dw, dh] = sz(dye);
  let vel = pair(sw, sh), den = pair(dw, dh), prs = pair(sw, sh); const dvg = target(sw, sh);

  const bindTex = (u: WebGLUniformLocation | null, t: Target, unit: number) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.uniform1i(u, unit); };
  const blit = (dst: Target | null) => { if (dst) { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo); gl.viewport(0, 0, dst.w, dst.h); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); } gl.drawArrays(gl.TRIANGLES, 0, 3); };
  const use = (n: string, t: Target) => { gl.useProgram(progs[n].p); gl.uniform2f(progs[n].u.uTexel, 1 / t.w, 1 / t.h); return progs[n].u; };

  return {
    splat(x: number, y: number, dx: number, dy: number, color: [number, number, number], radius = .0035) { // x,y in 0..1 (y up)
      let u = use('splat', vel.read); bindTex(u.uSrc, vel.read, 0); gl.uniform2f(u.uPoint, x, y); gl.uniform3f(u.uColor, dx, dy, 0); gl.uniform1f(u.uAspect, aspect()); gl.uniform1f(u.uRadius, radius); blit(vel.write); vel.swap();
      u = use('splat', den.read); bindTex(u.uSrc, den.read, 0); gl.uniform2f(u.uPoint, x, y); gl.uniform3f(u.uColor, ...color); gl.uniform1f(u.uAspect, aspect()); gl.uniform1f(u.uRadius, radius * 1.4); blit(den.write); den.swap(); },
    step(dt: number, opts2: { velDiss?: number; denDiss?: number; iters?: number } = {}) {
      const { velDiss = .2, denDiss = 1.1, iters = 18 } = opts2;
      let u = use('advect', vel.read); bindTex(u.uVel, vel.read, 0); bindTex(u.uSrc, vel.read, 1); gl.uniform1f(u.uDt, dt * 60); gl.uniform1f(u.uDiss, velDiss * dt); blit(vel.write); vel.swap();
      u = use('div', vel.read); bindTex(u.uVel, vel.read, 0); blit(dvg);
      for (let i = 0; i < iters; i++) { u = use('press', prs.read); bindTex(u.uP, prs.read, 0); bindTex(u.uDiv, dvg, 1); blit(prs.write); prs.swap(); }
      u = use('grad', vel.read); bindTex(u.uP, prs.read, 0); bindTex(u.uVel, vel.read, 1); blit(vel.write); vel.swap();
      u = use('advect', den.read); bindTex(u.uVel, vel.read, 0); bindTex(u.uSrc, den.read, 1); gl.uniform1f(u.uDt, dt * 60); gl.uniform1f(u.uDiss, denDiss * dt); blit(den.write); den.swap(); },
    draw() { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.clear(gl.COLOR_BUFFER_BIT);
      const u = use('show', den.read); bindTex(u.uSrc, den.read, 0); blit(null); gl.disable(gl.BLEND); },
    resize() { const [a, b] = sz(sim), [c, d] = sz(dye); if (a !== sw || c !== dw) { sw = a; sh = b; dw = c; dh = d; vel = pair(sw, sh); den = pair(dw, dh); prs = pair(sw, sh); } },
    destroy() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}
