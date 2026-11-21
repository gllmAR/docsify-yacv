import { mountAll } from './mount.js';
import { normalizeTagWhitespace } from './parse.js';
import { DEFAULT_VIEWER, resolveOptions } from './options.js';
import { injectStyles } from './styles.js';

/**
 * Docsify plugin factory.
 *
 * @example
 * window.$docsify = {
 *   plugins: [DocsifyYacv({ version: 'stable' })],
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
      hook.beforeEach(markdown => normalizeTagWhitespace(markdown));
    }

    if (typeof hook.doneEach === 'function') {
      hook.doneEach(() => {
        mountAll(vm, getOptions());
      });
    }
  };
}

export { docsifyYacv as yacv, DEFAULT_VIEWER };
