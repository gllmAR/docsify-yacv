import { normalizeKey } from './util.js';

/** Fence languages whose body is build123d / Python source executed in-browser. */
export const CODE_LANGS = new Set([
  'build123d',
  'b3d',
  'b123d',
  'yacv-build123d',
  'yacv-b3d',
  'yacv-py',
  'yacv-python',
]);

/** Fence languages whose body is a list of GLB/GLTF (or .py) URLs. */
export const MODEL_LANGS = new Set(['yacv', 'yacv-model', 'yacv-models']);

/** Languages that can be turned into a live playground with the `yacv` flag. */
const PYTHON_LANGS = new Set(['python', 'py', 'python3']);

/**
 * Parses a markdown fence info string (`build123d height=520 title="My part"`)
 * into a language + attribute map.
 *
 * Values may be single- or double-quoted to contain spaces. Bare words become
 * boolean flags (`yacv` -> `{ yacv: true }`).
 *
 * @param {string} info
 * @returns {{ lang: string, attrs: Record<string, string | true> }}
 */
export function parseInfoString(info) {
  const tokens = [];
  let current = '';
  let quote = null;
  const text = info == null ? '' : String(info);
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  const lang = (tokens.shift() || '').toLowerCase();
  const attrs = {};
  for (const token of tokens) {
    const eq = token.indexOf('=');
    if (eq < 0) {
      attrs[normalizeKey(token)] = true;
    } else {
      const key = normalizeKey(token.slice(0, eq));
      if (key) attrs[key] = token.slice(eq + 1);
    }
  }
  return { lang, attrs };
}

/**
 * Decides whether a fenced block should be turned into a viewer.
 *
 * @param {string} lang Fence language (lowercase).
 * @param {Record<string, string | true>} attrs Parsed fence attributes.
 * @returns {'code' | 'model' | null}
 */
export function classifyFence(lang, attrs = {}) {
  if (CODE_LANGS.has(lang)) return 'code';
  if (MODEL_LANGS.has(lang)) return 'model';
  if (PYTHON_LANGS.has(lang) && (attrs.yacv || attrs.b3d || attrs.build123d || attrs.live)) return 'code';
  return null;
}

/**
 * True when a text body looks like Python/build123d source rather than a list
 * of model URLs. Used to make a plain ```yacv fence "just work".
 *
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikePython(text) {
  return /^\s*(?:from\s+[\w.]+\s+import\b|import\s+[\w.]+|def\s+\w+\s*\(|class\s+\w+|with\s+[\w.]+\s*\(|show(?:_object)?\s*\()/m.test(
    text || '',
  );
}

/**
 * Splits the body of a ```yacv fence into model URLs and Python file URLs.
 * Blank lines and `#` comments are ignored.
 *
 * @param {string} text
 * @returns {{ models: string[], codeFiles: string[] }}
 */
export function parseModelBlock(text) {
  const models = [];
  const codeFiles = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const path = line.split(/[?#]/, 1)[0].toLowerCase();
    if (/\.(?:py|py\.gz)$/.test(path)) codeFiles.push(line);
    else models.push(line);
  }
  return { models, codeFiles };
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isPythonUrl(url) {
  return /\.(?:py|py\.gz)(?:[?#].*)?$/i.test(String(url || '').trim());
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isModelUrl(url) {
  return /\.(?:glb|gltf)(?:[?#].*)?$/i.test(String(url || '').trim());
}

/**
 * Makes `<yacv>` + `<script>` blocks robust against markdown's HTML-block rules
 * by ensuring blank lines after the opening tag and before the closing tag.
 * Fenced code blocks are left untouched.
 *
 * Without this, a `<yacv>` line opens an HTML block that ends at the first blank
 * line inside the Python source, and markdown turns the rest of the script into
 * paragraphs (which are then swallowed verbatim by the browser's `<script>`).
 *
 * @param {string} markdown
 * @returns {string}
 */
export function normalizeTagWhitespace(markdown) {
  const text = String(markdown == null ? '' : markdown);
  if (!/<yacv\b/i.test(text)) return text;

  const lines = text.split('\n');
  const out = [];
  /** @type {{ char: string, length: number } | null} */
  let fence = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);

    if (fence) {
      out.push(line);
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.char &&
        fenceMatch[1].length >= fence.length &&
        /^ {0,3}[`~]+\s*$/.test(line)
      ) {
        fence = null;
      }
      continue;
    }

    if (fenceMatch) {
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      out.push(line);
      continue;
    }

    if (/^ {0,3}<yacv\b/i.test(line)) {
      out.push(line);
      if (!/<\/yacv>/i.test(line)) {
        const next = lines[i + 1];
        if (next !== undefined && next.trim() !== '') out.push('');
      }
      continue;
    }

    if (/^ {0,3}<\/yacv>/i.test(line)) {
      const previous = out[out.length - 1];
      if (previous !== undefined && previous.trim() !== '') out.push('');
      out.push(line);
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}
