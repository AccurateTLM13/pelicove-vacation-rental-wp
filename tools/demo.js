const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const S = (process.env.OUT_DIR || 'screenshots') + '/';
  let p = await ctx.newPage();
  await p.goto('http://localhost:8080/gallery/', { waitUntil: 'networkidle' });
  await p.click('#g-views ~ * a, .sbh-gallery a >> nth=2').catch(async () => { await p.locator('.sbh-gallery a').nth(2).click(); });
  await p.waitForSelector('.sbh-lb.is-ready', { timeout: 10000 }); await p.waitForTimeout(400);
  await p.screenshot({ path: S + 'feature-lightbox.png' });
  await p.keyboard.press('ArrowRight'); await p.waitForSelector('.sbh-lb.is-ready'); console.log('lightbox counter:', await p.textContent('.sbh-lb-count'));
  await p.keyboard.press('Escape'); await p.close();

  p = await ctx.newPage();
  await p.goto('http://localhost:8080/contact-book/', { waitUntil: 'networkidle' });
  await p.fill('input[name=your-name]', 'Jamie Guest'); await p.fill('input[name=your-email]', 'jamie@example.com'); await p.selectOption('select[name=guests]', '6'); await p.fill('input[name=check-in]', '2027-03-20'); await p.fill('input[name=check-out]', '2027-03-27');
  await p.dispatchEvent('input[name=check-out]', 'change');
  await p.waitForTimeout(500);
  console.log('countdown:', (await p.textContent('[data-sbh-countdown]')).trim());
  await p.evaluate(() => { const h = document.querySelector('.sbh-header-wrap'); if (h) h.style.position = 'static'; }); await p.locator('.sbh-form-card').screenshot({ path: S + 'feature-countdown.png' });
  await p.close();

  p = await ctx.newPage();
  await p.goto('http://localhost:8080/location-area-guide/', { waitUntil: 'networkidle' });
  await p.locator('.sbh-leaflet').scrollIntoViewIfNeeded();
  await p.click('.sbh-map-toggle button[data-z=near]'); await p.waitForTimeout(2500);
  await p.locator('.sbh-house-tip').waitFor();
  await p.locator('.sbh-leaflet').screenshot({ path: S + 'feature-map-fort-morgan.png' });
  await p.close();

  p = await ctx.newPage();
  await p.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await p.waitForSelector('.sbh-weather.is-loaded', { timeout: 15000 });
  await p.locator('.sbh-weather').scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
  await p.locator('.sbh-weather').screenshot({ path: S + 'feature-weather.png' });
  await b.close();
})();
