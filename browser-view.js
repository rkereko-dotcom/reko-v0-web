const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);

  console.log('Хуудас руу орж байна...');
  await page.goto('http://localhost:3003', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // File input олоод poster upload хийнэ
  console.log('Poster upload хийж байна...');
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles('C:\\Users\\User\\OneDrive\\Desktop\\Reko V0 Designs\\CC thumbnail.jpg');

  console.log('Upload хийгдлээ!');
  await page.waitForTimeout(2000);

  // "Шинжилгээ хийх" товч дарна
  console.log('Шинжилгээ хийх товч дарж байна...');
  await page.click('button:has-text("Шинжилгээ хийх")');

  // Анализ дуусахыг хүлээнэ - "Шинжилж байна" алга болтол
  console.log('Анализ хүлээж байна...');
  await page.waitForSelector('button:has-text("Шинжилж байна")', { state: 'hidden', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Screenshot авна - анализын үр дүн
  await page.screenshot({ path: 'screenshot-analysis.png', fullPage: true });
  console.log('Анализын screenshot: screenshot-analysis.png');

  // "Сайжруулсан хувилбар үүсгэх" товч хайна
  console.log('Сайжруулсан хувилбар үүсгэх товч хайж байна...');
  const generateButton = page.locator('button:has-text("Сайжруулсан хувилбар үүсгэх")');

  if (await generateButton.count() > 0) {
    console.log('Товч олдлоо, дарж байна...');
    await generateButton.first().click();

    // Generation хүлээнэ (2 минут хүртэл)
    console.log('Зураг үүсгэж байна, хүлээгээрэй...');
    await page.waitForTimeout(90000);

    await page.screenshot({ path: 'screenshot-improved.png', fullPage: true });
    console.log('Сайжруулсан screenshot: screenshot-improved.png');
  } else {
    console.log('Товч олдсонгүй, scroll хийж үзье...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshot-improved.png', fullPage: true });
  }

  browser.on('disconnected', () => process.exit(0));
  await new Promise(() => {});
})();
