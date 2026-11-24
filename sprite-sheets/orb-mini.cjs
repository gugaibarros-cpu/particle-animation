// Leitor de um pacote de sprite-sheets (sem DOM, sem rede): resolve (forma, estado, tamanho, cor, dpr) -> folha + célula + ritmo. UMD: global `OrbMini`.
// Contrato em docs/sprite-sheets.md. Quem desenha (canvas 2D drawImage ou CSS) só usa o que sai daqui.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.OrbMini = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Estados da aplicação -> linha da folha. acordando mostra a linha "ouvindo"; mudo é o repouso mais apagado (opacidade).
  var APELIDO = { acordando: 'ouvindo', mudo: 'repouso' };
  var OPACIDADE = { mudo: 0.55 };
  var MOVIMENTO = { calmo: 0.65, normal: 1, intenso: 1.35 }; // multiplicador do fps
  var PADRAO = { forma: 'lumen', tema: 'ember' };

  // Menor valor disponível >= pedido; se o pedido passa de todos, o maior (a folha é ampliada pelo navegador).
  function mais(lista, v) {
    var ord = lista.slice().sort(function (a, b) { return a - b; });
    for (var i = 0; i < ord.length; i++) if (ord[i] >= v) return ord[i];
    return ord[ord.length - 1];
  }

  // manifest: o manifest.json já lido; base: pasta do pacote (com / no fim).
  function criar(manifest, base) {
    base = base || '';
    // forma: id da forma; estado: da aplicação; tamanho: lado em px CSS; opcoes: { cor, movimento, dpr }
    function lerOrbMini(forma, estado, tamanho, opcoes) {
      var o = opcoes || {};
      var f = manifest.formas[forma] ? forma : PADRAO.forma;
      var tema = manifest.formas[f].temas.indexOf(o.cor) >= 0 ? o.cor : PADRAO.tema;
      var nome = manifest.estados[estado] ? estado : (APELIDO[estado] || 'repouso');
      var e = manifest.estados[nome];
      var tam = mais(manifest.tamanhos, tamanho || 28);
      var esc = mais(manifest.escalas, o.dpr || 1);
      var px = tam * esc, k = MOVIMENTO[o.movimento] || 1;
      return {
        url: base + manifest.arquivo.replace('{forma}', f).replace('{tema}', tema).replace('{tamanho}', tam).replace('{escala}', esc),
        forma: f, tema: tema, estado: nome, tamanho: tam, escala: esc,
        px: px, colunas: manifest.colunas, linha: e.linha, quadros: e.quadros, laco: e.laco,
        fps: e.fps * k * (manifest.formas[f].velocidade || 1), // movimento calmo/normal/intenso e a velocidade da forma (buraco negro) mudam o ritmo, não a folha
        opacidade: OPACIDADE[estado] || 1,
        ajustado: f !== forma || tema !== (o.cor || tema) || tam !== tamanho, // pediram algo que o pacote não tem
      };
    }
    // Índice do quadro no instante t (ms desde que o estado começou); estados de 1 quadro devolvem sempre 0.
    function quadro(info, t) { return info.laco && info.fps > 0 ? Math.floor(t / 1000 * info.fps) % info.quadros : 0; }
    // Retângulo da célula na folha (px da imagem): para drawImage(img, sx, sy, px, px, dx, dy, tamanho, tamanho).
    function celula(info, q) { return { sx: q * info.px, sy: info.linha * info.px, w: info.px, h: info.px }; }
    return { lerOrbMini: lerOrbMini, quadro: quadro, celula: celula };
  }

  return { criar: criar, APELIDO: APELIDO, MOVIMENTO: MOVIMENTO, PADRAO: PADRAO };
});
