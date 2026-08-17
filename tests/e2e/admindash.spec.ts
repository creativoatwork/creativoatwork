import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_USER, seedEmulators } from './seed';

/**
 * What these tests exist to catch.
 *
 * Two Content-Security-Policy misconfigurations shipped from this repo. The first omitted
 * `https://apis.google.com` from `script-src` and would have made sign-in impossible. The second
 * omitted `https://api.github.com` and `https://dns.google` from `connect-src`, and silently
 * broke enrichment in production — every gather failed with "Failed to fetch", which reads like
 * a network error and is not one.
 *
 * Neither was catchable by type-checking, 55 emulator-backed rules tests, bundle analysis, or a
 * Node probe against the real APIs — Node has no CSP. Only a browser, loading the page through
 * the real Hosting config, can see them.
 *
 * So every test below records CSP violations and asserts there were none.
 */

/** Collect CSP violations as they happen. A blocked request is otherwise invisible from JS. */
async function watchCsp(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction('__cspViolation', (v: string) => void violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const ev = e as SecurityPolicyViolationEvent;
      // @ts-expect-error injected by exposeFunction
      window.__cspViolation(`${ev.violatedDirective} blocked ${ev.blockedURI}`);
    });
  });
  return violations;
}

/**
 * The value cell for a labelled row in the gathered panel.
 *
 * Matching on text alone is ambiguous here: "Cloudflare" also appears in the proxy note and in
 * the Host <select>'s options, and Playwright's strict mode rightly refuses to guess.
 */
function gatheredRow(page: Page, label: string) {
  return page
    .locator('dt', { hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd[1]');
}

async function signIn(page: Page) {
  await page.goto('/admindash');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in with email instead' }).click();
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add project' })).toBeVisible();
}

test.describe('/admindash', () => {
  test.beforeAll(async () => {
    await seedEmulators();
  });

  test('serves the admin entry, not the prerendered marketing page', async ({ page }) => {
    const res = await page.goto('/admindash');
    expect(res?.status()).toBe(200);

    // The rewrite must resolve to admindash.html. If it ever fell through to the marketing
    // catch-all, this page would contain the site header instead.
    await expect(page.locator('header.gutter')).toHaveCount(0);
    expect(await page.title()).toBe('admindash');

    const csp = res?.headers()['content-security-policy'] ?? '';
    expect(csp, 'the Hosting CSP must actually be served').toContain("default-src 'self'");
    expect(csp, 'signInWithPopup loads apis.google.com/js/api.js').toContain('https://apis.google.com');
    expect(csp, 'enrichment fetches the GitHub API').toContain('https://api.github.com');
    expect(csp, 'enrichment resolves DNS over HTTPS').toContain('https://dns.google');
    expect(res?.headers()['x-robots-tag']).toContain('noindex');
  });

  test('the committed CSP never allows loopback, whatever the e2e run needs', async () => {
    // The e2e config adds emulator origins so sign-in can reach them. This asserts that
    // convenience never leaks into the file that actually deploys.
    const production = readFileSync('firebase.json', 'utf8');
    expect(production).not.toMatch(/connect-src[^;]*(127\.0\.0\.1|localhost)/);
  });

  test('a sub-route resolves to the admin app, not a 404', async ({ page }) => {
    const res = await page.goto('/admindash/does-not-exist');
    expect(res?.status()).toBe(200);
    expect(await page.title()).toBe('admindash');
  });

  test('signs in, with no CSP violations', async ({ page }) => {
    const violations = await watchCsp(page);
    await signIn(page);
    await expect(page.getByText(TEST_USER.email)).toBeVisible();
    expect(violations, 'sign-in must not be blocked by the CSP').toEqual([]);
  });

  test('a signed-in session can read Firestore — the rules allow this UID', async ({ page }) => {
    await signIn(page);
    // permission-denied surfaces as a banner naming the UID. Its absence is the assertion.
    await expect(page.getByText(/Firestore refused the read/)).toHaveCount(0);
    await expect(page.getByText(/No projects yet|Search name, domain/)).toBeVisible();
  });

  test('creates a project, gathers its tech stack, and persists both', async ({ page }) => {
    const violations = await watchCsp(page);
    await signIn(page);

    await page.getByRole('button', { name: 'Add project' }).click();
    await page.getByLabel('Domain').fill('creativoatwork.com');
    await page.getByLabel('Project name').fill('E2E fixture');
    await page.getByRole('button', { name: 'Save project' }).click();

    // Lands on the detail view for the new document.
    await expect(page).toHaveURL(/\/admindash\/[A-Za-z0-9]+$/);
    await expect(page.getByLabel('Project name')).toHaveValue('E2E fixture');

    await page.getByRole('button', { name: /Gather tech stack|Refresh/ }).click();

    // DNS is the dependable half: dns.google has no rate limit, so this asserts a real
    // cross-origin fetch completed rather than being refused by the CSP.
    await expect(gatheredRow(page, 'DNS')).toContainText('Cloudflare', { timeout: 30_000 });
    await expect(gatheredRow(page, 'Server IP')).toContainText(/\d+\.\d+\.\d+\.\d+/);

    // "Failed to fetch" is precisely what a CSP block looks like from fetch(). GitHub rate
    // limiting is tolerable and reports differently; a blocked request is not.
    await expect(page.getByText(/Failed to fetch/)).toHaveCount(0);
    expect(violations, 'gathering must not be blocked by the CSP').toEqual([]);

    // Gathered data is written immediately, without the operator pressing Save. A reload proves
    // it reached Firestore rather than living in component state.
    await page.reload();
    await expect(gatheredRow(page, 'DNS')).toContainText('Cloudflare');
  });

  test('a Save after a Gather does not wipe the gathered data', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: /E2E fixture/ }).click();
    await expect(gatheredRow(page, 'DNS')).toContainText('Cloudflare');

    // This regression shipped: enrichment lived in the form's value, so Save wrote a stale copy
    // back over a fresh gather. Editing an unrelated field and saving must leave it intact.
    await page.getByLabel('Description').fill('edited by the e2e run');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Description')).toHaveValue('edited by the e2e run');
    await expect(gatheredRow(page, 'DNS'), 'Save must not undo a Gather').toContainText('Cloudflare');
  });

  test('deletes the fixture, and requires the name typed to do it', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: /E2E fixture/ }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    const confirm = page.getByRole('button', { name: 'Delete permanently' });
    await expect(confirm, 'the guard must stay disabled until the name matches').toBeDisabled();
    await page.getByLabel(/Type the project name/).fill('E2E fixture');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page).toHaveURL(/\/admindash$/);
    await expect(page.getByText('No projects yet.')).toBeVisible();
  });
});
