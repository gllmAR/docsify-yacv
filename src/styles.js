export const STYLE_ID = 'docsify-yacv-styles';

export const CSS = `
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

.yacv-worker-status {
  font-size: 11px;
  opacity: 0.65;
  white-space: nowrap;
}

.yacv-worker-status:empty { display: none; }
.yacv-worker-status[data-state="error"] { color: #c0392b; opacity: 1; }

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

.yacv-btn[hidden] { display: none; }

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

/* Staged progress over the poster/placeholder: visible while the shared Python
   worker boots or runs, so a 12-20s first example never looks stuck. */
.yacv-progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 11px 13px 12px;
  color: #fff;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.28) 65%, transparent);
  font-size: 12px;
  line-height: 1.35;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.yacv-progress[hidden] { display: none; }

.yacv-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.yacv-progress .yacv-spinner {
  width: 15px;
  height: 15px;
  border-width: 2px;
  border-color: rgba(255, 255, 255, 0.32);
  border-top-color: #fff;
}

.yacv-progress-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.yacv-progress-elapsed {
  flex: none;
  margin-left: auto;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.yacv-progress-track {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.28);
}

.yacv-progress-fill {
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: #fff;
  transition: width 0.35s ease;
}

.yacv-progress[data-indeterminate="true"] .yacv-progress-fill {
  animation: yacv-progress-slide 1.2s ease-in-out infinite;
}

@keyframes yacv-progress-slide {
  from { transform: translateX(-110%); }
  to { transform: translateX(310%); }
}

@keyframes yacv-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .yacv-spinner { animation-duration: 3s; }
  .yacv-progress[data-indeterminate="true"] .yacv-progress-fill { animation: none; }
  .yacv-progress-fill { transition: none; }
}

.yacv-error { color: #c0392b; }
.yacv-error code { color: inherit; }

.yacv-editor-host {
  height: min(46vh, 380px);
  min-height: 220px;
}

.yacv-inline-editor {
  position: relative;
  z-index: 1;
  padding: 8px 10px 10px;
  border-top: 1px solid var(--yacv-border-soft);
  background: var(--yacv-tint);
}

.yacv-editor-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.yacv-editor-hint {
  margin-left: auto;
  color: inherit;
  font-size: 11px;
  opacity: 0.6;
}

.yacv-editor-status {
  min-height: 1.2em;
  margin: 5px 0 0;
  color: inherit;
  font-size: 11px;
  opacity: 0.65;
}

.yacv-editor-status.is-error {
  color: #c0392b;
  opacity: 1;
}

/* The editor itself uses the Pupitre UI code-editor pattern (textarea over a
   highlighted layer, line gutter). The vendored PUI stylesheet is loaded on
   demand; these rules map the PUI tokens to the docsify theme and keep the
   editor usable if the stylesheet is blocked. */
.yacv-editor-wrap,
.yacv-editor-wrap > .yacv-pui-editor,
.yacv-pui-editor .pui-code-editor {
  height: 100%;
  min-height: 0;
}

.yacv-pui-editor.pui {
  --pui-bg: rgba(128, 128, 128, 0.08);
  --pui-surface: transparent;
  --pui-surface-2: rgba(128, 128, 128, 0.16);
  --pui-text: inherit;
  --pui-muted: rgba(128, 128, 128, 0.95);
  --pui-border: var(--yacv-border);
  --pui-accent: #2f81f7;
  --pui-success: #3fb950;
  --pui-warning: #d29922;
  --pui-danger: #f85149;
  --pui-radius: 8px;
  --pui-touch: 28px;
  --pui-font: var(--yacv-font);
  --pui-type-base: 13px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font-size: 12.5px;
  height: 100%;
}

.yacv-pui-editor .pui-code-editor,
.yacv-pui-editor .pui-code-highlight,
.yacv-pui-editor .pui-code-input,
.yacv-pui-editor .pui-code-gutter {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace !important;
  font-size: 12.5px !important;
  line-height: 18.75px !important;
  font-variant-ligatures: none;
  letter-spacing: normal;
  tab-size: 2;
}

.yacv-pui-editor .pui-code-highlight {
  position: absolute !important;
  inset: 0 !important;
  z-index: 1 !important;
  margin: 0 !important;
  padding: 8px 8px 8px 52px !important;
  border: 0 !important;
  background: transparent !important;
  color: inherit;
  white-space: pre !important;
  overflow: auto !important;
}

.yacv-pui-editor .pui-code-input {
  margin: 0 !important;
  padding: 8px 8px 8px 52px !important;
  border: 0 !important;
  white-space: pre !important;
  overflow: auto !important;
}

.yacv-pui-editor .pui-code-gutter {
  padding-top: 8px !important;
  padding-bottom: 8px !important;
}

/* Prism's theme may bold/italicize tokens, which changes advance widths and
   makes the highlight drift from the transparent textarea. */
.yacv-pui-editor .pui-code-highlight .token,
.yacv-pui-editor .pui-code-highlight .token * {
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  font-weight: 400 !important;
  font-style: normal !important;
  letter-spacing: normal !important;
}

/* Docsify themes style markdown pre blocks above the PUI class; reset the
   exact properties that break the overlay alignment. */
.markdown-section .yacv-pui-editor .pui-code-highlight,
.markdown-section .yacv-pui-editor .pui-code-highlight code {
  position: absolute !important;
  inset: 0 !important;
  margin: 0 !important;
  padding: 8px 8px 8px 52px !important;
  border: 0 !important;
  background: transparent !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace !important;
  font-size: 12.5px !important;
  line-height: 18.75px !important;
  white-space: pre !important;
}

.markdown-section .yacv-pui-editor .pui-code-input {
  margin: 0 !important;
  padding: 8px 8px 8px 52px !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace !important;
  font-size: 12.5px !important;
  line-height: 18.75px !important;
}

.yacv-pui-editor .token.comment {
  color: var(--pui-muted);
  font-style: italic;
}

.yacv-pui-editor .token.keyword,
.yacv-pui-editor .token.operator {
  color: var(--pui-danger);
}

.yacv-pui-editor .token.string,
.yacv-pui-editor .token.triple-quoted-string {
  color: var(--pui-success);
}

.yacv-pui-editor .token.number {
  color: var(--pui-warning);
}

.yacv-pui-editor .token.function,
.yacv-pui-editor .token.class-name {
  color: var(--pui-accent);
}

.yacv-pui-editor .token.boolean,
.yacv-pui-editor .token.builtin {
  color: var(--pui-danger);
}

.yacv-pui-editor .token.punctuation {
  color: var(--pui-muted);
}

.yacv-pui-editor .token.decorator,
.yacv-pui-editor .token.annotation {
  color: var(--pui-warning);
}

/* Plain textarea fallback when the PUI stylesheet cannot load. */
.yacv-pui-editor.is-unstyled .pui-code-editor.yacv-editor-textarea {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--yacv-border);
  border-radius: 8px;
}

.yacv-editor-textarea .pui-code-gutter,
.yacv-editor-textarea .pui-code-highlight {
  display: none;
}

.yacv-editor-textarea .pui-code-input {
  position: static;
  width: 100%;
  height: 100%;
  min-height: 220px;
  padding: 10px;
  border: 0;
  background: transparent;
  color: inherit;
  -webkit-text-fill-color: inherit;
  font-family: var(--yacv-mono);
  font-size: 12.5px;
  line-height: 1.5;
  resize: none;
}

/* In-page fullscreen live editor: the existing embed is promoted to a fixed
   viewport grid, so the already-loaded iframe, camera and worker stay alive. */
body.yacv-fs-open {
  overflow: hidden;
}

.yacv-embed.yacv-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  grid-template-columns: minmax(300px, 38%) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  width: auto;
  height: 100vh;
  height: 100dvh;
  max-width: none;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: var(--yacv-fullscreen-bg, #fff);
  color: var(--yacv-fullscreen-text, #1f2328);
}

.yacv-fullscreen .yacv-toolbar {
  grid-column: 1 / -1;
  grid-row: 1;
  overflow-x: auto;
  flex-wrap: nowrap;
  background: var(--yacv-fullscreen-surface, #fff);
}

.yacv-fullscreen .yacv-stage {
  grid-column: 2;
  grid-row: 2;
  height: auto !important;
  min-height: 0;
}

.yacv-fs-pane {
  grid-column: 1;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--yacv-border);
  background: var(--yacv-fullscreen-surface, #fff);
}

.yacv-fs-pane[hidden] {
  display: none;
}

.yacv-fullscreen.yacv-fs-no-editor {
  grid-template-columns: minmax(0, 1fr);
}

.yacv-fullscreen.yacv-fs-no-editor .yacv-stage {
  grid-column: 1;
}

.yacv-fs-head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--yacv-border-soft);
  font-size: 12px;
}

.yacv-fs-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.yacv-fs-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.yacv-fs-editor-host {
  flex: 1 1 auto;
  min-height: 0;
  padding: 8px;
}

.yacv-fs-pane > .yacv-editor-status {
  margin: 0;
  padding: 0 10px 8px;
}

.yacv-btn-primary {
  border-color: var(--yacv-border);
  background: var(--yacv-tint-strong);
  font-weight: 600;
}

.yacv-code[data-editing="true"] > pre {
  display: none;
}

@media (prefers-color-scheme: dark) {
  .yacv-embed.yacv-fullscreen {
    --yacv-fullscreen-bg: #171a1f;
    --yacv-fullscreen-surface: #1d2127;
    --yacv-fullscreen-text: #e6edf3;
  }
}

@media (max-width: 760px) {
  .yacv-embed.yacv-fullscreen {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(180px, 42vh) minmax(0, 1fr);
  }

  .yacv-fullscreen .yacv-fs-pane {
    grid-column: 1;
    grid-row: 2;
    border-right: 0;
    border-bottom: 1px solid var(--yacv-border);
  }

  .yacv-fullscreen .yacv-stage {
    background: var(--yacv-fullscreen-surface, #fff);
  }

  .yacv-fullscreen .yacv-stage {
    grid-column: 1;
    grid-row: 3;
  }

  .yacv-fullscreen.yacv-fs-no-editor .yacv-stage {
    grid-row: 2 / -1;
  }
}

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

.yacv-code-tools {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 4;
  display: flex;
  gap: 4px;
}

.yacv-copy {
  position: static;
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

/**
 * Injects the plugin stylesheet once per document.
 *
 * @returns {void}
 */
export function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
