/*
 * docsify-yacv shared Python worker.
 *
 * One Pyodide instance (OCP + build123d + yacv_server) serves every live embed
 * on the page. The embed viewers run in mesh mode and receive the resulting
 * GLB bytes through the same-origin `window.__b3dLiveViewer.loadMesh` API.
 *
 * Protocol:
 *   in:  { type: "init", version, debug, constraints }
 *        { type: "run", id, code }
 *   out: { type: "booting" | "ready" }
 *        { type: "result", id, models: [{ name, hash, data(base64) }] }
 *        { type: "error", id?, error }
 *
 * This is a module worker: Pyodide's ESM loader is imported from jsDelivr, and
 * PlaygroundStartup.py (the patched fast bootstrap) is fetched next to it.
 * Create it with `new Worker(url, { type: "module" })`.
 */
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";

let pyodide = null;
let booting = null;
let current = null;
const queue = [];

function post(message) {
  self.postMessage(message);
}

async function boot(options) {
  post({ type: "booting" });
  pyodide = await loadPyodide({
    indexURL: PYODIDE_INDEX,
    packages: ["micropip", "numpy", "scipy", "pillow", "requests", "packaging", "pyparsing"],
    // The bootstrap logs a lot of install progress; keep the docs console quiet.
    stdout: () => {},
    stderr: () => {},
  });
  pyodide.globals.set("_pg_build123d_version", options.version || "stable");
  pyodide.globals.set("_pg_debug", !!options.debug);
  pyodide.globals.set("_pg_constraints", options.constraints || "");
  pyodide.globals.set("_pg_yacv_wheel_url", "");
  const startupUrl = options.startupUrl || new URL("PlaygroundStartup.py", self.location.href).href;
  const response = await fetch(startupUrl);
  if (!response.ok) throw new Error("could not fetch " + startupUrl + " (HTTP " + response.status + ")");
  await pyodide.runPythonAsync(await response.text());
  post({ type: "ready" });
}

async function execute(id, code) {
  try {
    await pyodide.runPythonAsync(`
from yacv_server import yacv
yacv.clear()
if '_docsify_base_keys' not in globals():
    _docsify_base_keys = set(globals().keys()) | {'_docsify_base_keys'}
for _docsify_key in list(globals()):
    if _docsify_key not in _docsify_base_keys:
        del globals()[_docsify_key]
`);
    try {
      await pyodide.loadPackagesFromImports(code);
    } catch (error) {
      // The startup already installed build123d/OCP; a failed import scan is
      // not fatal, let the actual code raise the useful error.
    }
    await pyodide.runPythonAsync(code);
    const payload = await pyodide.runPythonAsync(`
import base64, json
from yacv_server import yacv
_exported = []
for _name in list(yacv.shown_object_names()):
    _result = yacv.export(_name)
    if _result is None:
        continue
    _glb, _hash = _result
    _exported.append({"name": _name, "hash": _hash, "data": base64.b64encode(_glb).decode("ascii")})
json.dumps(_exported)
`);
    await pyodide.runPythonAsync(`
for _docsify_key in list(globals()):
    if _docsify_key not in _docsify_base_keys:
        del globals()[_docsify_key]
`);
    post({ type: "result", id, models: JSON.parse(payload) });
  } catch (error) {
    post({
      type: "error",
      id,
      error: String((error && error.message) || error),
      stack: String((error && error.stack) || ""),
    });
  }
}

async function drain() {
  if (current || queue.length === 0) return;
  current = queue.shift();
  try {
    await execute(current.id, current.code);
  } finally {
    current = null;
    drain();
  }
}

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type === "init") {
    if (booting) return;
    booting = boot(data)
      .catch((error) => {
        post({ type: "error", error: String((error && error.message) || error) });
      })
      .finally(() => {
        booting = null;
      });
    return;
  }
  if (data.type === "run") {
    queue.push({ id: data.id, code: String(data.code || "") });
    drain();
  }
};
