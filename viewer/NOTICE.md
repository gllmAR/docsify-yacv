# Vendored optimized viewer

This directory is the **default embedded viewer** for docsify-yacv: a prebuilt, modified copy of
[Yet Another CAD Viewer](https://github.com/yeicor-3d/yet-another-cad-viewer)
v0.12.2 (upstream commit `5be952f8c7814b65f2453447471d9aa037eec8b0`), MIT
licensed — see `LICENSE-yet-another-cad-viewer.txt`.

It is built from the patched viewer used by
[gllm/Open-VSX-yet-another-cad-viewer](https://codeberg.org/gllm/Open-VSX-yet-another-cad-viewer)
(MIT), which adds:

- **headless host mode** — both side drawers start closed, the playground UI and
  sandbox/demo entry points are hidden, and `pg_code` runs in a hidden playground
  without rendering Monaco;
- **fast Python bootstrap** — `threejs-materials` (a ~90 MB wheel), `sympy`,
  `scikit-learn` and `IPython` are replaced with lightweight mocks because the
  yacv GLB export does not use them;
- the (lazily loaded, unused in host mode) Monaco assets are pruned from the
  build.

`index.html` was adapted for docsify-yacv: it enables host mode and selects
Python mode only when the URL hash contains `pg_code`; static/preview embeds run
in mesh mode and never bootstrap Pyodide.

To update it, rebuild the viewer with the patches from the b3d-live repository
(`scripts/vendor-yacv.sh`, `patches/0003-headless-viewer-mode.patch`,
`patches/0006-fast-python-bootstrap.patch`, `scripts/prune-viewer.mjs`) and keep
the `index.html` host-mode snippet.
