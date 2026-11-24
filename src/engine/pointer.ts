import { damp } from './math';

/** Tracks the pointer relative to an element; `x/y` are raw px, `sx/sy` are damped, `vx/vy` velocity (px/s). */
export class PointerTracker {
  x = 0; y = 0; sx = 0; sy = 0; vx = 0; vy = 0; inside = false;
  /** 0..1 presence, eased in/out — useful as a shader uniform. */
  presence = 0;
  private px = 0; private py = 0;
  private off: Array<() => void> = [];

  constructor(private el: HTMLElement, private stiffness = 8) {
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.x = e.clientX - r.left; this.y = e.clientY - r.top;
      if (!this.inside) { this.sx = this.x; this.sy = this.y; this.px = this.x; this.py = this.y; }
      this.inside = true;
    };
    const leave = () => { this.inside = false; };
    window.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave);
    this.off.push(() => window.removeEventListener('pointermove', move), () => el.removeEventListener('pointerleave', leave));
  }

  update(dt: number) {
    this.sx = damp(this.sx, this.x, this.stiffness, dt);
    this.sy = damp(this.sy, this.y, this.stiffness, dt);
    this.vx = dt ? (this.x - this.px) / dt : 0; this.vy = dt ? (this.y - this.py) / dt : 0;
    this.px = this.x; this.py = this.y;
    this.presence = damp(this.presence, this.inside ? 1 : 0, 5, dt);
  }
  destroy() { this.off.forEach((f) => f()); }
}
