# docsify-yacv

Docsify plugin that turns **build123d code** and **`.glb`/`.gltf` files** into interactive CAD
viewers, powered by [Yet Another CAD Viewer](https://github.com/yeicor-3d/yet-another-cad-viewer).
Build123d runs entirely in the reader's browser (OCP compiled to WebAssembly), so there is no
server, no Python install and no build step.

```build123d height=440 title="build123d — click Run, or Open to edit" preview="assets/preview-part.glb#name=part" poster="assets/preview-part.png" auto-load=false
from build123d import *

with BuildPart() as part:
    Box(34, 22, 8)
    with Locations((0, 0, 4)):
        Cylinder(6, 6)
    Cylinder(3, 20, mode=Mode.SUBTRACT)

part.color = (0.16, 0.47, 0.80, 1)
show(part, vertices=False)  # cleaner look; edges remain selectable
```

On a Docsify page this fence becomes an interactive viewer; on GitHub/Codeberg it stays a readable
Python code block. The same Markdown works everywhere.

[build123d recipes](build123d.md) · [Static models](models.md) · [Full reference](reference.md)

## Features

- **Live build123d** — `from build123d import *`, `show(...)` and `show_object(...)` execute
  client-side. No backend.
- **Full viewer** — orbit/pan/zoom, clipping planes, exploded view, transparency, edges and
  vertices, face/edge/vertex selection, measurements, orthographic camera, AR and GLB export.
- **Static GLB/GLTF** — one or more models per embed, names, and yacv hot reload
  (`dev+http://localhost:32323`) for local model development. CadQuery exports work too.
- **Docsify-native** — the source stays in the page as a highlighted code block with a copy
  button; the 3D view sits right below it.
- **Configurable sandbox** — pin build123d versions (PyPI, branch, tag, PR), debug wheels, pip
  constraints, Monaco editor, extra packages via micropip.
- **Fast perceived startup** — pair live code with a `preview` GLB and (optionally) a `poster`
  image: the model appears immediately while the sandbox boots or waits for a **Run build123d**
  click, then the live result replaces it.
- **Efficient with many embeds** — nearest-first load queue with capped concurrency, automatic
  unloading of far-offscreen viewers, and one viewer app per fence instead of per model.
- **Optimized embedded viewer** — the repo ships a headless, pruned yacv build: no Monaco, drawers
  closed, full-canvas 3D and a ~6s faster Python bootstrap.
- **Shared Python worker** — optionally run every live embed on a page in **one** Pyodide instance.
  First boot ~20s, then each example renders in well under a second and the preview stays visible.
- **No build, static hosting** — the plugin is a single root-level `docsify-yacv.js`, committed and
  served as-is. The repository root is the docsify demo.

## Quick Start (Docsify)

Add the plugin after docsify. It **auto-registers** itself with Docsify.

```html
<!DOCTYPE html>
<html>
  <body>
    <div id="app"></div>

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/docsify@5/dist/themes/core.min.css" />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/docsify@5/dist/themes/addons/core-dark.min.css"
      media="(prefers-color-scheme: dark)"
    />

    <script>
      window.$docsify = {
        name: 'My CAD docs',
        yacv: {
          version: 'stable', // build123d version for live code
          height: '460px',
        },
      };
    </script>

    <script src="https://cdn.jsdelivr.net/npm/docsify@5/dist/docsify.min.js"></script>
    <script src="https://gllmar.github.io/docsify-yacv/docsify-yacv.js"></script>
  </body>
</html>
```

Alternatives for the plugin `<script>`:

```html
<!-- jsDelivr from GitHub -->
<script src="https://cdn.jsdelivr.net/gh/gllmAR/docsify-yacv/docsify-yacv.js"></script>

<!-- locally: copy docsify-yacv.js next to your docs -->
<script src="./docsify-yacv.js"></script>
```

No `plugins: [...]` entry is needed: the script registers the plugin. Load it after
`window.$docsify` is defined (the order above).

### npm / bundlers

The ESM entry exports the plugin factory and does **not** auto-register:

```bash
npm install docsify-yacv
```

```js
import DocsifyYacv from 'docsify-yacv';

window.$docsify = {
  yacv: {
    viewer: 'https://yeicor-3d.github.io/yet-another-cad-viewer/',
    version: 'stable',
  },
  plugins: [DocsifyYacv()],
};
```

Factory options take precedence over `window.$docsify.yacv`. TypeScript definitions are included.

## Usage

### Live build123d code

````markdown
```build123d height=440 title="Parametric knob" version=stable
from build123d import *

with BuildPart() as knob:
    Cylinder(14, 6)
    with Locations((0, 0, 6)):
        Cylinder(9, 10)

show(knob)
```
````

The fence body is gzip-compressed with `CompressionStream` and sent to the viewer as base64url
`pg_code` in the iframe hash, then executed by the yacv playground (Pyodide + OCP.wasm).

Supported languages: `build123d`, `b3d`, `b123d`, `yacv-build123d`, `yacv-py`, `yacv-python`, or
`python yacv` if you want to keep Python highlighting.

Per-embed options are space separated: `height`, `title`, `version`/`b3d-version`, `debug`,
`constraints`, `editor`, `code` (`show`/`hide`), `code-src`, `preview`, `poster`, `models`/`src`,
`lazy`, `auto-load`, `chrome`, `open`, `viewer`, plus every yacv viewer setting (`edgeWidth=2`,
`autoplay=false`, ...).
Values with spaces must be quoted: `title="My part"`.

### Static models

````markdown
```yacv height=400 title="Exported assembly"
assets/models/assembly.glb
assets/models/assembly-edges.glb#name=edges
```
````

One URL per line; blank lines and `#` comments are ignored. Relative URLs resolve against the docs
page. Export the files from build123d with [yacv-server](https://pypi.org/project/yacv-server/):

```python
import os

# Don't start the interactive hot-reload server in CI (must happen before import)
if os.environ.get("CI"):
    os.environ["YACV_DISABLE_SERVER"] = "1"

from build123d import *
from yacv_server import show, export_all

with BuildPart() as part:
    Box(40, 24, 5)
    Cylinder(6, 5, mode=Mode.SUBTRACT)

show(part, names="assembly")
export_all("docs/assets/models")   # writes assembly.glb
```

Cross-origin model hosting needs CORS, including `HEAD` (yacv checks `ETag`s). GitHub Pages does
this automatically; self-host the viewer to avoid CORS entirely. See [Static models](models.md).

### `<yacv>` element

For external Python sources or richer attributes:

```html
<yacv src="examples/bracket.py" code="show" height="420" title="Bracket"></yacv>

<yacv height="420" title="Inline script">

<script type="text/x-python">
from build123d import *
show(Sphere(10))
</script>

</yacv>
```

The plugin inserts the blank lines markdown needs around `<script>` bodies automatically. Adding
them yourself keeps the Markdown renderable without the plugin.

## Configuration

All options are optional under `window.$docsify.yacv` (or the factory for bundlers).

```js
window.$docsify = {
  yacv: {
    version: 'stable',
    height: '460px',
    settings: {
      edgeWidth: 2,
      autoplay: true,
    },
  },
};
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `viewer` | `https://gllmar.github.io/docsify-yacv/viewer/` | Headless optimized viewer for embeds (absolute or relative). |
| `openViewer` | `https://yeicor-3d.github.io/yet-another-cad-viewer/` | Viewer used by the **Open** action (full upstream build with the editor). |
| `runtime` | `viewer` | `viewer` (Pyodide per embed) or `worker` (one shared same-origin worker). |
| `workerUrl` | `''` | Module worker for `runtime: 'worker'` (e.g. `./viewer/yacv-worker.js`). |
| `workerWarmup` | `true` | Pre-boot the shared worker on idle when a live embed exists. |
| `height` | `480px` | Default stage height (number = px, CSS length, or `auto`). |
| `title` | `''` | Default toolbar title. |
| `poster` | `''` | Poster image for preview-only (`auto-load=false`) embeds; shown instantly. |
| `version` | `stable` | build123d version for live code. |
| `debug` | `false` | Use OCP.wasm debug wheels. |
| `constraints` | `''` | Pip constraints (`;`/newline separated or JSON mapping). |
| `editor` | `0` | In-iframe Monaco opacity (`0` hides it; docsify shows the code). Ignored by the headless viewer. |
| `lazy` | `true` | Create iframes when they approach the viewport. |
| `lazyMargin` | `200px` | How far before the viewport lazy embeds start loading. |
| `maxConcurrent` | `2` | Maximum iframes created at the same time. |
| `maxLiveConcurrent` | `2` | Maximum live build123d sandboxes loaded at once. |
| `liveSlotMs` | `30000` | How long a loaded live sandbox holds its slot (`0` = until unloaded). |
| `unloadOffscreen` | `true` | Unload far-offscreen iframes (`'static'` = only non-code embeds, `false` = keep all). |
| `unloadMargin` | `100% 0px` | How far outside the viewport an embed is unloaded. |
| `autoLoad` | `true` | `false` shows a **Load 3D viewer** button. |
| `chrome` | `true` | Show the embed toolbar. |
| `openInNewTab` | `true` | Show the **Open** action (full viewer with editor). |
| `settings` | `{}` | Extra yacv viewer settings for every embed. |
| `base` | docs page URL | Base URL/resolver for relative assets. |

See the [full reference](reference.md) for fence attributes, every yacv setting, behaviour,
performance notes, styling variables, security notes and troubleshooting.

## Full build123d support

| Capability | How |
| ---------- | --- |
| Execute build123d in the browser | Any `build123d`/`b3d` fence (Pyodide + OCP.wasm). |
| Pin the build123d version | `version=0.13.0`, `version=dev`, `version=pull/123/head` |
| Debug wheels / package constraints | `debug`, `constraints="numpy<2;packaging>=24"` |
| `show_object()` from `ocp_vscode` | Provided by the yacv sandbox. |
| Colors, multiple objects, highlights | `obj.color = (r,g,b,a)` + `show(a, b, highlight)` |
| Textures and images | Data URIs or files via yacv's `show(..., texture=...)`. |
| Keep examples in real `.py` files | `code-src="examples/part.py"` or a `yacv` fence with a `.py` URL |
| Editable sandbox inside the docs | `editor=0.9` (Monaco, F10 to run) |
| Additional pure-Python packages | `await micropip.install("bd_warehouse")` inside the snippet |
| Static export for fast pages | `yacv_server.export_all()` + a `yacv` fence |

## Optimized embedded viewer

The **default `viewer`** is a **headless, pruned yacv build** prepared for the
[b3d-live VS Code extension](https://codeberg.org/gllm/Open-VSX-yet-another-cad-viewer) and hosted
from this repository (`viewer/`):

- both side drawers start closed and the 3D scene fills the embed
- the playground runs headless: **Monaco is never loaded** and its assets are pruned from the build
- the Python bootstrap stubs four heavy/unused wheels (`threejs-materials` ~90 MB, `sympy`,
  `scikit-learn`, `IPython`), cutting a warm live bootstrap from roughly 21–24s to ~15s
- static/preview embeds run in mesh mode and never start Pyodide at all

Use it for embeds and keep the full upstream viewer for **Open**, where the editor is available:

These are the defaults, so nothing needs configuring:

```js
window.$docsify = {
  yacv: {
    viewer: 'https://gllmar.github.io/docsify-yacv/viewer/',
    openViewer: 'https://yeicor-3d.github.io/yet-another-cad-viewer/',
  },
};
```

Copy the `viewer/` directory into your static site and use `viewer: './viewer/'` for a same-origin,
offline-capable embed. The `editor` option is ignored by the headless viewer — use **Open** to edit.
Point `viewer` at the upstream URL if you need the in-iframe Monaco editor. See
[`viewer/NOTICE.md`](viewer/NOTICE.md) for provenance and licensing.

## Time to interactive

Measured on the live demo with a warm browser cache (Chromium, M1-class machine):

| Embed | Time until the model is visible |
| ----- | ------------------------------- |
| Preview with `poster` (image) | **<0.5s**; interactive viewer on hover/tap |
| Static `yacv` model (GLB) | ~2–3s (optimized viewer), ~3s upstream |
| Live build123d **with `preview`** | preview in ~1–3s; live geometry replaces it when the sandbox finishes |
| Live build123d **with `preview` + `auto-load=false`** | preview in ~1–3s; sandbox starts only on **Run build123d** |
| Live build123d, optimized viewer (per-viewer runtime) | **~15s** warm cache |
| Live build123d, shared worker, **first** example | ~12–20s boot (preview/poster visible meanwhile) |
| Live build123d, shared worker, **later** examples | **~0.5–1s** |
| Live build123d, upstream viewer | ~21–30s (includes Monaco) |

The live sandbox cost is dominated by Pyodide boot plus installing/importing build123d, OCP and the
scientific Python stack — not by this plugin. The optimized `viewer/` build removes Monaco and stubs
unused wheels, which is where the ~6s improvement comes from. Practical mitigations:

- **Add a `preview` GLB.** Export the same model with `yacv_server.export_all()` and use the live
  model's variable name: `preview="assets/part.glb#name=part"`. yacv renders it immediately and
  replaces it when the sandbox output arrives.
- **Combine it with `auto-load=false`.** The preview still loads, and readers get a
  **Run build123d** button that starts the sandbox. This keeps pages fast and avoids ~20s of CPU
  for readers who only want to look at the model.
- **Prefer static GLBs** for anything that does not need to be executable.
- **Keep one or two live embeds per page.** Each live embed boots its own Pyodide instance.
- **Use `auto-load=false`** for optional live examples; readers opt in with a click.
- **Tune `lazyMargin`** (default `200px`): smaller values avoid starting off-screen sandboxes early.
- The plugin adds `preconnect`/`dns-prefetch` hints for the viewer, Pyodide CDN and (on live pages)
  PyPI/OCP.wasm origins.

## Static hosting

There is no build step. The repository root **is** the site:

```
index.html          docsify demo
README.md           demo home / this documentation
docsify-yacv.js     the plugin (committed IIFE, auto-registering)
docsify-yacv.esm.js ESM entry for npm/bundlers
viewer/             optimized headless yacv + shared Python worker (see viewer/NOTICE.md)
build123d.md        docs pages
models.md
reference.md
assets/             demo GLB and Python files
.nojekyll           serve files as-is on GitHub Pages
```

To publish the demo, set **Settings → Pages → Deploy from a branch → `main` / `(root)`**. There is
no workflow, no `npm install` and no build step: GitHub serves the committed files directly (the
root `.nojekyll` disables Jekyll). Any static host (Netlify, Codeberg Pages, S3, a local
`python -m http.server`) works the same way.

If you edit `src/`, regenerate the two committed artifacts with:

```bash
npm run build
```

## Development

```bash
npm install
npm run build         # docsify-yacv.js + docsify-yacv.esm.js
npm test              # unit tests (node:test)
npx playwright install chromium
npm run test:e2e      # docsify 5 + 4 in a real browser
npm run demo          # serves the repo root with CORS at http://localhost:8080/
npm run demo:models   # regenerate assets/*.glb
```

Project layout:

```
src/
  index.js       plugin entry (ESM, factory)
  iife.js        global + docsify auto-registration
  options.js     defaults, yacv setting schema
  parse.js       fence/attribute parsing, <yacv> normalization
  encode.js      gzip + base64url pg_code
  url.js         viewer URL construction
  mount.js       docsify hooks glue, DOM, lazy loading
  styles.js      injected stylesheet
scripts/         build + demo servers + demo model generator
test/unit/       node:test unit tests
test/e2e/        Playwright tests against a stub viewer
```

The CI workflow verifies that the committed `docsify-yacv.js` / `docsify-yacv.esm.js` are up to
date with `src/`.

## Compatibility

- docsify 5.x and newer.
- Modern browsers with `IntersectionObserver`; `CompressionStream` enables compact code URLs.
- No runtime dependencies.

## License

MIT. [Yet Another CAD Viewer](https://github.com/yeicor-3d/yet-another-cad-viewer) is MIT too;
build123d is Apache-2.0, OCP.wasm is LGPL-2.1 (loaded at runtime by the viewer).
