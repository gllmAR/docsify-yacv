import { encodeCode } from './encode.js';
import { ensureResourceHints } from './hints.js';
import { highlightPrePython, highlightPython } from './highlight.js';
import { classifyFence, looksLikePython, parseInfoString, parseModelBlock } from './parse.js';
import { buildParams, buildViewerUrl, parseShowCode, resolveBase } from './url.js';
import { copyText, cssSize, normalizeKey, resolveUrl, splitList, toBool } from './util.js';

const PROCESSED = 'data-yacv-processed';

/** @type {WeakMap<Element, EmbedContext>} */
const stageContexts = new WeakMap();
/** @type {Set<Element>} */
const observedStages = new Set();
/** @type {IntersectionObserver | null} */
let observer = null;
/** @type {IntersectionObserver | null} */
let unloadObserver = null;
/** @type {Set<Element>} */
const unloadObservedStages = new Set();

/** Embeds waiting for a load slot. */
/** @type {EmbedContext[]} */
const loadQueue = [];
/** @type {Set<EmbedContext>} */
const activeContexts = new Set();
/** @type {Set<EmbedContext>} */
const liveContexts = new Set();
let activeLoads = 0;
let liveActive = 0;
let maxConcurrent = 2;
let maxLiveConcurrent = 2;

/** @type {Map<string, Promise<string>>} */
const fetchCache = new Map();

const ICONS = {
  code: 'M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z',
  open: 'M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z',
  play: 'M8,5.14V19.14L19,12.14L8,5.14Z',
  reload:
    'M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z',
};

/**
 * Upgrades every not-yet-processed yacv block inside the docsify content area.
 *
 * @param {object} vm Docsify instance.
 * @param {import('./options.js').ResolvedOptions} options
 * @returns {void}
 */
export function mountAll(vm, options) {
  if (typeof document === 'undefined') return;
  const root = document.querySelector('.markdown-section');
  if (!root) return;
  maxConcurrent = Math.max(1, Math.floor(options.maxConcurrent || 2));
  maxLiveConcurrent = Math.max(1, Math.floor(options.maxLiveConcurrent || 2));
  pruneObserver();
  pumpQueue();

  for (const pre of Array.from(root.querySelectorAll(`pre[data-lang]:not([${PROCESSED}])`))) {
    try {
      prepareFence(pre, vm, options);
    } catch (err) {
      pre.setAttribute(PROCESSED, '');
      // eslint-disable-next-line no-console
      console.error('[docsify-yacv] Failed to set up code block:', err);
    }
  }

  for (const tag of Array.from(root.querySelectorAll(`yacv:not([${PROCESSED}])`))) {
    try {
      prepareTag(tag, vm, options);
    } catch (err) {
      tag.setAttribute(PROCESSED, '');
      // eslint-disable-next-line no-console
      console.error('[docsify-yacv] Failed to set up <yacv> element:', err);
    }
  }
}

/**
 * @param {HTMLPreElement} pre
 * @param {object} vm
 * @param {import('./options.js').ResolvedOptions} options
 */
function prepareFence(pre, vm, options) {
  const { lang, attrs } = parseInfoString(pre.getAttribute('data-lang') || '');
  const kind = classifyFence(lang, attrs);
  if (!kind) return;
  pre.setAttribute(PROCESSED, '');

  // The fence info string is shown by docsify in the top-right corner; keep
  // only the (useful) language part.
  pre.setAttribute('data-lang', kind === 'model' ? 'yacv' : lang || 'build123d');

  const text = pre.textContent || '';
  let code = null;
  let codeUrl = null;
  let models = [];

  if (kind === 'code') {
    code = text.trim() ? text : null;
    codeUrl = stringAttr(attrs.codesrc) || null;
  } else if (looksLikePython(text)) {
    // A plain ```yacv block with Python in it is treated as live code.
    code = text;
  } else {
    const parsed = parseModelBlock(text);
    models = parsed.models;
    codeUrl = parsed.codeFiles[0] || null;
    if (parsed.codeFiles.length > 1) {
      // eslint-disable-next-line no-console
      console.warn(
        '[docsify-yacv] A yacv block can reference at most one Python file; ignoring:',
        parsed.codeFiles.slice(1),
      );
    }
  }

  ensureResourceHints(options.viewer, false);

  const inlineCode = !!(code && code.trim());
  if (inlineCode) highlightPrePython(pre, code);
  const explicitShow = parseShowCode(attrs.code);

  const wrap = el('div', 'yacv-code');
  pre.replaceWith(wrap);
  wrap.appendChild(pre);

  const ctx = createEmbed(
    {
      attrs,
      code,
      codeUrl,
      models,
      kind: 'fence',
      showCode: explicitShow == null ? inlineCode : explicitShow,
    },
    vm,
    options,
  );

  if (inlineCode) {
    ctx.codeWrap = wrap;
    addCopyButton(wrap, () => code);
  } else {
    // The block only lists asset paths: not useful reading material.
    wrap.hidden = true;
  }

  wrap.after(ctx.container);
  if (inlineCode) mountCodeToggle(ctx);
  finishSetup(ctx);
}

