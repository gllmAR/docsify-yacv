# Static models

Live build123d is great for documentation, but exporting once and shipping `.glb` files is faster,
more deterministic and works in every browser. Both approaches use the same yacv viewer, so the
controls and measurements are identical.

## Local GLB files

```yacv height=420 title="Two exported models"
assets/cube.glb
assets/cylinder.glb#name=cylinder
```

```html
<yacv models="assets/cube.glb,assets/cylinder.glb#name=cylinder" height="420" title="Two exported models"></yacv>
```

The model list is also the fence body: one URL per line, blank lines and `#` comments ignored.
URLs may be absolute, relative to the docs page, or use yacv's `#name=` fragment to control the
name shown in the viewer.

## Exporting with yacv_server

The [yacv-server](https://pypi.org/project/yacv-server/) Python package turns build123d objects
into GLB files with the same tessellation, colors and edges as the live viewer:

```python
# build_models.py — run this when your docs are built
import os

# In CI we only want the exports, not the interactive hot-reload server.
# (This must be set before importing yacv_server.)
if os.environ.get("CI"):
    os.environ["YACV_DISABLE_SERVER"] = "1"

from build123d import *
from yacv_server import show, export_all

with BuildPart() as bracket:
    Box(40, 24, 5)
    Cylinder(6, 5, mode=Mode.SUBTRACT)

bracket.color = (0.25, 0.55, 0.85, 1)
show(bracket, names="bracket")

# Writes bracket.glb into docs/assets/models/
export_all("docs/assets/models")
```

```bash
pip install build123d yacv-server
python build_models.py
```

Then reference the files from markdown:

````markdown
```yacv
assets/models/bracket.glb
```
````

`export_all()` exports every object you have passed to `show()`. Alternatively, run the code in the
browser sandbox and use the viewer's **Download scene** button for a one-off GLB.

CadQuery objects work the same way with `yacv_server` (`show()`/`export_all()`): yacv converts OCP
shapes to GLTF regardless of the Python CAD library. Only the live in-browser sandbox is
build123d-specific.

## Hot reload while writing docs

If you are writing the CAD model and the docs at the same time, start the yacv server locally:

```bash
python -m pip install yacv-server
python build_models.py   # without CI set, this starts and keeps the server running
```

Edit the model and re-run the script (or the `show()` cell) — the viewer picks up the change.

and point an embed at it with the `dev+` prefix:

```yacv height=420 title="Hot-reloading local model (start yacv_server first)" auto-load=false
dev+http://localhost:32323
```

The viewer reconnects automatically and updates the geometry whenever `show()` runs again. This is
the same mechanism used by the yacv Jupyter/VSCode workflow. `dev+` URLs are ignored while the
server is down (the viewer keeps retrying), so it is safe to keep in a draft page.

## Hosting and CORS

The yacv frontend runs from its own origin (GitHub Pages by default), while your models are served
by your docs host. Model downloads therefore need CORS:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD
Access-Control-Expose-Headers: ETag
```

- **GitHub Pages** sends permissive CORS headers for static assets — nothing to do.
- **Local development** with `python -m http.server` does **not** send them. Use a server with CORS
  enabled, or self-host the viewer next to your docs (below).
- Browsers issue a `HEAD` request per model to read its `ETag` (used for update detection), so
  `HEAD` must be allowed too.

## Self-hosting the viewer

Download a release of [Yet Another CAD Viewer](https://github.com/yeicor-3d/yet-another-cad-viewer/releases)
and serve it next to your docs, then point the plugin at it:

```js
window.$docsify = {
  yacv: {
    viewer: 'assets/yacv/', // or a full URL
  },
};
```

Same-origin deployments avoid CORS entirely, work offline (after the browser cache is warm) and
let you pin the viewer version. You can also override the viewer for a single embed with the
`viewer` attribute.

## Mixing live code and static models

A single embed can do both: the static models appear immediately, and the playground output is
added when the Python code finishes running.

```build123d height=440 title="Static preview + live playground" src="assets/cube.glb"
from build123d import *

with BuildPart() as live:
    Box(24, 24, 24)
    Sphere(17, mode=Mode.INTERSECT)

live.color = (0.85, 0.3, 0.25, 1)
show(live)
```
