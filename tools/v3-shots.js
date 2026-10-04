// v3 screenshots: full pages (desktop 1440 + mobile 390) and feature close-ups.
// Usage: node v3-shots.js [all|pages|features] ; writes to ../screenshots/
const { chromium } = require('playwright-core');
const OUT = (process.env.OUT_DIR || 'screenshots') + '/';
const BASE = 'http://localhost:8080';
const PAGES = [['home', '/'], ['the-house', '/the-house/'], ['gallery', '/gallery/'], ['amenities', '/amenities/'], ['rates-availability', '/rates-availability/'], ['location-area-guide', '/location-area-guide/'], ['reviews', '/reviews/'], ['contact-book', '/contact-book/']];
const mode = process.argv[2] || 'all';
const only = process.argv[3];
const errors = [];

async function settle(page, full) {
  if (full) await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 450)); } window.scrollTo(0, 0); });
  await page.evaluate(() => document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; i.decoding = 'sync'; }));
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
  await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.querySelectorAll('.sbh-reveal, .sbh-card, .sbh-review, .sbh-section-head, .wp-block-column').forEach(e => e.classList.add('is-visible')));
  await page.waitForFunction(() => !document.querySelector('[data-sbh-weather]') || document.querySelector('.sbh-weather.is-loaded, .sbh-weather-error'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[data-sbh-map]') || document.querySelectorAll('.leaflet-tile-loaded').length > 4, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
}
// first valid stay of n nights starting from offset days
const pickJS = (n, from = 1) => `(() => { const A = window.AMP; const t = new Date(); for (let i = ${from}; i < 400; i++) { const d = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate() + i)).toISOString().slice(0,10); const o = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate() + i + ${n})).toISOString().slice(0,10); if (A.canIn(d) && A.canOut(d, o)) { A.set({ ci: d, co: o, adults: 4, children: 2 }); return [d, o]; } } })()`;

async function ctxFor(browser, mobile) {
  return browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
}
async function open(ctx, path, tag) {
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${tag} ${path}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${tag} ${path}: ${m.text()}`); });
  const r = await page.goto(BASE + path, { waitUntil: 'networkidle' });
  if (r.status() !== 200) errors.push(`${tag} ${path}: HTTP ${r.status()}`);
  return page;
}
async function scrollTo(page, sel, off = 90) { await page.evaluate(([s, o]) => { const e = document.querySelector(s); if (window.__lenis) window.__lenis.scrollTo(e, { immediate: true, offset: -o }); else window.scrollTo(0, e.getBoundingClientRect().top + scrollY - o); }, [sel, off]); await page.waitForTimeout(900); }
async function clipEl(page, sel, out, pad = 24, maxH = 1400) {
  await page.addStyleTag({ content: '.sbh-header-wrap,.amp-rooms-nav{visibility:hidden!important}' });
  const b = await page.evaluate(([s, p, m]) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.max(0, r.left - p), y: Math.max(0, r.top + scrollY - p), width: Math.min(innerWidth, r.width + 2 * p), height: Math.min(m, r.height + 2 * p) }; }, [sel, pad, maxH]);
  await page.screenshot({ path: OUT + out, clip: b, fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  if (mode === 'all' || mode === 'pages') {
    for (const mobile of [false, true]) {
      const ctx = await ctxFor(browser, mobile);
      for (const [name, path] of PAGES) {
        if (only && only !== name) continue;
        const page = await open(ctx, path, mobile ? 'mobile' : 'desktop');
        await settle(page, true);
        await page.evaluate(() => { if (window.__lenis) { window.__lenis.destroy(); window.__lenis = null; } document.documentElement.classList.remove('lenis', 'lenis-smooth', 'has-lenis'); window.scrollTo(0, 0); });
        await page.addStyleTag({ content: '.sbh-header-wrap{position:relative!important;top:0!important}.amp-mbar{display:none!important}' }); // full-page capture shows the top-of-page state
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
        await page.screenshot({ path: OUT + name + (mobile ? '-mobile' : '') + '.png', fullPage: true, animations: 'disabled' });
        console.log('shot', name, mobile ? 'mobile' : 'desktop');
        await page.close();
      }
      await ctx.close();
    }
  }
  if (mode === 'all' || mode === 'features') {
    const d = await ctxFor(browser, false);
    const want = f => !only || only === f;
    let p;
    if (want('hero')) { p = await open(d, '/', 'desktop'); await page_hero(p, 'summer'); await p.screenshot({ path: OUT + 'feature-hero-video.png' }); await p.close(); }
    if (want('season')) { p = await open(d, '/', 'desktop'); await page_hero(p, 'snowbird'); await p.screenshot({ path: OUT + 'feature-season-switch.png' }); await p.evaluate(() => document.querySelector('.amp-season [data-k="summer"]').click()); await p.close(); }
    if (want('card')) {
      p = await open(d, '/the-house/', 'desktop'); await settle(p);
      await p.evaluate(pickJS(4, 3)); await p.waitForTimeout(300);
      await p.evaluate(() => { const c = document.querySelector('.amp-aside .amp-f-g'); c.click(); });
      await p.waitForTimeout(500);
      await clipEl(p, '.amp-aside-inner', 'feature-booking-card.png', 36);
      await p.close();
    }
    if (want('calendar')) {
      p = await open(d, '/rates-availability/', 'desktop'); await settle(p);
      await scrollTo(p, '.amp-cal-card', 40);
      await p.evaluate(pickJS(5, 10)); await p.waitForTimeout(300);
      await p.hover('.amp-cal-card .amp-day.is-avail >> nth=3').catch(() => {});
      await clipEl(p, '.amp-cal-card', 'feature-calendar.png', 28);
      await p.close();
    }
    if (want('mosaic')) { p = await open(d, '/gallery/', 'desktop'); await settle(p); await clipEl(p, '.amp-mosaic', 'feature-gallery-mosaic.png', 40); await scrollTo(p, '#room-primary', 150); await p.screenshot({ path: OUT + 'feature-room-tour.png' }); await p.close(); }
    if (want('360')) {
      p = await open(d, '/gallery/', 'desktop'); await settle(p); await scrollTo(p, '.amp-360', 60);
      await p.click('[data-amp-pano-load]'); await p.waitForSelector('.amp-360-stage.is-live', { timeout: 20000 }); await p.waitForTimeout(3500);
      await p.hover('.amp-hs-info').catch(() => {}); await p.waitForTimeout(400);
      await clipEl(p, '.amp-360', 'feature-360.png', 30); await p.close();
    }
    if (want('reviews')) { p = await open(d, '/reviews/', 'desktop'); await settle(p); await clipEl(p, '[data-amp-reviews]', 'feature-reviews.png', 30, 1500); await p.close(); }
    if (want('truths')) { p = await open(d, '/the-house/', 'desktop'); await settle(p); await scrollTo(p, '.amp-truths-sec', 0); await clipEl(p, '.amp-truths-sec', 'feature-home-truths.png', 0, 1300); await p.close(); }
    if (want('story')) {
      p = await open(d, '/', 'desktop'); await settle(p, true);
      await scrollTo(p, '.amp-story-steps .amp-step:nth-child(3)', 120); await p.waitForTimeout(1600);
      await p.screenshot({ path: OUT + 'feature-story.png' }); await p.close();
    }
    await d.close();
    const m = await ctxFor(browser, true);
    if (want('mbar')) {
      p = await open(m, '/the-house/', 'mobile'); await settle(p);
      await p.evaluate(pickJS(4, 3)); await p.evaluate(() => window.scrollTo(0, 1300)); await p.waitForTimeout(800);
      await p.screenshot({ path: OUT + 'mobile-booking-bar.png' });
      await p.evaluate(() => { if (window.AMP && window.AMP.open) window.AMP.open(); else document.querySelector('.amp-mbar-btn').click(); }); await p.waitForTimeout(700);
      await p.screenshot({ path: OUT + 'mobile-booking-sheet.png' }); await p.close();
    }
    await m.close();
  }
  await browser.close();
  console.log(errors.length ? 'CONSOLE/PAGE ERRORS:\n' + [...new Set(errors)].join('\n') : 'No console errors on any page');
  async function page_hero(p, season) {
    await p.evaluate(s => document.querySelector('.amp-season [data-k="' + s + '"]').click(), season);
    await p.waitForFunction(s => { const v = document.querySelector('video[data-season-video="' + s + '"]'); return v && v.classList.contains('is-playing') && v.currentTime > 1.5; }, season, { timeout: 30000 }).catch(() => errors.push('hero video did not play: ' + season));
    await p.waitForTimeout(1300);
  }
})();
