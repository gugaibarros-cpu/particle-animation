/** Single shared requestAnimationFrame loop. Every effect subscribes instead of owning its own RAF. */
export type Tick = (time: number, delta: number) => void;

const subs = new Set<Tick>();
let raf = 0;
let last = 0;

function frame(now: number) {
  const t = now / 1000;
  const dt = Math.min(0.05, last ? t - last : 0.016); // clamp so tab-switch doesn't explode sims
  last = t;
  subs.forEach((fn) => fn(t, dt));
  raf = subs.size ? requestAnimationFrame(frame) : 0;
}

export function subscribe(fn: Tick): () => void {
  subs.add(fn);
  if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  return () => { subs.delete(fn); };
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
