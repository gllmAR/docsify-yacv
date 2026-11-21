import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { bytesToBase64Url, encodeCode } from '../../src/encode.js';

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

test('bytesToBase64Url', () => {
  assert.equal(bytesToBase64Url(new Uint8Array([0, 1, 2, 250, 251, 252])), 'AAEC-vv8');
  assert.equal(bytesToBase64Url(new Uint8Array()), '');
});

test('encodeCode: gzip + base64url round-trip', async () => {
  const code = 'from build123d import *\n\nwith BuildPart() as part:\n    Box(10, 10, 5)  # π ≈ 3.14159\n\nshow(part)\n';
  const encoded = await encodeCode(code);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.equal(gunzipSync(decodeBase64Url(encoded)).toString('utf8'), code);
});

test('encodeCode: normalizes CRLF', async () => {
  const encoded = await encodeCode('a = 1\r\nb = 2\r\n');
  assert.equal(gunzipSync(decodeBase64Url(encoded)).toString('utf8'), 'a = 1\nb = 2\n');
});

test('encodeCode: empty source', async () => {
  assert.equal(await encodeCode(''), '');
  assert.equal(await encodeCode(null), '');
});

test('encodeCode: caches repeated source', async () => {
  const code = '# cache me\nshow(Box(1, 1, 1))\n';
  const a = await encodeCode(code);
  const b = await encodeCode(code);
  assert.equal(a, b);
});

test('encodeCode: falls back to raw source without CompressionStream', async () => {
  const original = globalThis.CompressionStream;
  // @ts-expect-error intentional
  globalThis.CompressionStream = undefined;
  try {
    const code = 'from build123d import *\nshow(Box(2, 2, 2))\n';
    assert.equal(await encodeCode(code), code);

    const urlLike = 'https://example.com/not-a-url-fetch.py';
    assert.equal(await encodeCode(urlLike), '\n' + urlLike);
  } finally {
    globalThis.CompressionStream = original;
  }
});
