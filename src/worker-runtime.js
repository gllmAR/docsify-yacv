/**
 * Shared Python worker for live embeds.
 *
 * One module Worker (Pyodide + build123d + OCP + yacv_server) executes every
 * live snippet with the same version/debug/constraints on the page. The viewer
 * iframes run in mesh mode and receive GLB bytes either through their
 * same-origin `window.__b3dLiveViewer` API or through the cross-origin
 * postMessage bridge in `viewer/index.html`.
 *
 * The worker script itself may be cross-origin (the hosted viewer). In that
 * case its text is fetched (GitHub Pages allows CORS) and executed from a Blob
 * worker, which inherits the docs origin. Pyodide is imported from jsDelivr and
 * the bootstrap is passed as an absolute `startupUrl`.
 */

/** @typedef {{ name: string, hash: string | null, bytes: Uint8Array }} WorkerModel */

/**
 * @param {string} base64
 * @returns {Uint8Array}
 */
function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function sameOrigin(url) {
  try {
    return new URL(url, document.baseURI).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** @type {Map<string, Promise<string>>} */
const workerScripts = new Map();

/**
 * Returns a URL that can be passed to `new Worker` for a same- or cross-origin
 * worker script. Cross-origin scripts are fetched once and wrapped in a Blob
 * URL that inherits the docs origin.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
async function workerScriptUrl(url) {
  if (sameOrigin(url)) return url;
  if (!workerScripts.has(url)) {
    const promise = fetch(url, { mode: 'cors' })
      .then(response => {
        if (!response.ok) throw new Error(`Failed to fetch the Python worker (HTTP ${response.status})`);
        return response.text();
      })
      .then(text => URL.createObjectURL(new Blob([text], { type: 'text/javascript' })));
    promise.catch(() => workerScripts.delete(url));
    workerScripts.set(url, promise);
  }
  return workerScripts.get(url);
}

export class WorkerRuntime {
  /**
   * @param {string} url Worker script URL (same- or cross-origin).
   * @param {{ version: string, debug: boolean, constraints: string }} settings
   */
  constructor(url, settings, idleMs = 0) {
    this.url = url;
    this.settings = { ...settings };
    this.idleMs = idleMs;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.idleTimer = null;
    this.startupUrl = new URL('PlaygroundStartup.py', new URL(url, document.baseURI)).href;
    /** @type {Worker | null} */
    this.worker = null;
    /** @type {Promise<void> | null} */
    this.ready = null;
    this.runId = 0;
    /** @type {Map<number, { resolve: (models: WorkerModel[]) => void, reject: (err: Error) => void }>} */
    this.pending = new Map();
    this.chain = Promise.resolve();
  }

  clearIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  touchIdle() {
    this.clearIdle();
    if (!this.idleMs || this.idleMs <= 0) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.dispose();
    }, this.idleMs);
  }

  /**
   * Boots the worker. Rejects with `error.phase = "boot"` when the worker or
   * bootstrap cannot start (so the caller can fall back to the per-viewer
   * runtime).
   *
   * @returns {Promise<void>}
   */
  ensure() {
    if (this.worker && this.ready) return this.ready;
    if (this.worker) this.dispose();

    const ready = (async () => {
      const scriptUrl = await workerScriptUrl(this.url);
      const worker = new Worker(scriptUrl, { type: 'module' });
      this.worker = worker;
      await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          const error = new Error('Python worker bootstrap timed out');
          error.phase = 'boot';
          reject(error);
        }, 240000);

        worker.onmessage = event => {
          const message = event.data || {};
          if (message.type === 'ready') {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve();
            }
            return;
          }
          if (message.type === 'result' || message.type === 'error') {
            const entry = this.pending.get(message.id);
            if (!entry) return;
            this.pending.delete(message.id);
            if (message.type === 'error') {
              const error = new Error(message.error || 'Python worker error');
              error.phase = 'run';
              entry.reject(error);
              return;
            }
            /** @type {WorkerModel[]} */
            const models = [];
            for (const model of message.models || []) {
              try {
                const bytes = decodeBase64(String(model.data || ''));
                models.push({
                  name: String(model.name || 'model'),
                  hash: model.hash == null ? null : String(model.hash),
                  bytes,
                });
              } catch {
                // ignore malformed model entries
              }
            }
            entry.resolve(models);
            return;
          }
          if (message.type === 'boot-error' && !settled) {
            settled = true;
            clearTimeout(timer);
            const error = new Error(message.error || 'Python worker bootstrap failed');
            error.phase = 'boot';
            reject(error);
          }
        };
        worker.onerror = event => {
          const error = new Error(event.message || 'Python worker failed');
          error.phase = 'boot';
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
          this.failAll(error);
          this.dispose();
        };
        worker.postMessage({
          type: 'init',
          version: this.settings.version,
          debug: this.settings.debug,
          constraints: this.settings.constraints,
          startupUrl: this.startupUrl,
        });
      });
    })();

    this.ready = ready.catch(error => {
      const err = error instanceof Error ? error : new Error(String(error));
      if (!err.phase) err.phase = 'boot';
      this.failAll(err);
      this.dispose();
      throw err;
    });
    this.ready.then(
      () => this.touchIdle(),
      () => {},
    );
    // Avoid unhandled rejections when nobody is waiting yet.
    this.ready.catch(() => {});
    return this.ready;
  }

  /**
   * Runs one snippet. Runs are serialized through this interpreter.
   *
   * @param {string} code
   * @returns {Promise<WorkerModel[]>}
   */
  run(code) {
    this.clearIdle();
    const job = this.chain.then(async () => {
      await this.ensure();
      const worker = this.worker;
      if (!worker) throw new Error('Python worker is not available');
      const id = ++this.runId;
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        worker.postMessage({ type: 'run', id, code });
      });
    });
    // Keep the chain alive even after a failed run.
    this.chain = job.then(
      () => {
        this.touchIdle();
      },
      () => {
        this.touchIdle();
      },
    );
    return job;
  }

  /**
   * @param {Error} error
   */
  failAll(error) {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
  }

  dispose() {
    this.clearIdle();
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.terminate();
    }
    this.worker = null;
    this.ready = null;
    this.failAll(new Error('Python worker restarted'));
  }
}

/** @type {Map<string, WorkerRuntime>} */
const runtimes = new Map();

/**
 * @param {{ version: string, debug: boolean, constraints: string }} settings
 * @returns {string}
 */
function settingsKey(settings) {
  return `${settings.version}|${settings.debug ? 1 : 0}|${settings.constraints}`;
}

/**
 * Returns the shared worker for a URL + interpreter settings combination.
 * Embeds with identical settings reuse the same interpreter; a different
 * version/debug/constraints gets its own (shared) worker.
 *
 * @param {string} url
 * @param {{ version: string, debug: boolean, constraints: string }} settings
 * @returns {WorkerRuntime}
 */
export function getWorkerRuntime(url, settings, idleMs = 0) {
  const key = `${url}|${settingsKey(settings)}`;
  let runtime = runtimes.get(key);
  if (!runtime) {
    runtime = new WorkerRuntime(url, settings, idleMs);
    runtimes.set(key, runtime);
  } else {
    runtime.idleMs = idleMs;
  }
  return runtime;
}
