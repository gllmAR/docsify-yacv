/**
 * Optionally re-highlight a `<code>` element as Python.
 *
 * docsify highlights unknown fence languages as generic markup. If the docs
 * site loads Prism's Python grammar (`prism-python`), we can do better. This is
 * purely cosmetic: the original text is always preserved (Prism escapes HTML),
 * so the copy button and the code sent to the viewer are unaffected.
 *
 * @param {HTMLElement | SVGElement | null | undefined} codeEl
 * @param {string} code
 * @returns {boolean} Whether Prism's Python grammar was applied.
 */
export function highlightPython(codeEl, code) {
  const Prism = typeof window !== 'undefined' ? window.Prism : undefined;
  if (
    codeEl &&
    Prism &&
    Prism.languages &&
    Prism.languages.python &&
    typeof Prism.highlight === 'function'
  ) {
    try {
      codeEl.innerHTML = Prism.highlight(code, Prism.languages.python, 'python');
      return true;
    } catch {
      // fall through to plain text
    }
  }
  if (codeEl) codeEl.textContent = code;
  return false;
}

/**
 * Re-highlights the `<code>` child of a docsify code block, if possible.
 *
 * @param {HTMLPreElement} pre
 * @param {string} code
 * @returns {void}
 */
export function highlightPrePython(pre, code) {
  const codeEl = pre && pre.querySelector('code');
  if (!codeEl) return;
  if (highlightPython(codeEl, code)) {
    codeEl.classList.add('language-python', 'lang-python');
    pre.classList.add('language-python');
  }
}
