import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? process.env.INTERACTION_BASE_URL ?? 'http://localhost:9000';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  // e2e specs (bottom sheet, navigation) share app state — serial.
  // Interaction specs are independent browser contexts — parallel.
  workers: process.env.CI ? 4 : 2,
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['line'], ['allure-playwright', { resultsDir: 'allure-results/e2e' }]],
  projects: [
    {
      name: 'mobile-chrome',
      testDir: './tests/e2e',
      workers: 1, // e2e: sheet/map timing is order-sensitive
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'interaction',
      testDir: './tests/interaction',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
