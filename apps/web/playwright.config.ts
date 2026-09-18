import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');
const apiUrl = process.env.E2E_API_URL || 'http://localhost:4000';
const webUrl = process.env.E2E_WEB_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: webUrl,
    viewport: { width: 1600, height: 1000 },
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: process.env.E2E_API_COMMAND || 'corepack pnpm --filter api start:dev',
      cwd: repoRoot,
      url: `${apiUrl}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: process.env.E2E_WEB_COMMAND || 'corepack pnpm --filter web dev',
      cwd: repoRoot,
      url: `${webUrl}/dashboard`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});