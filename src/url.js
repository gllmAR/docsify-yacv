import {
  DEFAULT_VIEWER,
  YACV_SETTING_TYPES,
  YACV_SETTINGS_BY_KEY,
  normalizeEditor,
} from './options.js';
import { isPlainObject, normalizeKey, normalizeSettingKey, resolveUrl, splitList, toBool } from './util.js';

/**
 * Coerces a value to the string form expected by yacv's `parseSetting`.
 *
 * @param {string} key Canonical setting name.
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeSettingValue(key, value) {
  const type = YACV_SETTING_TYPES[key];
  if (!type) return null;
  if (value == null) return null;
  switch (type) {
    case 'boolean':
      return toBool(value) ? 'true' : 'false';
    case 'number': {
      const n = typeof value === 'number' ? value : Number(String(value).trim());
      return Number.isFinite(n) ? String(n) : null;
    }
    default:
      return String(value);
  }
}

/**
 * Collects yacv frontend settings from the plugin options and the per-embed
 * attributes. Unknown names are ignored (typos do not silently break a page).
 *
 * @param {Record<string, unknown>} attrs
 * @param {Record<string, unknown>} [optionsSettings]
 * @returns {Record<string, string | number | boolean>}
 */
export function collectSettings(attrs = {}, optionsSettings = {}) {
  /** @type {Record<string, string | number | boolean>} */
  const out = {};
  for (const [key, value] of Object.entries(optionsSettings || {})) {
    const canonical = YACV_SETTINGS_BY_KEY.get(normalizeSettingKey(key));
    if (canonical && value != null) out[canonical] = /** @type {any} */ (value);
  }
  for (const [key, value] of Object.entries(attrs || {})) {
    const canonical = YACV_SETTINGS_BY_KEY.get(normalizeSettingKey(key));
    if (canonical && value != null) out[canonical] = /** @type {any} */ (value);
  }
  return out;
}

/**
 * Normalizes pip constraints into the newline-separated format used by yacv.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeConstraints(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(String).join('\n').trim();
  if (isPlainObject(value)) return JSON.stringify(value);
  return String(value)
    .replace(/\\n/g, '\n')
    .replace(/;/g, '\n')
    .trim();
}

/**
 * Normalizes attribute names (`show-code`, `show_code`, `showCode` -> `showcode`)
 * so callers do not have to.
 *
 * @param {Record<string, unknown>} attrs
 * @returns {Record<string, unknown>}
 */
function normalizeAttrs(attrs) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(attrs || {})) {
    out[normalizeKey(key)] = value;
  }
  return out;
}

/**
 * @param {Record<string, unknown>} attrs
 * @param {string} name
 * @returns {unknown}
 */
function pickAttr(attrs, ...names) {
  for (const name of names) {
    if (attrs && Object.prototype.hasOwnProperty.call(attrs, name)) return attrs[name];
  }
  return undefined;
}

/**
 * Interprets the `code` attribute (`show`/`hide`/`true`/`false`).
 *
 * @param {unknown} value
 * @returns {boolean | null}
 */
export function parseShowCode(value) {
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (s === '') return true;
  if (['hide', 'false', 'off', 'no', 'none', '0'].includes(s)) return false;
  if (['show', 'true', 'on', 'yes', '1'].includes(s)) return true;
  return null;
}

/**
 * Builds the yacv viewer URL parameters for one embed.
 *
 * @param {Object} params
 * @param {boolean} params.hasCode Whether a `pg_code` value will be attached.
 * @param {string[]} [params.models] Static GLB/GLTF URLs to preload.
 * @param {Record<string, unknown>} [params.attrs] Per-embed attributes.
 * @param {import('./options.js').ResolvedOptions} params.options
 * @param {string | ((src: string) => string)} [params.base]
 * @returns {URLSearchParams | null} `null` when there is nothing to show.
 */
