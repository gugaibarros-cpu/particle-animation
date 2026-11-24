const done = new Set<string>();
/** Inject a <style> once per id (keyframes and pseudo-element rules that inline styles can't express). */
export function injectCss(id: string, css: string) {
  if (typeof document === 'undefined' || done.has(id)) return;
  done.add(id);
  const s = document.createElement('style'); s.dataset.fx = id; s.textContent = css; document.head.appendChild(s);
}
