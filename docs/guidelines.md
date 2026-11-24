# Guidelines

Rules the engine and every effect built on it follow. Each one exists because breaking it caused a visible problem.

1. **One RAF loop.** Effects subscribe (`subscribe` / `useFrame`) to the shared loop; never create your own
   `requestAnimationFrame`. Delta time is clamped to 50 ms so a background tab does not produce a jump on return.
2. **Damping, not fixed lerp.** Use `damp(a, b, k, dt)`. `lerp(a, b, 0.1)` runs twice as fast at 120 Hz as at 60 Hz.
3. **Pause off screen.** `IntersectionObserver` stops shaders that are not visible. `ResizeObserver` handles size, and
   the device pixel ratio is capped at 2.
4. **Reduced motion.** With `prefers-reduced-motion`, render one static frame.
5. **Accessible text.** Animated text is `aria-hidden` with an `sr-only` copy for screen readers.
6. **Shaders: write only `main()`.** The engine prepends the header and built-in uniforms. Declare your own uniforms
   under the same name you pass in `uniforms`, and avoid names that clash with the built-ins.
7. **No animation libraries.** Keyframes and pseudo-elements go through `injectCss(id, css)`.
8. **Check what you built.** Compiling does not mean it looks right: open the effect, look at it, and watch the
   console for GLSL errors.

## Effect archetypes

| Archetype | Idea | Engine part |
| :--- | :--- | :--- |
| Background shader | Full-screen quad plus fragment shader (noise, domain warping) | `shader` |
| Split text | Split into chars or words, delay by index, keep an `sr-only` copy | `text` |
| Pointer reaction | Damped pointer position, per-element distance drives a visual property | `pointer`, `math` |
| Particles / trail | Spawn along the pointer path, decreasing life, additive blending | `loop` plus 2D canvas |
