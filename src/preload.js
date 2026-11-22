/**
 * Preloads the yacv viewer's main modules/styles from `viewer/manifest.json`
 * (when the viewer URL is a directory ending in `/`). This starts the big
 * viewer bundle downloads before the first iframe is created.
 */

/** @type {Set<string>} */
const started = new Set();
import { resolveUrl } from './util.js';

/** @type {Set<string>} */
const modelPreloads = new Set();

/**
 * @param {string} viewer Viewer base URL.
 * @param {string | ((src: string) => string)} [base] Docs base URL/resolver.
 * @returns {void}
 */
export function preloadViewerAssets(viewer, base) {
  if (typeof document === 'undefined' || typeof fetch === 'undefined') return;
  let url;
  try {
    url = new URL(viewer, typeof base === 'string' ? base : document.baseURI);
  } catch {
    return;
  }
  if (!url.pathname.endsWith('/')) return; // custom single-file viewers have no manifest
  const manifestUrl = new URL('manifest.json', url).href;
  if (started.has(manifestUrl)) return;
  started.add(manifestUrl);

  fetch(manifestUrl, { mode: 'cors', credentials: 'omit' })
    .then(response => (response.ok ? response.json() : null))
    .then(manifest => {
      if (!manifest) return;
      /** @type {Set<string>} */
      const existing = new Set(
        Array.from(document.querySelectorAll('link[href]')).map(link => /** @type {HTMLLinkElement} */ (link).href),
      );
      const add = (file, rel, as) => {
        let href;
        try {
          href = new URL(String(file), url).href;
        } catch {
          return;
        }
        if (!href || existing.has(href)) return;
        const link = document.createElement('link');
        link.rel = rel;
        if (as) link.as = as;
        link.href = href;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
        existing.add(href);
      };
      for (const file of manifest.modules || []) add(file, 'modulepreload');
      for (const file of manifest.styles || []) add(file, 'preload', 'style');
    })
    .catch(() => {
      // Viewer manifests are optional.
    });
}

/**
 * Warms the HTTP cache for static GLB/GLTF models before the viewer iframe
 * requests them. Models on a different origin than the viewer are fetched by
 * the viewer with CORS; `crossorigin` makes the preload match. Models on the
 * viewer's own origin are skipped (their fetch would not match the CORS
 * preload and could download the model twice).
 *
 * @param {string[]} urls Absolute model URLs.
 * @param {string} viewer Viewer URL.
 * @param {string | ((src: string) => string)} [base]
 * @returns {void}
 */
export function prefetchModelAssets(urls, viewer, base) {
  if (typeof document === 'undefined' || !urls || urls.length === 0) return;
  let viewerOrigin = '';
  try {
    viewerOrigin = new URL(resolveUrl(viewer, base) || viewer, document.baseURI).origin;
  } catch {
    // no viewer origin: prefetch below is still safe for cross-origin URLs
  }
  for (const raw of urls) {
    let href;
    try {
      href = new URL(String(raw), document.baseURI).href;
    } catch {
      continue;
    }
    if (!/^https?:/i.test(href) || modelPreloads.has(href)) continue;
    if (viewerOrigin && new URL(href).origin === viewerOrigin) continue;
    modelPreloads.add(href);
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'fetch';
    link.href = href;
    link.crossOrigin = 'anonymous';
    link.fetchPriority = 'low';
    link.addEventListener('error', () => link.remove(), { once: true });
    document.head.appendChild(link);
  }
}
