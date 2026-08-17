import { readFileSync } from 'node:fs';

/**
 * Seeds the emulators.
 *
 * Called from the spec's beforeAll rather than Playwright's `globalSetup` hook: that hook runs
 * BEFORE `webServer` starts, so it can never see the emulators it is meant to seed.
 *
 * The chicken-and-egg here is real: `firestore.rules` allowlists production UIDs, and the Auth
 * emulator mints its own. So we create the test user first, read the UID it was given, and load
 * the REAL rules file into the Firestore emulator with only that allowlist substituted.
 * Everything else about the rules — every field, enum, length and timestamp check — is exercised
 * exactly as deployed.
 */

const PROJECT = 'creativoatwork-54e65';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8080';

export const TEST_USER = { email: 'e2e@creativoatwork.test', password: 'e2e-password-not-a-secret' };

async function waitFor(url: string, label: string, ms = 120_000) {
  const deadline = Date.now() + ms;
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 404 || r.status === 400) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`e2e: ${label} did not come up at ${url}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

export async function seedEmulators() {
  await waitFor(`${AUTH}/`, 'auth emulator');
  await waitFor(`${FIRESTORE}/`, 'firestore emulator');

  // Start from a clean slate so a rerun cannot inherit state from the last one.
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });

  const signUp = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...TEST_USER, returnSecureToken: true }),
    },
  );
  if (!signUp.ok) throw new Error(`e2e: could not create the test user: ${await signUp.text()}`);
  const { localId } = (await signUp.json()) as { localId: string };
  if (!localId) throw new Error('e2e: auth emulator returned no UID');

  const rules = readFileSync('firestore.rules', 'utf8').replace(
    /(function adminUids\(\) \{\s*return \[)[\s\S]*?(\];)/,
    `$1'${localId}',$2`,
  );
  if (!rules.includes(localId)) {
    throw new Error('e2e: could not inject the test UID into adminUids() — did the rules change shape?');
  }

  const load = await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}:securityRules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }),
  });
  if (!load.ok) throw new Error(`e2e: could not load rules into the emulator: ${await load.text()}`);

  console.log(`e2e: seeded ${TEST_USER.email} as ${localId}, rules loaded`);
}
