/**
 * Shared, same-origin Python worker for live embeds.
 *
 * One module Worker (Pyodide + build123d + OCP + yacv_server) executes every
 * live snippet on the page. The viewer iframes run in mesh mode and receive the
 * GLB bytes through their same-origin `window.__b3dLiveViewer` API.
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

export class WorkerRuntime {
  /**
   * @param {string} url Same-origin worker script URL.
   */
  constructor(url) {
    this.url = url;
    /** @type {Worker | null} */
    this.worker = null;
    this.key = '';
    this.ready = null;
    this.runId = 0;
    /** @type {Map<number, { resolve: (models: WorkerModel[]) => void, reject: (err: Error) => void }>} */
    this.pending = new Map();
    this.chain = Promise.resolve();
  }

  /**
   * @param {{ version: string, debug: boolean, constraints: string }} settings
   * @returns {Promise<void>}
   */
  ensure(settings) {
    const key = `${settings.version}|${settings.debug ? 1 : 0}|${settings.constraints}`;
    if (this.worker && this.key === key && this.ready) return this.ready;

    this.dispose();
    this.key = key;
    this.worker = new Worker(this.url, { type: 'module' });
    this.ready = new Promise((resolve, reject) => {
      const worker = /** @type {Worker} */ (this.worker);
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Python worker bootstrap timed out'));
        this.dispose();
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
            entry.reject(new Error(message.error || 'Python worker error'));
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
          reject(new Error(message.error || 'Python worker bootstrap failed'));
          this.dispose();
        }
      };
      worker.onerror = event => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(event.message || 'Python worker failed to start'));
        }
        this.failAll(new Error(event.message || 'Python worker failed'));
        this.dispose();
      };
      worker.postMessage({
        type: 'init',
        version: settings.version,
        debug: settings.debug,
        constraints: settings.constraints,
      });
    });
    // Avoid unhandled rejections when nobody is waiting yet.
    this.ready.catch(() => {});
    return this.ready;
  }

  /**
   * Runs one snippet. Runs are serialized through the shared interpreter.
   *
   * @param {string} code
   * @param {{ version: string, debug: boolean, constraints: string }} settings
   * @returns {Promise<WorkerModel[]>}
   */
  run(code, settings) {
    const job = this.chain.then(async () => {
      await this.ensure(settings);
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
      () => undefined,
      () => undefined,
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
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.terminate();
    }
    this.worker = null;
    this.ready = null;
    this.key = '';
    this.failAll(new Error('Python worker restarted'));
  }
}

/** @type {WorkerRuntime | null} */
let shared = null;

/**
 * Returns the per-page shared worker for the given URL.
 *
 * @param {string} url
 * @returns {WorkerRuntime}
 */
export function getWorkerRuntime(url) {
  if (!shared || shared.url !== url) {
    shared?.dispose();
    shared = new WorkerRuntime(url);
  }
  return shared;
}
