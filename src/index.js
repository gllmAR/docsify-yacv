import { mountAll } from './mount.js';
import { normalizeTagWhitespace } from './parse.js';
import { preloadViewerAssets } from './preload.js';
import { DEFAULT_OPEN_VIEWER, DEFAULT_VIEWER, DEFAULT_WORKER, resolveOptions } from './options.js';
import { clearResultCache } from './result-cache.js';
import { injectStyles } from './styles.js';

/**
 * Docsify plugin factory.
 *
 * @example
 * import DocsifyYacv from 'docsify-yacv';
 * window.$docsify = {
 *   yacv: { version: 'stable' },
 *   plugins: [DocsifyYacv()],
 * };
 *
 * @param {import('./options.js').DocsifyYacvOptions} [userOptions]
 * @returns {(hook: any, vm: any) => void} A docsify plugin.
 */
export default function docsifyYacv(userOptions = {}) {
  return function install(hook, vm) {
    /** @type {import('./options.js').ResolvedOptions | null} */
    let options = null;
    const getOptions = () => {
      if (!options) options = resolveOptions(userOptions, vm);
      return options;
    };

    hook.init(() => {
      injectStyles();
    });

    if (typeof hook.beforeEach === 'function') {
      hook.beforeEach(markdown => {
        const text = markdown == null ? '' : String(markdown);
        if (/(^|\n)```[^\n]*(?:yacv|build123d|b3d)/i.test(text) || /(^|\n)\s*<yacv\b/i.test(text)) {
          const options = getOptions();
          if (options.preloadViewer !== false) {
            preloadViewerAssets(
              options.viewer,
              typeof options.base === 'string' ? options.base : document.baseURI,
            );
          }
        }
        return normalizeTagWhitespace(text);
      });
    }

    if (typeof hook.doneEach === 'function') {
      hook.doneEach(() => {
        mountAll(vm, getOptions());
      });
    }
  };
}

docsifyYacv.clearCache = clearResultCache;

export { docsifyYacv as yacv, clearResultCache, DEFAULT_OPEN_VIEWER, DEFAULT_VIEWER, DEFAULT_WORKER };
