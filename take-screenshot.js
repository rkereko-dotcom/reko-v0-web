const { chromium } = require('playwright');

(async () => {
  // Connect to existing browser or launch new one
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3002', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshot-now.png', fullPage: true });
  console.log('Screenshot saved!');
  await browser.close();
})();
