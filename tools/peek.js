// Quick viewport capture for review: node peek.js <path> <out.png> [width] [height] [scrollSelector] [js]
const { chromium } = require('playwright-core');
(async () => {
  const [path, out, w = 1440, h = 900, sel, js] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const mobile = +w < 600;
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('requestfailed', r => errs.push('FAILED ' + r.url()));
  await page.goto('http://localhost:8080' + path, { waitUntil: 'networkidle' });
  if (sel) { await page.evaluate(s => { const e = document.querySelector(s); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 90); }, sel); await page.waitForTimeout(900); }
  if (js) { await page.evaluate(js); await page.waitForTimeout(900); }
  await page.evaluate(() => document.querySelectorAll('.sbh-reveal, .sbh-card, .sbh-review, .sbh-section-head, .wp-block-column').forEach(e => e.classList.add('is-visible')));
  await page.waitForTimeout(700);
  await page.screenshot({ path: out });
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
  await browser.close();
})();
