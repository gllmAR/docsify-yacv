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
 * case its text is fetched (GitHub Pages allows CORS) and executed from a
 * `SharedWorker` created with a stable data: URL, so every docs tab (and every
 * docs page using the same viewer) shares one interpreter. The data URL is
 * identical across tabs, which is what makes the browser reuse the worker.
 * When SharedWorker is unavailable (or disabled) the text runs from a Blob
 * worker instead. Pyodide is imported from jsDelivr and the bootstrap is passed
 * as an absolute `startupUrl`.
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

/** @type {Map<string, Promise<{ absolute: string, same: boolean, blobUrl?: string, dataUrl?: string }>>} */
const workerScripts = new Map();

/**
 * @param {string} text
 * @returns {string}
 */
function base64FromText(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Loads a worker script. Same-origin scripts are served directly; cross-origin
 * scripts are fetched once (CORS) and exposed both as a Blob URL (dedicated
 * fallback) and a stable data: URL (shared across tabs by a SharedWorker).
 *
 * @param {string} url
 * @returns {Promise<{ absolute: string, same: boolean, blobUrl?: string, dataUrl?: string }>}
 */
async function loadWorkerScript(url) {
  const absolute = new URL(url, document.baseURI).href;
  if (sameOrigin(absolute)) return { absolute, same: true };

  let promise = workerScripts.get(absolute);
  if (!promise) {
    promise = (async () => {
      const response = await fetch(absolute, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Failed to fetch the Python worker (HTTP ${response.status})`);
      }
      const text = await response.text();
      return {
        absolute,
        same: false,
        blobUrl: URL.createObjectURL(new Blob([text], { type: 'text/javascript' })),
        dataUrl: `data:text/javascript;base64,${base64FromText(text)}`,
      };
    })();
    promise.catch(() => workerScripts.delete(absolute));
    workerScripts.set(absolute, promise);
  }
  return promise;
}

export class WorkerRuntime {
  /**
   * @param {string} url Worker script URL (same- or cross-origin).
   * @param {{ version: string, debug: boolean, constraints: string }} settings
   */
  constructor(url, settings, idleMs = 0, sharedWorker = true) {
    this.url = url;
    this.settings = { ...settings };
    this.idleMs = idleMs;
    this.sharedWorker = sharedWorker;
    this.shared = false;
    /** @type {Worker | SharedWorker | null} */
    this.channel = null;
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
    /** @type {{ stage: string, label: string, progress: number } | null} */
    this.progress = null;
    /** @type {Set<(progress: { stage: string, label: string, progress: number }) => void>} */
    this.progressListeners = new Set();
  }

  /**
   * Subscribes to future boot/run progress milestones.
   *
   * @param {(progress: { stage: string, label: string, progress: number }) => void} listener
   * @returns {() => void}
   */
  onProgress(listener) {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  /**
   * @param {{ stage: string, label: string, progress: number }} progress
   */
  emitProgress(progress) {
    this.progress = progress;
    for (const listener of this.progressListeners) {
      try {
        listener(progress);
      } catch {
        // ignore UI errors
      }
    }
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
      const source = await loadWorkerScript(this.url);
      let worker = null;
      let channel = null;
      let shared = false;

      if (this.sharedWorker && typeof SharedWorker !== 'undefined') {
        try {
          const sharedWorker = new SharedWorker(
            source.same ? source.absolute : source.dataUrl,
            {
              type: 'module',
              // Separate shared interpreters for different worker URLs/settings.
              name: `docsify-yacv:${source.absolute}:${settingsKey(this.settings)}`,
            },
          );
          sharedWorker.port.start();
          worker = sharedWorker;
          channel = sharedWorker.port;
          shared = true;
        } catch {
          worker = null;
          channel = null;
        }
      }
      if (!channel) {
        worker = new Worker(source.same ? source.absolute : source.blobUrl, { type: 'module' });
        channel = worker;
      }
      this.worker = worker;
      this.channel = channel;
      this.shared = shared;

      await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          const error = new Error('Python worker bootstrap timed out');
          error.phase = 'boot';
          reject(error);
        }, 240000);

        channel.onmessage = event => {
          const message = event.data || {};
          if (message.type === 'progress') {
            this.emitProgress({
              stage: String(message.stage || ''),
              label: String(message.label || ''),
              progress: Number(message.progress),
            });
            return;
          }
          if (message.type === 'ready') {
            this.progress = null;
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve();
            }
            return;
          }
          if (message.type === 'result' || message.type === 'error') {
            this.progress = null;
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
            this.progress = null;
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
        channel.postMessage({
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
      const channel = this.channel;
      if (!channel) throw new Error('Python worker is not available');
      const id = ++this.runId;
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        channel.postMessage({ type: 'run', id, code });
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
    if (this.channel && this.shared) {
      try {
        this.channel.close();
      } catch {
        // ignore
      }
    } else if (this.worker) {
      this.worker.onerror = null;
      this.worker.terminate();
    }
    this.worker = null;
    this.channel = null;
    this.shared = false;
    this.ready = null;
    this.progress = null;
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
export function getWorkerRuntime(url, settings, idleMs = 0, sharedWorker = true) {
  const key = `${url}|${settingsKey(settings)}`;
  let runtime = runtimes.get(key);
  if (!runtime) {
    runtime = new WorkerRuntime(url, settings, idleMs, sharedWorker);
    runtimes.set(key, runtime);
  } else {
    runtime.idleMs = idleMs;
    runtime.sharedWorker = sharedWorker;
  }
  return runtime;
}
