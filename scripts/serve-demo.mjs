#!/usr/bin/env node
/**
 * Serves the repository root (so /demo and /dist work) with permissive CORS
 * headers, which the yacv viewer needs to load demo models from a different
 * origin.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8080);
// The demo proxies the public viewer under /yacv/ so that static models are
// same-origin when running locally (browsers block public origins from fetching
// loopback models).
const YACV_ORIGIN = 'https://yeicor-3d.github.io/yet-another-cad-viewer/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.py': 'text/x-python; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/') {
    res.writeHead(302, { location: '/demo/' });
    res.end();
    return;
  }
  if (url.pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Allow pages served from a public origin (e.g. GitHub Pages yacv) to fetch
  // models from this local server. Chrome's Private Network Access blocks this
  // without an explicit opt-in.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, HEAD, OPTIONS',
      'access-control-allow-headers': '*',
      'access-control-allow-private-network': 'true',
      'access-control-max-age': '600',
    });
    res.end();
    return;
  }

  const clean = decodeURIComponent(url.pathname);
  if (clean.includes('..')) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  if (clean === '/yacv') {
    res.writeHead(302, { location: '/yacv/' });
    res.end();
    return;
  }

  if (clean.startsWith('/yacv/')) {
    const upstreamUrl = YACV_ORIGIN + clean.slice('/yacv/'.length) + url.search;
    try {
      const upstream = await fetch(upstreamUrl, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: { accept: req.headers.accept || '*/*' },
      });
      const headers = {};
      for (const name of ['content-type', 'cache-control', 'etag', 'last-modified']) {
        const value = upstream.headers.get(name);
        if (value) headers[name] = value;
      }
      headers['access-control-allow-origin'] = '*';
      res.writeHead(upstream.status, headers);
      if (req.method === 'HEAD' || !upstream.body) {
        res.end();
      } else {
        Readable.fromWeb(upstream.body).pipe(res);
      }
    } catch (err) {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(`viewer proxy error: ${err.message}`);
    }
    return;
  }

  const file = path.join(root, clean);
  try {
    const info = await stat(file);
    const finalFile = info.isDirectory() ? path.join(file, 'index.html') : file;
    const body = await readFile(finalFile);
    res.writeHead(200, {
      'content-type': MIME[path.extname(finalFile)] || 'application/octet-stream',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, HEAD, OPTIONS',
      'access-control-allow-headers': '*',
      'access-control-expose-headers': 'ETag',
      'access-control-allow-private-network': 'true',
      etag: `"${body.length}-${info.mtimeMs}"`,
      'cache-control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`docsify-yacv demo: http://localhost:${port}/demo/`);
});
