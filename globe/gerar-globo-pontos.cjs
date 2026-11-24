'use strict';
// Gera os pontos do globo: ~2.600 em terra e ~1.070 no mar, sobre uma espiral de Fibonacci, com lat/lon em décimos de grau.
// Saída: globe/pontos.js (global GLOBO_PONTOS = { v, terra: [lat, lon, ...], mar: [lat, lon, ...] }), pronta para qualquer renderer de partículas.
//   node globe/gerar-globo-pontos.cjs            grava globe/pontos.js
//   node globe/gerar-globo-pontos.cjs --confere  sai 1 se o arquivo difere do que o gerador produz
// shortcut: contornos grosseiros feitos à mão; trocar por um mapa real (Natural Earth, domínio público) melhora a costa sem mudar o formato.
const fs = require('node:fs');
const path = require('node:path');

const RAD = Math.PI / 180;
const CONT = {
  americaNorte: [[-168, 66], [-140, 70], [-95, 72], [-80, 63], [-60, 55], [-53, 47], [-66, 44], [-76, 35], [-81, 25], [-90, 29], [-97, 26], [-97, 18], [-87, 15], [-83, 9], [-78, 8], [-92, 14], [-105, 20], [-112, 31], [-118, 34], [-124, 40], [-125, 49], [-135, 57], [-152, 58], [-165, 60]],
  groenlandia: [[-55, 60], [-43, 60], [-20, 70], [-20, 80], [-40, 83], [-65, 80], [-58, 75], [-52, 68]],
  americaSul: [[-80, 9], [-72, 12], [-62, 10], [-50, 0], [-35, -6], [-38, -13], [-41, -22], [-48, -28], [-58, -38], [-65, -42], [-68, -52], [-74, -52], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 1]],
  europa: [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [10, 58], [5, 62], [15, 69], [28, 71], [40, 67], [45, 60], [50, 45], [40, 42], [28, 41], [23, 37], [20, 40], [15, 38], [12, 44], [8, 44], [3, 42], [-2, 37]],
  reinoUnido: [[-5, 50], [1, 51], [-1, 55], [-3, 58], [-6, 57], [-5, 54]],
  africa: [[-17, 21], [-13, 28], [-6, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [42, -2], [40, -15], [35, -25], [27, -34], [18, -34], [12, -18], [13, -6], [9, 4], [-8, 4], [-17, 14]],
  madagascar: [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  asia: [[28, 41], [40, 42], [50, 45], [45, 60], [40, 67], [60, 70], [80, 73], [105, 78], [140, 72], [180, 68], [170, 60], [160, 55], [142, 50], [135, 43], [128, 38], [122, 30], [120, 22], [108, 21], [105, 10], [100, 13], [101, 3], [104, 1], [100, 8], [98, 16], [93, 22], [88, 22], [80, 15], [77, 8], [72, 20], [67, 25], [57, 25], [52, 27], [48, 30], [56, 24], [58, 20], [52, 16], [43, 13], [39, 21], [35, 28], [35, 33], [36, 36]],
  japao: [[130, 31], [136, 34], [141, 38], [142, 45], [140, 41], [135, 35]],
  sumatra: [[95, 5], [98, 4], [106, -6], [103, -5]],
  borneu: [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3]],
  australia: [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [141, -38], [135, -35], [129, -32], [115, -34]],
};
const dentro = (pol, lon, lat) => {
  let d = false;
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i], [xj, yj] = pol[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) d = !d;
  }
  return d;
};
const emTerra = (lat, lon) => lat < -72 || Object.values(CONT).some((p) => dentro(p, lon, lat));

const ALVO_TERRA = 2600, ALVO_MAR = 1070;
function gerar() {
  const ouro = Math.PI * (3 - Math.sqrt(5));
  const varre = (N) => {
    const terra = [], mar = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, lat = Math.asin(y) / RAD, lon = ((Math.atan2(Math.sin(ouro * i) * Math.sqrt(1 - y * y), Math.cos(ouro * i) * Math.sqrt(1 - y * y)) / RAD) + 540) % 360 - 180;
      const p = [Math.round(lat * 10), Math.round(lon * 10)];
      (emTerra(lat, lon) ? terra : mar).push(p);
    }
    return { terra, mar };
  };
  let lo = 4000, hi = 60000;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (varre(m).terra.length < ALVO_TERRA) lo = m; else hi = m; }
  const { terra, mar } = varre(hi);
  const passo = mar.length / ALVO_MAR, maisMar = [];
  for (let k = 0; k < ALVO_MAR; k++) maisMar.push(mar[Math.floor(k * passo)]);
  return { v: 1, terra: terra.flat(), mar: maisMar.flat() };
}

const conteudo = () => `// Gerado por globe/gerar-globo-pontos.cjs. Não edite: rode o gerador. lat/lon em décimos de grau: [lat, lon, lat, lon, ...].
globalThis.GLOBO_PONTOS = ${JSON.stringify(gerar())};
`;
const ALVOS = [path.join(__dirname, 'pontos.js')];

if (require.main === module) {
  const c = conteudo(), conf = process.argv.includes('--confere');
  const norma = (t) => t.replace(/\r\n/g, '\n');
  let diff = 0;
  for (const a of ALVOS) {
    const atual = fs.existsSync(a) ? norma(fs.readFileSync(a, 'utf8')) : null;
    if (conf) { if (atual !== c) { console.log('difere: ' + a); diff++; } } else { fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, c); console.log('gravado: ' + a + ' (' + Math.round(c.length / 1024) + ' KB)'); }
  }
  process.exit(diff ? 1 : 0);
}
module.exports = { gerar, conteudo, emTerra, ALVOS, ALVO_TERRA, ALVO_MAR };
