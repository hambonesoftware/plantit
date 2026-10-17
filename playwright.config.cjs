const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/local',
  testMatch: '*.spec.cjs',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:8765',
    headless: true,
    launchOptions: process.env.PLANTIT_CHROMIUM ? {
      executablePath: process.env.PLANTIT_CHROMIUM,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--use-gl=angle', '--use-angle=swiftshader'],
    } : {},
  },
  webServer: {
    command: 'python scripts/build_static.py && python -m http.server 8765 --bind 127.0.0.1 --directory dist/plantit',
    url: 'http://127.0.0.1:8765',
    reuseExistingServer: false,
  },
});
