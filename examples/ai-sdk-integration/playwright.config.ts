import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for testing Chrome Prompt API integration
 *
 * This attempts to use Chrome (not Chromium) with experimental AI features enabled.
 * Note: This requires Chrome Canary/Dev to be installed on your system.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chrome-with-prompt-api',
      use: {
        ...devices['Desktop Chrome'],

        // Launch options with experimental flags for Chrome Prompt API
        launchOptions: {
          // Explicitly specify Chrome Canary executable path
          executablePath: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',

          args: [
            // Enable optimization guide for on-device model
            '--enable-features=OptimizationGuideModelDownloading,OptimizationGuideOnDeviceModel,PromptAPIForGeminiNano',

            // Bypass performance requirements
            '--optimization-guide-model-execution=enabled',

            // Additional flags that might help
            '--no-first-run',
            '--no-default-browser-check',

            // Disable some restrictions
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        },
      },
    },

    {
      name: 'chromium-fallback',
      use: {
        ...devices['Desktop Chrome'],
        // Regular Chromium - will use test mode
      },
    },
  ],

  // Note: Start servers manually before running tests
  // Terminal 1: cd packages/server && pnpm dev:serve
  // Terminal 2: cd examples/ai-sdk-integration && pnpm dev
});
