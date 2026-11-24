/** Pure mesh helpers (no DOM): OBJ and GLB parsers returning the same shape the viewer draws. */
export type Mesh = { pos: Float32Array; nor: Float32Array; idx: Uint32Array };

/** Smooth per-vertex normals from triangles (used when the file has none). */
export function computeNormals(pos: Float32Array, idx: Uint32Array): Float32Array {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/** Center on the origin and scale so the farthest vertex sits at `radius`. */
export function fitMesh(m: Mesh, radius = 1.4): Mesh {
  const p = m.pos; const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]); }
  const c = [0, 1, 2].map((k) => (min[k] + max[k]) / 2); let r = 0;
  for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i] - c[0], p[i + 1] - c[1], p[i + 2] - c[2]));
  const s = r ? radius / r : 1; const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) { out[i] = (p[i] - c[0]) * s; out[i + 1] = (p[i + 1] - c[1]) * s; out[i + 2] = (p[i + 2] - c[2]) * s; }
  return { pos: out, nor: m.nor, idx: m.idx };
}

/** Wavefront OBJ: v / vn / f (triangles, quads and n-gons are fan-triangulated; negative indices supported). */
export function parseOBJ(text: string): Mesh {
  const V: number[][] = [], N: number[][] = []; const pos: number[] = [], nor: number[] = [], idx: number[] = []; const cache = new Map<string, number>(); let hasN = true;
  const ref = (tok: string): number => {
    const hit = cache.get(tok); if (hit !== undefined) return hit;
    const [vi, , ni] = tok.split('/'); const v = V[(+vi < 0 ? V.length + +vi : +vi - 1)]; if (!v) throw new Error('OBJ: bad vertex index ' + tok);
    pos.push(v[0], v[1], v[2]);
    if (ni) { const n = N[(+ni < 0 ? N.length + +ni : +ni - 1)] ?? [0, 0, 1]; nor.push(n[0], n[1], n[2]); } else { hasN = false; nor.push(0, 0, 0); }
    const id = pos.length / 3 - 1; cache.set(tok, id); return id;
  };
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim(); if (!l || l[0] === '#') continue; const t = l.split(/\s+/);
    if (t[0] === 'v') V.push([+t[1], +t[2], +t[3]]); else if (t[0] === 'vn') N.push([+t[1], +t[2], +t[3]]);
    else if (t[0] === 'f') { const ids = t.slice(1).map(ref); for (let i = 1; i < ids.length - 1; i++) idx.push(ids[0], ids[i], ids[i + 1]); }
  }
  if (!idx.length) throw new Error('OBJ: no faces found');
  const P = new Float32Array(pos), I = new Uint32Array(idx);
  return { pos: P, nor: hasN ? new Float32Array(nor) : computeNormals(P, I), idx: I };
}

const COMP: Record<number, { size: number; read: (d: DataView, o: number) => number }> = {
  5120: { size: 1, read: (d, o) => d.getInt8(o) }, 5121: { size: 1, read: (d, o) => d.getUint8(o) },
  5122: { size: 2, read: (d, o) => d.getInt16(o, true) }, 5123: { size: 2, read: (d, o) => d.getUint16(o, true) },
  5125: { size: 4, read: (d, o) => d.getUint32(o, true) }, 5126: { size: 4, read: (d, o) => d.getFloat32(o, true) },
};
const NCOMP: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** Binary glTF (.glb): reads the FIRST primitive of the FIRST mesh (positions, optional normals, optional indices). No textures/materials/skins. */
export function parseGLB(buf: ArrayBuffer): Mesh {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('GLB: bad magic (not a .glb file)');
  let off = 12, json: any = null, bin: DataView | null = null;
  while (off < dv.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true); const start = off + 8;
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, len)));
    else if (type === 0x004e4942 && !bin) bin = new DataView(buf, start, len);
    off = start + len + ((4 - (len % 4)) % 4);
  }
  if (!json || !bin) throw new Error('GLB: missing JSON or BIN chunk');
  const prim = json.meshes?.[0]?.primitives?.[0]; if (!prim) throw new Error('GLB: no mesh primitive');
  const read = (acc: number): { data: number[]; n: number } => {
    const a = json.accessors[acc], bv = json.bufferViews[a.bufferView], c = COMP[a.componentType], n = NCOMP[a.type];
    const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = bv.byteStride ?? c.size * n; const data: number[] = [];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) data.push(c.read(bin!, base + i * stride + k * c.size));
    return { data, n };
  };
  const pos = new Float32Array(read(prim.attributes.POSITION).data);
  let idx: Uint32Array;
  if (prim.indices !== undefined) idx = new Uint32Array(read(prim.indices).data); else idx = Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
  const nor = prim.attributes.NORMAL !== undefined ? new Float32Array(read(prim.attributes.NORMAL).data) : computeNormals(pos, idx);
  return { pos, nor, idx };
}

/** Pick a parser from the file name. */
export async function loadMeshFile(file: File): Promise<Mesh> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.obj')) return fitMesh(parseOBJ(await file.text()));
  if (name.endsWith('.glb')) return fitMesh(parseGLB(await file.arrayBuffer()));
  throw new Error('Formato não suportado: use .obj ou .glb');
}
