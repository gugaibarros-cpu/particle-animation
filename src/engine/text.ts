/** Split a string into animatable units while keeping the original readable by assistive tech. */
export type Unit = { text: string; index: number; word: number };

export function splitText(text: string, by: 'chars' | 'words' = 'chars'): Unit[] {
  const out: Unit[] = []; let i = 0;
  text.split(/(\s+)/).forEach((chunk, w) => {
    if (!chunk) return;
    if (/^\s+$/.test(chunk)) { out.push({ text: ' ', index: i++, word: w }); return; }
    if (by === 'words') out.push({ text: chunk, index: i++, word: w });
    else for (const ch of Array.from(chunk)) out.push({ text: ch, index: i++, word: w });
  });
  return out;
}

/** Pure stagger: returns each unit's delay (s) for an ordering mode. */
export function stagger(count: number, step: number, from: 'start' | 'end' | 'center' | 'random' = 'start') {
  return Array.from({ length: count }, (_, i) => {
    switch (from) {
      case 'end': return (count - 1 - i) * step;
      case 'center': return Math.abs(i - (count - 1) / 2) * step;
      case 'random': return Math.random() * count * step;
      default: return i * step;
    }
  });
}
