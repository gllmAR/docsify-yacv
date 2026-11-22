#!/usr/bin/env node
/**
 * Refreshes the vendored Pupitre UI stylesheet from the pinned upstream
 * revision. The stylesheet is the only PUI artifact docsify-yacv uses.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../vendor/pupitre-ui');
const commit = '436e195';
const base = `https://codeberg.org/gllm/pupitre-ui/raw/commit/${commit}`;
const files = [
  ['dist/pupitre-ui.css', 'pupitre-ui.css'],
  ['LICENSE', 'LICENSE'],
  ['VERSION', 'VERSION'],
];

await mkdir(out, { recursive: true });
for (const [remote, local] of files) {
  const response = await fetch(`${base}/${remote}`);
  if (!response.ok) throw new Error(`${remote}: HTTP ${response.status}`);
  const body = await response.text();
  await writeFile(path.join(out, local), body);
  console.log(`wrote ${path.relative(process.cwd(), path.join(out, local))} (${body.length} bytes)`);
}
