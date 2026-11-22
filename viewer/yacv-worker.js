/*
 * docsify-yacv Python worker.
 *
 * One Pyodide instance (OCP + build123d + yacv_server) can serve every live
 * embed with matching settings. The same script supports both:
 *   - a dedicated module Worker (cross-origin worker scripts are fetched and
 *     wrapped in a Blob worker by the plugin);
 *   - a SharedWorker (same-origin worker URL), shared by all docs tabs.
 *
 * The viewers run in mesh mode and receive GLB bytes through the viewer API or
 * the postMessage bridge in index.html.
 *
 * Protocol:
 *   in:  { type: "init", version, debug, constraints, startupUrl }
 *        { type: "run", id, code }
 *   out: { type: "ready" }
 *        { type: "result", id, models: [{ name, hash, data(base64) }] }
 *        { type: "error", id?, error }
 *        { type: "boot-error", error }
 */
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";

let pyodide = null;
/** @type {Promise<void> | null} */
let booting = null;
/** @type {{ id: number, code: string, reply: (message: any) => void } | null} */
let current = null;
/** @type {Array<{ id: number, code: string, reply: (message: any) => void }>} */
const queue = [];

async function boot(options) {
  if (pyodide) return;
  if (booting) return booting;
  booting = (async () => {
    const loaded = await loadPyodide({
      indexURL: PYODIDE_INDEX,
      packages: ["micropip", "numpy", "scipy", "pillow", "requests", "packaging", "pyparsing"],
      // The bootstrap logs a lot of install progress; keep the docs console quiet.
      stdout: () => {},
      stderr: () => {},
    });
    loaded.globals.set("_pg_build123d_version", options.version || "stable");
    loaded.globals.set("_pg_debug", !!options.debug);
    loaded.globals.set("_pg_constraints", options.constraints || "");
    loaded.globals.set("_pg_yacv_wheel_url", "");
    const startupUrl =
      options.startupUrl || new URL("PlaygroundStartup.py", self.location.href).href;
    const response = await fetch(startupUrl);
    if (!response.ok) {
      throw new Error("could not fetch " + startupUrl + " (HTTP " + response.status + ")");
    }
    await loaded.runPythonAsync(await response.text());
    pyodide = loaded;
  })();
  try {
    await booting;
  } finally {
    booting = null;
  }
}

async function execute(job) {
  const { id, code, reply } = job;
  if (!pyodide) {
    reply({ type: "error", id, error: "Python runtime is not initialized" });
    return;
  }
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
    } catch {
      // The startup already installed build123d/OCP; let the code report errors.
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
    reply({ type: "result", id, models: JSON.parse(payload) });
  } catch (error) {
    reply({
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
    await execute(current);
  } finally {
    current = null;
    drain();
  }
}

function handleMessage(data, reply) {
  if (!data) return;
  if (data.type === "init") {
    boot(data)
      .then(() => reply({ type: "ready" }))
      .catch(error => {
        reply({ type: "boot-error", error: String((error && error.message) || error) });
      });
    return;
  }
  if (data.type === "run") {
    queue.push({ id: data.id, code: String(data.code || ""), reply });
    drain();
  }
}

// SharedWorker: one interpreter for every connected docs tab. Dedicated Worker:
// one interpreter per docs page. A SharedWorker script must be same-origin; the
// plugin falls back to a dedicated (Blob) worker for cross-origin worker URLs.
if (typeof onconnect !== "undefined") {
  onconnect = event => {
    const port = event.ports[0];
    const reply = message => {
      try {
        port.postMessage(message);
      } catch {
        // The tab disconnected mid-run.
      }
    };
    port.onmessage = message => handleMessage(message.data, reply);
    port.start();
  };
} else {
  self.onmessage = event =>
    handleMessage(event.data, reply => {
      try {
        self.postMessage(reply);
      } catch {
        // ignore
      }
    });
}
