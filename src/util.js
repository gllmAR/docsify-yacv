/**
 * Small, dependency-free helpers shared by the plugin.
 */

/** @param {unknown} value */
export function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Converts "boolean-ish" strings/numbers (including valueless HTML attributes,
 * which the DOM reports as "") into a boolean.
 *
 * @param {unknown} value
 * @param {boolean} [fallback]
 * @returns {boolean}
 */
export function toBool(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (s === '') return true; // e.g. `<yacv debug>` or the `debug` fence flag
  if (['1', 'true', 'yes', 'on', 'show', 'show-code'].includes(s)) return true;
  if (['0', 'false', 'no', 'off', 'hide', 'none'].includes(s)) return false;
  return fallback;
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
export function toNumber(value, fallback = NaN) {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalizes an embed height to a CSS length.
 *
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function cssSize(value, fallback = '480px') {
  if (value == null || value === '' || value === true) return fallback;
  if (typeof value === 'number') return `${value}px`;
  const s = String(value).trim();
  if (s === '') return fallback;
  if (/^\d*\.?\d+$/.test(s)) return `${s}px`;
  return s;
}

/**
 * Normalizes an attribute name: lowercase and dashes removed.
 * e.g. `show-code`, `showCode`, `show_code` -> `showcode`
 *
 * @param {string} key
 * @returns {string}
 */
export function normalizeKey(key) {
  return String(key).toLowerCase().replace(/-/g, '');
}

/**
 * Normalizes keys used to match yacv settings (`pg_opacity_loading`,
 * `edgeWidth`, `edge-width`, ...) -> `pgopacityloading`, `edgewidth`.
 *
 * @param {string} key
 * @returns {string}
 */
export function normalizeSettingKey(key) {
  return String(key).toLowerCase().replace(/[-_]/g, '');
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function splitList(value) {
  if (value == null || value === true || value === false) return [];
  const values = Array.isArray(value) ? value : String(value).split(/[\s,]+/);
  const out = [];
  for (const v of values) {
    const s = String(v).trim();
    if (s) out.push(s);
  }
  return out;
}

/**
 * Resolves a possibly relative URL. Absolute URLs (including `dev+http://...`,
 * `data:` URIs and protocol-relative URLs) are returned unchanged.
 *
 * @param {string} src
 * @param {string | ((src: string) => string)} [base]
 * @returns {string}
 */
export function resolveUrl(src, base) {
  const s = String(src == null ? '' : src).trim();
  if (!s) return '';
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(s)) return s;
  let baseUrl = typeof base === 'function' ? base(s) : base;
  if (!baseUrl) {
    baseUrl = typeof document !== 'undefined' ? document.baseURI : undefined;
  }
  if (!baseUrl) return s;
  try {
    return new URL(s, baseUrl).href;
  } catch {
    return s;
  }
}

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
export function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand && document.execCommand('copy');
      ta.remove();
      if (ok) resolve();
      else reject(new Error('Copy command failed'));
    } catch (err) {
      ta.remove();
      reject(err);
    }
  });
}

/**
 * @param {Element | null | undefined} el
 * @param {string} selector
 * @returns {HTMLElement[]}
 */
export function findAll(el, selector) {
  if (!el) return [];
  return Array.prototype.slice.call(el.querySelectorAll(selector));
}
