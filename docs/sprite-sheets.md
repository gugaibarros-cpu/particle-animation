# Sprite-sheet package

For small animated marks (18 to 44 px) where running WebGL is wasteful: pre-render frames once, then draw a cell.

## Layout

```
<shape>/<theme>-<size>@<scale>x.webp     one sheet per shape, theme, size and scale
manifest.json                            shapes, themes, states, frame counts, fps, sizes, scales
```

Each sheet has one row per state and up to `colunas` columns (frames). `manifest.json` in this folder is an example:
12 shape names, 4 themes, sizes 18/28/44, scales 1x/2x, states `repouso`, `ouvindo`, `pensando`, `falando` and `erro`
(rest and error are one frame, the others loop).

## Reader

```js
const O = require("./orb-mini.cjs");
const r = O.criar(manifest, "assets/").lerOrbMini("lumen", "ouvindo", 28, { cor: "ember", dpr: 2 });
// r.url, r.px, r.fps, r.opacidade, r.ajustado (true if the request was rounded to what the package has)
const q = O.quadro(r, tMs);        // frame index at tMs since the state began
const c = O.celula(r, q);          // {sx, sy, w, h} for ctx.drawImage(img, c.sx, c.sy, c.w, c.h, dx, dy, size, size)
```

In CSS, use `background-position` with `steps()` and no JavaScript.

- Sizes and scales are rounded up to the nearest available; unknown shapes or themes fall back to the defaults.
- `movimento` (`calmo`, `normal`, `intenso`) scales the frame rate, not the sheets.
- Loops close by cross-fading the last frames into the first, so there is no jump.
- The reader has no DOM and no network access, so it runs in Node tests.
