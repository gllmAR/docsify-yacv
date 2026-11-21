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

.yacv-placeholder {
  position: absolute;
  inset: 0;
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

@keyframes yacv-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .yacv-spinner { animation-duration: 3s; }
}

.yacv-error { color: #c0392b; }
.yacv-error code { color: inherit; }

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

.yacv-copy {
  position: absolute;
  top: 8px;
  right: 8px;
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
