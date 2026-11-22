/**
 * IndexedDB cache for shared-worker results.
 *
 * The key hashes the code plus the interpreter settings, so changed snippets or
 * a different build123d version invalidate automatically. Deterministic docs
 * examples can then render instantly on repeat visits without booting Pyodide.
 */

const DB_NAME = 'docsify-yacv-results';
const STORE = 'results';
const DB_VERSION = 1;
/** Bump when the worker/renderer output changes in a way code hashes miss. */
const CACHE_VERSION = '1';
const MAX_ENTRIES = 24;
const MAX_BYTES = 64 * 1024 * 1024;

/** @type {Promise<IDBDatabase | null> | null} */
let dbPromise = null;

/** @returns {Promise<IDBDatabase | null>} */
function openDb() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  dbPromise = new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'key' });
          store.createIndex('ts', 'ts');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/**
 * @param {{ code: string, settings: { version: string, debug: boolean, constraints: string }, workerUrl: string }} input
 * @returns {Promise<string | null>}
 */
async function cacheKey({ code, settings, workerUrl }) {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : null;
  if (!subtle || typeof TextEncoder === 'undefined') return null;
  const text = [
    CACHE_VERSION,
    workerUrl,
    settings.version,
    settings.debug ? '1' : '0',
    settings.constraints,
    code,
  ].join('\u0000');
  try {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

/**
 * @param {{ code: string, settings: { version: string, debug: boolean, constraints: string }, workerUrl: string }} input
 * @returns {Promise<Array<{ name: string, hash: string | null, bytes: Uint8Array }> | null>}
 */
export async function getCachedResult(input) {
  const key = await cacheKey(input);
  if (!key) return null;
  const db = await openDb();
  if (!db) return null;
  try {
    const record = await new Promise(resolve => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
    if (!record || !Array.isArray(record.models) || record.models.length === 0) return null;
    return record.models
      .filter(model => model && model.name && model.bytes)
      .map(model => ({
        name: String(model.name),
        hash: model.hash == null ? null : String(model.hash),
        bytes:
          model.bytes instanceof Uint8Array
            ? model.bytes
            : new Uint8Array(model.bytes.buffer || model.bytes),
      }));
  } catch {
    return null;
  }
}

/**
 * @param {{ code: string, settings: { version: string, debug: boolean, constraints: string }, workerUrl: string }} input
 * @param {Array<{ name: string, hash: string | null, bytes: Uint8Array }>} models
 * @returns {Promise<void>}
 */
export async function putCachedResult(input, models) {
  const filtered = (models || []).filter(model => model && model.name && model.bytes && model.bytes.length);
  if (filtered.length === 0) return;
  const total = filtered.reduce((sum, model) => sum + model.bytes.length, 0);
  if (total > MAX_BYTES) return;

  const key = await cacheKey(input);
  if (!key) return;
  const db = await openDb();
  if (!db) return;

  try {
    await new Promise(resolve => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({
        key,
        ts: Date.now(),
        models: filtered.map(model => ({
          name: model.name,
          hash: model.hash,
          bytes: model.bytes,
        })),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });

    // Prune the oldest entries, but do not load the model bytes.
    const count = await new Promise(resolve => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => resolve(0);
    });
    if (count <= MAX_ENTRIES) return;
    const remove = count - MAX_ENTRIES;
    await new Promise(resolve => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const cursor = store.index('ts').openCursor();
      let removed = 0;
      cursor.onsuccess = () => {
        const value = cursor.result;
        if (!value || removed >= remove) {
          resolve();
          return;
        }
        store.delete(value.primaryKey);
        removed += 1;
        value.continue();
      };
      cursor.onerror = () => resolve();
    });
  } catch {
    // Cache failures are non-fatal.
  }
}
