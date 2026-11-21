import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOptions } from '../../src/options.js';
import {
  buildParams,
  buildViewerUrl,
  collectSettings,
  normalizeConstraints,
  normalizeSettingValue,
  parseShowCode,
} from '../../src/url.js';

const base = 'https://docs.example.com/guide/';
const options = resolveOptions();

/** @param {URLSearchParams} params */
const obj = params => Object.fromEntries(params.entries());
/** @param {URLSearchParams} params */
const all = (params, key) => params.getAll(key);

test('buildParams: live build123d defaults hide the in-iframe editor', () => {
  const params = buildParams({ hasCode: true, attrs: {}, options, base });
  const p = obj(params);
  assert.equal(p.pg_version, 'stable');
  assert.equal(p.pg_debug, 'false');
  assert.equal(p.pg_opacity_loading, '0');
  assert.equal(p.pg_opacity_loaded, '0');
  assert.equal(p.pg_code, undefined);
  assert.equal(p.pg_constraints, undefined);
});

test('buildParams: per-block build123d options', () => {
  const params = buildParams({
    hasCode: true,
    attrs: { version: 'dev', debug: '', editor: '0.85', constraints: 'numpy<2;packaging>=24' },
    options,
    base,
  });
  const p = obj(params);
  assert.equal(p.pg_version, 'dev');
  assert.equal(p.pg_debug, 'true');
  assert.equal(p.pg_opacity_loading, '0.85');
  assert.equal(p.pg_opacity_loaded, '0.85');
  assert.equal(p.pg_constraints, 'numpy<2\npackaging>=24');
});

test('buildParams: b3d-version alias and debug=false', () => {
  const params = buildParams({ hasCode: true, attrs: { b3dversion: '0.9.1', debug: 'false' }, options, base });
  const p = obj(params);
  assert.equal(p.pg_version, '0.9.1');
  assert.equal(p.pg_debug, 'false');
});

test('buildParams: raw pg_* attribute names are accepted as aliases', () => {
  const params = buildParams({
    hasCode: true,
    attrs: { pg_version: '0.10.0', 'pg-debug': '', pg_constraints: 'numpy<2' },
    options,
    base,
  });
  const p = obj(params);
  assert.equal(p.pg_version, '0.10.0');
  assert.equal(p.pg_debug, 'true');
  assert.equal(p.pg_constraints, 'numpy<2');
});

test('buildParams: static models are resolved and deduplicated', () => {
  const params = buildParams({
    hasCode: false,
    models: ['assets/part.glb', 'assets/part.glb', 'https://cdn.example.com/other.glb', 'dev+http://localhost:32323'],
    attrs: {},
    options,
    base,
  });
  assert.deepEqual(all(params, 'preload'), [
    'https://docs.example.com/guide/assets/part.glb',
    'https://cdn.example.com/other.glb',
    'dev+http://localhost:32323',
  ]);
  assert.equal(obj(params).pg_code, undefined);
  assert.equal(obj(params).pg_opacity_loading, undefined);
});

test('buildParams: models can also come from attributes', () => {
  const params = buildParams({
    hasCode: false,
    attrs: { models: 'a.glb, b.glb', src: 'c.glb', preview: 'p.glb#name=part', preload: 'd.glb' },
    options,
    base,
  });
  assert.deepEqual(all(params, 'preload'), [
    'https://docs.example.com/guide/a.glb',
    'https://docs.example.com/guide/b.glb',
    'https://docs.example.com/guide/c.glb',
    'https://docs.example.com/guide/p.glb#name=part',
    'https://docs.example.com/guide/d.glb',
  ]);
});

test('buildParams: yacv settings are coerced and forwarded', () => {
  const params = buildParams({
    hasCode: true,
    attrs: {
      edgewidth: '2',
      autoplay: 'false',
      armode: 'ignored-typo',
      exposure: '1.25',
      shadowintensity: 'nope',
      loadhelpers: '',
      skybox: 'data:image/png;base64,AAAA',
    },
    options,
    base,
  });
  const p = obj(params);
  assert.equal(p.edgeWidth, '2');
  assert.equal(p.autoplay, 'false');
  assert.equal(p.exposure, '1.25');
  assert.equal(p.loadHelpers, 'true');
  assert.equal(p.shadowIntensity, undefined, 'invalid numbers are ignored');
  assert.equal(p.armode, undefined);
  assert.equal(p.skybox, 'data:image/png;base64,AAAA');
});

