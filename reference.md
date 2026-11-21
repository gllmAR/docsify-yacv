# Reference

## Plugin options

With the auto-registering `docsify-yacv.js`, configure the plugin under `window.$docsify.yacv`:

```js
window.$docsify = {
  yacv: {
    version: 'stable',
    height: '460px',
    settings: { edgeWidth: 1, autoplay: true },
  },
};
```

When importing the ESM build (bundlers, npm), pass options to the factory instead. Factory options
win over `$docsify.yacv`, which wins over the defaults; the ESM entry does not auto-register, so add
it to `plugins`:

```js
import DocsifyYacv from 'docsify-yacv';

window.$docsify = {
  yacv: { version: 'stable' },
  plugins: [DocsifyYacv({ height: '460px' })],
};
```

| Option         | Type                | Default                                          | Description |
| -------------- | ------------------- | ------------------------------------------------ | ----------- |
| `viewer`       | `string`            | `https://yeicor-3d.github.io/yet-another-cad-viewer/` | yacv frontend URL (absolute or relative). |
| `height`       | `number \| string`  | `480px`                                          | Default viewer height. Numbers are pixels; `auto` uses a 4:3 area. |
| `title`        | `string`            | `''`                                             | Default toolbar title. |
| `version`      | `string`            | `stable`                                         | build123d version for live code (`stable`, `0.9.1`, `dev`, `pull/123/head`, ...). |
| `debug`        | `boolean`           | `false`                                          | Use OCP.wasm debug wheels. |
| `constraints`  | `string`            | `''`                                             | Pip constraints for the sandbox, newline or `;` separated, or a JSON mapping. |
| `editor`       | `number \| string`  | `0`                                              | Opacity of the in-iframe Monaco editor. `0` hides it (code is shown by docsify instead); `show` = `0.9`. |
| `lazy`         | `boolean`           | `true`                                           | Create the iframe only when the embed approaches the viewport. |
| `lazyMargin`   | `string \| number`  | `200px`                                          | How far before the viewport a lazy embed starts loading. |
| `maxConcurrent` | `number`           | `2`                                              | Maximum iframes created at the same time (nearest first). |
| `unloadOffscreen` | `boolean \| 'static'` | `true`                                        | Remove far-offscreen iframes to free memory. `'static'` keeps live sandboxes alive. |
| `unloadMargin` | `string \| number`  | `100% 0px`                                       | How far outside the viewport an embed is unloaded. |
| `autoLoad`     | `boolean`           | `true`                                           | When `false`, show a **Load 3D viewer** button. With a `preview`/static model it instead loads the preview and shows a **Run build123d** button for the sandbox. |
| `chrome`       | `boolean`           | `true`                                           | Show the toolbar (title, badge, code toggle, reload, open). |
| `openInNewTab` | `boolean`           | `true`                                           | Show the **Open** action that opens the model in the full viewer. |
| `settings`     | `object`            | `{}`                                             | Extra yacv frontend settings applied to every embed. |
| `base`         | `string \| fn`      | docs page URL                                    | Base URL (or `src => url` function) for relative model/code paths. |

## Fence attributes

Attributes follow the fence language, space separated. Values with spaces must be quoted.
Flag attributes (`debug`, `open`, `yacv` when combined with `python`) need no value.

````markdown
```build123d height="60vh" title="My part" version=dev editor=0.8 debug constraints="numpy<2" autoplay=false
from build123d import *
show(Box(10, 10, 10))
```
````

| Attribute         | Aliases                    | Description |
| ----------------- | -------------------------- | ----------- |
| `height`          |                            | Stage height (number = px, CSS length, or `auto`). |
| `title`           |                            | Toolbar title. |
| `version`         | `b3d-version`              | build123d version for this embed. |
| `debug`           |                            | Use debug wheels (flag or `true`/`false`). |
| `constraints`     |                            | Pip constraints (`;` or `\n` separated). |
| `editor`          |                            | Editor opacity (`0`..`1`, `show`, `hide`). |
| `code`            | `show-code`                | Show/hide the source panel (`show`, `hide`, `true`, `false`). |
| `code-src`        |                            | External `.py` file to execute (instead of inline code). |
| `models`          | `src`, `preload`          | Static model URL(s) to load, comma separated. |
| `preview`         |                           | Static GLB shown while live code boots (use `#name=<variable>` to let yacv replace it). |
| `lazy`            |                            | Override the global lazy setting. |
| `auto-load`       | `autoload`                 | Override the global auto-load setting. |
| `chrome`          |                            | Override the global toolbar setting. |
| `open`            |                            | `false` hides the **Open** action. |
| `viewer`          |                            | Override the viewer URL for this embed. |