/**
 * @param {Element} tag a `<yacv>` element
 * @param {object} vm
 * @param {import('./options.js').ResolvedOptions} options
 */
function prepareTag(tag, vm, options) {
  tag.setAttribute(PROCESSED, '');
  const attrs = elementAttrs(tag);

  const scripts = Array.from(tag.querySelectorAll('script')).filter(script => {
    const type = (script.getAttribute('type') || '').toLowerCase();
    return type === 'text/x-python' || type === 'text/x-build123d' || script.hasAttribute('data-yacv-code');
  });
  const inlineCode = scripts
    .map(script => script.textContent || '')
    .join('\n\n')
    .trim();

  let codeUrl = stringAttr(attrs.codesrc) || null;
  const models = splitList(attrs.models);
  const src = stringAttr(attrs.src);
  if (src) {
    if (/\.(?:py|py\.gz)(?:[?#].*)?$/i.test(src)) codeUrl = codeUrl || src;
    else models.push(src);
  }

  scripts.forEach(script => script.remove());

  ensureResourceHints(options.viewer, false);

  const hasInline = !!inlineCode;
  const explicitShow = parseShowCode(attrs.code);
  const ctx = createEmbed(
    {
      attrs: without(attrs, ['src', 'models', 'codesrc']),
      code: hasInline ? inlineCode : null,
      codeUrl,
      models,
      kind: 'tag',
      showCode: explicitShow == null ? hasInline : explicitShow,
      id: stringAttr(attrs.id),
      className: stringAttr(attrs.class),
    },
    vm,
    options,
  );

  const parent = tag.parentElement;
  if (parent && parent.tagName === 'P' && parent.children.length === 1 && !(parent.textContent || '').trim()) {
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

/**
 * @param {Object} spec
 * @param {Record<string, any>} spec.attrs
 * @param {string | null} spec.code
 * @param {string | null} spec.codeUrl
 * @param {string[]} spec.models
 * @param {'fence'|'tag'} spec.kind
 * @param {boolean} spec.showCode
 * @param {string} [spec.id]
 * @param {string} [spec.className]
 * @param {object} vm
 * @param {import('./options.js').ResolvedOptions} options
 * @returns {EmbedContext}
 */
function createEmbed(spec, vm, options) {
  const attrs = spec.attrs || {};
  const base = resolveBase(options, vm);
  const height = cssSize(pick(attrs, 'height') ?? options.height, '480px');
  const title = stringAttr(pick(attrs, 'title')) || options.title || '';
  const viewer = stringAttr(pick(attrs, 'viewer')) || options.viewer;
  const openViewer = stringAttr(pick(attrs, 'openviewer')) || options.openViewer || viewer;
  const version =
    stringAttr(pick(attrs, 'version', 'b3dversion', 'pgversion', 'pg_version')) || options.version;
  const modelCount =
    spec.models.length +
    splitList(pick(attrs, 'models')).length +
    splitList(pick(attrs, 'src')).length +
    splitList(pick(attrs, 'preview')).length +
    splitList(pick(attrs, 'preload')).length;
  const autoLoad = pick(attrs, 'autoload') === undefined ? options.autoLoad : toBool(pick(attrs, 'autoload'), options.autoLoad);
  const lazy = pick(attrs, 'lazy') === undefined ? options.lazy : toBool(pick(attrs, 'lazy'), options.lazy);
  const chrome = pick(attrs, 'chrome') === undefined ? options.chrome : toBool(pick(attrs, 'chrome'), options.chrome);

  const container = el('div', 'yacv-embed');
  container.setAttribute('data-yacv', '');
  if (spec.id) container.id = spec.id;
  if (spec.className) container.classList.add(...spec.className.split(/\s+/).filter(Boolean));

  const toolbar = el('div', 'yacv-toolbar');
  const titleEl = el('span', 'yacv-title');
  if (title) titleEl.textContent = title;
  else titleEl.hidden = true;
  toolbar.appendChild(titleEl);

  const hasCode = !!(spec.code && spec.code.trim()) || !!spec.codeUrl;
  const badge = el('span', 'yacv-badge');
  if (hasCode) {
    badge.textContent = `build123d · ${version}`;
  } else if (modelCount > 1) {
    badge.textContent = `${modelCount} models`;
  } else {
    badge.hidden = true;
  }
  toolbar.appendChild(badge);

  const actions = el('div', 'yacv-actions');
  toolbar.appendChild(actions);

  const stage = el('div', 'yacv-stage');
  if (height === 'auto') stage.setAttribute('data-aspect', 'true');
  else stage.style.height = height;

  container.appendChild(toolbar);
  container.appendChild(stage);

  /** @type {EmbedContext} */
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
    state: 'idle',
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
    version,
    autoLoad,
    lazy,
    chrome,
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
    pendingUnload: false,
  };

  // Models can also be provided through `models`, `preload` or `src` attrs.
  // `buildParams` collects those, so nothing to do here besides the badge.

  ctx.hasCode = hasCode;
  ctx.live = true;
  stageContexts.set(stage, ctx);

  const openAttr = pick(attrs, 'open');
  if (chrome && options.openInNewTab && (openAttr === undefined || toBool(openAttr, true))) addOpenButton(ctx);
  if (hasCode) addReloadButton(ctx);

  const hasBadge = hasCode || modelCount > 1;
  if (!chrome || (!title && !hasBadge && ctx.actions.childElementCount === 0)) {
    toolbar.hidden = true;
  }

  return ctx;
}

/**
 * Whether the embed has at least one static model (preview/src/models/...).
 *
 * @param {EmbedContext} ctx
 * @returns {boolean}
 */
function hasStaticModels(ctx) {
  if (ctx.models && ctx.models.length > 0) return true;
  return ['models', 'src', 'preview', 'preload'].some(key => splitList(ctx.attrs[key]).length > 0);
}

/**
 * Starts lazy loading / immediate loading for a fresh embed.
 *
 * @param {EmbedContext} ctx
 */
function finishSetup(ctx) {
  observeUnload(ctx);

  if (ctx.autoLoad === false) {
    // With a static preview we can show the model immediately and only boot
    // the Python sandbox when the reader asks for it.
    if (ctx.chrome && ctx.hasCode && hasStaticModels(ctx)) {
      ctx.live = false;
      addRunButton(ctx);
      scheduleLoad(ctx, 'The preview loads when it becomes visible.');
      return;
    }
    showPlaceholder(ctx, {
      text: 'The 3D viewer is not loaded yet.',
      button: { label: 'Load 3D viewer', onClick: () => enqueueLoad(ctx, true) },
    });
    return;
  }
  scheduleLoad(ctx, 'The 3D viewer loads when it becomes visible.');
}

/**
 * Creates the iframe now or when the embed approaches the viewport.
 *
 * @param {EmbedContext} ctx
 * @param {string} text Placeholder text while waiting for intersection.
 */
function scheduleLoad(ctx, text) {
  if (!ctx.lazy || typeof IntersectionObserver === 'undefined') {
    enqueueLoad(ctx);
    return;
  }
  showPlaceholder(ctx, { text });
  ensureObserver(ctx.options).observe(ctx.stage);
  observedStages.add(ctx.stage);
}

/**
 * @returns {IntersectionObserver}
 */
function ensureObserver(options) {
  if (observer) return observer;
  observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        observedStages.delete(entry.target);
        const ctx = stageContexts.get(entry.target);
        if (ctx) enqueueLoad(ctx);
      }
    },
    { rootMargin: options.lazyMargin || '200px' },
  );
  return observer;
}

/**
 * @returns {IntersectionObserver}
 */
function ensureUnloadObserver(options) {
  if (unloadObserver) return unloadObserver;
  unloadObserver = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) continue;
        const ctx = stageContexts.get(entry.target);
        if (ctx) unload(ctx);
      }
    },
    { rootMargin: options.unloadMargin || '200% 0px' },
  );
  return unloadObserver;
}

