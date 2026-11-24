// Unit tests for the OBJ/GLB parsers. Run: npx esbuild src/engine/mesh.ts --bundle --format=cjs --platform=node --outfile=<tmp>/mesh.cjs && node tests/mesh.test.cjs <tmp>/mesh.cjs
const assert = require('node:assert/strict');
const { parseOBJ, parseGLB, fitMesh, computeNormals } = require(require('path').resolve(process.argv[2]));

// 1) OBJ: a cube with quads, positive and negative indices, no normals → fan triangulation + computed normals
const cube = `v -1 -1 -1\nv 1 -1 -1\nv 1 1 -1\nv -1 1 -1\nv -1 -1 1\nv 1 -1 1\nv 1 1 1\nv -1 1 1\n` +
  `f 1 4 3 2\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\n`;
let m = parseOBJ(cube);
assert.equal(m.idx.length / 3, 12, 'cube = 12 triangles'); assert.equal(m.pos.length, m.nor.length);
for (let i = 0; i < m.nor.length; i += 3) assert.ok(Math.abs(Math.hypot(m.nor[i], m.nor[i + 1], m.nor[i + 2]) - 1) < 1e-5, 'unit normals');
m = parseOBJ('v 0 0 0\nv 1 0 0\nv 0 1 0\nf -3 -2 -1\n'); assert.equal(m.idx.length, 3, 'negative indices');
m = parseOBJ('v 0 0 0\nv 1 0 0\nv 0 1 0\nvn 0 0 1\nf 1//1 2//1 3//1\n'); assert.deepEqual(Array.from(m.nor.slice(0, 3)), [0, 0, 1], 'explicit normals kept');
assert.throws(() => parseOBJ('v 0 0 0\n'), /no faces/);

// 2) fitMesh: centred and radius 1.4
const f = fitMesh(parseOBJ(cube)); let r = 0; for (let i = 0; i < f.pos.length; i += 3) r = Math.max(r, Math.hypot(f.pos[i], f.pos[i + 1], f.pos[i + 2])); assert.ok(Math.abs(r - 1.4) < 1e-5, 'fit radius');

// 3) GLB: build a one-triangle binary glTF by hand (positions float32 + uint16 indices, byteStride on positions)
const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]); const ind = new Uint16Array([0, 1, 2]);
const bin = Buffer.concat([Buffer.from(pos.buffer), Buffer.from(ind.buffer), Buffer.alloc(2)]);
const json = { asset: { version: '2.0' }, buffers: [{ byteLength: bin.length }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }] };
let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
const glb = Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]); glb.writeUInt32LE(glb.length, 8);
m = parseGLB(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.length));
assert.deepEqual(Array.from(m.pos), Array.from(pos)); assert.deepEqual(Array.from(m.idx), [0, 1, 2]); assert.ok(Math.abs(m.nor[2] - 1) < 1e-6, 'computed normal +Z');
assert.throws(() => parseGLB(new ArrayBuffer(16)), /bad magic/);
console.log('mesh parsers: all tests passed');
