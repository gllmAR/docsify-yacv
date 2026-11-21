/**
 * Type definitions for docsify-yacv.
 */

/** Default yacv frontend URL (GitHub Pages deployment). */
export declare const DEFAULT_VIEWER: string;

export type YacvSettingValue = string | number | boolean;

/**
 * Plugin options. Every option can also be set globally through
 * `window.$docsify.yacv` (options passed to the factory take precedence).
 */
export interface DocsifyYacvOptions {
  /** Base URL of the yacv frontend. Default: the public GitHub Pages build. */
  viewer?: string;
  /** Default viewer height (`480`, `"480px"`, `"60vh"`, `"auto"`, ...). */
  height?: string | number;
  /** Default title shown in the embed toolbar. */
  title?: string;
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

export default yacv;

declare global {
  interface Window {
    /** Global exposed by `dist/docsify-yacv.js` / `dist/docsify-yacv.min.js`. */
    DocsifyYacv?: typeof yacv;
  }
}
