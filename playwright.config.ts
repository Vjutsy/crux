import { defineConfig, devices } from '@playwright/test';

// Локально можна вказати свій Chrome: CHROME_PATH=/usr/bin/google-chrome npm run e2e
const executablePath = process.env.CHROME_PATH;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173/',
    launchOptions: executablePath ? { executablePath } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    env: { BASE_PATH: '/' },
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
