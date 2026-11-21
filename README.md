# docsify-yacv

**Yet Another CAD Viewer for docsify 5 — with full build123d support.**

Write build123d code in a markdown fence and get an interactive 3D model: the code is executed in
the reader's browser by the [yacv](https://github.com/yeicor-3d/yet-another-cad-viewer) playground
(OCP compiled to WebAssembly). Prefer static files? Point an embed at exported `.glb` models.

[Live demo](https://gllmar.github.io/docsify-yacv/demo/) ·
[build123d recipes](demo/build123d.md) ·
[Static models](demo/models.md) ·
[Full reference](demo/reference.md)

```markdown
```build123d height=420 title="Bracket"
from build123d import *

with BuildPart() as bracket:
    Box(30, 14, 6)
    Cylinder(4, 6, mode=Mode.SUBTRACT)

show(bracket)
```
```

## Features

- **Live build123d** — `from build123d import *`, `show(...)`, and `show_object(...)`
  (`ocp_vscode` compatibility is provided by yacv) run client-side. No server, no Python on the
  docs host.
- **Full viewer** — orbit/pan/zoom, clipping planes, exploded view, transparency, edges and
  vertices, face/edge/vertex selection, measurements, orthographic camera, AR and GLB export.
- **Static GLB/GLTF** — single or multiple models per embed, optional names, yacv hot-reload
  (`dev+http://localhost:32323`) for local model development. Exports from CadQuery work too; only
  the live sandbox is build123d-specific.
- **Docsify-native** — the build123d source stays in the page as a highlighted code block (copy
  button included); the 3D view sits right below it.
- **Configurable sandbox** — pin build123d versions (PyPI release, branch, tag, PR), use debug
  wheels, pass pip constraints, or show the Monaco editor inside the iframe.
- **Fast by default** — lazy iframe creation, click-to-load mode, gzip+base64url code transport,
  no dependencies, small bundle.

## Install

### CDN

```html
<!DOCTYPE html>
<html>
  <body>
    <div id="app"></div>

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/docsify@5/dist/themes/core.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/docsify@5/dist/themes/addons/vue.min.css" />

    <!-- Defines the global DocsifyYacv (pin a release tag in production) -->
    <script src="https://cdn.jsdelivr.net/gh/gllmAR/docsify-yacv@main/dist/docsify-yacv.min.js"></script>

    <script>
      window.$docsify = {
        plugins: [
          DocsifyYacv({
            version: 'stable', // build123d version for live code
            height: '460px',
          }),
        ],
      };
    </script>

    <!-- docsify must be loaded after window.$docsify is configured -->
    <script src="https://cdn.jsdelivr.net/npm/docsify@5/dist/docsify.min.js"></script>
  </body>
</html>
```

### npm

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

Options can be passed to the factory or set globally in `window.$docsify.yacv` (factory options
win). TypeScript definitions are included.

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

The fence body is sent to the viewer as gzipped `pg_code` and executed by the yacv playground.
Supported languages: `build123d`, `b3d`, `b123d`, `yacv-build123d`, `yacv-py`, `yacv-python`, or
`python yacv` if you want to keep Python highlighting.

Per-embed options are space separated: `height`, `title`, `version`/`b3d-version`, `debug`,
`constraints`, `editor`, `code` (`show`/`hide`), `code-src`, `models`/`src`, `lazy`, `auto-load`,
`chrome`, `open`, `viewer`, plus every yacv viewer setting (`edgeWidth=2`, `autoplay=false`, ...).

### Full build123d support

| Capability | How |
| ---------- | --- |
| Execute build123d in the browser | Any `build123d`/`b3d` fence (Pyodide + OCP.wasm). |
| Pin the build123d version | `version=0.13.0`, `version=dev`, `version=pull/123/head` |
| Debug wheels / package constraints | `debug`, `constraints="numpy<2;packaging>=24"` |
| `show_object()` from `ocp_vscode` | Supported out of the box by the yacv sandbox. |
| Colors, multiple objects, highlights | `obj.color = (r,g,b,a)` + `show(a, b, highlight)` |
| Textures and images | Data URIs or files, via yacv's `show(..., texture=...)`. |
| Keep examples in real `.py` files | `code-src="examples/part.py"` or a `yacv` fence containing a `.py` URL |
| Editable sandbox inside the docs | `editor=0.9` (Monaco, F10 to run) |
| Additional pure-Python packages | `await micropip.install("bd_warehouse")` inside the snippet |
| Export for static hosting | `yacv_server.export_all()` and a `yacv` fence |

### Static models

````markdown
```yacv height=400 title="Exported assembly"
assets/models/assembly.glb
assets/models/assembly-edges.glb#name=edges
```
````

One URL per line; blank lines and `#` comments are ignored. Relative URLs resolve against the docs
page. Export the files from build123d with
[yacv-server](https://pypi.org/project/yacv-server/):

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

Serving models cross-origin (the default viewer is on GitHub Pages) requires CORS — including
`HEAD`, because yacv checks `ETag`s. GitHub Pages does this automatically; self-host the viewer to
avoid CORS entirely. See [Static models](demo/models.md) for details and the hot-reload workflow
(`dev+http://localhost:32323`).

### `<yacv>` element

For external sources or richer attributes:

```html
<yacv src="examples/bracket.py" code="show" height="420" title="Bracket"></yacv>

<yacv height="420" title="Inline script">

<script type="text/x-python">
from build123d import *
show(Sphere(10))
</script>

</yacv>
```

> The plugin inserts the blank lines markdown needs around `<script>` bodies automatically. If you
> render the same Markdown without the plugin, add them yourself.

## Options

| Option | Default | Description |
| ------ | ------- | ----------- |
| `viewer` | yacv GitHub Pages build | Viewer frontend URL (absolute or relative). |
| `height` | `480px` | Default stage height (number = px, CSS length, or `auto`). |
| `title` | `''` | Default toolbar title. |
| `version` | `stable` | build123d version for live code. |
| `debug` | `false` | Use OCP.wasm debug wheels. |
| `constraints` | `''` | Pip constraints (`;`/newline separated or JSON mapping). |
| `editor` | `0` | In-iframe editor opacity (`0` hides it; docsify shows the code instead). |
| `lazy` | `true` | Create iframes when they approach the viewport. |
| `autoLoad` | `true` | `false` shows a **Load 3D viewer** button. |
| `chrome` | `true` | Show the embed toolbar. |
| `openInNewTab` | `true` | Show the **Open** action (opens the full viewer with the playground editor). |
| `settings` | `{}` | Extra yacv viewer settings for every embed. |
| `base` | docs page URL | Base URL/resolver for relative assets. |

See the [full reference](demo/reference.md) for fence attributes, every yacv setting, behaviour,
performance notes, styling variables, security notes and troubleshooting.

## How it works

The plugin listens to docsify's `doneEach` hook, finds fences with yacv languages (and `<yacv>`
elements), and replaces/augments them with a responsive stage containing an iframe. Live code is
gzip-compressed with `CompressionStream`, base64url-encoded and placed in the iframe URL fragment
(yacv's `pg_code`), so it never reaches a server. Models are passed as repeated `preload`
parameters. The iframe is created lazily through an `IntersectionObserver` and talks to the
configured viewer exactly like the official yacv share links.

## Development

```bash
npm install
npm run build         # dist/ (IIFE + ESM, minified + unminified)
npm test              # unit tests (node:test)
npx playwright install chromium
npm run test:e2e      # docsify 5 + plugin in a real browser
npm run demo          # serves /demo with CORS at http://localhost:8080/demo/
node scripts/make-demo-glb.mjs   # regenerate demo/assets/*.glb
```

Project layout:

```
src/
  index.js       plugin entry (ESM)
  iife.js        global DocsifyYacv export
  options.js     defaults, yacv setting schema
  parse.js       fence/attribute parsing
  encode.js      gzip + base64url pg_code
  url.js         viewer URL construction
  mount.js       docsify hooks glue, DOM, lazy loading
  styles.js      injected stylesheet
demo/            docsify 5 demo site (also the documentation)
test/unit/       node:test unit tests
test/e2e/        Playwright tests against a stub viewer
```

## Compatibility

- docsify 5.x (tested) and docsify 4.x.
- docsify 4 does not escape fence info strings correctly, so values containing spaces must be
  avoided there: use `title=Bracket` instead of `title="My bracket"`, or the
  [`<yacv>` element](#yacv-element) with proper HTML attributes.
- Modern browsers with `IntersectionObserver`; `CompressionStream` enables compact code URLs.
- No runtime dependencies.

## License

MIT. [Yet Another CAD Viewer](https://github.com/yeicor-3d/yet-another-cad-viewer) is MIT too;
build123d is Apache-2.0, OCP.wasm is LGPL-2.1 (loaded at runtime by the viewer).
