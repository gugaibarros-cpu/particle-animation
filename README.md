# particle-animation

A small, dependency-free WebGL2 animation engine for React, the rules it was built under, and two helpers used for
particle visuals: a sprite-sheet reader and a globe point generator. No `three`, `ogl` or `gsap`.

## What is in here

| Path | What it is |
| :--- | :--- |
| `src/engine/` | The engine: one shared RAF loop (`loop`), smoothed pointer tracking (`pointer`), WebGL2 fragment-shader runner with texture support (`shader`), stable-fluids solver (`fluid`), text splitting and stagger (`text`), OBJ/GLB parsers (`mesh`), React hooks (`hooks`), CSS injection (`css`), math helpers (`math`). About 26 KB of TypeScript. |
| `docs/guidelines.md` | The rules every effect follows: single loop, frame-rate independent damping, reduced motion, off-screen pause, accessible text. |
| `sprite-sheets/` | `orb-mini.cjs`: a reader that turns `(shape, state, size, color, dpr)` into a sheet URL, a cell rectangle and a frame rate, from a `manifest.json`. Format in `docs/sprite-sheets.md`. The WebP sheets themselves are not included. |
| `globe/` | `gerar-globo-pontos.cjs`: generates ~2,600 land and ~1,070 sea points on a Fibonacci spiral from hand-drawn continent outlines. Output: `globe/pontos.js`. |
| `tests/` | OBJ/GLB parser tests and a check that the globe output matches its generator. |

## Use

```bash
npm install
npm run check   # tsc --noEmit
npm test
```

The engine peer-depends on React (>= 18). Import from `src/engine`:

```ts
import { useShader, useFrame, PointerTracker, damp } from "./src/engine";
```

Pass a GLSL ES 3.00 fragment body (your `main()`); the header declares `uTime`, `uResolution`, `uPointer` and `uPresence`.
Uniforms you pass in `uniforms` are set by name, so declare them in your GLSL with the same name. `textures` entries become
`sampler2D` inputs plus an automatic `<name>Size`.

## Limits

- Not published to npm; copy `src/engine` or build it yourself.
- Performance was checked in a software GL renderer, not measured on real GPUs.
- Comments in `globe/` and `sprite-sheets/` are in Portuguese; names are Portuguese too.
- The continent outlines are coarse. Swap in Natural Earth (public domain) for a real coastline; the output format stays.

## License

MIT, see [LICENSE](LICENSE). All code here is original. Behaviour of some effects was inspired by public demos, but no
third-party source was copied.