export function buildParams({ hasCode, models = [], attrs = {}, options, base }) {
  const params = new URLSearchParams();
  attrs = normalizeAttrs(attrs);

  const editorAttr = pickAttr(attrs, 'editor');
  const editor = editorAttr === undefined ? options.editor : normalizeEditor(editorAttr, options.editor);
  const editorExplicit = editorAttr !== undefined || options.editorExplicit === true;

  // `version`/`debug`/`constraints` are the friendly names; accept the raw
  // yacv setting names as aliases too.
  const version = pickAttr(attrs, 'version', 'b3dversion', 'pgversion', 'pg_version');
  const debug = pickAttr(attrs, 'debug', 'pgdebug', 'pg_debug');
  const constraints = pickAttr(attrs, 'constraints', 'pgconstraints', 'pg_constraints');

  // 1. Raw yacv settings (global config, then per-embed attributes).
  const settings = collectSettings(attrs, options.settings);
  for (const [key, value] of Object.entries(settings)) {
    if (hasCode && ['pg_version', 'pg_debug', 'pg_constraints'].includes(key)) continue; // plugin wins below
    if (editorExplicit && ['pg_opacity_loading', 'pg_opacity_loaded'].includes(key)) continue;
    const normalized = normalizeSettingValue(key, value);
    if (normalized != null) params.set(key, normalized);
  }

  // 2. build123d/playground options (friendlier API, takes precedence).
  if (hasCode) {
    params.set('pg_version', String(version == null || version === '' ? options.version : version));
    params.set('pg_debug', toBool(debug === undefined ? options.debug : debug) ? 'true' : 'false');
    const normalizedConstraints = normalizeConstraints(constraints === undefined ? options.constraints : constraints);
    if (normalizedConstraints) params.set('pg_constraints', normalizedConstraints);
  }

  // 3. Keep the 3D model interactive: hide the in-iframe editor by default.
  if (editorExplicit) {
    params.set('pg_opacity_loading', String(editor));
    params.set('pg_opacity_loaded', String(editor));
  } else if (hasCode) {
    if (!params.has('pg_opacity_loading')) params.set('pg_opacity_loading', String(editor));
    if (!params.has('pg_opacity_loaded')) params.set('pg_opacity_loaded', String(editor));
  }

  // 4. Static models to preload (in addition to any playground output).
  const modelCandidates = [
    ...splitList(pickAttr(attrs, 'models')),
    ...splitList(pickAttr(attrs, 'src')),
    ...splitList(pickAttr(attrs, 'preload')),
    ...models,
  ];
  const resolvedModels = [];
  for (const candidate of modelCandidates) {
    const url = resolveUrl(candidate, base);
    if (url && !resolvedModels.includes(url)) resolvedModels.push(url);
  }
  for (const url of resolvedModels) params.append('preload', url);

  if (!hasCode && resolvedModels.length === 0 && params.toString() === '') return null;
  return params;
}

/**
 * @param {URLSearchParams} params
 * @param {string} viewer
 * @param {string} [documentBase]
 * @returns {string}
 */
export function buildViewerUrl(viewer, params, documentBase) {
  const base = documentBase || (typeof document !== 'undefined' ? document.baseURI : undefined);
  const href = resolveUrl(viewer || DEFAULT_VIEWER, base);
  try {
    const url = new URL(href, base);
    url.hash = params.toString();
    return url.href;
  } catch {
    return `${href}${href.includes('#') ? '' : '#'}${params.toString()}`;
  }
}

/**
 * Resolves the base URL used for relative asset references.
 *
 * @param {import('./options.js').ResolvedOptions} options
 * @param {{ config?: { basePath?: string } } | null} [vm]
 * @returns {string | ((src: string) => string)}
 */
export function resolveBase(options, vm) {
  if (typeof options.base === 'function' || (typeof options.base === 'string' && options.base.trim())) {
    return options.base;
  }
  if (vm && vm.config && typeof vm.config.basePath === 'string' && vm.config.basePath.trim()) {
    try {
      return new URL(vm.config.basePath, typeof document !== 'undefined' ? document.baseURI : undefined).href;
    } catch {
      // fall through to document.baseURI
    }
  }
  return typeof document !== 'undefined' ? document.baseURI : '';
}
