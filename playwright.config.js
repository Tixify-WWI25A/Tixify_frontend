// Playwright-Konfiguration für den NFA-Test (KI-Log Nr. 19)
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 120000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
});