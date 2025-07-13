const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function takeScreenshot() {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('https://polymarket.com', { waitUntil: 'networkidle2' });
    const screenshotPath = path.join(__dirname, 'static', 'polymarket-bg.jpg');
    await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 80, fullPage: true });
    await browser.close();
    console.log('Screenshot updated:', screenshotPath);
}

takeScreenshot();
setInterval(takeScreenshot, 30 * 1000); 