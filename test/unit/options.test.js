import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OPEN_VIEWER,
  DEFAULT_OPTIONS,
  DEFAULT_WORKER,
  DEFAULT_VIEWER,
  YACV_SETTING_TYPES,
  normalizeEditor,
  resolveOptions,
} from '../../src/options.js';

test('resolveOptions: defaults', () => {
  const options = resolveOptions();
  assert.equal(options.viewer, DEFAULT_VIEWER);
  assert.equal(options.openViewer, DEFAULT_OPEN_VIEWER);
  assert.equal(options.height, DEFAULT_OPTIONS.height);
  assert.equal(options.version, 'stable');
  assert.equal(options.debug, false);
  assert.equal(options.editor, 0);
  assert.equal(options.editorExplicit, false);
  assert.equal(options.lazy, true);
  assert.equal(options.lazyMargin, '200px');
  assert.equal(options.maxConcurrent, 2);
  assert.equal(options.maxLiveConcurrent, 2);
  assert.equal(options.liveSlotMs, 30000);
  assert.equal(options.runtime, 'worker');
  assert.equal(options.workerUrl, DEFAULT_WORKER);
  assert.equal(options.workerWarmup, true);
  assert.equal(options.cache, true);
  assert.equal(options.workerIdleMs, 1800000);
  assert.equal(options.sharedWorker, true);
  assert.equal(options.prefetchModels, true);
  assert.equal(options.unloadOffscreen, true);
  assert.equal(options.unloadMargin, '100% 0px');
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

test('resolveOptions: scheduling and unloading options', () => {
  assert.equal(resolveOptions({ maxConcurrent: 0 }).maxConcurrent, 1);
  assert.equal(resolveOptions({ maxConcurrent: '3' }).maxConcurrent, 3);
  assert.equal(resolveOptions({ maxLiveConcurrent: 0 }).maxLiveConcurrent, 1);
  assert.equal(resolveOptions({ maxLiveConcurrent: '1' }).maxLiveConcurrent, 1);
  assert.equal(resolveOptions({ liveSlotMs: 0 }).liveSlotMs, 0);
  assert.equal(resolveOptions({ liveSlotMs: -5 }).liveSlotMs, 0);
  assert.equal(resolveOptions({ liveSlotMs: '1500' }).liveSlotMs, 1500);
  assert.equal(resolveOptions({ unloadOffscreen: false }).unloadOffscreen, false);
  assert.equal(resolveOptions({ unloadOffscreen: 'false' }).unloadOffscreen, false);
  assert.equal(resolveOptions({ unloadOffscreen: 'static' }).unloadOffscreen, 'static');
  assert.equal(resolveOptions({ unloadMargin: '100%' }).unloadMargin, '100%');
  assert.equal(resolveOptions({ unloadMargin: '10vh' }).unloadMargin, '100% 0px');
});

test('resolveOptions: openViewer is independent of viewer', () => {
  const options = resolveOptions({ viewer: '/embed/', openViewer: 'https://full.example/' });
  assert.equal(options.viewer, '/embed/');
  assert.equal(options.openViewer, 'https://full.example/');
  assert.equal(resolveOptions({ viewer: '/embed/' }).openViewer, DEFAULT_OPEN_VIEWER);
});

test('resolveOptions: shared worker options', () => {
  const options = resolveOptions({ runtime: 'worker', workerUrl: './viewer/yacv-worker.js', workerWarmup: false });
  assert.equal(options.runtime, 'worker');
  assert.equal(options.workerUrl, './viewer/yacv-worker.js');
  assert.equal(options.workerWarmup, false);
  assert.equal(resolveOptions({ runtime: 'nope' }).runtime, 'viewer');
  assert.equal(resolveOptions({ cache: false }).cache, false);
  assert.equal(resolveOptions({ workerIdleMs: -5 }).workerIdleMs, 0);
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
