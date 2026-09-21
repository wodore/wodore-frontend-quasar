import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:9000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // sheet/map timing is order-sensitive; keep runs deterministic
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['line'], ['allure-playwright', { resultsDir: 'allure-results/e2e' }]],
  projects: [
    {
      name: 'mobile-chrome',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
