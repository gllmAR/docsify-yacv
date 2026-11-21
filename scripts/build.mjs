#!/usr/bin/env node
/**
 * Builds the two committed, directly-hostable artifacts:
 *
 *   docsify-yacv.js      IIFE, auto-registers with docsify (script tag / CDN)
 *   docsify-yacv.esm.js  ESM, default export for bundlers / npm imports
 *
 * No source maps, no dist/ directory: the repository root is the static site
 * and the plugin file.
 */
import { build, context } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const banner = {
  js: `/*! ${pkg.name} v${pkg.version} | MIT | https://github.com/gllmAR/docsify-yacv */`,
};

/** @type {import('esbuild').BuildOptions[]} */
const targets = [
  { entryPoints: ['src/iife.js'], outfile: 'docsify-yacv.js', format: 'iife' },
  { entryPoints: ['src/index.js'], outfile: 'docsify-yacv.esm.js', format: 'esm' },
];

const common = {
  bundle: true,
  target: ['es2020'],
  platform: 'browser',
  banner,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
  absWorkingDir: root,
};

const watch = process.argv.includes('--watch');

if (watch) {
  const contexts = await Promise.all(targets.map(options => context({ ...common, ...options })));
  await Promise.all(contexts.map(ctx => ctx.watch()));
  // eslint-disable-next-line no-console
  console.log('Watching for changes…');
} else {
  await Promise.all(targets.map(options => build({ ...common, ...options })));
}
