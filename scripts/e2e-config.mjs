#!/usr/bin/env node
/**
 * Generates firebase.e2e.json for the end-to-end run.
 *
 * The point of running e2e through the Hosting emulator is that the Content-Security-Policy
 * under test is the real one. But the emulated Auth and Firestore live on loopback ports, and
 * the production `connect-src` rightly does not allow those — so sign-in fails with
 * `auth/network-request-failed`, which is a CSP refusal wearing a network error's clothes.
 *
 * Rather than weaken the production policy for the benefit of tests, this derives a config that
 * differs from firebase.json by EXACTLY the emulator origins. Everything else — every other
 * directive, the rewrites, the other headers — is copied verbatim, and
 * `tests/e2e/admindash.spec.ts` asserts that the committed firebase.json still names the real
 * production hosts and never names loopback.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const EMULATOR_ORIGINS = [
  'http://127.0.0.1:9099',   // auth
  'http://127.0.0.1:8080',   // firestore
  'http://localhost:9099',
  'http://localhost:8080',
];

const config = JSON.parse(readFileSync('firebase.json', 'utf8'));

let patched = 0;
for (const block of config.hosting.headers ?? []) {
  for (const header of block.headers ?? []) {
    if (header.key !== 'Content-Security-Policy') continue;
    if (/127\.0\.0\.1|localhost/.test(header.value)) {
      throw new Error(
        'firebase.json already allows loopback in its CSP. That must never ship — remove it.',
      );
    }
    header.value = header.value.replace(
      /connect-src ([^;]*)/,
      (_m, sources) => `connect-src ${sources.trim()} ${EMULATOR_ORIGINS.join(' ')}`,
    );
    patched++;
  }
}

if (!patched) throw new Error('e2e-config: found no Content-Security-Policy header to extend');

writeFileSync('firebase.e2e.json', `${JSON.stringify(config, null, 2)}\n`);
console.log(`e2e-config: wrote firebase.e2e.json (${patched} CSP header(s) extended for emulators)`);
