#!/usr/bin/env node
/**
 * Generates viewer/manifest.json with the modules and styles the optimized
 * viewer needs on first paint. The docsify plugin preloads these when an embed
 * exists, before the iframe is created.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewer = path.join(root, 'viewer');
const html = await readFile(path.join(viewer, 'index.html'), 'utf8');

const modules = new Set();
const styles = new Set();

for (const match of html.matchAll(/<script[^>]+src="\.\/([^"]+\.js)"/g)) modules.add(match[1]);
for (const match of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\.\/([^"]+\.js)"/g)) modules.add(match[1]);
for (const match of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/([^"]+\.css)"/g)) styles.add(match[1]);

// The main bundle dynamically imports the renderer immediately.
for (const name of await readdir(viewer)) {
  if (/^ModelViewerWrapper-.*\.js$/.test(name)) modules.add(name);
}

await writeFile(
  path.join(viewer, 'manifest.json'),
  JSON.stringify({ modules: [...modules], styles: [...styles] }, null, 2) + '\n',
);
console.log('Wrote viewer/manifest.json:', { modules: modules.size, styles: styles.size });
