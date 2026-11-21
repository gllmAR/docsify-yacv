const cache = new Map();
const CACHE_LIMIT = 64;
let warnedAboutFallback = false;

/**
 * Base64url encodes a byte array (no padding), matching yacv's `b64UrlEncode`.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64Url(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * @param {string} text
 * @returns {Promise<Uint8Array | null>}
 */
async function gzip(text) {
  if (typeof CompressionStream === 'undefined' || typeof Blob === 'undefined' || typeof Response === 'undefined') {
    return null;
  }
  try {
    const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('gzip'));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

/**
 * Encodes build123d source for yacv's `pg_code` setting.
 *
 * yacv accepts (in this order): a URL, base64url+gzipped source, or raw source.
 * We always prefer gzip as it keeps the iframe URL small (and works around URL
 * length limits in some browsers).
 *
 * @param {string} code
 * @returns {Promise<string>}
 */
export async function encodeCode(code) {
  const text = String(code == null ? '' : code).replace(/\r\n/g, '\n');
  if (!text) return '';
  const cached = cache.get(text);
  if (cached !== undefined) return cached;

  const compressed = await gzip(text);
  let value;
  if (compressed && compressed.length > 0) {
    value = bytesToBase64Url(compressed);
  } else {
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[docsify-yacv] CompressionStream is not available, passing build123d source to yacv unencoded. ' +
          'Upgrade to a browser with CompressionStream support for smaller viewer URLs.',
      );
    }
    // yacv treats `pg_code` values that parse as absolute URLs as a URL to
    // fetch. Prefix raw source with a newline in that (extremely unlikely) case.
    value = /^[a-z][a-z0-9+.-]*:\/\//i.test(text.trim()) ? '\n' + text : text;
  }

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(text, value);
  return value;
}
