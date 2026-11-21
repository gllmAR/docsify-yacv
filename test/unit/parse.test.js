import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFence,
  isModelUrl,
  isPythonUrl,
  looksLikePython,
  normalizeTagWhitespace,
  parseInfoString,
  parseModelBlock,
} from '../../src/parse.js';

test('parseInfoString: language, flags, values and quotes', () => {
  const { lang, attrs } = parseInfoString('build123d height=520 title="My bracket" debug');
  assert.equal(lang, 'build123d');
  assert.equal(attrs.height, '520');
  assert.equal(attrs.title, 'My bracket');
  assert.equal(attrs.debug, true);
});

test('parseInfoString: single quotes, kebab-case and boolean-ish values', () => {
  const { lang, attrs } = parseInfoString("python show-code='hide' b3d-version=dev yacv");
  assert.equal(lang, 'python');
  assert.equal(attrs.showcode, 'hide');
  assert.equal(attrs.b3dversion, 'dev');
  assert.equal(attrs.yacv, true);
});

test('parseInfoString: empty and malformed input', () => {
  assert.deepEqual(parseInfoString(undefined), { lang: '', attrs: {} });
  assert.deepEqual(parseInfoString('  '), { lang: '', attrs: {} });
  assert.deepEqual(parseInfoString('python =oops'), { lang: 'python', attrs: {} });
});

test('classifyFence: code languages', () => {
  for (const lang of ['build123d', 'b3d', 'yacv-py', 'yacv-python', 'yacv-build123d']) {
    assert.equal(classifyFence(lang), 'code', lang);
  }
});

test('classifyFence: model languages and python+yacv flag', () => {
  assert.equal(classifyFence('yacv'), 'model');
  assert.equal(classifyFence('yacv-models'), 'model');
  assert.equal(classifyFence('python', { yacv: true }), 'code');
  assert.equal(classifyFence('python'), null);
  assert.equal(classifyFence('javascript', { yacv: true }), null);
  assert.equal(classifyFence('bash'), null);
});

test('parseModelBlock: splits assets, ignores comments and blank lines', () => {
  const { models, codeFiles } = parseModelBlock(`
    # static exports
    assets/part.glb
    assets/part-highlight.glb#name=hl
    examples/box.py

    // comment
    https://example.com/model.gltf?x=1
  `);
  assert.deepEqual(models, [
    'assets/part.glb',
    'assets/part-highlight.glb#name=hl',
    'https://example.com/model.gltf?x=1',
  ]);
  assert.deepEqual(codeFiles, ['examples/box.py']);
});

test('looksLikePython', () => {
  assert.equal(looksLikePython('from build123d import *\nshow(Box(1, 1, 1))'), true);
  assert.equal(looksLikePython('with BuildPart() as part:\n    Box(1, 1, 1)'), true);
  assert.equal(looksLikePython('import build123d'), true);
  assert.equal(looksLikePython('show_object(part)'), true);
  assert.equal(looksLikePython('assets/part.glb\nassets/other.glb'), false);
});

test('url helpers', () => {
  assert.equal(isPythonUrl('examples/box.py'), true);
  assert.equal(isPythonUrl('examples/box.py?x=1'), true);
  assert.equal(isPythonUrl('examples/box.glb'), false);
  assert.equal(isModelUrl('assets/part.glb'), true);
  assert.equal(isModelUrl('assets/part.gltf#name=a'), true);
  assert.equal(isModelUrl('examples/box.py'), false);
});

test('normalizeTagWhitespace: adds blank lines around multi-line tags', () => {
  const input = [
    '# Title',
    '',
    '<yacv height="200">',
    '<script type="text/x-python">',
    'from build123d import *',
    '',
    'show(Box(1, 1, 1))',
    '</script>',
    '</yacv>',
  ].join('\n');
  const output = normalizeTagWhitespace(input);
  assert.equal(
    output,
    [
      '# Title',
      '',
      '<yacv height="200">',
      '',
      '<script type="text/x-python">',
      'from build123d import *',
      '',
      'show(Box(1, 1, 1))',
      '</script>',
      '',
      '</yacv>',
    ].join('\n'),
  );
});

test('normalizeTagWhitespace: leaves single-line tags and existing spacing alone', () => {
  const input = '<yacv src="a.glb"></yacv>\n\n<yacv height="1">\n\n<script></script>\n\n</yacv>';
  assert.equal(normalizeTagWhitespace(input), input);
});

test('normalizeTagWhitespace: does not touch fenced code blocks', () => {
  const input = ['````markdown', '<yacv height="1">', '<script>', '</script>', '</yacv>', '````'].join('\n');
  assert.equal(normalizeTagWhitespace(input), input);
});

test('normalizeTagWhitespace: indented code blocks are left untouched', () => {
  const input = ['    <yacv height="1">', '    <script>', '    </script>', '    </yacv>'].join('\n');
  assert.equal(normalizeTagWhitespace(input), input);
});

test('normalizeTagWhitespace: fast path and null input', () => {
  assert.equal(normalizeTagWhitespace('# nothing to do'), '# nothing to do');
  assert.equal(normalizeTagWhitespace(null), '');
});
