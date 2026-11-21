import docsifyYacv from './index.js';

// Expose a global so the plugin can be loaded straight from a CDN:
//   <script src=".../docsify-yacv.min.js"></script>
//   window.$docsify = { plugins: [DocsifyYacv()] };
if (typeof window !== 'undefined') {
  window.DocsifyYacv = docsifyYacv;
}

export default docsifyYacv;
