#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const fixtures = path.join(here, 'fixtures');
const port = Number(process.env.PORT || 8123);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.py': 'text/x-python; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * @param {string} urlPath
 * @returns {string | null}
 */
function resolvePath(urlPath) {
  if (urlPath === '/docsify.min.js') return path.join(root, 'node_modules/docsify/dist/docsify.min.js');
  if (urlPath === '/docsify4.min.js') return path.join(root, 'node_modules/docsify4/lib/docsify.min.js');
  if (urlPath === '/docsify-core.css') return path.join(root, 'node_modules/docsify/dist/themes/core.min.css');
  if (urlPath === '/docsify-yacv.js') return path.join(root, 'docsify-yacv.js');
  if (urlPath === '/') return path.join(fixtures, 'index.html');

  const clean = decodeURIComponent(urlPath.split('?')[0]);
  if (!clean || clean.includes('..')) return null;
  const candidate = path.join(fixtures, clean);
  return candidate.startsWith(fixtures) ? candidate : null;
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  const file = resolvePath(pathname);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  try {
    const info = await stat(file);
    const finalFile = info.isDirectory() ? path.join(file, 'index.html') : file;
    const body = await readFile(finalFile);
    res.writeHead(200, {
      'content-type': MIME[path.extname(finalFile)] || 'application/octet-stream',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-expose-headers': 'ETag',
      etag: `"${info.size}-${info.mtimeMs}"`,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`e2e server listening on http://127.0.0.1:${port}`);
});
