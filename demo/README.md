# docsify-yacv

**Yet Another CAD Viewer for docsify** — embed interactive CAD models directly in your markdown,
with first-class **build123d** support. Build123d code runs entirely in the reader's browser
(OCP compiled to WebAssembly), so there is no server, no Python install and no build step.

```build123d height=440 title="Live build123d — click Open to edit"
from build123d import *

with BuildPart() as part:
    Box(34, 22, 8)
    with Locations((0, 0, 4)):
        Cylinder(6, 6)
    Cylinder(3, 20, mode=Mode.SUBTRACT)

part.color = (0.16, 0.47, 0.80, 1)
show(part)
```

The model above is generated from the code on your machine, right now. Click **Open** to load the
full viewer with the code editor and re-run it there. Scroll down for static models (pre-exported
GLB files), version pinning, external Python files, and every available option.

## Why?

- **Documentation that stays true.** A build123d snippet in your docs is not a screenshot: it is
  the actual, executable model.
- **Zero backend.** The [yacv](https://github.com/yeicor-3d/yet-another-cad-viewer) frontend is
  served statically; the CAD kernel runs from a WASM wheel.
- **Full viewer.** Orbit, zoom, clipping planes, exploded view, face/edge/vertex selection,
  measurements, orthographic projection, screenshots and GLB export all come from yacv.
- **Static when you need speed.** Pre-export heavy models with `yacv_server.export_all()` and
  embed the resulting `.glb` files.
- **Lazy and cheap.** Iframes are only created when they scroll into view (and can be made
  click-to-load).

## Install

```html
<!-- Defines the DocsifyYacv global -->
<script src="https://cdn.jsdelivr.net/gh/gllmAR/docsify-yacv@v0.1.0/dist/docsify-yacv.min.js"></script>

<script>
  window.$docsify = {
    plugins: [
      DocsifyYacv({
        version: 'stable', // build123d version used by the in-browser sandbox
        height: '460px',
      }),
    ],
  };
</script>

<!-- docsify must be loaded after window.$docsify is configured -->
<script src="https://cdn.jsdelivr.net/npm/docsify@5/dist/docsify.min.js"></script>
```

From npm:

```bash
npm install docsify-yacv
```

```js
import DocsifyYacv from 'docsify-yacv';

window.$docsify = {
  plugins: [DocsifyYacv({ version: 'stable' })],
};
```

## Two kinds of embeds

### Live build123d (runs in the browser)

````markdown
```build123d title="Bracket" height=420
from build123d import *

with BuildPart() as bracket:
    Box(30, 14, 6)
    Cylinder(4, 6, mode=Mode.SUBTRACT)

show(bracket)
```
````

The fence body is executed by the yacv playground (`pg_code`), so `from build123d import *` and
`show(...)` are all you need. `show_object(...)` from `ocp_vscode` also works — yacv provides a
compatibility shim.

Supported fence languages: `build123d`, `b3d`, `yacv-build123d`, `yacv-py`, `yacv-python`.
You can also write ```` ```python yacv ```` to keep Python syntax highlighting in your editor.

### Static GLB / GLTF models

````markdown
```yacv height=400 title="Pre-exported assembly"
assets/cube.glb
assets/cylinder.glb#name=cyl
```
````

Each non-empty line is a model URL (relative paths are resolved against the docs page). A `#name=`
fragment renames the model in the yacv sidebar. Lines ending in `.py` are treated as build123d
source files (at most one per block); this is handy when the model and its code live in separate
files.

## The `<yacv>` element

For attributes that do not fit a fence, or to point at an external script:

```html
<yacv src="assets/bracket.py" code="show" height="420" title="External build123d file"></yacv>
```

Inline code goes in a `script` tag. The plugin adds the blank lines markdown needs automatically,
but writing them explicitly keeps the source portable:

```html
<yacv height="420" title="Inline script">

<script type="text/x-python">
from build123d import *
show(Sphere(10))
</script>

</yacv>
```

## Next steps

- [build123d recipes](build123d.md) — colors, multiple objects, versions, constraints, external files
- [Static models](models.md) — exporting with `yacv_server`, hot reloading, hosting
- [Reference](reference.md) — every option and attribute
