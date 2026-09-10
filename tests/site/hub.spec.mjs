import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const siteBaseUrl = new URL(process.env.SITE_BASE_URL || 'http://127.0.0.1:4173/');
const expectedOrigin = siteBaseUrl.origin;
const routes = ['/', '/accessibility/'];

function routeUrl(route) {
  return new URL(route.replace(/^\/+/, ''), siteBaseUrl).toString();
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} must not overflow horizontally`).toBeLessThanOrEqual(1);
}

async function assertA11y(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, `${label} axe violations: ${results.violations.map(v => v.id).join(', ')}`).toEqual([]);
}

async function assertThemeControl(page, label) {
  const group = page.getByRole('group', { name: 'Theme' });
  await expect(group, `${label} theme group`).toHaveCount(1);
  for (const name of ['System', 'Light', 'Dark']) {
    const radio = page.getByRole('radio', { name });
    await expect(radio).toHaveCount(1);
    const box = await radio.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

async function assertLinkScopes(page, label) {
  const anchors = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => ({
    href: node.href,
    target: node.getAttribute('target') || '',
    rel: node.getAttribute('rel') || '',
    className: node.className,
    indicator: node.querySelector('.external-link-indicator')?.textContent?.trim() || '',
    note: node.querySelector('.sr-only')?.textContent?.trim() || '',
  })));

  for (const anchor of anchors) {
    const target = new URL(anchor.href);
    if (target.hostname === 'supracraft.github.io' || target.origin === expectedOrigin) {
      expect(anchor.target, `${label} organization-internal link must stay in the same context: ${anchor.href}`).toBe('');
      expect(anchor.className.split(/\s+/)).not.toContain('external-link');
    } else {
      expect(anchor.className.split(/\s+/), `${label} external handoff must be marked: ${anchor.href}`).toContain('external-link');
      expect(anchor.target).toBe('_blank');
      const rel = new Set(anchor.rel.split(/\s+/).filter(Boolean));
      expect(rel.has('noopener')).toBe(true);
      expect(rel.has('noreferrer')).toBe(true);
      expect(anchor.indicator).toBe('↗');
      expect(anchor.note).toMatch(/opens in a new tab or window/i);
    }
  }
}

for (const route of routes) {
  test(`${route} is a complete accessible organization page`, async ({ page }, testInfo) => {
    await page.route('https://api.github.com/**', route => route.abort());
    const response = await page.goto(routeUrl(route), { waitUntil: 'networkidle' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Primary"]')).toHaveCount(1);
    await expect(page.locator('main#main-content')).toHaveCount(1);
    await expect(page.locator('footer')).toHaveCount(1);
    await expect(page.locator('a.skip-link[href="#main-content"]')).toHaveCount(1);
    await assertThemeControl(page, `${testInfo.project.name} ${route}`);
    await assertNoHorizontalOverflow(page, `${testInfo.project.name} ${route}`);
    await assertLinkScopes(page, `${testInfo.project.name} ${route}`);
    await assertA11y(page, `${testInfo.project.name} ${route} light/system`);
    await page.emulateMedia({ colorScheme: 'dark' });
    await assertA11y(page, `${testInfo.project.name} ${route} dark/system`);
  });
}

test('human homepage keeps implementation and machine orientation out of the normal UI', async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.abort());
  await page.goto(routeUrl('/'), { waitUntil: 'networkidle' });

  await expect(page.locator('nav[aria-label="Primary"] a[href="/accessibility/"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'For tools and automation' })).toHaveCount(0);
  await expect(page.locator('main a[href="/organization.json"], main a[href="/surface.json"], main a[href="/llms.txt"]')).toHaveCount(0);
  await expect(page.locator('head link[rel="describedby"][href="/surface.json"]')).toHaveCount(1);

  const text = (await page.locator('body').innerText()).toLowerCase();
  for (const phrase of [
    'without javascript',
    "github's public api",
    'interaction grammar',
    'release lifecycle',
    'task flows',
    'same-tab navigation',
    'external handoff',
    'automated qualification',
    'performance budgets',
  ]) {
    expect(text).not.toContain(phrase);
  }

  const disclosure = page.locator('details.accessibility-disclosure');
  await expect(disclosure).toHaveCount(1);
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(disclosure.getByText('Accessibility', { exact: true })).toBeVisible();
});

test('hero and compact mark use the current workbench identity without owning the meaning', async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.abort());
  await page.goto(routeUrl('/'), { waitUntil: 'networkidle' });

  const hero = page.locator('img.hero-craft');
  await expect(hero).toHaveCount(1);
  await expect(hero).toHaveAttribute('src', '/assets/brand/supracraft-hero.svg');
  await expect(hero).toHaveAttribute('alt', /precision workbench.*vise/i);
  await expect(page.locator('img.brand-mark')).toHaveAttribute('src', '/assets/brand/supracraft-icon.svg');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Shared craftsmanship');
  await expect(page.getByRole('heading', { level: 2, name: /workbench is shared/i })).toBeVisible();
});

test('core identity remains understandable when decorative and brand images do not load', async ({ page }) => {
  await page.route('**/*.svg', route => route.abort());
  await page.route('https://api.github.com/**', route => route.abort());
  await page.goto(routeUrl('/'), { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Shared craftsmanship');
  await expect(page.getByRole('heading', { level: 2, name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Bridge' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'VanillaCord' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /workbench is shared/i })).toBeVisible();
});

test('public repository discovery refreshes the catalog when public metadata is available', async ({ page }) => {
  await page.route('https://api.github.com/orgs/SupraCraft/repos**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { name: 'Bridge', description: 'Bridge public description', language: 'Java', fork: true, archived: false, homepage: 'https://supracraft.github.io/Bridge/', html_url: 'https://github.com/SupraCraft/Bridge' },
        { name: 'VanillaCord', description: 'VanillaCord public description', language: 'Java', fork: true, archived: false, homepage: '', html_url: 'https://github.com/SupraCraft/VanillaCord' },
        { name: '.github', description: '', language: null, fork: false, archived: false, homepage: '', html_url: 'https://github.com/SupraCraft/.github' },
        { name: 'supracraft.github.io', description: '', language: null, fork: false, archived: false, homepage: 'https://supracraft.github.io/', html_url: 'https://github.com/SupraCraft/supracraft.github.io' },
        { name: 'ArchivedExample', description: '', language: null, fork: false, archived: true, homepage: '', html_url: 'https://github.com/SupraCraft/ArchivedExample' }
      ])
    });
  });

  await page.goto(routeUrl('/'), { waitUntil: 'networkidle' });
  await expect(page.locator('.repo-item')).toHaveCount(2);
  await expect(page.locator('.repo-item').filter({ hasText: 'Bridge' }).getByRole('link', { name: 'Project site' })).toHaveAttribute('href', 'https://supracraft.github.io/Bridge/');
  const featuredBridgeSite = page.locator('[data-project="Bridge"] [data-live-project-site]');
  await expect(featuredBridgeSite).toHaveAttribute('href', '/Bridge/');
  await expect(featuredBridgeSite).not.toHaveAttribute('target', '_blank');
  await expect(page.getByText('2 public repositories')).toBeVisible();
  await assertLinkScopes(page, 'enhanced discovery');
});

test('repository refresh failure remains quiet and preserves useful static paths', async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.abort());
  await page.goto(routeUrl('/'), { waitUntil: 'networkidle' });
  await expect(page.locator('[data-project="Bridge"]')).toBeVisible();
  await expect(page.locator('[data-project="VanillaCord"]')).toBeVisible();
  await expect(page.locator('#repository-status')).toHaveText('');
  await expect(page.getByRole('link', { name: /Browse all repositories on GitHub/ })).toBeVisible();
});

test('theme choice persists across organization routes', async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.abort());
  await page.goto(routeUrl('/'));
  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto(routeUrl('/accessibility/'));
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('system color and reduced-motion preferences are honored silently', async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.abort());
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(routeUrl('/'), { waitUntil: 'networkidle' });

  await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();
  const state = await page.evaluate(() => ({
    explicitTheme: document.documentElement.dataset.theme || '',
    background: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  expect(state.explicitTheme).toBe('');
  expect(state.background.toLowerCase()).toBe('#0f1719');
  expect(state.scrollBehavior).toBe('auto');
});

test('print projection keeps content and removes interactive site chrome', async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.abort());
  await page.goto(routeUrl('/'), { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });

  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.site-footer')).toBeHidden();
  await expect(page.locator('.hero-structure')).toBeHidden();
  await expect(page.locator('.repo-browser')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Bridge' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'VanillaCord' })).toBeVisible();
});

test('320px reflow keeps navigation and primary controls usable', async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.abort());
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of routes) {
    await page.goto(routeUrl(route), { waitUntil: 'networkidle' });
    await assertNoHorizontalOverflow(page, `320px ${route}`);
    const controls = page.locator('nav[aria-label="Primary"] a, .theme-option, a.button, summary');
    const boxes = await controls.evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
  }
});

test('desktop keyboard users can skip directly to main content', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop-'), 'keyboard tab-order check applies to desktop browser projects');
  await page.route('https://api.github.com/**', route => route.abort());
  await page.goto(routeUrl('/'));
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});
