import { useEffect, useRef, useState, type RefObject } from 'react';
import { createShader, type ShaderOptions } from './shader';
import { subscribe, type Tick } from './loop';

/** Mount a fragment shader on a canvas ref; reruns only when the fragment source changes. */
export function useShader(ref: RefObject<HTMLCanvasElement | null>, opts: ShaderOptions) {
  const inst = useRef<ReturnType<typeof createShader>>(null);
  const latest = useRef(opts); latest.current = opts;
  useEffect(() => {
    if (!ref.current) return;
    try { inst.current = createShader(ref.current, latest.current); } catch (e) { console.error(e); }
    return () => { inst.current?.destroy(); inst.current = null; };
  }, [ref, opts.fragment]);
  useEffect(() => { for (const k in opts.uniforms) inst.current?.set(k, opts.uniforms[k]); });
  return inst;
}

export function useFrame(fn: Tick) {
  const f = useRef(fn); f.current = fn;
  useEffect(() => subscribe((t, d) => f.current(t, d)), []);
}

export function useInView<T extends Element>(once = true, threshold = 0.2): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null); const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); if (once) io.disconnect(); } else if (!once) setSeen(false); }, { threshold });
    io.observe(ref.current); return () => io.disconnect();
  }, [once, threshold]);
  return [ref, seen];
}
