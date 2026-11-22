# Pupitre UI (vendored styles)

`pupitre-ui.css` is vendored from
[gllm/pupitre-ui](https://codeberg.org/gllm/pupitre-ui) v1.18.39
(commit `436e195`), MIT licensed — see `LICENSE`.

Only the stylesheet is vendored. docsify-yacv uses Pupitre UI's design tokens
and code-editor pattern (transparent textarea over a highlighted layer with a
line gutter) for its live code editor and fullscreen surface; it does not load
the Pupitre UI renderer or document contract.

Refresh with:

```bash
node scripts/sync-pupitre-ui.mjs
```
