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

  test('sorts by project name, ascending on the first click', async ({ page }) => {
    await signIn(page);

    // Three names whose order differs by case and by number, so a naive comparison shows up.
    for (const [domain, name] of [
      ['zebra-sort.example', 'zebra lowercase'],
      ['alpha-sort.example', 'Alpha Uppercase'],
      ['num-sort.example', 'Project 10'],
      ['num2-sort.example', 'Project 9'],
    ] as const) {
      await page.getByRole('button', { name: 'Add project' }).click();
      await page.getByLabel('Domain').fill(domain);
      await page.getByLabel('Project name').fill(name);
      await page.getByRole('button', { name: 'Save project' }).click();
      await expect(page).toHaveURL(/\/admindash\/[A-Za-z0-9]+$/);
      await page.getByRole('link', { name: '← all projects' }).click();
    }

    const header = page.getByRole('columnheader', { name: /Project/ });
    const names = () => page.locator('tbody tr td:first-child span:first-child');

    await header.getByRole('button').click();
    await expect(header, 'first click on a text column sorts A-Z').toHaveAttribute('aria-sort', 'ascending');
    const FIXTURES = ['Alpha Uppercase', 'Project 9', 'Project 10', 'zebra lowercase'];
    const asc = await names().allTextContents();
    expect(asc.filter((n) => FIXTURES.includes(n))).toEqual([
      'Alpha Uppercase', 'Project 9', 'Project 10', 'zebra lowercase',
    ]);

    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    const desc = await names().allTextContents();
    expect(desc.filter((n) => FIXTURES.includes(n))).toEqual([
      'zebra lowercase', 'Project 10', 'Project 9', 'Alpha Uppercase',
    ]);

    // Sorting lives in the URL, so a sorted view is linkable and survives reload.
    await expect(page).toHaveURL(/sort=name/);
    await page.reload();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
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

    // Asserts the row is gone, not that the collection is empty: other tests leave fixtures
    // behind, and coupling to a global count makes this fail for reasons unrelated to delete.
    await expect(page).toHaveURL(/\/admindash$/);
    await expect(page.getByRole('link', { name: /E2E fixture/ })).toHaveCount(0);
  });
});

/**
 * Bulk import.
 *
 * Runs after the block above, which leaves the collection empty. The preview is the feature's
 * only safety mechanism — fields are classified by shape rather than by column position, so what
 * the parser decided has to be visible before anything is written. These tests assert on the
 * preview's own cells, not just on the outcome.
 */
test.describe('/admindash import', () => {
  const row = (page: Page, line: number) => page.locator(`tr[data-line="${line}"]`);

  const PASTE = [
    'Alpha Import, alpha-import.example, https://github.com/creativoatwork/alpha',
    'beta-import.example',
    'https://github.com/owner/repo',
    'Alpha Again, alpha-import.example',
  ].join('\n');

  test('previews a pasted list, classifies each row, and imports only the valid ones', async ({ page }) => {
    const violations = await watchCsp(page);
    await signIn(page);
    await page.getByRole('button', { name: 'Import list' }).click();
    await page.getByLabel('One project per line').fill(PASTE);

    // Line 1: all three fields supplied, in the canonical order.
    await expect(row(page, 1)).toContainText('alpha-import.example');
    await expect(row(page, 1)).toContainText('creativoatwork/alpha');
    await expect(row(page, 1).getByLabel('Project name for line 1')).toHaveValue('Alpha Import');
    await expect(row(page, 1)).toContainText('ok');

    // Line 2: domain only — the name is derived from it.
    await expect(row(page, 2).getByLabel('Project name for line 2')).toHaveValue('Beta Import');
    await expect(row(page, 2)).toContainText('from the domain');
    await expect(row(page, 2)).toContainText('ok');

    // Line 3: a repo with no domain. firestore.rules requires a hostname, so this is refused
    // here rather than attempted and rejected by the server.
    await expect(row(page, 3)).toContainText('invalid');
    await expect(row(page, 3)).toContainText('No domain on this line');
    await expect(row(page, 3).getByRole('checkbox')).toBeDisabled();

    // Line 4: same domain as line 1, so it is a duplicate within the paste itself, and off.
    await expect(row(page, 4)).toContainText('duplicate');
    await expect(row(page, 4)).toContainText('Same domain as line 1');
    await expect(row(page, 4).getByRole('checkbox')).not.toBeChecked();

    await expect(page.getByText('2 ready, 1 duplicate, 1 invalid')).toBeVisible();

    // The GitHub ceiling has to be stated where the checkbox is, not in a doc nobody opens.
    await expect(page.getByText(/60 unauthenticated requests an hour/)).toBeVisible();

    await page.getByRole('button', { name: /^Import 2 projects$/ }).click();
    await expect(page.getByText(/Created 2 · Skipped 2 · Failed 0/)).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(page.getByRole('link', { name: /Alpha Import/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Beta Import/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Alpha Again/ })).toHaveCount(0);
    expect(violations, 'importing must not be blocked by the CSP').toEqual([]);
  });

  test('a second import of the same domain is flagged against what is already stored', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'Import list' }).click();
    await page.getByLabel('One project per line').fill('alpha-import.example');

    await expect(row(page, 1)).toContainText('duplicate');
    await expect(row(page, 1)).toContainText('Already in the collection.');
    await expect(page.getByRole('button', { name: 'Import 0 projects' })).toBeDisabled();
  });
});
