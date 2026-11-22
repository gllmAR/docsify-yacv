/**
 * Lightweight Python editor built on the Pupitre UI code-editor pattern:
 * a transparent textarea over a Prism-highlighted <pre>, with a line gutter.
 * The Pupitre UI stylesheet supplies the visual language; no editor runtime or
 * bundler is needed. If that stylesheet is unavailable, a plain textarea is
 * still fully functional.
 *
 * Visual pattern adapted from pupitre-ui (MIT), spec/CODE.md:
 * https://codeberg.org/gllm/pupitre-ui
 */

const PRISM_CORE = 'https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-core.min.js';
const PRISM_PYTHON = 'https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-python.min.js';

/** @type {Map<string, Promise<boolean>>} */
const styleLoads = new Map();
/** @type {Promise<void> | null} */
let prismPromise = null;

/**
 * @param {string} src
 * @returns {Promise<void>}
 */
function loadScript(src) {
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(script);
  });
}

/**
 * Ensures Prism's Python grammar is available for the highlight overlay. If
 * docsify did not load Prism at all, load the small core too.
 *
 * @returns {Promise<void>}
 */
function ensurePythonGrammar() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (window.Prism && window.Prism.languages && window.Prism.languages.python) return Promise.resolve();
  if (prismPromise) return prismPromise;
  prismPromise = (async () => {
    if (!window.Prism) await loadScript(PRISM_CORE);
    if (window.Prism && (!window.Prism.languages || !window.Prism.languages.python)) {
      await loadScript(PRISM_PYTHON);
    }
  })().catch(() => {});
  return prismPromise;
}

/**
 * @param {string} href
 * @returns {Promise<boolean>}
 */
function loadPuiStyles(href) {
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (!href) return Promise.resolve(false);
  if (styleLoads.has(href)) return styleLoads.get(href);
  const existing = Array.from(document.querySelectorAll('link[data-yacv-pui-css]')).find(
    link => link.dataset.yacvPuiCss === href,
  );
  if (existing && (existing.dataset.loaded || existing.sheet)) {
    const result = Promise.resolve(existing.sheet ? true : existing.dataset.loaded === '1');
    styleLoads.set(href, result);
    return result;
  }
  const link = existing || document.createElement('link');
  const promise = new Promise(resolve => {
    const finish = ok => {
      link.dataset.loaded = ok ? '1' : '0';
      resolve(ok);
    };
    if (existing) {
      link.addEventListener('load', () => finish(true), { once: true });
      link.addEventListener('error', () => finish(false), { once: true });
      setTimeout(() => finish(!!link.sheet), 4000);
      return;
    }
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.yacvPuiCss = href;
    link.addEventListener('load', () => finish(true), { once: true });
    link.addEventListener('error', () => finish(false), { once: true });
    document.head.appendChild(link);
  });
  styleLoads.set(href, promise);
  return promise;
}

/**
 * @param {string} code
 * @returns {string}
 */
