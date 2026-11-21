import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OPTIONS,
  DEFAULT_VIEWER,
  YACV_SETTING_TYPES,
  normalizeEditor,
  resolveOptions,
} from '../../src/options.js';

test('resolveOptions: defaults', () => {
  const options = resolveOptions();
  assert.equal(options.viewer, DEFAULT_VIEWER);
  assert.equal(options.height, DEFAULT_OPTIONS.height);
  assert.equal(options.version, 'stable');
  assert.equal(options.debug, false);
  assert.equal(options.editor, 0);
  assert.equal(options.editorExplicit, false);
  assert.equal(options.lazy, true);
  assert.equal(options.lazyMargin, '200px');
  assert.equal(options.autoLoad, true);
  assert.equal(options.chrome, true);
  assert.deepEqual(options.settings, {});
});

test('resolveOptions: $docsify.yacv is used, factory options win', () => {
  const vm = {
    config: {
      yacv: { height: '40vh', version: 'dev', settings: { edgeWidth: 2, autoplay: false } },
    },
  };
  const options = resolveOptions({ height: 320, settings: { exposure: 1.4 } }, vm);
  assert.equal(options.height, 320);
  assert.equal(options.version, 'dev');
  assert.deepEqual(options.settings, { edgeWidth: 2, autoplay: false, exposure: 1.4 });
});

test('resolveOptions: lazyMargin accepts numbers and CSS lengths', () => {
  assert.equal(resolveOptions({ lazyMargin: 300 }).lazyMargin, '300px');
  assert.equal(resolveOptions({ lazyMargin: '300' }).lazyMargin, '300px');
  assert.equal(resolveOptions({ lazyMargin: '10%' }).lazyMargin, '10%');
  assert.equal(resolveOptions({ lazyMargin: '300px 0px' }).lazyMargin, '300px 0px');
  assert.equal(resolveOptions({ lazyMargin: '30vh' }).lazyMargin, '200px');
  assert.equal(resolveOptions({ lazyMargin: '' }).lazyMargin, '200px');
});

test('resolveOptions: marks editor as explicit only when configured', () => {
  assert.equal(resolveOptions().editorExplicit, false);
  assert.equal(resolveOptions({ editor: 0 }).editorExplicit, true);
  assert.equal(resolveOptions({}, { config: { yacv: { editor: 'hide' } } }).editorExplicit, true);
});

test('normalizeEditor', () => {
  assert.equal(normalizeEditor(undefined), 0);
  assert.equal(normalizeEditor('hide'), 0);
  assert.equal(normalizeEditor(false), 0);
  assert.equal(normalizeEditor('show'), 0.9);
  assert.equal(normalizeEditor(true), 0.9);
  assert.equal(normalizeEditor('0.5'), 0.5);
  assert.equal(normalizeEditor(2), 1);
  assert.equal(normalizeEditor(-1), 0);
  assert.equal(normalizeEditor('garbage', 0.3), 0.3);
});

test('all required yacv settings are known', () => {
  for (const key of [
    'loadHelpers',
    'edgeWidth',
    'autoplay',
    'arModes',
    'exposure',
    'shadowIntensity',
    'pg_version',
    'pg_debug',
    'pg_constraints',
    'pg_opacity_loading',
    'pg_opacity_loaded',
  ]) {
    assert.ok(key in YACV_SETTING_TYPES, key);
  }
  assert.ok(!('preload' in YACV_SETTING_TYPES));
  assert.ok(!('pg_code' in YACV_SETTING_TYPES));
});
