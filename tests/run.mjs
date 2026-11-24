// Bundles src/engine/mesh.ts and runs the parser tests.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const out = join(mkdtempSync(join(tmpdir(), "pa-")), "mesh.cjs");
await build({ entryPoints: ["src/engine/mesh.ts"], bundle: true, format: "cjs", platform: "node", outfile: out });
execFileSync("node", ["tests/mesh.test.cjs", out], { stdio: "inherit" });
execFileSync("node", ["globe/gerar-globo-pontos.cjs", "--confere"], { stdio: "inherit" });
console.log("ok");