function escapeHtml(code) {
  return String(code).replace(/[&<>]/g, ch => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'));
}

/**
 * @param {string} code
 * @returns {string}
 */
function highlightPython(code) {
  const Prism = typeof window !== 'undefined' ? window.Prism : undefined;
  if (Prism && Prism.languages && Prism.languages.python && typeof Prism.highlight === 'function') {
    try {
      return Prism.highlight(code, Prism.languages.python, 'python');
    } catch {
      // fall back to escaped text
    }
  }
  return escapeHtml(code);
}

/**
 * @typedef {Object} CodeEditor
 * @property {() => string} getValue
 * @property {(value: string) => void} setValue
 * @property {() => void} focus
 * @property {() => void} refresh
 * @property {() => void} destroy
 * @property {boolean} pui
 */

/**
 * @param {HTMLElement} host
 * @param {string} value
 * @param {{ onChange?: (value: string) => void, onRun?: () => void, onEscape?: () => void, puiCss?: string, label?: string }} [handlers]
 * @returns {Promise<CodeEditor>}
 */
export function createCodeEditor(host, value, handlers = {}) {
  const styledPromise = loadPuiStyles(handlers.puiCss || '');
  const grammarPromise = ensurePythonGrammar();
  host.textContent = '';

  const label = handlers.label || 'Python code';
  const wrap = document.createElement('div');
  wrap.className = 'yacv-editor-wrap';
  const root = document.createElement('div');
  root.className = 'pui yacv-pui-editor';
  const surface = document.createElement('div');
  surface.className = 'pui-code-editor';
  const gutter = document.createElement('div');
  gutter.className = 'pui-code-gutter';
  gutter.setAttribute('aria-hidden', 'true');
  const highlight = document.createElement('pre');
  highlight.className = 'pui-code-highlight';
  highlight.setAttribute('aria-hidden', 'true');
  const textarea = document.createElement('textarea');
  textarea.className = 'pui-code-input';
  textarea.spellcheck = false;
  textarea.setAttribute('aria-label', label);
  textarea.value = value;
  surface.append(gutter, highlight, textarea);
  root.appendChild(surface);
  wrap.appendChild(root);
  host.appendChild(wrap);

  root.classList.add('is-unstyled');
  surface.classList.add('yacv-editor-textarea');

  let frame = 0;
  let silent = false;
  /**
   * @param {string} next
   */
  const render = next => {
    highlight.innerHTML = `${highlightPython(next)}\n`;
    const lines = next.split('\n').length;
    gutter.textContent = '';
    for (let i = 1; i <= lines; i += 1) {
      const line = document.createElement('span');
      line.textContent = String(i);
      gutter.appendChild(line);
    }
    syncScroll();
  };

  const syncScroll = () => {
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
    gutter.scrollTop = textarea.scrollTop;
  };

  const schedule = () => {
    if (frame) return;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : callback => setTimeout(callback, 16);
    frame = raf(() => {
      frame = 0;
      render(textarea.value);
    });
  };

  /**
   * @param {string} text
   * @param {number} start
   * @param {number} end
   * @param {string} replacement
   */
  const replaceRange = (text, start, end, replacement) => {
    const next = text.slice(0, start) + replacement + text.slice(end);
    textarea.value = next;
    const caret = start + replacement.length;
    textarea.setSelectionRange(caret, caret);
    schedule();
    if (!silent) handlers.onChange?.(next);
  };

  textarea.addEventListener('input', () => {
    render(textarea.value);
    if (!silent) handlers.onChange?.(textarea.value);
  });
  textarea.addEventListener('scroll', syncScroll, { passive: true });
  textarea.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handlers.onRun?.();
      return;
    }
    if (event.key === 'Escape') {
      handlers.onEscape?.();
      return;
    }
    const text = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        // Dedent every selected line by up to four spaces.
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        const block = text.slice(lineStart, end);
        const next = block.replace(/^ {1,4}/gm, '');
        replaceRange(text, lineStart, end, next);
        return;
      }
      replaceRange(text, start, end, '    ');
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const line = text.slice(lineStart, start);
      const indent = (line.match(/^[ \t]*/) || [''])[0];
      const extra = /:\s*(?:#.*)?$/.test(line) ? '    ' : '';
      replaceRange(text, start, end, `\n${indent}${extra}`);
    }
  });

  render(value);
  styledPromise.then(ok => {
    if (!ok) return;
    root.classList.remove('is-unstyled');
    surface.classList.remove('yacv-editor-textarea');
    render(textarea.value);
  });
  grammarPromise.then(() => render(textarea.value));

  return {
    getValue: () => textarea.value,
    setValue: next => {
      silent = true;
      textarea.value = next;
      silent = false;
      render(next);
    },
    focus: () => textarea.focus(),
    refresh: () => {
      render(textarea.value);
      syncScroll();
    },
    destroy: () => wrap.remove(),
  };
}
