import docsifyYacv from './index.js';

// Expose the factory (useful for tests / explicit registration) and, following
// the convention of the other docsify plugins in this account, auto-register
// the plugin with docsify. Load this script after `window.$docsify` is set:
//
//   <script>window.$docsify = { yacv: { ... } };</script>
//   <script src="docsify.min.js"></script>
//   <script src="./docsify-yacv.js"></script>
if (typeof window !== 'undefined') {
  window.DocsifyYacv = docsifyYacv;
  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(docsifyYacv());
}

export default docsifyYacv;