test('buildParams: pg_opacity_* settings win over the implicit editor default', () => {
  const params = buildParams({
    hasCode: true,
    attrs: { pg_opacity_loading: '0.8' },
    options,
    base,
  });
  const p = obj(params);
  assert.equal(p.pg_opacity_loading, '0.8');
  assert.equal(p.pg_opacity_loaded, '0'); // not overridden, plugin default applies
});

test('buildParams: explicit editor wins over pg_opacity_* settings', () => {
  const params = buildParams({
    hasCode: true,
    attrs: { editor: 0.4, pg_opacity_loading: '0.8' },
    options,
    base,
  });
  const p = obj(params);
  assert.equal(p.pg_opacity_loading, '0.4');
  assert.equal(p.pg_opacity_loaded, '0.4');
});

test('buildParams: explicit editor from plugin options wins over settings', () => {
  const opts = resolveOptions({ editor: 0.25 });
  const params = buildParams({ hasCode: false, attrs: { pg_opacity_loading: '1' }, options: opts, base });
  const p = obj(params);
  assert.equal(p.pg_opacity_loading, '0.25');
  assert.equal(p.pg_opacity_loaded, '0.25');
});

test('buildParams: returns null when there is nothing to show', () => {
  assert.equal(buildParams({ hasCode: false, attrs: {}, options, base }), null);
});

test('buildParams: an empty viewer is still allowed with explicit settings', () => {
  const params = buildParams({ hasCode: false, attrs: { autoplay: 'false' }, options, base });
  assert.ok(params);
  assert.equal(obj(params).autoplay, 'false');
});

test('buildViewerUrl: hash params and existing query string are preserved', () => {
  const params = new URLSearchParams({ a: '1', b: 'hello world' });
  const url = buildViewerUrl('https://viewer.example.com/app/?x=y#old', params, base);
  assert.equal(url, 'https://viewer.example.com/app/?x=y#a=1&b=hello+world');
});

test('buildViewerUrl: relative viewer URLs', () => {
  const params = new URLSearchParams({ a: '1' });
  assert.equal(buildViewerUrl('yacv/', params, base), 'https://docs.example.com/guide/yacv/#a=1');
});

test('normalizeConstraints', () => {
  assert.equal(normalizeConstraints('numpy<2;packaging>=24'), 'numpy<2\npackaging>=24');
  assert.equal(normalizeConstraints('numpy<2\\npackaging>=24'), 'numpy<2\npackaging>=24');
  assert.equal(normalizeConstraints(['a', 'b']), 'a\nb');
  assert.equal(normalizeConstraints({ numpy: '<2' }), '{"numpy":"<2"}');
  assert.equal(normalizeConstraints(''), '');
});

test('normalizeSettingValue', () => {
  assert.equal(normalizeSettingValue('autoplay', 'false'), 'false');
  assert.equal(normalizeSettingValue('autoplay', 0), 'false');
  assert.equal(normalizeSettingValue('edgeWidth', '2.5'), '2.5');
  assert.equal(normalizeSettingValue('edgeWidth', 'x'), null);
  assert.equal(normalizeSettingValue('skybox', 'abc'), 'abc');
  assert.equal(normalizeSettingValue('unknown', 'abc'), null);
});

test('collectSettings: merges global and per-block settings, ignoring unknown keys', () => {
  const settings = collectSettings(
    { edgewidth: '3', notasetting: '1', pg_opacity_loading: '0.5' },
    { autoplay: false, exposure: 1.3, preload: 'ignored.glb' },
  );
  assert.deepEqual(settings, {
    autoplay: false,
    exposure: 1.3,
    edgeWidth: '3',
    pg_opacity_loading: '0.5',
  });
});

test('parseShowCode', () => {
  assert.equal(parseShowCode(undefined), null);
  assert.equal(parseShowCode(true), true);
  assert.equal(parseShowCode(''), true);
  assert.equal(parseShowCode('show'), true);
  assert.equal(parseShowCode('hide'), false);
  assert.equal(parseShowCode('false'), false);
  assert.equal(parseShowCode('maybe'), null);
});
