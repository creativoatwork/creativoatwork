import { defineConfig } from '@playwright/test';

/**
 * Browser-level verification for /admindash.
 *
 * Every unit-level check in this repo passed while two separate CSP misconfigurations shipped —
 * one that would have blocked sign-in, one that silently broke enrichment in production. Neither
 * was catchable outside a browser, and neither was catchable against `vite dev`, because the CSP
 * is served by Firebase Hosting and Vite does not send it.
 *
 * So these tests run against the **Hosting emulator reading the real firebase.json**: the same
 * rewrites and the same Content-Security-Policy that production serves.
 *
 * Auth and Firestore are emulated, so no real password is needed and no production data is
 * touched. Chrome is used via `channel` rather than a downloaded Chromium, since it is already
 * on this machine.
 *
 * Port 3009, not 5000: macOS AirPlay Receiver binds 5000, and Playwright's `reuseExistingServer`
 * then sees it answering and never starts the emulators at all.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3009',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run e2e:serve',
    url: 'http://127.0.0.1:3009/admindash',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
  },
});
