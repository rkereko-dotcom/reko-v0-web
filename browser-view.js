const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);

  console.log('Хуудас руу орж байна...');
  await page.goto('http://localhost:3005', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // File input олоод poster upload хийнэ
  console.log('Flower poster upload хийж байна...');
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles('C:\\Users\\User\\OneDrive\\Desktop\\Reko V0 Designs\\flower.jpg');

  console.log('Upload хийгдлээ!');
  await page.waitForTimeout(2000);

  // "Шинжилгээ хийх" товч дарна
  console.log('Шинжилгээ хийх товч дарж байна...');
  await page.click('button:has-text("Шинжилгээ хийх")');

  // Анализ дуусахыг хүлээнэ
  console.log('Анализ хүлээж байна...');
  await page.waitForSelector('button:has-text("Шинжилж байна")', { state: 'hidden', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Screenshot авна - анализын үр дүн
  await page.screenshot({ path: 'screenshot-analysis.png', fullPage: true });
  console.log('Анализын screenshot: screenshot-analysis.png');

  // ===== 🔧 REDESIGN BUTTON ТЕСТ =====
  console.log('🔧 REDESIGN товч хайж байна...');
  const redesignButton = page.locator('button:has-text("Design бүтэн өөрчлөх")');

  if (await redesignButton.count() > 0) {
    console.log('🔧 REDESIGN товч олдлоо, дарж байна...');
    await redesignButton.first().click();

    // Generation хүлээнэ (2 минут хүртэл)
    console.log('🔧 Design бүтэн өөрчилж байна, хүлээгээрэй...');
    await page.waitForTimeout(90000);

    await page.screenshot({ path: 'screenshot-redesign.png', fullPage: true });
    console.log('🔧 Redesign screenshot: screenshot-redesign.png');
  } else {
    console.log('❌ Redesign товч олдсонгүй');
  }

  console.log('✅ Тест дууслаа! Browser-ийг гараар хаана уу.');
  browser.on('disconnected', () => process.exit(0));
  await new Promise(() => {});
})();
