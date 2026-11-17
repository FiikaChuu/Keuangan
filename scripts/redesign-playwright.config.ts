import { defineConfig } from '@playwright/test';
import existing from '../playwright.config';
import { chromium } from 'playwright';

// Local-only UI regression runner; the project's deployment/test config is unchanged.
export default defineConfig({
  ...existing,
  testDir: '../tests/browser',
  outputDir: '../test-results/redesign-e2e',
  webServer: undefined,
  use: { ...existing.use, baseURL: process.env.REDESIGN_BASE_URL || 'http://127.0.0.1:4183' },
  projects: existing.projects
    ?.filter((p) => p.name !== 'iphone-webkit')
    .map((p) => ({
      ...p,
      use: {
        ...p.use,
        launchOptions: { executablePath: chromium.executablePath(), args: ['--no-sandbox'] },
      },
    })),
});
