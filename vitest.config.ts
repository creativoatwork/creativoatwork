import { defineConfig } from 'vitest/config';

// Scoped to Firestore Security Rules only. Rules are the security boundary and cannot be
// verified by reading them; everything else in this repo remains untested by deliberate choice.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
