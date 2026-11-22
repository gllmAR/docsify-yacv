# build123d recipes

All examples on this page run in the browser through the yacv playground. The first run in a
session downloads the OCP WebAssembly wheel (tens of megabytes), so subsequent examples are
noticeably faster. See [performance notes](reference.md?id=performance-and-limits).

> For pages where the 3D view matters more than interactive code, pair the fence with a
> pre-exported `preview` GLB (see [Load code from a file](#load-code-from-a-file)) and optionally
> `auto-load=false` so the sandbox starts only when the reader clicks **Run build123d**.
>
> Add `vertices=False` to `show()` for a cleaner embed; yacv draws small vertex markers by default.
>
> These examples use the shared Python worker (`runtime: 'worker'`). Embeds with the same
> version/debug/constraints share one interpreter; a different combination gets its own shared
> worker. The version/debug examples use `auto-load=false`, so their worker only boots on **Run**.

## A parametric part

```build123d preview="assets/previews/flange.glb#name=flange" poster="assets/previews/flange.png" height=420 title="Parametric flange"
from math import cos, sin, radians

from build123d import *

BORE = 14
BOLT_CIRCLE = 46
BOLTS = 6

with BuildPart() as flange:
    Cylinder(32, 8)
    Cylinder(BORE / 2, 8, mode=Mode.SUBTRACT)
    with Locations(*(
        (BOLT_CIRCLE / 2 * cos(radians(360 / BOLTS * i)), BOLT_CIRCLE / 2 * sin(radians(360 / BOLTS * i)), 0)
        for i in range(BOLTS)
    )):
        Hole(2.5)
    # Round the outer top and bottom rims
    outer_rims = flange.edges().filter_by(GeomType.CIRCLE).filter_by(lambda e: e.radius > 20)
    fillet(outer_rims, radius=1.5)

show(flange)
```

## Multiple objects, colors and highlights

`show()` accepts several objects at once. The variable names become the model names in the yacv
sidebar, and `obj.color = (r, g, b, a)` sets a per-object color.

```build123d preview="assets/previews/base_part.glb#name=base_part,assets/previews/cap_part.glb#name=cap_part,assets/previews/rim.glb#name=rim" poster="assets/previews/assembly.png" height=420 title="Assembly with a highlighted edge group"
from build123d import *

with BuildPart() as base:
    Box(44, 30, 8)
    Cylinder(8, 8, mode=Mode.SUBTRACT)

with BuildPart() as cap:
    Cylinder(16, 6)
    Cylinder(8, 6, mode=Mode.SUBTRACT)

# BuildPart objects are builders: use .part for the resulting shape
base_part = base.part
cap_part = cap.part.translate((0, 0, 8))
base_part.color = (0.20, 0.60, 0.45, 1)
cap_part.color = (0.90, 0.60, 0.15, 1)

# Highlight the top rim of the cap (slightly raised to avoid z-fighting)
rim = Compound(cap_part.edges().group_by(Axis.Z)[-1]).translate((0, 0, 0.01))
rim.color = (1, 0.2, 0.2, 1)

show(base_part, cap_part, rim)
```

## ocp_vscode / CQ-editor compatible code

The playground pre-imports `yacv_server` and mocks `ocp_vscode`, so snippets written for
VS Code (or CQ-editor) work as-is:

```build123d preview="assets/previews/part.glb#name=part" poster="assets/previews/part.png" height=380 title="show_object() compatibility"
from build123d import *
from ocp_vscode import show_object

part = Box(30, 20, 10) - Cylinder(5, 10)
part.color = (0.8, 0.4, 0.1, 1)

# yacv maps show_object() to its own show(): use yacv features (like
# obj.color) instead of ocp_vscode-only options.
show_object(part)
```

## Pinning the build123d version

By default the sandbox installs the latest stable build123d. Use `version` to pin a PyPI release,
or to test a GitHub branch / tag / commit / pull request:

```build123d version=dev auto-load=false preview="assets/previews/cube.glb#name=cube" poster="assets/previews/cube.png" height=360 title="build123d dev branch"
from build123d import *

with BuildPart() as cube:
    Box(20, 20, 20)
    fillet(cube.edges(), radius=2)

show(cube)
```

`version` accepts:

| Value             | Meaning                                       |
| ----------------- | --------------------------------------------- |
| `stable`          | Latest PyPI release (default)                 |
| `0.13.0`          | A specific PyPI release                       |
| `dev`             | The `dev` branch of the build123d repository  |
| `pull/123/head`   | The head of pull request #123                 |
| `v0.9.1`          | A tag from the build123d repository           |

## Debug wheels and package constraints

`debug` installs OCP.wasm debug wheels (newer dev builds, better crash reports; slower).
`constraints` passes pip constraints for every package the sandbox installs:

```build123d debug constraints="numpy<2;packaging>=24" auto-load=false preview="assets/previews/constraints.glb#name=constraints" poster="assets/previews/constraints.png" height=340 title="Pinned sandbox dependencies"
from build123d import *
import numpy

print("numpy", numpy.__version__)
show(Box(16, 16, 4), names="constraints")
```

Multiple constraints are separated with `;` (a newline works too when using the `<yacv>` element).

The sandbox is a regular Pyodide environment, so pure-Python packages can be installed from a snippet
with micropip before importing them:

```build123d height=360 title="Installing a pure-Python library"
import micropip

await micropip.install("bd_warehouse")

from build123d import *
from bd_warehouse.fastener import SocketHeadCapScrew

screw = SocketHeadCapScrew("M6-1", length=20)
show(screw)
```

If a package needs native code that has not been compiled to WebAssembly, it will not work in the
browser; export a static GLB instead.

## Live editing and fullscreen

The embedded demos run the headless, shared-worker viewer, so Monaco is not loaded. Instead, every
live code panel has an **Edit** action for in-place editing, and the toolbar has **Fullscreen** for
a split code/viewer workspace that fills the page. Both use the same shared Python worker and the
same viewer iframe, so the camera and loaded geometry stay put; `Ctrl/⌘+Enter` runs, `Escape`
leaves fullscreen, and the toolbar code toggle hides the editor pane to maximize the viewer. The editor uses Pupitre UI's code-editor pattern and Prism Python highlighting.
Set `autorun` on a fence (or `autorun: true` globally) to re-run after a short typing pause.

**Open** still opens the full upstream yacv viewer with its Monaco playground (`F10` runs) in a new
tab, for readers who want it.

If you really want Monaco inside an embed, use the full upstream viewer and the per-viewer runtime.
This creates one Pyodide instance **per viewer**, so it is intentionally not used in this demo:

```js
window.$docsify = {
  yacv: {
    runtime: 'viewer',
    viewer: 'https://yeicor-3d.github.io/yet-another-cad-viewer/',
  },
};
```

````markdown
```build123d editor=0.85 runtime=viewer viewer="https://yeicor-3d.github.io/yet-another-cad-viewer/"
from build123d import *
show(Box(10, 20, 30))
```
````

## Load code from a file

Keeping examples in real `.py` files lets you lint and test them, and keeps markdown short:

```yacv code=show height=420 preview="assets/preview-bracket.glb#name=bracket" poster="assets/previews/bracket.png"
assets/bracket.py
```

The file is fetched at runtime (same-origin by default, CORS otherwise), so it must be served by
your docs host. Add `code=show` to render the fetched source above the viewer; `code-src` (or a
`src` ending in `.py`) selects the file.

The `preview` GLB in that block is the same bracket exported ahead of time with
`yacv_server.export_all()`. yacv displays it after ~2–3s while the sandbox boots, then the live
model (also named `bracket`) replaces it. This is the recommended pattern for any page where the
3D view matters more than waiting for the Python kernel.