/**
 * @param {EmbedContext} ctx
 * @returns {boolean}
 */
function shouldUnload(ctx) {
  if (ctx.options.unloadOffscreen === 'static') return !ctx.hasCode;
  return ctx.options.unloadOffscreen !== false;
}

/**
 * Starts unloading a far-away iframe once it becomes visible-independent.
 *
 * @param {EmbedContext} ctx
 */
function observeUnload(ctx) {
  if (!shouldUnload(ctx) || typeof IntersectionObserver === 'undefined') return;
  ensureUnloadObserver(ctx.options).observe(ctx.stage);
  unloadObservedStages.add(ctx.stage);
}

/**
 * Removes a far-offscreen iframe (and its Pyodide/GPU memory). It is re-created
 * when the embed approaches the viewport again.
 *
 * @param {EmbedContext} ctx
 */
function unload(ctx) {
  removeFromQueue(ctx);

  if (ctx.state === 'loading') {
    // `load()` is still building the URL; unload as soon as the iframe settles.
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
  setState(ctx, 'idle');
  ctx.url = null;
  ctx.openUrl = null;
  ctx.loading = null;
  ctx.pendingUnload = false;

  // Reload when it comes back near the viewport (even if `lazy` is false).
  if (typeof IntersectionObserver === 'undefined') {
    enqueueLoad(ctx);
  } else {
    ensureObserver(ctx.options).observe(ctx.stage);
    observedStages.add(ctx.stage);
  }
}

function pruneObserver() {
  // A docsify navigation can remove iframes before their `load` event fires.
  // Do not let those stale loads keep concurrency slots for the next page.
  for (const ctx of Array.from(activeContexts)) {
    if (!ctx.stage.isConnected) {
      releaseSlot(ctx, ctx.activeSlotId);
      ctx.loading = null;
      ctx.state = 'idle';
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

/**
 * Queues an embed for loading, respecting the concurrency limit and prioritizing
 * the embed closest to the viewport. User-initiated loads jump the queue.
 *
 * @param {EmbedContext} ctx
 * @param {boolean} [priority]
 */
function enqueueLoad(ctx, priority = false) {
  if (ctx.state === 'ready' || ctx.state === 'loading' || ctx.state === 'error') return;
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
  ctx.startPromise = new Promise(resolve => {
    ctx.resolveStart = resolve;
  });
  if (ctx.priority) loadQueue.unshift(ctx);
  else loadQueue.push(ctx);
  pumpQueue();
}

/**
 * Starts queued embeds while there is a free slot.
 *
 * @returns {void}
 */
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
      // A live sandbox slot filled in the meantime; try later.
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
    // Intentionally not awaited: the slot is released by the iframe load event.
    load(ctx, slot);
  }
}

/**
 * @returns {number} Index of the next context, or -1 when nothing is usable.
 */
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
    if (ctx.hasCode && ctx.live !== false && !ctx.liveSlotHeld && liveActive >= maxLiveConcurrent) {
      continue;
    }
    const isPriority = !!ctx.priority;
    const distance = distanceToViewport(ctx.stage);
    if (best === -1 || (isPriority && !bestPriority) || (isPriority === bestPriority && distance < bestDistance)) {
      best = i;
      bestPriority = isPriority;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * @param {Element} el
 * @returns {number}
 */
function distanceToViewport(el) {
  try {
    const rect = el.getBoundingClientRect();
    const viewportMiddle = (window.innerHeight || 0) / 2;
    return Math.abs(rect.top + rect.height / 2 - viewportMiddle);
  } catch {
    return Infinity;
  }
}

/**
 * Frees a loading slot and starts the next queued embed.
 *
 * @param {EmbedContext} ctx
 * @param {number | null} [slot]
 */
function releaseSlot(ctx, slot = null) {
  if (!ctx.slotHeld) return;
  if (slot != null && ctx.activeSlotId !== slot) return;
  ctx.slotHeld = false;
  ctx.activeSlotId = null;
  activeContexts.delete(ctx);
  activeLoads = Math.max(0, activeLoads - 1);
  pumpQueue();
}

/**
 * A live embed needs one of the global live-sandbox slots (held until unload).
 *
 * @param {EmbedContext} ctx
 * @returns {boolean}
 */
function acquireLiveSlot(ctx) {
  if (!ctx.hasCode || ctx.live === false || ctx.liveSlotHeld) return true;
  if (liveActive >= maxLiveConcurrent) return false;
  ctx.liveSlotHeld = true;
  liveContexts.add(ctx);
  liveActive += 1;
  return true;
}

/**
 * @param {EmbedContext} ctx
 */
function releaseLiveSlot(ctx) {
  if (ctx.liveTimer) clearTimeout(ctx.liveTimer);
  ctx.liveTimer = null;
  if (!ctx.liveSlotHeld) return;
  ctx.liveSlotHeld = false;
  liveContexts.delete(ctx);
  liveActive = Math.max(0, liveActive - 1);
  pumpQueue();
}

/**
 * Starts the post-load hold timer for a live sandbox slot. This bounds the
 * boot concurrency window even when the viewer stays loaded forever.
 *
 * @param {EmbedContext} ctx
 */
function startLiveHold(ctx) {
  if (!ctx.liveSlotHeld || ctx.liveTimer) return;
  const ms = ctx.options.liveSlotMs;
  if (!ms) return;
  ctx.liveTimer = setTimeout(() => {
    ctx.liveTimer = null;
    releaseLiveSlot(ctx);
  }, ms);
}

/**
 * Removes a queued embed from the load queue.
 *
 * @param {EmbedContext} ctx
 */
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

/**
 * @param {EmbedContext} ctx
 * @returns {Promise<string | null>}
 */
function ensureCode(ctx) {
  if (ctx.inlineCode) return Promise.resolve(ctx.inlineCode);
  if (ctx.fetchedCode != null) return Promise.resolve(ctx.fetchedCode);
  if (!ctx.codeUrl) return Promise.resolve(null);
  if (ctx.codePromise) return ctx.codePromise;
  const resolved = resolveUrl(ctx.codeUrl, ctx.base);
  const promise = fetchCode(resolved).then(code => {
    ctx.fetchedCode = code;
    return code;
  });
  ctx.codePromise = promise.catch(err => {
    ctx.codePromise = null;
    throw err;
  });
  return ctx.codePromise;
}

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
function fetchCode(url) {
  if (fetchCache.has(url)) return fetchCache.get(url);
  const promise = fetch(url, { credentials: 'same-origin' }).then(async response => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url} (HTTP ${response.status})`);
    }
    return response.text();
  });
  fetchCache.set(url, promise);
  promise.catch(() => fetchCache.delete(url));
  return promise;
}

/**
 * Loads the iframe (idempotent).
 *
 * @param {EmbedContext} ctx
 * @returns {Promise<EmbedContext>}
 */
function load(ctx, slot = ctx.activeSlotId) {
  if (ctx.state === 'ready') {
    releaseSlot(ctx, slot);
    return Promise.resolve(ctx);
  }
  if (ctx.loading) {
    releaseSlot(ctx, slot);
    return ctx.loading;
  }

  setState(ctx, 'loading');
  showPlaceholder(ctx, { spinner: true, text: 'Loading 3D viewer…' });

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
          // Still show preloaded static models when the Python source is unavailable.
          if (!hasStaticModels(ctx)) throw err;
          // eslint-disable-next-line no-console
          console.warn('[docsify-yacv]', err);
        }
      }

      if (code && ctx.showCode && !ctx.codeWrap) {
        createCodePanel(ctx, code);
        mountCodeToggle(ctx);
      }

      if (slot !== ctx.activeSlotId) return ctx; // aborted by reload/unload

      const hasCode = !!(code && code.trim());
      if (!hasCode) releaseLiveSlot(ctx);
      if (hasCode) ensureResourceHints(ctx.viewer, true);
      const params = buildParams({
        hasCode,
        models: ctx.models,
        attrs: ctx.attrs,
        options: ctx.options,
        base: ctx.base,
      });
      if (!params) {
        throw new Error('Nothing to show: add build123d code or a .glb/.gltf model.');
      }
      if (hasCode) params.set('pg_code', await encodeCode(code));
      if (slot !== ctx.activeSlotId) return ctx; // aborted while encoding

      const url = buildViewerUrl(ctx.viewer, params);
      ctx.url = url;

      // The embedded viewer hides the Monaco editor (docsify shows the code).
      // "Open" should give access to the full playground, so unless the editor
      // opacity was configured explicitly, show it in the new tab. Preview-only
      // embeds build their live Open URL lazily in the Open button handler, so
      // the preview itself never waits for the code.
      const openParams = new URLSearchParams(params);
      if (hasCode) {
        const settings = ctx.options.settings || {};
        const editorConfigured =
          ctx.attrs.editor !== undefined ||
          ctx.attrs['pg-opacity-loading'] !== undefined ||
          ctx.attrs.pg_opacity_loading !== undefined ||
          ctx.options.editorExplicit === true ||
          'pg_opacity_loading' in settings ||
          'pg-opacity-loading' in settings ||
          'pgopacityloading' in settings;
        const openEditor = editorConfigured ? params.get('pg_opacity_loading') || '0' : '0.9';
        openParams.set('pg_opacity_loading', openEditor);
        openParams.set('pg_opacity_loaded', openEditor);
      }
      ctx.openUrl = buildViewerUrl(ctx.openViewer, openParams);

      const iframe = document.createElement('iframe');
      iframe.className = 'yacv-iframe';
      iframe.src = url;
      iframe.title = ctx.title || '3D CAD viewer (Yet Another CAD Viewer)';
      iframe.setAttribute(
        'allow',
        'fullscreen; xr-spatial-tracking; clipboard-write; accelerometer; gyroscope',
      );
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      iframe.addEventListener('load', () => {
        releaseSlot(ctx, slot);
        if (ctx.iframe !== iframe) return;
        if (ctx.timer) clearTimeout(ctx.timer);
        ctx.timer = null;
        if (ctx.pendingUnload) {
          ctx.pendingUnload = false;
          unload(ctx);
          return;
        }
        startLiveHold(ctx);
        setState(ctx, 'ready');
        clearPlaceholder(ctx);
      });
      iframe.addEventListener('error', () => {
        releaseSlot(ctx, slot);
        releaseLiveSlot(ctx);
        if (ctx.iframe !== iframe) return;
        ctx.pendingUnload = false;
        setState(ctx, 'error');
        showPlaceholder(ctx, {
          text: 'The 3D viewer failed to load. Check your connection or the viewer URL.',
          error: true,
        });
      });

      ctx.iframe = iframe;
      ctx.stage.appendChild(iframe);

      // Surface very slow loads instead of an infinite spinner.
      ctx.timer = setTimeout(() => {
        // Never let a hung iframe block the queue for other embeds.
        releaseSlot(ctx, slot);
        releaseLiveSlot(ctx);
        if (ctx.state === 'loading') {
          showPlaceholder(ctx, {
            spinner: true,
            text: 'Still loading — the first build123d run downloads the CAD kernel and can take a while.',
          });
        }
      }, 20000);
    } catch (err) {
      if (slot !== ctx.activeSlotId) return ctx; // aborted
      releaseSlot(ctx, slot);
      releaseLiveSlot(ctx);
      setState(ctx, 'error');
      showPlaceholder(ctx, { text: describeError(err), error: true });
      // eslint-disable-next-line no-console
      console.warn('[docsify-yacv]', err);
    }
    return ctx;
  })();

  // Assign before awaiting anything: static-only loads complete synchronously,
  // so a `finally { ctx.loading = null }` inside the IIFE would be overwritten
  // by this assignment and leave the embed permanently "loading".
  ctx.loading = loading;
  loading.finally(() => {
    if (ctx.loading === loading) ctx.loading = null;
  });
  return loading;
}

/**
 * @param {EmbedContext} ctx
 */
function mountCodeToggle(ctx) {
  if (!ctx.chrome || !ctx.actions || ctx.codeBtn) return;
  const btn = el('button', 'yacv-btn');
  btn.type = 'button';
  btn.appendChild(icon(ICONS.code));
  const label = el('span');
  btn.appendChild(label);
  btn.addEventListener('click', async () => {
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

/**
 * @param {EmbedContext} ctx
 */
function applyCodeVisibility(ctx) {
  const hasPanel = !!ctx.codeWrap;
  if (ctx.codeWrap) ctx.codeWrap.hidden = !ctx.showCode;
  if (ctx.codeBtn) {
    ctx.codeBtn.hidden = !hasPanel;
    const label = ctx.codeBtn.querySelector('span');
    if (label) label.textContent = ctx.showCode ? 'Hide code' : 'Show code';
    ctx.codeBtn.title = ctx.showCode ? 'Hide the source code' : 'Show the source code';
    ctx.codeBtn.setAttribute('aria-label', ctx.showCode ? 'Hide code' : 'Show code');
  }
}

/**
 * Adds a highlighted-looking code panel for the given source. Used for
 * `<yacv>` tags and for Python files fetched from disk.
 *
 * @param {EmbedContext} ctx
 * @param {string} code
 */
function createCodePanel(ctx, code) {
  if (ctx.codeWrap) {
    if (ctx.codeWrap.dataset.yacvGenerated === '1') {
      const codeEl = ctx.codeWrap.querySelector('code');
      if (codeEl) codeEl.textContent = code;
    }
    applyCodeVisibility(ctx);
    return;
  }
  const wrap = el('div', 'yacv-code');
  wrap.dataset.yacvGenerated = '1';
  const pre = document.createElement('pre');
  pre.setAttribute('data-lang', 'python');
  const codeEl = document.createElement('code');
  codeEl.className = 'lang-python language-python';
  highlightPython(codeEl, code);
  pre.appendChild(codeEl);
  wrap.appendChild(pre);
  addCopyButton(wrap, () => code);
  ctx.container.before(wrap);
  ctx.codeWrap = wrap;
  applyCodeVisibility(ctx);
}

/**
 * Starts the full live sandbox for preview-only embeds (auto-load=false).
 *
 * @param {EmbedContext} ctx
 */
function addRunButton(ctx) {
  if (!ctx.chrome || !ctx.actions) return;
  const btn = el('button', 'yacv-btn');
  btn.type = 'button';
  btn.title = 'Run this build123d code in the browser';
  btn.setAttribute('aria-label', 'Run build123d');
  btn.appendChild(icon(ICONS.play));
  const label = el('span');
  label.textContent = 'Run build123d';
  btn.appendChild(label);
  btn.addEventListener('click', () => {
    btn.remove();
    ctx.live = true;
    reload(ctx);
  });
  ctx.actions.insertBefore(btn, ctx.actions.firstChild);
}

/**
 * Builds the Open URL with the live code for preview-only embeds. This fetches
 * external sources on demand, never during preview startup.
 *
 * @param {EmbedContext} ctx
 * @returns {Promise<string | null>}
 */
async function buildLiveOpenUrl(ctx) {
  const code = await ensureCode(ctx);
  if (!code || !code.trim()) return null;
  const params =
    buildParams({
      hasCode: true,
      models: ctx.models,
      attrs: ctx.attrs,
      options: ctx.options,
      base: ctx.base,
    }) || new URLSearchParams();
  params.set('pg_code', await encodeCode(code));
  const settings = ctx.options.settings || {};
  const editorConfigured =
    ctx.attrs.editor !== undefined ||
    ctx.attrs['pg-opacity-loading'] !== undefined ||
    ctx.attrs.pg_opacity_loading !== undefined ||
    ctx.options.editorExplicit === true ||
    'pg_opacity_loading' in settings ||
    'pg-opacity-loading' in settings ||
    'pgopacityloading' in settings;
  const openEditor = editorConfigured ? params.get('pg_opacity_loading') || '0' : '0.9';
  params.set('pg_opacity_loading', openEditor);
  params.set('pg_opacity_loaded', openEditor);
  return buildViewerUrl(ctx.openViewer, params);
}

/**
 * @param {EmbedContext} ctx
 */
function addOpenButton(ctx) {
  const btn = el('button', 'yacv-btn');
  btn.type = 'button';
  btn.title = 'Open this model in the full yacv viewer';
  btn.setAttribute('aria-label', btn.title);
  btn.appendChild(icon(ICONS.open));
  const label = el('span');
  label.textContent = 'Open';
  btn.appendChild(label);
  btn.addEventListener('click', async () => {
    const previewOnly = ctx.live === false && ctx.hasCode;
    if (!previewOnly) {
      const openUrl = ctx.openUrl || ctx.url;
      if (openUrl) {
        window.open(openUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    // Open the tab synchronously so popup blockers do not reject it, then
    // navigate it once the viewer URL (with compressed code) is ready.
    const pending = window.open('', '_blank');
    btn.disabled = true;
    try {
      let url = ctx.openUrl || ctx.url;
      if (previewOnly) {
        try {
          url = (await buildLiveOpenUrl(ctx)) || url;
          ctx.openUrl = url;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[docsify-yacv] Could not build the Open URL:', err);
        }
      } else {
        await ensureLoaded(ctx);
        url = ctx.openUrl || ctx.url;
      }
      if (url && pending) {
        pending.opener = null;
        pending.location.href = url;
      } else if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else if (pending) {
        pending.close();
      }
    } finally {
      btn.disabled = false;
    }
  });
  ctx.actions.appendChild(btn);
}

/**
 * @param {EmbedContext} ctx
 */
function addReloadButton(ctx) {
  const btn = el('button', 'yacv-btn');
  btn.type = 'button';
  btn.title = 'Reload the 3D viewer';
  btn.setAttribute('aria-label', btn.title);
  btn.appendChild(icon(ICONS.reload));
  const label = el('span');
  label.textContent = 'Reload';
  btn.appendChild(label);
  btn.addEventListener('click', () => reload(ctx));
  ctx.actions.appendChild(btn);
}

/**
 * @param {EmbedContext} ctx
 * @returns {Promise<void>}
 */
async function ensureLoaded(ctx) {
  if (ctx.state === 'ready') return;
  if (ctx.state === 'error') reload(ctx);
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

/**
 * @param {EmbedContext} ctx
 */
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
  setState(ctx, 'idle');
  ctx.url = null;
  ctx.openUrl = null;
  ctx.loading = null;
  ctx.pendingUnload = false;
  enqueueLoad(ctx, true);
}

/**
 * @param {Element} wrap
 * @param {() => string} getText
 */
function addCopyButton(wrap, getText) {
  const btn = el('button', 'yacv-copy');
  btn.type = 'button';
  btn.textContent = 'Copy';
  btn.title = 'Copy code';
  btn.setAttribute('aria-label', 'Copy code');
  btn.addEventListener('click', async () => {
    try {
      await copyText(getText());
      btn.textContent = 'Copied!';
    } catch {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => {
      btn.textContent = 'Copy';
    }, 1400);
  });
  wrap.appendChild(btn);
}

/**
 * @param {EmbedContext} ctx
 * @param {Object} options
 * @param {string} [options.text]
 * @param {boolean} [options.spinner]
 * @param {boolean} [options.error]
 * @param {{ label: string, onClick: () => void }} [options.button]
 */
function showPlaceholder(ctx, { text, spinner, error, button }) {
  clearPlaceholder(ctx);
  const placeholder = el('div', 'yacv-placeholder');
  if (spinner) placeholder.appendChild(el('div', 'yacv-spinner'));
  if (text) {
    const p = el('p', error ? 'yacv-error' : undefined);
    p.textContent = text;
    placeholder.appendChild(p);
  }
  if (button) {
    const btn = el('button', 'yacv-btn');
    btn.type = 'button';
    btn.textContent = button.label;
    btn.addEventListener('click', button.onClick);
    placeholder.appendChild(btn);
  }
  ctx.stage.appendChild(placeholder);
  ctx.placeholder = placeholder;
}

/**
 * @param {EmbedContext} ctx
 */
function clearPlaceholder(ctx) {
  if (ctx.placeholder) {
    ctx.placeholder.remove();
    ctx.placeholder = null;
  }
}

/**
 * @param {EmbedContext} ctx
 * @param {unknown} err
 */
function showErrorInStage(ctx, err) {
  showPlaceholder(ctx, { text: describeError(err), error: true });
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function describeError(err) {
  const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
  return message || 'Unknown error';
}

/**
 * @param {EmbedContext} ctx
 * @param {string} state
 */
function setState(ctx, state) {
  ctx.state = state;
  ctx.container.setAttribute('data-yacv-state', state);
}

/**
 * @returns {Element}
 */
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/**
 * @param {string} path
 * @returns {SVGElement}
 */
function icon(path) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'yacv-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  svg.appendChild(p);
  return svg;
}

/**
 * Reads all attributes of an element, normalizing names and valueless
 * attributes (which become `true`).
 *
 * @param {Element} element
 * @returns {Record<string, string | true>}
 */
function elementAttrs(element) {
  /** @type {Record<string, string | true>} */
  const attrs = {};
  for (const attr of Array.from(element.attributes)) {
    const key = normalizeKey(attr.name);
    if (!key || key === 'datayacvprocessed') continue;
    const value = attr.value == null ? '' : attr.value;
    attrs[key] = value === '' ? true : value;
  }
  return attrs;
}

/**
 * @param {Record<string, unknown>} attrs
 * @param {string[]} keys
 * @returns {unknown}
 */
function pick(attrs, ...keys) {
  for (const key of keys) {
    if (attrs && Object.prototype.hasOwnProperty.call(attrs, key)) return attrs[key];
  }
  return undefined;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function stringAttr(value) {
  if (value == null || value === true) return '';
  return String(value).trim();
}

/**
 * @param {Record<string, unknown>} attrs
 * @param {string[]} keys
 * @returns {Record<string, unknown>}
 */
function without(attrs, keys) {
  const out = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (!keys.includes(key)) out[key] = value;
  }
  return out;
}

/**
 * @typedef {Object} EmbedContext
 * @property {object} vm
 * @property {import('./options.js').ResolvedOptions} options
 * @property {Record<string, any>} attrs
 * @property {string | ((src: string) => string)} base
 * @property {string} viewer
 * @property {string} openViewer
 * @property {string[]} models
 * @property {HTMLElement} container
 * @property {HTMLElement} toolbar
 * @property {HTMLElement} titleEl
 * @property {HTMLElement} actions
 * @property {HTMLElement} stage
 * @property {string} state
 * @property {string | null} url
 * @property {string | null} openUrl
 * @property {HTMLIFrameElement | null} iframe
 * @property {Promise<EmbedContext> | null} loading
 * @property {string | null} inlineCode
 * @property {string | null} codeUrl
 * @property {string | null} fetchedCode
 * @property {Promise<string | null> | null} codePromise
 * @property {HTMLElement | null} codeWrap
 * @property {HTMLButtonElement | null} codeBtn
 * @property {boolean} showCode
 * @property {HTMLElement | null} placeholder
 * @property {string} title
 * @property {string} version
 * @property {boolean} hasCode
 * @property {boolean} live
 * @property {boolean} autoLoad
 * @property {boolean} lazy
 * @property {boolean} chrome
 * @property {ReturnType<typeof setTimeout> | null} timer
 * @property {boolean} queued
 * @property {boolean} priority
 * @property {Promise<void> | null} startPromise
 * @property {(() => void) | null} resolveStart
 * @property {boolean} slotHeld
 * @property {number | null} activeSlotId
 * @property {number} slotSeq
 * @property {boolean} liveSlotHeld
 * @property {ReturnType<typeof setTimeout> | null} liveTimer
 * @property {boolean} pendingUnload
 */
