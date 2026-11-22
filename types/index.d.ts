/**
 * Type definitions for docsify-yacv.
 */

/** Default embedded viewer: the headless, optimized build in this repo. */
export declare const DEFAULT_VIEWER: string;

/** Default viewer for the "Open" action: the full upstream yacv build. */
export declare const DEFAULT_OPEN_VIEWER: string;

/** Default shared worker (may be cross-origin; it is wrapped in a Blob worker). */
export declare const DEFAULT_WORKER: string;

export type YacvSettingValue = string | number | boolean;

/**
 * Plugin options. Every option can also be set globally through
 * `window.$docsify.yacv` (options passed to the factory take precedence).
 */
export interface DocsifyYacvOptions {
  /**
   * Base URL of the yacv frontend for embedded viewers. Default: the headless
   * optimized build at `https://gllmar.github.io/docsify-yacv/viewer/`.
   */
  viewer?: string;
  /**
   * Base URL used by the "Open" action. Default: the full upstream viewer
   * (`https://yeicor-3d.github.io/yet-another-cad-viewer/`).
   */
  openViewer?: string;
  /** Default viewer height (`480`, `"480px"`, `"60vh"`, `"auto"`, ...). */
  height?: string | number;
  /** Default title shown in the embed toolbar. */
  title?: string;
  /** Default poster image for preview-only (`auto-load=false`) embeds. */
  poster?: string;
  /**
   * build123d version installed by the in-browser playground.
   * `"stable"` (latest PyPI release), a version such as `"0.9.1"`, or a GitHub
   * ref such as `"dev"` / `"pull/123/head"`.
   */
  version?: string;
  /** Use OCP.wasm debug wheels (better crash reports, newer dev builds). */
  debug?: boolean;
  /** Global pip constraints (newline separated) for the playground. */
  constraints?: string;
  /**
   * Opacity (0..1) of the in-iframe playground editor. `0` (default) hides the
   * editor so the 3D model stays interactive; docsify already displays the
   * source code next to the viewer.
   */
  editor?: number | string | boolean;
  /** Defer iframe creation until the embed scrolls into view. Default: true. */
  lazy?: boolean;
  /** Preload the viewer's main modules/styles from viewer/manifest.json. Default: true. */
  preloadViewer?: boolean;
  /** How far before the viewport lazy embeds start loading. Default: "200px". */
  lazyMargin?: string | number;
  /**
   * `"worker"` (default) runs one shared Python worker per
   * version/debug/constraints combination. `"viewer"` runs build123d inside
   * each viewer iframe (needed for the in-iframe Monaco editor).
   */
  runtime?: 'viewer' | 'worker';
  /**
   * Worker script for `runtime: "worker"`. May be cross-origin (it is fetched
   * and wrapped in a Blob worker). Default: the hosted viewer's worker.
   */
  workerUrl?: string;
  /** Pre-boot the shared worker on idle when a live embed exists. Default: true. */
  workerWarmup?: boolean;
  /**
   * Use a `SharedWorker` so all docs tabs share one interpreter. Same-origin
   * scripts load directly; cross-origin scripts run from a stable `data:` URL.
   * Default: true (falls back to a dedicated Blob worker).
   */
  sharedWorker?: boolean;
  /**
   * Cache worker GLB results in IndexedDB, keyed by code and interpreter
   * settings. Unchanged snippets render without booting Pyodide on repeat
   * visits. Default: true.
   */
  cache?: boolean;
  /** Terminate an idle shared worker after this many ms (`0` disables). Default: 30 min. */
  workerIdleMs?: number;
  /** Maximum number of iframes created at the same time. Default: 2. */
  maxConcurrent?: number;
  /**
   * Maximum number of loaded live build123d sandboxes. A live embed keeps its
   * slot until it is unloaded. Default: 2.
   */
  maxLiveConcurrent?: number;
  /**
   * How long a live sandbox holds its concurrency slot after its viewer loads.
   * `0` holds it until the embed is unloaded. Default: 30000.
   */
  liveSlotMs?: number;
  /**
   * Unload far-offscreen iframes to free memory/CPU. `"static"` only unloads
   * embeds without live code. Default: true.
   */
  unloadOffscreen?: boolean | 'static';
  /** How far outside the viewport an embed is unloaded. Default: "200% 0px". */
  unloadMargin?: string | number;
  /** Load automatically. When false, a "Load 3D viewer" button is shown. */
  autoLoad?: boolean;
  /** Show the embed toolbar. Default: true. */
  chrome?: boolean;
  /** Show the "Open" action that opens the model in the full yacv viewer. */
  openInNewTab?: boolean;
  /** Extra settings forwarded to the yacv frontend. */
  settings?: Record<string, YacvSettingValue>;
  /** Base URL (or resolver) used for relative model/code paths. */
  base?: string | ((src: string) => string);
}

/** A docsify plugin function. */
export type DocsifyPlugin = (hook: any, vm: any) => void;

/**
 * Creates the docsify plugin.
 *
 * @example
 * window.$docsify = {
 *   plugins: [DocsifyYacv({ version: 'stable' })],
 * };
 */
export declare function yacv(options?: DocsifyYacvOptions): DocsifyPlugin;

/** Delete the IndexedDB worker-result cache. */
export declare function clearResultCache(): Promise<void>;

declare namespace yacv {
  /** Delete the IndexedDB worker-result cache. */
  function clearCache(): Promise<void>;
}

export default yacv;

declare global {
  interface Window {
    /** Global exposed by the auto-registering `docsify-yacv.js` script tag. */
    DocsifyYacv?: typeof yacv & { clearCache: typeof clearResultCache };
  }
}
