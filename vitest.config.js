import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests only. The end-to-end specs import @playwright/test and are
    // run by `npm run test:e2e`, which starts a database and a server for
    // them. Without this, vitest collects them and every file errors.
    include: ['**/__tests__/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