Any [yacv setting](#yacv-settings) can also be used as an attribute (case-insensitive, dashes and
underscores are ignored): `edgeWidth=2`, `autoplay=false`, `pg_opacity_loaded=0.5`, ...

## Fence languages

| Language | Meaning |
| -------- | ------- |
| `build123d`, `b3d`, `b123d`, `yacv-build123d`, `yacv-b3d`, `yacv-py`, `yacv-python` | Body is build123d/Python source, executed in the sandbox. |
| `python yacv` / `py b3d` | Same, but keeps the `python` language for editors/Prism. |
| `yacv`, `yacv-model`, `yacv-models` | Body is a list of `.glb`/`.gltf`/`.py` URLs. Bodies that look like Python are auto-detected as live code. |

## The `<yacv>` element

Use it when you need a code file, a script tag, or attribute names that are awkward in a fence.
Options are the same as fence attributes.

```html
<yacv src="assets/models/assembly.glb" height="420" title="Assembly"></yacv>

<yacv src="examples/knob.py" code="show" editor="0.9"></yacv>

<yacv height="420" title="Inline">

<script type="text/x-python">
from build123d import *
show(Box(10, 20, 30))
</script>

</yacv>
```

> **Blank lines matter.** Markdown only keeps the script content raw if the `<script>` line starts a
> fresh HTML block. The plugin inserts the necessary blank lines automatically; adding them yourself
> is still recommended so the Markdown also renders sanely without the plugin.

A `src` ending in `.py` is treated as source code; any other `src` is a model. `models` accepts a
comma separated list. Inner `<script type="text/x-python">` blocks are concatenated.

## yacv settings

