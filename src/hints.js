/**
 * Resource hints for the cross-origin viewer and its runtime dependencies.
 *
 * Connections are shared by the browser across frames, so preconnecting from
 * the docs page cuts DNS/TLS setup time for the iframe viewer, Pyodide and the
 * PyPI wheels downloaded by the build123d sandbox.
 */

const added = new Set();

/**
 * @param {string} origin
 * @param {boolean} cors Whether the origin is used by CORS fetches/modules.
 */
function add(origin, cors) {
  if (!origin || typeof document === 'undefined') return;
  if (origin === window.location.origin) return;

  const dnsKey = `dns:${origin}`;
  if (!added.has(dnsKey)) {
    added.add(dnsKey);
    const dns = document.createElement('link');
    dns.rel = 'dns-prefetch';
    dns.href = origin;
    document.head.appendChild(dns);
  }

  const key = `${cors ? 'cors' : 'plain'}:${origin}`;
  if (added.has(key)) return;
  added.add(key);
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  if (cors) link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

/**
 * Adds hints for one embed. `live` includes the PyPI/OCP.wasm origins used by
 * the in-browser build123d sandbox.
 *
 * @param {string} viewer Viewer URL.
 * @param {boolean} live Whether the embed executes Python in the browser.
 * @returns {void}
 */
export function ensureResourceHints(viewer, live) {
  try {
    const url = new URL(viewer, document.baseURI);
    if (url.protocol === 'http:' || url.protocol === 'https:') add(url.origin, false);
  } catch {
    // ignore invalid viewer URLs (mounting will surface the error)
  }

  // Pyodide + docsify are served from jsDelivr by default.
  add('https://cdn.jsdelivr.net', true);

  if (live) {
    // OCP.wasm bootstrap + wheel downloads.
    add('https://raw.githubusercontent.com', true);
    add('https://pypi.org', true);
    add('https://files.pythonhosted.org', true);
  }
}
