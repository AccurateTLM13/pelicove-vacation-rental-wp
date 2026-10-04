const { chromium } = require('playwright-core');
(async () => {
  const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['home:/', 'the-house:/the-house/', 'rates-availability:/rates-availability/', 'contact-book:/contact-book/'];
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const p of pages) {
    const [name, path] = p.split(':');
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const r = await page.goto('http://localhost:8080' + path, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 450) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 300)); } window.scrollTo(0, 0); });
    await page.evaluate(() => document.querySelectorAll('img').forEach(i => { i.decoding = 'sync'; i.loading = 'eager'; }));
    await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 30000 });
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
    await page.waitForTimeout(800);
    await page.waitForFunction(() => !document.querySelector('[data-sbh-weather]') || document.querySelector('.sbh-weather.is-loaded, .sbh-weather-error'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('[data-sbh-map]') || document.querySelectorAll('.leaflet-tile-loaded').length > 4, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => document.querySelectorAll('.sbh-reveal, .sbh-card, .sbh-review, .sbh-section-head, .wp-block-column').forEach(e => e.classList.add('is-visible')));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${process.env.OUT_DIR || 'screenshots'}/${name}.png`, fullPage: true, animations: 'disabled' });
    console.log(name, r.status(), errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
    await page.close();
  }
  await browser.close();
})();
