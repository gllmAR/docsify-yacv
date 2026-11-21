import { isPlainObject, normalizeSettingKey, toBool, toNumber } from './util.js';

/** Default public viewer (GitHub Pages deployment of Yet Another CAD Viewer). */
// Default embedded viewer: prebuilt headless build in this repo (no Monaco,
// closed drawers, faster bootstrap). Static and preview embeds use mesh mode.
export const DEFAULT_VIEWER = 'https://gllmar.github.io/docsify-yacv/viewer/';
// Full upstream viewer for the "Open" action, where the editor is available.
export const DEFAULT_OPEN_VIEWER = 'https://yeicor-3d.github.io/yet-another-cad-viewer/';

/**
 * Every setting accepted by the yacv frontend (see `frontend/misc/settings.ts`
 * in the yacv repository), together with the type used to coerce values coming
 * from markdown/HTML attributes.
 *
 * `preload` and `pg_code` are handled explicitly by this plugin: `preload` is
 * built from the model list and `pg_code` is gzip/base64url encoded.
 *
 * @type {Record<string, 'boolean' | 'number' | 'string'>}
 */
export const YACV_SETTING_TYPES = {
  loadHelpers: 'boolean',
  edgeWidth: 'number',
  displayLoadingEveryMs: 'number',
  monitorEveryMs: 'number',
  monitorOpenTimeoutMs: 'number',
  autoplay: 'boolean',
  arModes: 'string',
  zoomSensitivity: 'number',
  orbitSensitivity: 'number',
  panSensitivity: 'number',
  exposure: 'number',
  shadowIntensity: 'number',
  environment: 'string',
  environmentIntensity: 'number',
  skybox: 'string',
  pg_version: 'string',
  pg_debug: 'boolean',
  pg_constraints: 'string',
  pg_opacity_loading: 'number',
  pg_opacity_loaded: 'number',
};

/** Lookup table: normalized setting name -> canonical yacv setting name. */
export const YACV_SETTINGS_BY_KEY = new Map(
  Object.keys(YACV_SETTING_TYPES).map(key => [normalizeSettingKey(key), key]),
);

/**
 * Reserved embed attribute names (normalized with `normalizeKey`). They are
 * not forwarded to the viewer as-is.
 */
export const RESERVED_ATTRS = new Set([
  'height',
  'title',
  'version',
  'b3dversion',
  'debug',
  'constraints',
  'editor',
  'code',
  'codesrc',
  'models',
  'src',
  'lazy',
  'autoload',
  'chrome',
  'open',
  'viewer',
  'live',
  'yacv',
  'b3d',
  'build123d',
  'python',
  'preload',
  'id',
  'class',
  'style',
]);

/** @type {Required<DocsifyYacvOptions>} */
export const DEFAULT_OPTIONS = {
  viewer: DEFAULT_VIEWER,
  /** Viewer used by the "Open" action (default: the full upstream viewer). */
  openViewer: DEFAULT_OPEN_VIEWER,
  height: '480px',
  title: '',
  /** build123d version installed by the in-browser playground. */
  version: 'stable',
  /** Use OCP.wasm debug wheels (better crash reports, newer dev builds). */
  debug: false,
  /**
   * Global pip constraints for the playground, newline separated.
   * e.g. `"numpy<2\npackaging>=24"`.
   */
  constraints: '',
  /**
   * Opacity of the in-iframe playground editor (0 hides it, so the 3D model
   * stays interactive; docsify already displays the code next to the viewer).
   */
  editor: 0,
  /** Defer iframe creation until the embed scrolls into view. */
  lazy: true,
  /** How far before the viewport (CSS px or %) a lazy embed starts loading. */
  lazyMargin: '200px',
  /** Maximum number of iframes created at the same time. */
  maxConcurrent: 2,
  /**
   * Maximum number of loaded live build123d sandboxes. A sandbox holds this
   * slot until its embed is unloaded, so pages with many live examples do not
   * boot many Pyodide instances at once.
   */
  maxLiveConcurrent: 2,
  /**
   * How long a live sandbox holds its live-concurrency slot after its viewer
   * loads (`0` = until the embed is unloaded). Prevents both unbounded Pyodide
   * boots and a permanent wait when several live embeds are visible together.
   */
  liveSlotMs: 30000,
  /**
   * Remove far-offscreen iframes to free memory/CPU. `true` unloads every
   * embed, `'static'` only non-code embeds, `false` keeps everything alive.
   */
  unloadOffscreen: true,
  /** How far outside the viewport an embed is unloaded (CSS px or %). */
  unloadMargin: '100% 0px',
  /** Load automatically. When false, a "Load 3D viewer" button is shown. */
  autoLoad: true,
  /** Show the small embed toolbar (title, code toggle, reload, open). */
  chrome: true,
  /** Show the "Open in yacv" action in the toolbar. */
  openInNewTab: true,
  /** Extra settings forwarded to the yacv frontend for every embed. */
  settings: {},
  /** Base URL (or resolver function) used for relative model/code paths. */
  base: null,
};

/**
 * Resolves plugin options from (in increasing priority):
 * `DEFAULT_OPTIONS` < `window.$docsify.yacv` < options passed to the factory.
 *
 * @param {DocsifyYacvOptions} [userOptions]
 * @param {{ config?: { yacv?: DocsifyYacvOptions } } | null} [vm]
 * @returns {ResolvedOptions}
 */
