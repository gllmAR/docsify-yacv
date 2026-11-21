import { test, expect } from 'playwright/test';
import { gunzipSync } from 'node:zlib';

/**
 * @param {string} src
 * @returns {URLSearchParams}
 */
function viewerParams(src) {
  const url = new URL(src);
  return new URLSearchParams(url.hash.replace(/^#/, ''));
}

/**
 * @param {URLSearchParams} params
 * @returns {string | null}
 */
function decodeCode(params) {
  const raw = params.get('pg_code');
  if (!raw) return null;
  if (raw.startsWith('from ') || raw.startsWith('#') || raw.startsWith('\n')) return raw;
  const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return gunzipSync(Buffer.from(padded, 'base64')).toString('utf8');
}

/**
 * @param {import('playwright/test').Page} page
 * @returns {string | null}
 */
async function iframeSrc(page, embed) {
  await embed.scrollIntoViewIfNeeded();
  const iframe = embed.locator('iframe');
  await expect(iframe).toHaveCount(1);
  const src = await iframe.getAttribute('src');
  expect(src).toContain('/viewer-stub.html');
  return src;
}

test.describe('docsify-yacv', () => {
  test('renders a live build123d block with defaults', async ({ page }) => {
    await page.goto('/');
    const embed = page.locator('.yacv-embed').nth(0);
    await expect(embed).toBeVisible();

    const src = await iframeSrc(page, embed);
    const params = viewerParams(src);

    expect(decodeCode(params)).toContain('with BuildPart() as part:');
    expect(decodeCode(params)).toContain('`show()`'); // docsify backtick placeholder round-trips
    expect(params.get('pg_version')).toBe('0.9.1');
    expect(params.get('pg_debug')).toBe('false');
    expect(params.get('pg_opacity_loading')).toBe('0');
    expect(params.get('pg_opacity_loaded')).toBe('0');
    expect(params.getAll('preload')).toEqual(['http://127.0.0.1:8123/assets/preview.glb#name=part']);

    // Resource hints are added for the viewer/Pyodide/PyPI origins.
    await expect(page.locator('link[rel="preconnect"][href="https://cdn.jsdelivr.net"]')).toHaveCount(1);
    await expect(page.locator('link[rel="preconnect"][href="https://pypi.org"]')).toHaveCount(1);

    await expect(embed.locator('.yacv-title')).toHaveText('Bracket demo');
    await expect(embed.locator('.yacv-badge')).toHaveText('build123d · 0.9.1');
    expect(await embed.locator('.yacv-stage').evaluate(el => el.style.height)).toBe('321px');

    // The source stays visible, highlighted by docsify, above the viewer.
    const code = page.locator('.yacv-code').nth(0);
    await expect(code).toBeVisible();
    await expect(code.locator('pre')).toHaveAttribute('data-lang', 'build123d');
    await expect(code.getByRole('button', { name: 'Copy code' })).toBeVisible();
  });

  test('renders static GLB models and forwards yacv settings', async ({ page }) => {
    await page.goto('/');
    const embed = page.locator('.yacv-embed').nth(1);
    await expect(embed).toBeVisible();

    const src = await iframeSrc(page, embed);
    const params = viewerParams(src);

    expect(params.getAll('preload')).toEqual([
      'http://127.0.0.1:8123/assets/cube.glb',
      'http://127.0.0.1:8123/assets/second.glb#name=second',
    ]);
    expect(params.get('autoplay')).toBe('false');
    expect(params.get('edgeWidth')).toBe('2');
    expect(params.get('pg_code')).toBeNull();
    expect(params.get('pg_opacity_loading')).toBeNull();

    // The asset path list is not useful reading material.
    await expect(page.locator('.yacv-code').nth(1)).toBeHidden();
  });

  test('supports <yacv> tags with inline Python', async ({ page }) => {
    await page.goto('/');
    const embed = page.locator('.yacv-embed').nth(2);
    await expect(embed).toBeVisible();

    await expect(embed.locator('.yacv-title')).toHaveText('Tag model');
    await expect(embed.locator('.yacv-badge')).toHaveText('build123d · dev');
    expect(await embed.locator('.yacv-stage').evaluate(el => el.style.height)).toBe('240px');

    const params = viewerParams(await iframeSrc(page, embed));
    expect(decodeCode(params)).toContain('Sphere(5)');
    expect(params.get('pg_version')).toBe('dev');
    expect(params.get('pg_debug')).toBe('true');
    expect(params.get('pg_constraints')).toBe('numpy<2\npackaging>=24');

    const code = page.locator('.yacv-code', { hasText: 'Sphere(5)' });
    await expect(code).toBeVisible();
  });

  test('fetches external Python sources', async ({ page }) => {
    await page.goto('/');
    const embed = page.locator('.yacv-embed').nth(3);
    await expect(embed).toBeVisible();

    await expect(embed.locator('.yacv-title')).toHaveText('External source');
    const params = viewerParams(await iframeSrc(page, embed));
    expect(decodeCode(params)).toContain('A bracket, loaded from a separate .py file.');
    expect(params.get('pg_version')).toBe('0.9.1');
    expect(await embed.locator('.yacv-stage').evaluate(el => el.style.height)).toBe('222px');

    const code = page.locator('.yacv-code', { hasText: 'A bracket, loaded from a separate' });
    await expect(code).toBeVisible();
  });

  test('renders asset-only <yacv> tags', async ({ page }) => {
    await page.goto('/');
    const embed = page.locator('.yacv-embed').nth(4);
    await expect(embed).toBeVisible();

    const params = viewerParams(await iframeSrc(page, embed));
    expect(params.getAll('preload')).toEqual([
      'http://127.0.0.1:8123/assets/one.glb',
      'http://127.0.0.1:8123/assets/two.glb',
    ]);
    expect(params.get('autoplay')).toBe('false');
    expect(await embed.locator('.yacv-stage').evaluate(el => el.style.height)).toBe('180px');
  });

  test('can hide and show the source code', async ({ page }) => {
    await page.goto('/');
    const embed = page.locator('.yacv-embed').nth(5);
    await expect(embed).toBeVisible();

    const code = page.locator('.yacv-code', { hasText: 'show(Box(1, 2, 3))' });
    await expect(code).toBeHidden();
    await embed.getByRole('button', { name: 'Show code' }).click();
    await expect(code).toBeVisible();
    await expect(embed.getByRole('button', { name: 'Hide code' })).toBeVisible();
    await embed.getByRole('button', { name: 'Hide code' }).click();
    await expect(code).toBeHidden();
  });

  test('normalizes <yacv> blocks without blank lines', async ({ page }) => {
    await page.goto('/#/tag');
    const embed = page.locator('.yacv-embed');
    await expect(embed).toHaveCount(1);
    const src = await iframeSrc(page, embed);
    const code = decodeCode(viewerParams(src));
    expect(code).toContain('show(Box(5, 5, 5))');
    expect(code).not.toContain('<p>');
    await expect(page.locator('.yacv-code', { hasText: 'show(Box(5, 5, 5))' })).toBeVisible();
  });

  test('lazy-loads iframes when scrolled into view', async ({ page }) => {
    await page.goto('/#/lazy');
    await expect(page.locator('.yacv-embed')).toHaveCount(1);
    await expect(page.locator('.yacv-embed iframe')).toHaveCount(0);
    await expect(page.locator('.yacv-placeholder')).toContainText('loads when it becomes visible');

    await page.locator('.yacv-embed').scrollIntoViewIfNeeded();
    await expect(page.locator('.yacv-embed iframe')).toHaveCount(1);
  });

  test('preview-only embed loads the preview and starts live on demand', async ({ page }) => {
    await page.goto('/#/preview');
    const embed = page.locator('.yacv-embed');
    await expect(embed).toHaveCount(1);
    await embed.scrollIntoViewIfNeeded();

    const iframe = embed.locator('iframe');
    await expect(iframe).toHaveCount(1);
    const staticParams = viewerParams(await iframe.getAttribute('src'));
    expect(staticParams.getAll('preload')).toEqual([
      'http://127.0.0.1:8123/assets/preview.glb#name=part',
    ]);
    expect(staticParams.get('pg_code')).toBeNull();

    const run = embed.getByRole('button', { name: 'Run build123d' });
    await expect(run).toBeVisible();
    await run.click();

    await expect
      .poll(async () => {
        const src = await embed.locator('iframe').getAttribute('src');
        return src ? decodeCode(viewerParams(src)) : '';
      })
      .toContain('show(Box(5, 5, 5))');
  });

  test('supports click-to-load', async ({ page }) => {
    await page.goto('/#/click');
    await expect(page.locator('.yacv-embed iframe')).toHaveCount(0);
    const button = page.getByRole('button', { name: 'Load 3D viewer' });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('.yacv-embed iframe')).toHaveCount(1);
  });

  test('open and reload actions work', async ({ page }) => {
    await page.addInitScript(() => {
      /** @type {string[]} */
      window.__yacvOpened = [];
      window.open = url => {
        window.__yacvOpened.push(String(url));
        return null;
      };
    });
    await page.goto('/');
    const embed = page.locator('.yacv-embed').nth(0);
    const before = await iframeSrc(page, embed);

    await embed.getByRole('button', { name: 'Open' }).click();
    const opened = await page.evaluate(() => window.__yacvOpened[0] || null);
    expect(opened).not.toBeNull();
    const openParams = viewerParams(opened);
    expect(openParams.get('pg_code')).toBe(viewerParams(before).get('pg_code'));
    // The embedded viewer hides the editor; "Open" shows it in the full viewer.
    expect(viewerParams(before).get('pg_opacity_loading')).toBe('0');
    expect(openParams.get('pg_opacity_loading')).toBe('0.9');
    expect(openParams.get('pg_opacity_loaded')).toBe('0.9');

    await embed.getByRole('button', { name: 'Reload' }).click();
    await expect(embed.locator('iframe')).toHaveCount(1);
    const after = await iframeSrc(page, embed);
    expect(viewerParams(after).get('pg_code')).toBe(viewerParams(before).get('pg_code'));
  });

  test('does not emit plugin errors', async ({ page }) => {
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', err => problems.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
    });

    await page.goto('/');
    const embeds = page.locator('.yacv-embed');
    await expect(embeds).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await embeds.nth(i).scrollIntoViewIfNeeded();
    }
    await expect(page.locator('.yacv-embed iframe')).toHaveCount(6);
    await page.waitForTimeout(500);

    expect(problems.filter(text => /docsify-yacv|pageerror/i.test(text))).toEqual([]);
  });
});
