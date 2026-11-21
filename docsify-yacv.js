/*! docsify-yacv v0.1.0 | MIT | https://github.com/gllmAR/docsify-yacv */
(() => {
  // src/encode.js
  var cache = /* @__PURE__ */ new Map();
  var CACHE_LIMIT = 64;
  var warnedAboutFallback = false;
  function bytesToBase64Url(bytes) {
    let binary = "";
    const chunk = 32768;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  async function gzip(text) {
    if (typeof CompressionStream === "undefined" || typeof Blob === "undefined" || typeof Response === "undefined") {
      return null;
    }
    try {
      const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream("gzip"));
      const buffer = await new Response(stream).arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      return null;
    }
  }
  async function encodeCode(code) {
    const text = String(code == null ? "" : code).replace(/\r\n/g, "\n");
    if (!text) return "";
    const cached = cache.get(text);
    if (cached !== void 0) return cached;
    const compressed = await gzip(text);
    let value;
    if (compressed && compressed.length > 0) {
      value = bytesToBase64Url(compressed);
    } else {
      if (!warnedAboutFallback) {
        warnedAboutFallback = true;
        console.warn(
          "[docsify-yacv] CompressionStream is not available, passing build123d source to yacv unencoded. Upgrade to a browser with CompressionStream support for smaller viewer URLs."
        );
      }
      value = /^[a-z][a-z0-9+.-]*:\/\//i.test(text.trim()) ? "\n" + text : text;
    }
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(text, value);
    return value;
  }

  // src/hints.js
  var added = /* @__PURE__ */ new Set();
  function add(origin, cors) {
    if (!origin || typeof document === "undefined") return;
    if (origin === window.location.origin) return;
    const dnsKey = `dns:${origin}`;
    if (!added.has(dnsKey)) {
      added.add(dnsKey);
      const dns = document.createElement("link");
      dns.rel = "dns-prefetch";
      dns.href = origin;
      document.head.appendChild(dns);
    }
    const key = `${cors ? "cors" : "plain"}:${origin}`;
    if (added.has(key)) return;
    added.add(key);
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    if (cors) link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
  function ensureResourceHints(viewer, live) {
    try {
      const url = new URL(viewer, document.baseURI);
      if (url.protocol === "http:" || url.protocol === "https:") add(url.origin, false);
    } catch {
    }
    add("https://cdn.jsdelivr.net", true);
    if (live) {
      add("https://raw.githubusercontent.com", true);
      add("https://pypi.org", true);
      add("https://files.pythonhosted.org", true);
    }
  }

  // src/highlight.js
  function highlightPython(codeEl, code) {
    const Prism = typeof window !== "undefined" ? window.Prism : void 0;
    if (codeEl && Prism && Prism.languages && Prism.languages.python && typeof Prism.highlight === "function") {
      try {
        codeEl.innerHTML = Prism.highlight(code, Prism.languages.python, "python");
        return true;
      } catch {
      }
    }
    if (codeEl) codeEl.textContent = code;
    return false;
  }
  function highlightPrePython(pre, code) {
    const codeEl = pre && pre.querySelector("code");
    if (!codeEl) return;
    if (highlightPython(codeEl, code)) {
      codeEl.classList.add("language-python", "lang-python");
      pre.classList.add("language-python");
    }
  }

  // src/util.js
  function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
  }
  function toBool(value, fallback = false) {
    if (value == null) return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const s = String(value).trim().toLowerCase();
    if (s === "") return true;
    if (["1", "true", "yes", "on", "show", "show-code"].includes(s)) return true;
    if (["0", "false", "no", "off", "hide", "none"].includes(s)) return false;
    return fallback;
  }
  function toNumber(value, fallback = NaN) {
    if (value == null || value === "") return fallback;
    const n = typeof value === "number" ? value : Number(String(value).trim());
    return Number.isFinite(n) ? n : fallback;
  }
  function cssSize(value, fallback = "480px") {
    if (value == null || value === "" || value === true) return fallback;
    if (typeof value === "number") return `${value}px`;
    const s = String(value).trim();
    if (s === "") return fallback;
    if (/^\d*\.?\d+$/.test(s)) return `${s}px`;
    return s;
  }
  function normalizeKey(key) {
    return String(key).toLowerCase().replace(/-/g, "");
  }
  function normalizeSettingKey(key) {
    return String(key).toLowerCase().replace(/[-_]/g, "");
  }
  function splitList(value) {
    if (value == null || value === true || value === false) return [];
    const values = Array.isArray(value) ? value : String(value).split(/[\s,]+/);
    const out = [];
    for (const v of values) {
      const s = String(v).trim();
      if (s) out.push(s);
    }
    return out;
  }
  function resolveUrl(src, base) {
    const s = String(src == null ? "" : src).trim();
    if (!s) return "";
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(s)) return s;
    let baseUrl = typeof base === "function" ? base(s) : base;
    if (!baseUrl) {
      baseUrl = typeof document !== "undefined" ? document.baseURI : void 0;
    }
    if (!baseUrl) return s;
    try {
      return new URL(s, baseUrl).href;
    } catch {
      return s;
    }
  }
  function copyText(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        const ok = document.execCommand && document.execCommand("copy");
        ta.remove();
        if (ok) resolve();
        else reject(new Error("Copy command failed"));
      } catch (err) {
        ta.remove();
        reject(err);
      }
    });
  }

  // src/parse.js
  var CODE_LANGS = /* @__PURE__ */ new Set([
    "build123d",
    "b3d",
    "b123d",
    "yacv-build123d",
    "yacv-b3d",
    "yacv-py",
    "yacv-python"
  ]);
  var MODEL_LANGS = /* @__PURE__ */ new Set(["yacv", "yacv-model", "yacv-models"]);
  var PYTHON_LANGS = /* @__PURE__ */ new Set(["python", "py", "python3"]);
  function parseInfoString(info) {
    const tokens = [];
    let current = "";
    let quote = null;
    const text = info == null ? "" : String(info);
    for (const ch of text) {
      if (quote) {
        if (ch === quote) quote = null;
        else current += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (/\s/.test(ch)) {
        if (current) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += ch;
      }
    }
    if (current) tokens.push(current);
    const lang = (tokens.shift() || "").toLowerCase();
    const attrs = {};
    for (const token of tokens) {
      const eq = token.indexOf("=");
      if (eq < 0) {
        attrs[normalizeKey(token)] = true;
      } else {
        const key = normalizeKey(token.slice(0, eq));
        if (key) attrs[key] = token.slice(eq + 1);
      }
    }
    return { lang, attrs };
  }
  function classifyFence(lang, attrs = {}) {
    if (CODE_LANGS.has(lang)) return "code";
    if (MODEL_LANGS.has(lang)) return "model";
    if (PYTHON_LANGS.has(lang) && (attrs.yacv || attrs.b3d || attrs.build123d || attrs.live)) return "code";
    return null;
  }
  function looksLikePython(text) {
    return /^\s*(?:from\s+[\w.]+\s+import\b|import\s+[\w.]+|def\s+\w+\s*\(|class\s+\w+|with\s+[\w.]+\s*\(|show(?:_object)?\s*\()/m.test(
      text || ""
    );
  }
  function parseModelBlock(text) {
    const models = [];
    const codeFiles = [];
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || line.startsWith("//")) continue;
      const path = line.split(/[?#]/, 1)[0].toLowerCase();
      if (/\.(?:py|py\.gz)$/.test(path)) codeFiles.push(line);
      else models.push(line);
    }
    return { models, codeFiles };
  }
  function normalizeTagWhitespace(markdown) {
    const text = String(markdown == null ? "" : markdown);
    if (!/<yacv\b/i.test(text)) return text;
    const lines = text.split("\n");
    const out = [];
    let fence = null;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fence) {
        out.push(line);
        if (fenceMatch && fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length && /^ {0,3}[`~]+\s*$/.test(line)) {
          fence = null;
        }
        continue;
      }
      if (fenceMatch) {
        fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
        out.push(line);
        continue;
      }
      if (/^ {0,3}<yacv\b/i.test(line)) {
        out.push(line);
        if (!/<\/yacv>/i.test(line)) {
          const next = lines[i + 1];
          if (next !== void 0 && next.trim() !== "") out.push("");
        }
        continue;
      }
      if (/^ {0,3}<\/yacv>/i.test(line)) {
        const previous = out[out.length - 1];
        if (previous !== void 0 && previous.trim() !== "") out.push("");
        out.push(line);
        continue;
      }
      out.push(line);
    }
    return out.join("\n");
  }

  // src/options.js
  var DEFAULT_VIEWER = "https://gllmar.github.io/docsify-yacv/viewer/";
  var DEFAULT_OPEN_VIEWER = "https://yeicor-3d.github.io/yet-another-cad-viewer/";
  var YACV_SETTING_TYPES = {
    loadHelpers: "boolean",
    edgeWidth: "number",
    displayLoadingEveryMs: "number",
    monitorEveryMs: "number",
    monitorOpenTimeoutMs: "number",
    autoplay: "boolean",
    arModes: "string",
    zoomSensitivity: "number",
    orbitSensitivity: "number",
    panSensitivity: "number",
    exposure: "number",
    shadowIntensity: "number",
    environment: "string",
    environmentIntensity: "number",
    skybox: "string",
    pg_version: "string",
    pg_debug: "boolean",
    pg_constraints: "string",
    pg_opacity_loading: "number",
    pg_opacity_loaded: "number"
  };
  var YACV_SETTINGS_BY_KEY = new Map(
    Object.keys(YACV_SETTING_TYPES).map((key) => [normalizeSettingKey(key), key])
  );
  var DEFAULT_OPTIONS = {
    viewer: DEFAULT_VIEWER,
    /** Viewer used by the "Open" action (default: the full upstream viewer). */
    openViewer: DEFAULT_OPEN_VIEWER,
    height: "480px",
    title: "",
    /** build123d version installed by the in-browser playground. */
    version: "stable",
    /** Use OCP.wasm debug wheels (better crash reports, newer dev builds). */
    debug: false,
    /**
     * Global pip constraints for the playground, newline separated.
     * e.g. `"numpy<2\npackaging>=24"`.
     */
    constraints: "",
    /**
     * Opacity of the in-iframe playground editor (0 hides it, so the 3D model
     * stays interactive; docsify already displays the code next to the viewer).
     */
    editor: 0,
    /** Defer iframe creation until the embed scrolls into view. */
    lazy: true,
    /** How far before the viewport (CSS px or %) a lazy embed starts loading. */
    lazyMargin: "200px",
    /** Maximum number of iframes created at the same time. */
    maxConcurrent: 2,
    /**
     * Maximum number of loaded live build123d sandboxes. A sandbox holds this
     * slot until its embed is unloaded, so pages with many live examples do not
     * boot many Pyodide instances at once.
     */
    maxLiveConcurrent: 2,
    /**
     * How long a live sandbox holds its live-concurrency slot after its viewer
     * loads (`0` = until the embed is unloaded). Prevents both unbounded Pyodide
     * boots and a permanent wait when several live embeds are visible together.
     */
    liveSlotMs: 3e4,
    /**
     * Remove far-offscreen iframes to free memory/CPU. `true` unloads every
     * embed, `'static'` only non-code embeds, `false` keeps everything alive.
     */
    unloadOffscreen: true,
    /** How far outside the viewport an embed is unloaded (CSS px or %). */
    unloadMargin: "100% 0px",
    /** Load automatically. When false, a "Load 3D viewer" button is shown. */
    autoLoad: true,
    /** Show the small embed toolbar (title, code toggle, reload, open). */
    chrome: true,
    /** Show the "Open in yacv" action in the toolbar. */
    openInNewTab: true,
    /** Extra settings forwarded to the yacv frontend for every embed. */
    settings: {},
    /** Base URL (or resolver function) used for relative model/code paths. */
    base: null
  };
  function resolveOptions(userOptions = {}, vm = null) {
    const fromConfig = vm && vm.config && isPlainObject(vm.config.yacv) ? vm.config.yacv : {};
    const own = isPlainObject(userOptions) ? userOptions : {};
    const merged = { ...DEFAULT_OPTIONS, ...fromConfig, ...own };
    merged.settings = {
      ...isPlainObject(fromConfig.settings) ? fromConfig.settings : {},
      ...isPlainObject(own.settings) ? own.settings : {}
    };
    merged.version = merged.version == null || merged.version === "" ? "stable" : String(merged.version);
    merged.debug = toBool(merged.debug, false);
    merged.constraints = merged.constraints == null ? "" : String(merged.constraints);
    merged.editor = normalizeEditor(merged.editor, 0);
    merged.lazy = toBool(merged.lazy, true);
    merged.lazyMargin = normalizeMargin(merged.lazyMargin, DEFAULT_OPTIONS.lazyMargin);
    merged.unloadMargin = normalizeMargin(merged.unloadMargin, DEFAULT_OPTIONS.unloadMargin);
    merged.runtime = merged.runtime === "worker" ? "worker" : "viewer";
    merged.workerUrl = merged.workerUrl == null ? "" : String(merged.workerUrl);
    merged.workerWarmup = toBool(merged.workerWarmup, true);
    merged.maxConcurrent = Math.max(1, Math.floor(toNumber(merged.maxConcurrent, 2)));
    merged.maxLiveConcurrent = Math.max(1, Math.floor(toNumber(merged.maxLiveConcurrent, 2)));
    merged.liveSlotMs = Math.max(0, Math.floor(toNumber(merged.liveSlotMs, 3e4)));
    if (merged.unloadOffscreen === "static") merged.unloadOffscreen = "static";
    else merged.unloadOffscreen = toBool(merged.unloadOffscreen, true);
    merged.autoLoad = toBool(merged.autoLoad, true);
    merged.chrome = toBool(merged.chrome, true);
    merged.openInNewTab = toBool(merged.openInNewTab, true);
    merged.height = merged.height == null || merged.height === "" ? DEFAULT_OPTIONS.height : merged.height;
    merged.title = merged.title == null ? "" : String(merged.title);
    merged.poster = merged.poster == null ? "" : String(merged.poster);
    merged.viewer = merged.viewer == null || merged.viewer === "" ? DEFAULT_VIEWER : String(merged.viewer);
    merged.openViewer = merged.openViewer == null || merged.openViewer === "" ? DEFAULT_OPEN_VIEWER : String(merged.openViewer);
    merged.editorExplicit = Object.prototype.hasOwnProperty.call(fromConfig, "editor") || Object.prototype.hasOwnProperty.call(own, "editor");
    return (
      /** @type {ResolvedOptions} */
      merged
    );
  }
  function normalizeMargin(value, fallback) {
    if (value == null || value === "") return fallback;
    const s = typeof value === "number" ? `${value}px` : String(value).trim();
    if (/^\d+(\.\d+)?$/.test(s)) return `${s}px`;
    if (/^\d+(\.\d+)?(px|%)(\s+\d+(\.\d+)?(px|%)){0,3}$/.test(s)) return s;
    return fallback;
  }
  function normalizeEditor(value, fallback = 0) {
    if (value == null || value === "") return fallback;
    if (typeof value === "boolean") return value ? 0.9 : 0;
    if (typeof value === "string") {
      const s = value.trim().toLowerCase();
      if (["hide", "false", "off", "no", "none", "0"].includes(s)) return 0;
      if (["show", "true", "on", "yes"].includes(s)) return 0.9;
    }
    const n = toNumber(value, fallback);
    return Math.min(1, Math.max(0, n));
  }

  // src/url.js
  function normalizeSettingValue(key, value) {
    const type = YACV_SETTING_TYPES[key];
    if (!type) return null;
    if (value == null) return null;
    switch (type) {
      case "boolean":
        return toBool(value) ? "true" : "false";
      case "number": {
        const n = typeof value === "number" ? value : Number(String(value).trim());
        return Number.isFinite(n) ? String(n) : null;
      }
      default:
        return String(value);
    }
  }
  function collectSettings(attrs = {}, optionsSettings = {}) {
    const out = {};
    for (const [key, value] of Object.entries(optionsSettings || {})) {
      const canonical = YACV_SETTINGS_BY_KEY.get(normalizeSettingKey(key));
      if (canonical && value != null) out[canonical] = /** @type {any} */
      value;
    }
    for (const [key, value] of Object.entries(attrs || {})) {
      const canonical = YACV_SETTINGS_BY_KEY.get(normalizeSettingKey(key));
      if (canonical && value != null) out[canonical] = /** @type {any} */
      value;
    }
    return out;
  }
  function normalizeConstraints(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(String).join("\n").trim();
    if (isPlainObject(value)) return JSON.stringify(value);
    return String(value).replace(/\\n/g, "\n").replace(/;/g, "\n").trim();
  }
  function normalizeAttrs(attrs) {
    const out = {};
    for (const [key, value] of Object.entries(attrs || {})) {
      out[normalizeKey(key)] = value;
    }
    return out;
  }
  function pickAttr(attrs, ...names) {
    for (const name of names) {
      if (attrs && Object.prototype.hasOwnProperty.call(attrs, name)) return attrs[name];
    }
    return void 0;
  }
  function parseShowCode(value) {
    if (value == null) return null;
    if (typeof value === "boolean") return value;
    const s = String(value).trim().toLowerCase();
    if (s === "") return true;
    if (["hide", "false", "off", "no", "none", "0"].includes(s)) return false;
    if (["show", "true", "on", "yes", "1"].includes(s)) return true;
    return null;
  }
  function buildParams({ hasCode, models = [], attrs = {}, options, base }) {
    const params = new URLSearchParams();
    attrs = normalizeAttrs(attrs);
    const editorAttr = pickAttr(attrs, "editor");
    const editor = editorAttr === void 0 ? options.editor : normalizeEditor(editorAttr, options.editor);
    const editorExplicit = editorAttr !== void 0 || options.editorExplicit === true;
    const version = pickAttr(attrs, "version", "b3dversion", "pgversion", "pg_version");
    const debug = pickAttr(attrs, "debug", "pgdebug", "pg_debug");
    const constraints = pickAttr(attrs, "constraints", "pgconstraints", "pg_constraints");
    const settings = collectSettings(attrs, options.settings);
    for (const [key, value] of Object.entries(settings)) {
      if (hasCode && ["pg_version", "pg_debug", "pg_constraints"].includes(key)) continue;
      if (editorExplicit && ["pg_opacity_loading", "pg_opacity_loaded"].includes(key)) continue;
      const normalized = normalizeSettingValue(key, value);
      if (normalized != null) params.set(key, normalized);
    }
    if (hasCode) {
      params.set("pg_version", String(version == null || version === "" ? options.version : version));
      params.set("pg_debug", toBool(debug === void 0 ? options.debug : debug) ? "true" : "false");
      const normalizedConstraints = normalizeConstraints(constraints === void 0 ? options.constraints : constraints);
      if (normalizedConstraints) params.set("pg_constraints", normalizedConstraints);
    }
    if (editorExplicit) {
      params.set("pg_opacity_loading", String(editor));
      params.set("pg_opacity_loaded", String(editor));
    } else if (hasCode) {
      if (!params.has("pg_opacity_loading")) params.set("pg_opacity_loading", String(editor));
      if (!params.has("pg_opacity_loaded")) params.set("pg_opacity_loaded", String(editor));
    }
    const modelCandidates = [
      ...splitList(pickAttr(attrs, "models")),
      ...splitList(pickAttr(attrs, "src")),
      ...splitList(pickAttr(attrs, "preview")),
      ...splitList(pickAttr(attrs, "preload")),
      ...models
    ];
    const resolvedModels = [];
    for (const candidate of modelCandidates) {
      const url = resolveUrl(candidate, base);
      if (url && !resolvedModels.includes(url)) resolvedModels.push(url);
    }
    for (const url of resolvedModels) params.append("preload", url);
    if (!hasCode && resolvedModels.length === 0 && params.toString() === "") return null;
    return params;
  }
  function buildViewerUrl(viewer, params, documentBase) {
    const base = documentBase || (typeof document !== "undefined" ? document.baseURI : void 0);
    const href = resolveUrl(viewer || DEFAULT_VIEWER, base);
    try {
      const url = new URL(href, base);
      url.hash = params.toString();
      return url.href;
    } catch {
      return `${href}${href.includes("#") ? "" : "#"}${params.toString()}`;
    }
  }
  function resolveBase(options, vm) {
    if (typeof options.base === "function" || typeof options.base === "string" && options.base.trim()) {
      return options.base;
    }
    if (vm && vm.config && typeof vm.config.basePath === "string" && vm.config.basePath.trim()) {
      try {
        return new URL(vm.config.basePath, typeof document !== "undefined" ? document.baseURI : void 0).href;
      } catch {
      }
    }
    return typeof document !== "undefined" ? document.baseURI : "";
  }

  // src/worker-runtime.js
  function decodeBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  var WorkerRuntime = class {
    /**
     * @param {string} url Same-origin worker script URL.
     */
    constructor(url) {
      this.url = url;
      this.worker = null;
      this.key = "";
      this.ready = null;
      this.runId = 0;
      this.pending = /* @__PURE__ */ new Map();
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
      this.worker = new Worker(this.url, { type: "module" });
      this.ready = new Promise((resolve, reject) => {
        const worker = (
          /** @type {Worker} */
          this.worker
        );
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("Python worker bootstrap timed out"));
          this.dispose();
        }, 24e4);
        worker.onmessage = (event) => {
          const message = event.data || {};
          if (message.type === "ready") {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve();
            }
            return;
          }
          if (message.type === "result" || message.type === "error") {
            const entry = this.pending.get(message.id);
            if (!entry) return;
            this.pending.delete(message.id);
            if (message.type === "error") {
              entry.reject(new Error(message.error || "Python worker error"));
              return;
            }
            const models = [];
            for (const model of message.models || []) {
              try {
                const bytes = decodeBase64(String(model.data || ""));
                models.push({
                  name: String(model.name || "model"),
                  hash: model.hash == null ? null : String(model.hash),
                  bytes
                });
              } catch {
              }
            }
            entry.resolve(models);
            return;
          }
          if (message.type === "boot-error" && !settled) {
            settled = true;
            clearTimeout(timer);
            reject(new Error(message.error || "Python worker bootstrap failed"));
            this.dispose();
          }
        };
        worker.onerror = (event) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(new Error(event.message || "Python worker failed to start"));
          }
          this.failAll(new Error(event.message || "Python worker failed"));
          this.dispose();
        };
        worker.postMessage({
          type: "init",
          version: settings.version,
          debug: settings.debug,
          constraints: settings.constraints
        });
      });
      this.ready.catch(() => {
      });
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
        if (!worker) throw new Error("Python worker is not available");
        const id = ++this.runId;
        return new Promise((resolve, reject) => {
          this.pending.set(id, { resolve, reject });
          worker.postMessage({ type: "run", id, code });
        });
      });
      this.chain = job.then(
        () => void 0,
        () => void 0
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
      this.key = "";
      this.failAll(new Error("Python worker restarted"));
    }
  };
  var shared = null;
  function getWorkerRuntime(url) {
    if (!shared || shared.url !== url) {
      shared?.dispose();
      shared = new WorkerRuntime(url);
    }
    return shared;
  }

  // src/mount.js
  var PROCESSED = "data-yacv-processed";
  var stageContexts = /* @__PURE__ */ new WeakMap();
  var observedStages = /* @__PURE__ */ new Set();
  var observer = null;
  var unloadObserver = null;
  var unloadObservedStages = /* @__PURE__ */ new Set();
  var loadQueue = [];
  var activeContexts = /* @__PURE__ */ new Set();
  var liveContexts = /* @__PURE__ */ new Set();
  var activeLoads = 0;
  var liveActive = 0;
  var maxConcurrent = 2;
  var maxLiveConcurrent = 2;
  var fetchCache = /* @__PURE__ */ new Map();
  var ICONS = {
    code: "M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z",
    open: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
    play: "M8,5.14V19.14L19,12.14L8,5.14Z",
    reload: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"
  };
  function mountAll(vm, options) {
    if (typeof document === "undefined") return;
    const root = document.querySelector(".markdown-section");
    if (!root) return;
    maxConcurrent = Math.max(1, Math.floor(options.maxConcurrent || 2));
    maxLiveConcurrent = Math.max(1, Math.floor(options.maxLiveConcurrent || 2));
    pruneObserver();
    pumpQueue();
    for (const pre of Array.from(root.querySelectorAll(`pre[data-lang]:not([${PROCESSED}])`))) {
      try {
        prepareFence(pre, vm, options);
      } catch (err) {
        pre.setAttribute(PROCESSED, "");
        console.error("[docsify-yacv] Failed to set up code block:", err);
      }
    }
    for (const tag of Array.from(root.querySelectorAll(`yacv:not([${PROCESSED}])`))) {
      try {
        prepareTag(tag, vm, options);
      } catch (err) {
        tag.setAttribute(PROCESSED, "");
        console.error("[docsify-yacv] Failed to set up <yacv> element:", err);
      }
    }
  }
  function prepareFence(pre, vm, options) {
    const { lang, attrs } = parseInfoString(pre.getAttribute("data-lang") || "");
    const kind = classifyFence(lang, attrs);
    if (!kind) return;
    pre.setAttribute(PROCESSED, "");
    pre.setAttribute("data-lang", kind === "model" ? "yacv" : lang || "build123d");
    const text = pre.textContent || "";
    let code = null;
    let codeUrl = null;
    let models = [];
    if (kind === "code") {
      code = text.trim() ? text : null;
      codeUrl = stringAttr(attrs.codesrc) || null;
    } else if (looksLikePython(text)) {
      code = text;
    } else {
      const parsed = parseModelBlock(text);
      models = parsed.models;
      codeUrl = parsed.codeFiles[0] || null;
      if (parsed.codeFiles.length > 1) {
        console.warn(
          "[docsify-yacv] A yacv block can reference at most one Python file; ignoring:",
          parsed.codeFiles.slice(1)
        );
      }
    }
    ensureResourceHints(options.viewer, false);
    const inlineCode = !!(code && code.trim());
    if (inlineCode) highlightPrePython(pre, code);
    const explicitShow = parseShowCode(attrs.code);
    const wrap = el("div", "yacv-code");
    pre.replaceWith(wrap);
    wrap.appendChild(pre);
    const ctx = createEmbed(
      {
        attrs,
        code,
        codeUrl,
        models,
        kind: "fence",
        showCode: explicitShow == null ? inlineCode : explicitShow
      },
      vm,
      options
    );
    if (inlineCode) {
      ctx.codeWrap = wrap;
      addCopyButton(wrap, () => code);
    } else {
      wrap.hidden = true;
    }
    wrap.after(ctx.container);
    if (inlineCode) mountCodeToggle(ctx);
    finishSetup(ctx);
  }
  function prepareTag(tag, vm, options) {
    tag.setAttribute(PROCESSED, "");
    const attrs = elementAttrs(tag);
    const scripts = Array.from(tag.querySelectorAll("script")).filter((script) => {
      const type = (script.getAttribute("type") || "").toLowerCase();
      return type === "text/x-python" || type === "text/x-build123d" || script.hasAttribute("data-yacv-code");
    });
    const inlineCode = scripts.map((script) => script.textContent || "").join("\n\n").trim();
    let codeUrl = stringAttr(attrs.codesrc) || null;
    const models = splitList(attrs.models);
    const src = stringAttr(attrs.src);
    if (src) {
      if (/\.(?:py|py\.gz)(?:[?#].*)?$/i.test(src)) codeUrl = codeUrl || src;
      else models.push(src);
    }
    scripts.forEach((script) => script.remove());
    ensureResourceHints(options.viewer, false);
    const hasInline = !!inlineCode;
    const explicitShow = parseShowCode(attrs.code);
    const ctx = createEmbed(
      {
        attrs: without(attrs, ["src", "models", "codesrc"]),
        code: hasInline ? inlineCode : null,
        codeUrl,
        models,
        kind: "tag",
        showCode: explicitShow == null ? hasInline : explicitShow,
        id: stringAttr(attrs.id),
        className: stringAttr(attrs.class)
      },
      vm,
      options
    );
    const parent = tag.parentElement;
    if (parent && parent.tagName === "P" && parent.children.length === 1 && !(parent.textContent || "").trim()) {
      parent.replaceWith(ctx.container);
    } else {
      tag.replaceWith(ctx.container);
    }
    if (hasInline) {
      createCodePanel(ctx, inlineCode);
      mountCodeToggle(ctx);
    }
    finishSetup(ctx);
  }
  function sameOrigin(url) {
    try {
      return new URL(url, document.baseURI).origin === window.location.origin;
    } catch {
      return false;
    }
  }
  function createEmbed(spec, vm, options) {
    const attrs = spec.attrs || {};
    const base = resolveBase(options, vm);
    const height = cssSize(pick(attrs, "height") ?? options.height, "480px");
    const title = stringAttr(pick(attrs, "title")) || options.title || "";
    const poster = stringAttr(pick(attrs, "poster")) || options.poster || "";
    const viewer = stringAttr(pick(attrs, "viewer")) || options.viewer;
    const openViewer = stringAttr(pick(attrs, "openviewer")) || options.openViewer || viewer;
    const version = stringAttr(pick(attrs, "version", "b3dversion", "pgversion", "pg_version")) || options.version;
    const modelCount = spec.models.length + splitList(pick(attrs, "models")).length + splitList(pick(attrs, "src")).length + splitList(pick(attrs, "preview")).length + splitList(pick(attrs, "preload")).length;
    const autoLoad = pick(attrs, "autoload") === void 0 ? options.autoLoad : toBool(pick(attrs, "autoload"), options.autoLoad);
    const runtimeMode = stringAttr(pick(attrs, "runtime")) || options.runtime;
    const workerUrl = stringAttr(pick(attrs, "worker", "workerurl")) || options.workerUrl;
    const workerMode = runtimeMode === "worker" && !!workerUrl && sameOrigin(workerUrl) && sameOrigin(viewer);
    if (runtimeMode === "worker" && !workerMode) {
      console.warn(
        "[docsify-yacv] Worker runtime requires a same-origin viewer and workerUrl; using the per-viewer runtime."
      );
    }
    const workerSettings = {
      version: options.version,
      debug: toBool(options.debug, false),
      constraints: normalizeConstraints(options.constraints || "")
    };
    const lazy = pick(attrs, "lazy") === void 0 ? options.lazy : toBool(pick(attrs, "lazy"), options.lazy);
    const chrome = pick(attrs, "chrome") === void 0 ? options.chrome : toBool(pick(attrs, "chrome"), options.chrome);
    const container = el("div", "yacv-embed");
    container.setAttribute("data-yacv", "");
    if (spec.id) container.id = spec.id;
    if (spec.className) container.classList.add(...spec.className.split(/\s+/).filter(Boolean));
    const toolbar = el("div", "yacv-toolbar");
    const titleEl = el("span", "yacv-title");
    if (title) titleEl.textContent = title;
    else titleEl.hidden = true;
    toolbar.appendChild(titleEl);
    const hasCode = !!(spec.code && spec.code.trim()) || !!spec.codeUrl;
    const badge = el("span", "yacv-badge");
    if (hasCode) {
      badge.textContent = `build123d \xB7 ${version}`;
    } else if (modelCount > 1) {
      badge.textContent = `${modelCount} models`;
    } else {
      badge.hidden = true;
    }
    toolbar.appendChild(badge);
    const actions = el("div", "yacv-actions");
    toolbar.appendChild(actions);
    const stage = el("div", "yacv-stage");
    if (height === "auto") stage.setAttribute("data-aspect", "true");
    else stage.style.height = height;
    container.appendChild(toolbar);
    container.appendChild(stage);
    const ctx = {
      vm,
      options,
      attrs,
      base,
      viewer,
      openViewer,
      models: spec.models,
      container,
      toolbar,
      titleEl,
      actions,
      stage,
      state: "idle",
      url: null,
      openUrl: null,
      iframe: null,
      loading: null,
      inlineCode: spec.code,
      codeUrl: spec.codeUrl,
      fetchedCode: null,
      codePromise: null,
      codeWrap: null,
      codeBtn: null,
      showCode: !!spec.showCode,
      placeholder: null,
      title,
      poster,
      posterEl: null,
      version,
      autoLoad,
      lazy,
      chrome,
      workerMode,
      workerUrl,
      workerSettings,
      workerModels: null,
      appliedWorkerNames: [],
      workerPromise: null,
      openNeedsCode: false,
      timer: null,
      queued: false,
      priority: false,
      startPromise: null,
      resolveStart: null,
      slotHeld: false,
      activeSlotId: null,
      slotSeq: 0,
      liveSlotHeld: false,
      liveTimer: null,
      pendingUnload: false
    };
    ctx.hasCode = hasCode;
    ctx.live = true;
    stageContexts.set(stage, ctx);
    const openAttr = pick(attrs, "open");
    if (chrome && options.openInNewTab && (openAttr === void 0 || toBool(openAttr, true))) addOpenButton(ctx);
    if (hasCode) addReloadButton(ctx);
    const hasBadge = hasCode || modelCount > 1;
    if (!chrome || !title && !hasBadge && ctx.actions.childElementCount === 0) {
      toolbar.hidden = true;
    }
    return ctx;
  }
  function hasStaticModels(ctx) {
    if (ctx.models && ctx.models.length > 0) return true;
    return ["models", "src", "preview", "preload"].some((key) => splitList(ctx.attrs[key]).length > 0);
  }
  function createPoster(ctx) {
    if (!ctx.poster || ctx.posterEl) return;
    const poster = el("img", "yacv-poster");
    poster.src = resolveUrl(ctx.poster, ctx.base);
    poster.alt = ctx.title ? `${ctx.title} preview` : "3D model preview";
    poster.loading = "eager";
    poster.addEventListener(
      "error",
      () => {
        poster.remove();
        ctx.posterEl = null;
        if (ctx.autoLoad === false) scheduleLoad(ctx, "The preview loads when it becomes visible.");
      },
      { once: true }
    );
    ctx.posterEl = poster;
    ctx.stage.appendChild(poster);
  }
  function finishSetup(ctx) {
    observeUnload(ctx);
    createPoster(ctx);
    if (ctx.autoLoad === false) {
      if (ctx.chrome && ctx.hasCode && hasStaticModels(ctx)) {
        ctx.live = false;
        addRunButton(ctx);
        if (ctx.poster) {
          const load2 = () => enqueueLoad(ctx, true);
          ctx.container.addEventListener("pointerenter", load2, { once: true });
          ctx.container.addEventListener("pointerdown", load2, { once: true });
          ctx.container.addEventListener("focusin", load2, { once: true });
          ctx.container.addEventListener("click", load2, { once: true });
        } else {
          scheduleLoad(ctx, "The preview loads when it becomes visible.");
        }
        if (ctx.workerMode && ctx.hasCode) {
          warmWorkerOnIntent(ctx);
          setTimeout(() => {
            if (ctx.workerMode && ctx.live === false && ctx.stage.isConnected && !ctx.workerPromise && !ctx.workerModels) {
              warmWorker(ctx);
            }
          }, 1500);
        }
        return;
      }
      showPlaceholder(ctx, {
        text: "The 3D viewer is not loaded yet.",
        button: { label: "Load 3D viewer", onClick: () => enqueueLoad(ctx, true) }
      });
      return;
    }
    if (ctx.workerMode && ctx.hasCode) warmWorker(ctx);
    scheduleLoad(ctx, "The 3D viewer loads when it becomes visible.");
  }
  function scheduleLoad(ctx, text) {
    if (!ctx.lazy || typeof IntersectionObserver === "undefined") {
      enqueueLoad(ctx);
      return;
    }
    if (!ctx.posterEl) showPlaceholder(ctx, { text });
    ensureObserver(ctx.options).observe(ctx.stage);
    observedStages.add(ctx.stage);
  }
  function ensureObserver(options) {
    if (observer) return observer;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          observedStages.delete(entry.target);
          const ctx = stageContexts.get(entry.target);
          if (ctx) enqueueLoad(ctx);
        }
      },
      { rootMargin: options.lazyMargin || "200px" }
    );
    return observer;
  }
  function ensureUnloadObserver(options) {
    if (unloadObserver) return unloadObserver;
    unloadObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) continue;
          const ctx = stageContexts.get(entry.target);
          if (ctx) unload(ctx);
        }
      },
      { rootMargin: options.unloadMargin || "200% 0px" }
    );
    return unloadObserver;
  }
  function shouldUnload(ctx) {
    if (ctx.options.unloadOffscreen === "static") return !ctx.hasCode;
    return ctx.options.unloadOffscreen !== false;
  }
  function observeUnload(ctx) {
    if (!shouldUnload(ctx) || typeof IntersectionObserver === "undefined") return;
    ensureUnloadObserver(ctx.options).observe(ctx.stage);
    unloadObservedStages.add(ctx.stage);
  }
  function unload(ctx) {
    removeFromQueue(ctx);
    if (ctx.state === "loading") {
      ctx.pendingUnload = true;
      return;
    }
    if (!ctx.iframe) return;
    if (ctx.timer) clearTimeout(ctx.timer);
    ctx.timer = null;
    ctx.iframe.remove();
    ctx.iframe = null;
    clearPlaceholder(ctx);
    releaseSlot(ctx, ctx.activeSlotId);
    releaseLiveSlot(ctx);
    setState(ctx, "idle");
    ctx.url = null;
    ctx.openUrl = null;
    ctx.loading = null;
    ctx.pendingUnload = false;
    if (ctx.posterEl) ctx.posterEl.hidden = false;
    if (typeof IntersectionObserver === "undefined") {
      enqueueLoad(ctx);
    } else {
      ensureObserver(ctx.options).observe(ctx.stage);
      observedStages.add(ctx.stage);
    }
  }
  function pruneObserver() {
    for (const ctx of Array.from(activeContexts)) {
      if (!ctx.stage.isConnected) {
        releaseSlot(ctx, ctx.activeSlotId);
        ctx.loading = null;
        ctx.state = "idle";
      }
    }
    for (const ctx of Array.from(liveContexts)) {
      if (!ctx.stage.isConnected) releaseLiveSlot(ctx);
    }
    if (observer) {
      for (const stage of Array.from(observedStages)) {
        if (!stage.isConnected) {
          observer.unobserve(stage);
          observedStages.delete(stage);
        }
      }
    }
    if (unloadObserver) {
      for (const stage of Array.from(unloadObservedStages)) {
        if (!stage.isConnected) {
          unloadObserver.unobserve(stage);
          unloadObservedStages.delete(stage);
        }
      }
    }
  }
  function enqueueLoad(ctx, priority = false) {
    if (ctx.state === "ready" || ctx.state === "loading" || ctx.state === "error") return;
    if (ctx.queued) {
      if (priority) {
        const idx = loadQueue.indexOf(ctx);
        if (idx > 0) {
          loadQueue.splice(idx, 1);
          loadQueue.unshift(ctx);
        }
        ctx.priority = true;
      }
      return;
    }
    ctx.queued = true;
    ctx.priority = !!priority;
    ctx.startPromise = new Promise((resolve) => {
      ctx.resolveStart = resolve;
    });
    if (ctx.priority) loadQueue.unshift(ctx);
    else loadQueue.push(ctx);
    pumpQueue();
  }
  function pumpQueue() {
    while (activeLoads < maxConcurrent && loadQueue.length > 0) {
      const index = pickNextIndex();
      if (index === -1) return;
      const ctx = loadQueue.splice(index, 1)[0];
      ctx.queued = false;
      ctx.priority = false;
      if (!ctx.stage.isConnected) {
        ctx.resolveStart?.();
        ctx.resolveStart = null;
        ctx.startPromise = null;
        continue;
      }
      if (!acquireLiveSlot(ctx)) {
        ctx.queued = true;
        loadQueue.unshift(ctx);
        return;
      }
      activeLoads += 1;
      activeContexts.add(ctx);
      ctx.slotHeld = true;
      ctx.activeSlotId = (ctx.slotSeq || 0) + 1;
      ctx.slotSeq = ctx.activeSlotId;
      const slot = ctx.activeSlotId;
      ctx.resolveStart?.();
      ctx.resolveStart = null;
      ctx.startPromise = null;
      load(ctx, slot);
    }
  }
  function pickNextIndex() {
    let best = -1;
    let bestPriority = false;
    let bestDistance = Infinity;
    for (let i = 0; i < loadQueue.length; i += 1) {
      const ctx = loadQueue[i];
      if (!ctx.stage.isConnected) {
        loadQueue.splice(i, 1);
        i -= 1;
        ctx.queued = false;
        ctx.resolveStart?.();
        ctx.resolveStart = null;
        ctx.startPromise = null;
        continue;
      }
      if (needsLiveSlot(ctx) && liveActive >= maxLiveConcurrent) continue;
      const isPriority = !!ctx.priority;
      const distance = distanceToViewport(ctx.stage);
      if (best === -1 || isPriority && !bestPriority || isPriority === bestPriority && distance < bestDistance) {
        best = i;
        bestPriority = isPriority;
        bestDistance = distance;
      }
    }
    return best;
  }
  function distanceToViewport(el2) {
    try {
      const rect = el2.getBoundingClientRect();
      const viewportMiddle = (window.innerHeight || 0) / 2;
      return Math.abs(rect.top + rect.height / 2 - viewportMiddle);
    } catch {
      return Infinity;
    }
  }
  function releaseSlot(ctx, slot = null) {
    if (!ctx.slotHeld) return;
    if (slot != null && ctx.activeSlotId !== slot) return;
    ctx.slotHeld = false;
    ctx.activeSlotId = null;
    activeContexts.delete(ctx);
    activeLoads = Math.max(0, activeLoads - 1);
    pumpQueue();
  }
  function needsLiveSlot(ctx) {
    return ctx.hasCode && !ctx.workerMode && ctx.live !== false && !ctx.liveSlotHeld;
  }
  function acquireLiveSlot(ctx) {
    if (!needsLiveSlot(ctx)) return true;
    if (liveActive >= maxLiveConcurrent) return false;
    ctx.liveSlotHeld = true;
    liveContexts.add(ctx);
    liveActive += 1;
    return true;
  }
  function releaseLiveSlot(ctx) {
    if (ctx.liveTimer) clearTimeout(ctx.liveTimer);
    ctx.liveTimer = null;
    if (!ctx.liveSlotHeld) return;
    ctx.liveSlotHeld = false;
    liveContexts.delete(ctx);
    liveActive = Math.max(0, liveActive - 1);
    pumpQueue();
  }
  function startLiveHold(ctx) {
    if (!ctx.liveSlotHeld || ctx.liveTimer) return;
    const ms = ctx.options.liveSlotMs;
    if (!ms) return;
    ctx.liveTimer = setTimeout(() => {
      ctx.liveTimer = null;
      releaseLiveSlot(ctx);
    }, ms);
  }
  function removeFromQueue(ctx) {
    if (!ctx.queued) return;
    const idx = loadQueue.indexOf(ctx);
    if (idx !== -1) loadQueue.splice(idx, 1);
    ctx.queued = false;
    ctx.priority = false;
    ctx.resolveStart?.();
    ctx.resolveStart = null;
    ctx.startPromise = null;
  }
  function ensureCode(ctx) {
    if (ctx.inlineCode) return Promise.resolve(ctx.inlineCode);
    if (ctx.fetchedCode != null) return Promise.resolve(ctx.fetchedCode);
    if (!ctx.codeUrl) return Promise.resolve(null);
    if (ctx.codePromise) return ctx.codePromise;
    const resolved = resolveUrl(ctx.codeUrl, ctx.base);
    const promise = fetchCode(resolved).then((code) => {
      ctx.fetchedCode = code;
      return code;
    });
    ctx.codePromise = promise.catch((err) => {
      ctx.codePromise = null;
      throw err;
    });
    return ctx.codePromise;
  }
  function fetchCode(url) {
    if (fetchCache.has(url)) return fetchCache.get(url);
    const promise = fetch(url, { credentials: "same-origin" }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url} (HTTP ${response.status})`);
      }
      return response.text();
    });
    fetchCache.set(url, promise);
    promise.catch(() => fetchCache.delete(url));
    return promise;
  }
  function load(ctx, slot = ctx.activeSlotId) {
    if (ctx.state === "ready") {
      releaseSlot(ctx, slot);
      return Promise.resolve(ctx);
    }
    if (ctx.loading) {
      releaseSlot(ctx, slot);
      return ctx.loading;
    }
    setState(ctx, "loading");
    if (ctx.posterEl) ctx.posterEl.hidden = false;
    else showPlaceholder(ctx, { spinner: true, text: "Loading 3D viewer\u2026" });
    const loading = (async () => {
      try {
        if (ctx.iframe) {
          ctx.iframe.remove();
          ctx.iframe = null;
        }
        let code = null;
        if (ctx.live !== false) {
          try {
            code = await ensureCode(ctx);
          } catch (err) {
            if (!hasStaticModels(ctx)) throw err;
            console.warn("[docsify-yacv]", err);
          }
        }
        if (code && ctx.showCode && !ctx.codeWrap) {
          createCodePanel(ctx, code);
          mountCodeToggle(ctx);
        }
        if (slot !== ctx.activeSlotId) return ctx;
        const hasCode = !!(code && code.trim());
        const viewerHasCode = hasCode && !ctx.workerMode;
        if (!hasCode) releaseLiveSlot(ctx);
        if (hasCode) ensureResourceHints(ctx.viewer, true);
        let params = buildParams({
          hasCode: viewerHasCode,
          models: ctx.models,
          attrs: ctx.attrs,
          options: ctx.options,
          base: ctx.base
        });
        if (!params && ctx.workerMode && hasCode) {
          params = new URLSearchParams();
        }
        if (!params) {
          throw new Error("Nothing to show: add build123d code or a .glb/.gltf model.");
        }
        if (viewerHasCode) params.set("pg_code", await encodeCode(code));
        if (slot !== ctx.activeSlotId) return ctx;
        const url = buildViewerUrl(ctx.viewer, params);
        ctx.url = url;
        ctx.openNeedsCode = hasCode && (ctx.workerMode || ctx.live === false);
        const openParams = new URLSearchParams(params);
        if (hasCode && !ctx.openNeedsCode) {
          const settings = ctx.options.settings || {};
          const editorConfigured = ctx.attrs.editor !== void 0 || ctx.attrs["pg-opacity-loading"] !== void 0 || ctx.attrs.pg_opacity_loading !== void 0 || ctx.options.editorExplicit === true || "pg_opacity_loading" in settings || "pg-opacity-loading" in settings || "pgopacityloading" in settings;
          const openEditor = editorConfigured ? params.get("pg_opacity_loading") || "0" : "0.9";
          openParams.set("pg_opacity_loading", openEditor);
          openParams.set("pg_opacity_loaded", openEditor);
        }
        ctx.openUrl = buildViewerUrl(ctx.openViewer, openParams);
        const iframe = document.createElement("iframe");
        iframe.className = "yacv-iframe";
        iframe.src = url;
        iframe.title = ctx.title || "3D CAD viewer (Yet Another CAD Viewer)";
        iframe.setAttribute(
          "allow",
          "fullscreen; xr-spatial-tracking; clipboard-write; accelerometer; gyroscope"
        );
        iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        iframe.addEventListener("load", () => {
          releaseSlot(ctx, slot);
          if (ctx.iframe !== iframe) return;
          if (ctx.timer) clearTimeout(ctx.timer);
          ctx.timer = null;
          if (ctx.pendingUnload) {
            ctx.pendingUnload = false;
            unload(ctx);
            return;
          }
          if (ctx.posterEl) ctx.posterEl.hidden = true;
          if (ctx.workerMode) {
            setState(ctx, "ready");
            clearPlaceholder(ctx);
            void attachWorkerModels(ctx, iframe);
            if (ctx.live === false && !ctx.workerModels) {
              setTimeout(() => {
                if (ctx.workerMode && ctx.live === false && ctx.stage.isConnected && !ctx.workerPromise && !ctx.workerModels) {
                  warmWorker(ctx);
                }
              }, 1500);
            }
            return;
          }
          startLiveHold(ctx);
          setState(ctx, "ready");
          clearPlaceholder(ctx);
        });
        iframe.addEventListener("error", () => {
          releaseSlot(ctx, slot);
          releaseLiveSlot(ctx);
          if (ctx.iframe !== iframe) return;
          ctx.pendingUnload = false;
          setState(ctx, "error");
          showPlaceholder(ctx, {
            text: "The 3D viewer failed to load. Check your connection or the viewer URL.",
            error: true
          });
        });
        ctx.iframe = iframe;
        ctx.stage.appendChild(iframe);
        if (ctx.workerMode && ctx.live !== false && hasCode && !ctx.workerModels) {
          void startWorkerRun(ctx);
        }
        ctx.timer = setTimeout(() => {
          releaseSlot(ctx, slot);
          releaseLiveSlot(ctx);
          if (ctx.state === "loading") {
            showPlaceholder(ctx, {
              spinner: true,
              text: "Still loading \u2014 the first build123d run downloads the CAD kernel and can take a while."
            });
          }
        }, 2e4);
      } catch (err) {
        if (slot !== ctx.activeSlotId) return ctx;
        releaseSlot(ctx, slot);
        releaseLiveSlot(ctx);
        setState(ctx, "error");
        showPlaceholder(ctx, { text: describeError(err), error: true });
        console.warn("[docsify-yacv]", err);
      }
      return ctx;
    })();
    ctx.loading = loading;
    loading.finally(() => {
      if (ctx.loading === loading) ctx.loading = null;
    });
    return loading;
  }
  function mountCodeToggle(ctx) {
    if (!ctx.chrome || !ctx.actions || ctx.codeBtn) return;
    const btn = el("button", "yacv-btn");
    btn.type = "button";
    btn.appendChild(icon(ICONS.code));
    const label = el("span");
    btn.appendChild(label);
    btn.addEventListener("click", async () => {
      const visible = ctx.showCode && !!ctx.codeWrap;
      if (visible) {
        ctx.showCode = false;
        applyCodeVisibility(ctx);
        return;
      }
      ctx.showCode = true;
      if (!ctx.codeWrap) {
        try {
          const code = await ensureCode(ctx);
          if (code) createCodePanel(ctx, code);
        } catch (err) {
          showErrorInStage(ctx, describeError(err));
          return;
        }
      }
      applyCodeVisibility(ctx);
    });
    ctx.actions.insertBefore(btn, ctx.actions.firstChild);
    ctx.codeBtn = btn;
    applyCodeVisibility(ctx);
  }
  function applyCodeVisibility(ctx) {
    const hasPanel = !!ctx.codeWrap;
    if (ctx.codeWrap) ctx.codeWrap.hidden = !ctx.showCode;
    if (ctx.codeBtn) {
      ctx.codeBtn.hidden = !hasPanel;
      const label = ctx.codeBtn.querySelector("span");
      if (label) label.textContent = ctx.showCode ? "Hide code" : "Show code";
      ctx.codeBtn.title = ctx.showCode ? "Hide the source code" : "Show the source code";
      ctx.codeBtn.setAttribute("aria-label", ctx.showCode ? "Hide code" : "Show code");
    }
  }
  function createCodePanel(ctx, code) {
    if (ctx.codeWrap) {
      if (ctx.codeWrap.dataset.yacvGenerated === "1") {
        const codeEl2 = ctx.codeWrap.querySelector("code");
        if (codeEl2) codeEl2.textContent = code;
      }
      applyCodeVisibility(ctx);
      return;
    }
    const wrap = el("div", "yacv-code");
    wrap.dataset.yacvGenerated = "1";
    const pre = document.createElement("pre");
    pre.setAttribute("data-lang", "python");
    const codeEl = document.createElement("code");
    codeEl.className = "lang-python language-python";
    highlightPython(codeEl, code);
    pre.appendChild(codeEl);
    wrap.appendChild(pre);
    addCopyButton(wrap, () => code);
    ctx.container.before(wrap);
    ctx.codeWrap = wrap;
    applyCodeVisibility(ctx);
  }
  function viewerApi(iframe) {
    try {
      return iframe.contentWindow && iframe.contentWindow.__b3dLiveViewer;
    } catch {
      return null;
    }
  }
  async function waitForViewerApi(iframe, timeout = 3e3) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const api = viewerApi(iframe);
      if (api) return api;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }
  function applyWorkerModels(ctx, api) {
    if (!ctx.workerMode || !ctx.workerModels || !ctx.workerModels.length) return;
    const iframe = ctx.iframe;
    const ViewerBlob = iframe && iframe.contentWindow && iframe.contentWindow.Blob || Blob;
    const nextNames = /* @__PURE__ */ new Set();
    for (const model of ctx.workerModels) {
      nextNames.add(model.name);
      try {
        api.loadMesh(new ViewerBlob([model.bytes], { type: "model/gltf-binary" }), model.name);
      } catch (err) {
        console.warn("[docsify-yacv] Could not load worker model", model.name, err);
      }
    }
    for (const name of ctx.appliedWorkerNames || []) {
      if (!nextNames.has(name)) {
        try {
          api.removeMesh(name);
        } catch {
        }
      }
    }
    ctx.appliedWorkerNames = [...nextNames];
    ctx.container.setAttribute("data-yacv-worker", "ready");
  }
  async function attachWorkerModels(ctx, iframe) {
    const api = await waitForViewerApi(iframe, 4e3);
    if (ctx.iframe !== iframe) return;
    if (!api) {
      console.warn(
        "[docsify-yacv] The viewer does not expose __b3dLiveViewer; falling back to the per-viewer runtime."
      );
      ctx.workerMode = false;
      ctx.openNeedsCode = false;
      ctx.workerModels = null;
      reload(ctx);
      return;
    }
    applyWorkerModels(ctx, api);
    if (ctx.live !== false && !ctx.workerModels && !ctx.workerPromise) {
      void startWorkerRun(ctx);
    }
  }
  function startWorkerRun(ctx) {
    if (!ctx.workerMode || ctx.workerPromise || ctx.workerModels) return ctx.workerPromise;
    ctx.workerPromise = (async () => {
      try {
        const code = await ensureCode(ctx);
        if (!code || !code.trim()) return;
        ctx.container.setAttribute("data-yacv-worker", "booting");
        const models = await getWorkerRuntime(ctx.workerUrl).run(code, ctx.workerSettings);
        if (!ctx.workerMode) return;
        ctx.workerModels = models;
        ctx.container.setAttribute("data-yacv-worker", "ready");
        if (ctx.iframe) {
          const api = await waitForViewerApi(ctx.iframe, 5e3);
          if (api) applyWorkerModels(ctx, api);
        }
      } catch (err) {
        ctx.container.setAttribute("data-yacv-worker", "error");
        console.warn("[docsify-yacv] Python worker:", err);
      } finally {
        ctx.workerPromise = null;
      }
    })();
    return ctx.workerPromise;
  }
  function warmWorkerOnIntent(ctx) {
    if (ctx.options.workerWarmup === false) return;
    const start = () => warmWorker(ctx);
    ctx.container.addEventListener("pointerenter", start, { once: true });
    ctx.container.addEventListener("pointerdown", start, { once: true });
    ctx.container.addEventListener("focusin", start, { once: true });
  }
  var warmedWorker = "";
  function warmWorker(ctx) {
    if (!ctx.workerMode || ctx.options.workerWarmup === false) return;
    const key = `${ctx.workerUrl}|${ctx.workerSettings.version}|${ctx.workerSettings.debug}|${ctx.workerSettings.constraints}`;
    if (warmedWorker === key) return;
    warmedWorker = key;
    const start = () => {
      getWorkerRuntime(ctx.workerUrl).ensure(ctx.workerSettings).catch((err) => {
        ctx.container.setAttribute("data-yacv-worker", "error");
        console.warn("[docsify-yacv] Python worker warmup failed:", err);
      });
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(start, { timeout: 2e3 });
    else setTimeout(start, 800);
  }
  function addRunButton(ctx) {
    if (!ctx.chrome || !ctx.actions) return;
    const btn = el("button", "yacv-btn");
    btn.type = "button";
    btn.title = "Run this build123d code in the browser";
    btn.setAttribute("aria-label", "Run build123d");
    btn.appendChild(icon(ICONS.play));
    const label = el("span");
    label.textContent = "Run build123d";
    btn.appendChild(label);
    btn.addEventListener("click", async () => {
      ctx.live = true;
      if (ctx.workerMode) {
        btn.disabled = true;
        const text = btn.querySelector("span");
        if (text) text.textContent = "Building\u2026";
        try {
          await ensureLoaded(ctx);
          await startWorkerRun(ctx);
        } finally {
          btn.remove();
        }
        return;
      }
      btn.remove();
      reload(ctx);
    });
    ctx.actions.insertBefore(btn, ctx.actions.firstChild);
  }
  async function buildLiveOpenUrl(ctx) {
    const code = await ensureCode(ctx);
    if (!code || !code.trim()) return null;
    const params = buildParams({
      hasCode: true,
      models: ctx.models,
      attrs: ctx.attrs,
      options: ctx.options,
      base: ctx.base
    }) || new URLSearchParams();
    params.set("pg_code", await encodeCode(code));
    const settings = ctx.options.settings || {};
    const editorConfigured = ctx.attrs.editor !== void 0 || ctx.attrs["pg-opacity-loading"] !== void 0 || ctx.attrs.pg_opacity_loading !== void 0 || ctx.options.editorExplicit === true || "pg_opacity_loading" in settings || "pg-opacity-loading" in settings || "pgopacityloading" in settings;
    const openEditor = editorConfigured ? params.get("pg_opacity_loading") || "0" : "0.9";
    params.set("pg_opacity_loading", openEditor);
    params.set("pg_opacity_loaded", openEditor);
    return buildViewerUrl(ctx.openViewer, params);
  }
  function addOpenButton(ctx) {
    const btn = el("button", "yacv-btn");
    btn.type = "button";
    btn.title = "Open this model in the full yacv viewer";
    btn.setAttribute("aria-label", btn.title);
    btn.appendChild(icon(ICONS.open));
    const label = el("span");
    label.textContent = "Open";
    btn.appendChild(label);
    btn.addEventListener("click", async () => {
      const previewOnly = ctx.openNeedsCode || ctx.live === false && ctx.hasCode;
      if (!previewOnly) {
        const openUrl = ctx.openUrl || ctx.url;
        if (openUrl) {
          window.open(openUrl, "_blank", "noopener,noreferrer");
          return;
        }
      }
      const pending = window.open("", "_blank");
      btn.disabled = true;
      try {
        let url = ctx.openUrl || ctx.url;
        if (previewOnly) {
          try {
            url = await buildLiveOpenUrl(ctx) || url;
            ctx.openUrl = url;
            ctx.openNeedsCode = false;
          } catch (err) {
            console.warn("[docsify-yacv] Could not build the Open URL:", err);
          }
        } else {
          await ensureLoaded(ctx);
          url = ctx.openUrl || ctx.url;
        }
        if (url && pending) {
          pending.opener = null;
          pending.location.href = url;
        } else if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        } else if (pending) {
          pending.close();
        }
      } finally {
        btn.disabled = false;
      }
    });
    ctx.actions.appendChild(btn);
  }
  function addReloadButton(ctx) {
    const btn = el("button", "yacv-btn");
    btn.type = "button";
    btn.title = "Reload the 3D viewer";
    btn.setAttribute("aria-label", btn.title);
    btn.appendChild(icon(ICONS.reload));
    const label = el("span");
    label.textContent = "Reload";
    btn.appendChild(label);
    btn.addEventListener("click", () => reload(ctx));
    ctx.actions.appendChild(btn);
  }
  async function ensureLoaded(ctx) {
    if (ctx.state === "ready") return;
    if (ctx.state === "error") reload(ctx);
    if (ctx.loading) {
      await ctx.loading;
      return;
    }
    enqueueLoad(ctx, true);
    if (ctx.loading) {
      await ctx.loading;
      return;
    }
    if (ctx.startPromise) {
      await ctx.startPromise;
      if (ctx.loading) await ctx.loading;
    }
  }
  function reload(ctx) {
    if (ctx.timer) clearTimeout(ctx.timer);
    ctx.timer = null;
    if (ctx.liveTimer) clearTimeout(ctx.liveTimer);
    ctx.liveTimer = null;
    if (ctx.iframe) {
      ctx.iframe.remove();
      ctx.iframe = null;
    }
    releaseSlot(ctx, ctx.activeSlotId);
    removeFromQueue(ctx);
    clearPlaceholder(ctx);
    setState(ctx, "idle");
    ctx.url = null;
    ctx.openUrl = null;
    ctx.loading = null;
    ctx.pendingUnload = false;
    enqueueLoad(ctx, true);
  }
  function addCopyButton(wrap, getText) {
    const btn = el("button", "yacv-copy");
    btn.type = "button";
    btn.textContent = "Copy";
    btn.title = "Copy code";
    btn.setAttribute("aria-label", "Copy code");
    btn.addEventListener("click", async () => {
      try {
        await copyText(getText());
        btn.textContent = "Copied!";
      } catch {
        btn.textContent = "Copy failed";
      }
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 1400);
    });
    wrap.appendChild(btn);
  }
  function showPlaceholder(ctx, { text, spinner, error, button }) {
    clearPlaceholder(ctx);
    const placeholder = el("div", "yacv-placeholder");
    if (spinner) placeholder.appendChild(el("div", "yacv-spinner"));
    if (text) {
      const p = el("p", error ? "yacv-error" : void 0);
      p.textContent = text;
      placeholder.appendChild(p);
    }
    if (button) {
      const btn = el("button", "yacv-btn");
      btn.type = "button";
      btn.textContent = button.label;
      btn.addEventListener("click", button.onClick);
      placeholder.appendChild(btn);
    }
    ctx.stage.appendChild(placeholder);
    ctx.placeholder = placeholder;
  }
  function clearPlaceholder(ctx) {
    if (ctx.placeholder) {
      ctx.placeholder.remove();
      ctx.placeholder = null;
    }
  }
  function showErrorInStage(ctx, err) {
    showPlaceholder(ctx, { text: describeError(err), error: true });
  }
  function describeError(err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
    return message || "Unknown error";
  }
  function setState(ctx, state) {
    ctx.state = state;
    ctx.container.setAttribute("data-yacv-state", state);
  }
  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }
  function icon(path) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "yacv-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path);
    svg.appendChild(p);
    return svg;
  }
  function elementAttrs(element) {
    const attrs = {};
    for (const attr of Array.from(element.attributes)) {
      const key = normalizeKey(attr.name);
      if (!key || key === "datayacvprocessed") continue;
      const value = attr.value == null ? "" : attr.value;
      attrs[key] = value === "" ? true : value;
    }
    return attrs;
  }
  function pick(attrs, ...keys) {
    for (const key of keys) {
      if (attrs && Object.prototype.hasOwnProperty.call(attrs, key)) return attrs[key];
    }
    return void 0;
  }
  function stringAttr(value) {
    if (value == null || value === true) return "";
    return String(value).trim();
  }
  function without(attrs, keys) {
    const out = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (!keys.includes(key)) out[key] = value;
    }
    return out;
  }

  // src/styles.js
  var STYLE_ID = "docsify-yacv-styles";
  var CSS = `
.yacv-embed {
  --yacv-border: rgba(128, 128, 128, 0.35);
  --yacv-border-soft: rgba(128, 128, 128, 0.22);
  --yacv-tint: rgba(128, 128, 128, 0.09);
  --yacv-tint-strong: rgba(128, 128, 128, 0.18);
  --yacv-radius: 10px;
  --yacv-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --yacv-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  margin: 1.1em 0;
  border: 1px solid var(--yacv-border);
  border-radius: var(--yacv-radius);
  overflow: hidden;
  background: var(--yacv-tint);
  color: inherit;
  font-family: var(--yacv-font);
  line-height: 1.4;
}

.markdown-section .yacv-embed,
.markdown-section .yacv-code {
  box-sizing: border-box;
  max-width: 100%;
}

.yacv-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 4px 8px 4px 12px;
  border-bottom: 1px solid var(--yacv-border-soft);
  background: var(--yacv-tint);
  font-size: 12px;
}

.yacv-toolbar[hidden] { display: none; }

.yacv-title {
  flex: 0 1 auto;
  min-width: 0;
  font-weight: 600;
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.yacv-badge {
  flex: none;
  font-family: var(--yacv-mono);
  font-size: 10.5px;
  line-height: 1.6;
  padding: 0 7px;
  border: 1px solid var(--yacv-border-soft);
  border-radius: 999px;
  opacity: 0.75;
  white-space: nowrap;
}

.yacv-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.yacv-btn {
  -webkit-appearance: none;
  appearance: none;
  display: inline-flex;
  flex: none;
  white-space: nowrap;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: var(--yacv-font);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  text-decoration: none;
  cursor: pointer;
}

.yacv-btn:hover {
  background: var(--yacv-tint-strong);
  border-color: var(--yacv-border-soft);
  text-decoration: none;
}

.yacv-btn:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}

.yacv-btn[disabled] {
  opacity: 0.55;
  cursor: progress;
}

.yacv-icon {
  width: 13px;
  height: 13px;
  flex: none;
  fill: currentColor;
  opacity: 0.85;
}

.yacv-stage {
  position: relative;
  height: var(--yacv-height, 480px);
  background: var(--yacv-tint);
}

.yacv-stage[data-aspect="true"] {
  height: auto;
  aspect-ratio: 4 / 3;
}

.markdown-section .yacv-stage > iframe {
  position: absolute;
  inset: 0;
  display: block;
  width: 100% !important;
  min-width: 0 !important;
  max-width: none;
  height: 100%;
  margin: 0 !important;
  border: 0 !important;
  background: #7f7f7f;
}

.yacv-poster {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #b3b3b3;
  cursor: pointer;
  display: block;
}

.yacv-poster[hidden] { display: none; }

.yacv-placeholder {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px;
  text-align: center;
  font-size: 13px;
  color: inherit;
  opacity: 0.85;
}

.yacv-placeholder p { margin: 0; }
.yacv-placeholder code { font-family: var(--yacv-mono); font-size: 11.5px; }

.yacv-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(128, 128, 128, 0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: yacv-spin 0.9s linear infinite;
}

@keyframes yacv-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .yacv-spinner { animation-duration: 3s; }
}

.yacv-error { color: #c0392b; }
.yacv-error code { color: inherit; }

.yacv-code {
  position: relative;
}

.yacv-code[hidden] { display: none; }

/* Docsify renders the fence info string in the top-right corner; the toolbar
   already shows a friendlier language badge. */
.yacv-code pre[data-lang]::after,
.markdown-section .yacv-code pre[data-lang]::after {
  display: none;
}

.markdown-section .yacv-code > pre {
  margin-block-end: 0.5em;
}

.yacv-copy {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  -webkit-appearance: none;
  appearance: none;
  padding: 3px 8px;
  border: 1px solid var(--yacv-border);
  border-radius: 6px;
  background: var(--yacv-tint);
  color: inherit;
  font-family: var(--yacv-font);
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  opacity: 0.75;
}

.yacv-copy:hover {
  opacity: 1;
  background: var(--yacv-tint-strong);
}

.yacv-copy:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 1px;
  opacity: 1;
}

@media (max-width: 560px) {
  .yacv-toolbar { padding-left: 8px; }
  .yacv-badge { display: none; }
  .yacv-btn { padding: 4px 6px; }
  .yacv-btn span { display: none; }
}
`;
  function injectStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // src/index.js
  function docsifyYacv(userOptions = {}) {
    return function install(hook, vm) {
      let options = null;
      const getOptions = () => {
        if (!options) options = resolveOptions(userOptions, vm);
        return options;
      };
      hook.init(() => {
        injectStyles();
      });
      if (typeof hook.beforeEach === "function") {
        hook.beforeEach((markdown) => normalizeTagWhitespace(markdown));
      }
      if (typeof hook.doneEach === "function") {
        hook.doneEach(() => {
          mountAll(vm, getOptions());
        });
      }
    };
  }

  // src/iife.js
  if (typeof window !== "undefined") {
    window.DocsifyYacv = docsifyYacv;
    window.$docsify = window.$docsify || {};
    window.$docsify.plugins = (window.$docsify.plugins || []).concat(docsifyYacv());
  }
  var iife_default = docsifyYacv;
})();
