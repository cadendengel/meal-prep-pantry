import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT) || 3210;

// The server and the database are started by e2e/run.js, which owns their
// lifecycle. Playwright only drives the browser.
export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // Workers share one dev server, so a slow moment under load must not
  // read as a failure.
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
      // The narrow-screen suite belongs to the mobile project only.
      testIgnore: /mobile\.spec\.js/,
    },
    {
      name: 'mobile',
      // A phone viewport with touch, but on Chromium. These tests check the
      // CSS breakpoint, not engine-specific rendering, so requiring a
      // second browser download would cost more than it proves.
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        channel: undefined,
      },
      testMatch: /mobile\.spec\.js/,
    },
  ],
});
