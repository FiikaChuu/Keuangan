import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    actionTimeout: 15000,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
          args: ['--no-sandbox'],
        },
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'iphone-size',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
          args: ['--no-sandbox'],
        },
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'iphone-webkit',
      use: {
        browserName: 'webkit',
        launchOptions: { executablePath: process.env.WEBKIT_EXECUTABLE_PATH || undefined },
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: 'SKYWALLET_DEMO=true npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