export function resolveOptions(userOptions = {}, vm = null) {
  const fromConfig = vm && vm.config && isPlainObject(vm.config.yacv) ? vm.config.yacv : {};
  const own = isPlainObject(userOptions) ? userOptions : {};
  const merged = { ...DEFAULT_OPTIONS, ...fromConfig, ...own };

  merged.settings = {
    ...(isPlainObject(fromConfig.settings) ? fromConfig.settings : {}),
    ...(isPlainObject(own.settings) ? own.settings : {}),
  };
  merged.version = merged.version == null || merged.version === '' ? 'stable' : String(merged.version);
  merged.debug = toBool(merged.debug, false);
  merged.constraints = merged.constraints == null ? '' : String(merged.constraints);
  merged.editor = normalizeEditor(merged.editor, 0);
  merged.lazy = toBool(merged.lazy, true);
  merged.lazyMargin = normalizeMargin(merged.lazyMargin, DEFAULT_OPTIONS.lazyMargin);
  merged.unloadMargin = normalizeMargin(merged.unloadMargin, DEFAULT_OPTIONS.unloadMargin);
  merged.runtime = merged.runtime === 'worker' ? 'worker' : 'viewer';
  merged.workerUrl = merged.workerUrl == null ? '' : String(merged.workerUrl);
  merged.workerWarmup = toBool(merged.workerWarmup, true);
  merged.maxConcurrent = Math.max(1, Math.floor(toNumber(merged.maxConcurrent, 2)));
  merged.maxLiveConcurrent = Math.max(1, Math.floor(toNumber(merged.maxLiveConcurrent, 2)));
  merged.liveSlotMs = Math.max(0, Math.floor(toNumber(merged.liveSlotMs, 30000)));
  if (merged.unloadOffscreen === 'static') merged.unloadOffscreen = 'static';
  else merged.unloadOffscreen = toBool(merged.unloadOffscreen, true);
  merged.autoLoad = toBool(merged.autoLoad, true);
  merged.chrome = toBool(merged.chrome, true);
  merged.openInNewTab = toBool(merged.openInNewTab, true);
  merged.height = merged.height == null || merged.height === '' ? DEFAULT_OPTIONS.height : merged.height;
  merged.title = merged.title == null ? '' : String(merged.title);
  merged.poster = merged.poster == null ? '' : String(merged.poster);
  merged.viewer = merged.viewer == null || merged.viewer === '' ? DEFAULT_VIEWER : String(merged.viewer);
  merged.openViewer =
    merged.openViewer == null || merged.openViewer === '' ? DEFAULT_OPEN_VIEWER : String(merged.openViewer);

  // Internal flag: an explicitly configured editor wins over raw pg_opacity_*
  // settings, the implicit default (0) does not.
  merged.editorExplicit =
    Object.prototype.hasOwnProperty.call(fromConfig, 'editor') || Object.prototype.hasOwnProperty.call(own, 'editor');

  return /** @type {ResolvedOptions} */ (merged);
}

/**
 * Normalizes an IntersectionObserver margin (px or %).
 *
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
export function normalizeMargin(value, fallback) {
  if (value == null || value === '') return fallback;
  const s = typeof value === 'number' ? `${value}px` : String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}px`;
  if (/^\d+(\.\d+)?(px|%)(\s+\d+(\.\d+)?(px|%)){0,3}$/.test(s)) return s;
  return fallback;
}

/**
 * Normalizes the `editor` option: accepts 0..1 numbers as well as
 * `show`/`hide`/`true`/`false`.
 *
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
export function normalizeEditor(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 0.9 : 0;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (['hide', 'false', 'off', 'no', 'none', '0'].includes(s)) return 0;
    if (['show', 'true', 'on', 'yes'].includes(s)) return 0.9;
  }
  const n = toNumber(value, fallback);
  return Math.min(1, Math.max(0, n));
}

/**
 * @typedef {Object} DocsifyYacvOptions
 * @property {string} [viewer] Base URL of the yacv frontend for embedded viewers.
 * @property {string} [openViewer] Base URL used by the "Open" action (defaults to `viewer`).
 * @property {string | number} [height] Default viewer height (number = px).
 * @property {string} [title] Default title shown in the toolbar.
 * @property {string} [poster] Default poster image for preview-only embeds.
 * @property {string} [version] build123d version (`stable`, `0.9.1`, `dev`, `pull/123/head`, ...).
 * @property {boolean} [debug] Use OCP.wasm debug wheels.
 * @property {string} [constraints] Global pip constraints (newline separated).
 * @property {number | string | boolean} [editor] In-iframe playground editor opacity (0 = hidden).
 * @property {boolean} [lazy] Only create the iframe when scrolled into view.
 * @property {string | number} [lazyMargin] Viewport margin for lazy loading (px or %).
 * @property {'viewer' | 'worker'} [runtime] Python runtime: per-viewer or shared worker.
 * @property {string} [workerUrl] Same-origin module worker for `runtime: 'worker'`.
 * @property {boolean} [workerWarmup] Pre-boot the shared worker on idle.
 * @property {number} [maxConcurrent] Maximum simultaneous iframe creations.
 * @property {number} [maxLiveConcurrent] Maximum loaded live build123d sandboxes.
 * @property {number} [liveSlotMs] How long a live sandbox holds its slot (`0` = until unload).
 * @property {boolean | 'static'} [unloadOffscreen] Unload far-offscreen iframes.
 * @property {string | number} [unloadMargin] Viewport margin for offscreen unloading.
 * @property {boolean} [autoLoad] Load automatically (false = click to load).
 * @property {boolean} [chrome] Show the embed toolbar.
 * @property {boolean} [openInNewTab] Show the "Open" action.
 * @property {Record<string, string | number | boolean>} [settings] Extra yacv frontend settings.
 * @property {string | ((src: string) => string)} [base] Base URL for relative assets.
 */

/**
 * @typedef {Required<DocsifyYacvOptions> & {
 *   settings: Record<string, string | number | boolean>,
 *   editorExplicit: boolean,
 * }} ResolvedOptions
 */