These are forwarded to the viewer. See the
[yacv documentation](https://github.com/yeicor-3d/yet-another-cad-viewer) for details.

| Setting | Type | Description |
| ------- | ---- | ----------- |
| `loadHelpers` | boolean | Load the edges/vertices helper models. |
| `edgeWidth` | number | Edge line width in pixels (`0` = basic GL lines). |
| `autoplay` | boolean | Play GLTF animations. |
| `arModes` | string | `model-viewer` AR modes. |
| `zoomSensitivity`, `orbitSensitivity`, `panSensitivity` | number | Camera control sensitivity. |
| `exposure`, `shadowIntensity`, `environment`, `environmentIntensity`, `skybox` | mixed | Lighting and background. |
| `displayLoadingEveryMs`, `monitorEveryMs`, `monitorOpenTimeoutMs` | number | Loading/update polling timings. |
| `pg_version`, `pg_debug`, `pg_constraints` | mixed | Playground settings (usually set with `version`, `debug`, `constraints`). |
| `pg_opacity_loading`, `pg_opacity_loaded` | number | Editor opacity (usually set with `editor`). |

`preload` and `pg_code` are managed by the plugin; use `models` and code fences instead.

## Behaviour

1. On every docsify `doneEach`, new `<pre data-lang>` blocks and `<yacv>` elements inside
   `.markdown-section` are upgraded. Navigation re-processes the page from scratch.
2. **Live code** is gzip-compressed with the browser's `CompressionStream` and base64url-encoded
   into the iframe hash (yacv's `pg_code`). The viewer then installs build123d + OCP.wasm in a
   Pyodide worker and executes the code. If `CompressionStream` is unavailable, raw source is
   passed instead.
3. **Static models** become repeated `preload` hash parameters. Relative URLs resolve against
   `base` (the docs page by default).
4. The iframe is created on first intersection (or immediately when `lazy=false`), never
   re-created on scroll. `Reload` recreates it; navigating away destroys it.
5. The docsify source block is kept and reused as the code panel; `code=hide` collapses it behind a
   **Show code** button. Fetched/`<script>` sources get a generated code panel with a copy button.
6. `Open` opens the viewer URL (including compressed code) in a new tab. For live code it uses an
   editor opacity of `0.9` (unless you configured `editor`), so readers can edit and re-run the
   example there. `Reload` resets the embedded iframe.
7. `preview`, `src`, `models` and `preload` are all passed as yacv `preload` parameters. The viewer
   renders them while the sandbox boots; a live model with the same `#name=` replaces its preview.

## Embed chrome and the yacv sidebars

The viewer is the full yacv application, not a minimal model widget. On landscape embeds (width >
height) yacv opens its **Models** and **Tools** sidebars by default; close them with the X buttons in
their toolbars to give the model the full width. This is yacv's own layout logic and is
independent of this plugin.

With the default `editor=0`, yacv moves its Monaco editor off-screen; a slim **Playground** toolbar
may remain visible at the top of the iframe, from which readers can bring the editor back. Set
`editor=0.9` to show the editor directly, or rely on the docsify code panel plus the **Open**
action.

## Time to interactive

Measured on the live demo with a warm cache (Chromium, M1-class machine):

| Embed | Model visible |
| ----- | ------------- |
| Static GLB (`yacv` fence) | ~2–3s |
| Live build123d + `preview` GLB | ~2–3s, replaced by live geometry ~20s after the sandbox starts |
| Live build123d + `preview` + `auto-load=false` | ~2–3s; sandbox starts on **Run build123d** |
| Live build123d without preview | ~20–30s |

The live cost is Pyodide boot plus installing/importing build123d, OCP.wasm and the scientific
Python stack. It is not caused by this plugin and cannot be removed from the docs side.

Practical improvements:

- Add `preview="assets/part.glb#name=part"` (name = the variable passed to `show()`). yacv renders
  the static model immediately and replaces it when the live output arrives.
- Prefer static GLBs for heavy or non-executable models.
- Keep one or two live embeds per page: each iframe boots its own Pyodide instance, although wheels
  are reused from the browser cache.
- Use `auto-load=false` for optional live examples. With a preview model, the preview is still
  shown and a **Run build123d** button starts the sandbox on demand.
- Lower `lazyMargin` if a page has many embeds; off-screen sandboxes then start later.
- The plugin adds `preconnect`/`dns-prefetch` hints for the viewer origin, jsDelivr and (for live
  embeds) the PyPI/OCP.wasm origins.

## Performance and limits

- The **first** live embed in a browser session downloads Pyodide and the OCP WASM wheels
  (tens of MB). Later embeds on the same page/origin reuse the browser HTTP cache, but each iframe
  runs its own Pyodide instance.
- Keep `lazy` enabled on long pages.
- Use a single `yacv` fence with several models instead of several fences when the models belong
  together: one viewer app, one GPU context.
- The plugin serializes iframe creation (`maxConcurrent`, default 2, closest embed first) and
  unloads far-offscreen viewers by default. Live embeds restart when scrolled back; use
  `unloadOffscreen: 'static'` to keep them alive.
- `maxConcurrent` limits iframe startup, not Pyodide concurrency: if readers scroll quickly through
  several live embeds, eventually several sandboxes can be booting. Clearing the viewport unloads
  them and frees memory.
- The sandbox editor is heavy (Monaco). The default `editor=0` avoids loading it visibly, and the
  docsify code block already gives readers the source.
- WebAssembly, `CompressionStream` and `IntersectionObserver` are required for the full experience;
  without `CompressionStream` long code may hit URL length limits in older browsers.

## Security and privacy

Embeds are iframes served by the configured viewer origin (GitHub Pages by default). That origin
receives the model/code payload in the URL **fragment**, which is not sent to the server, but the
viewer app and its dependencies are loaded from it. The Python code runs inside the viewer's
Pyodide sandbox in the visitor's browser; it does not run on your server and is not uploaded.

Self-host the viewer if you need a fully first-party, offline-capable or CORS-free setup.

## Styling

The embed inherits the page text color. Override these custom properties on `.yacv-embed`:

```css
.yacv-embed {
  --yacv-border: rgba(128, 128, 128, 0.35);
  --yacv-border-soft: rgba(128, 128, 128, 0.22);
  --yacv-tint: rgba(128, 128, 128, 0.09);
  --yacv-tint-strong: rgba(128, 128, 128, 0.18);
  --yacv-radius: 10px;
  --yacv-font: system-ui, sans-serif;
  --yacv-mono: ui-monospace, monospace;
}
```

Styles are injected once (`#docsify-yacv-styles`) and do not depend on a docsify theme. The plugin
targets docsify 5.x and newer.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Viewer stays on **No model loaded** | Check the browser console inside the iframe. A Python error is also printed there and in the playground output. |
| `Failed to fetch ... .py` | Python files must be same-origin or CORS-enabled. |
| Models never appear with a static embed | Model URLs need CORS (including `HEAD`). See [hosting and CORS](models.md?id=hosting-and-cors). |
| Iframe is blank or refuses to connect | The viewer origin may send `X-Frame-Options`/CSP `frame-ancestors`. Self-host a viewer that allows framing. |
| `pg_code` error in the iframe console | Your build123d version string is invalid, or a constraint is unsatisfiable. Try `version=stable` without constraints. |
| Layout jumps when scrolling | Give embeds an explicit `height`; lazy loading reserves space from the start. |
