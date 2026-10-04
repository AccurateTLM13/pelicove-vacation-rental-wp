// Playwright booking-flow test for the v3 booking engine.
// Run: cd tools && node test-booking.js   (exit code 0 = all pass)
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:8080';
const READONLY = !!process.env.READONLY; // READONLY=1: never submit the form (for the live site)
const results = []; let failed = 0;
function ok(name, cond, info = '') { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); if (!cond) failed++; }
const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (READONLY) await ctx.route(/contact-form-7\/v1\/contact-forms\/\d+\/feedback(?!\/schema)/, r => r.request().method() === 'POST' ? r.abort() : r.continue()); // safety net: block any CF7 submission
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + '/rates-availability/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.AMP && document.querySelector('[data-amp-calendar] .amp-day'));
  const CFG = await page.evaluate(() => window.AMP_BK);
  const seasonOf = d => CFG.seasons.find(s => s.months.includes(+d.slice(5, 7)));
  const add = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const cal = '[data-amp-calendar]';

  // helper: navigate the inline calendar until a date is rendered, then click it
  async function clickDay(d, opts = {}) {
    for (let i = 0; i < 24 && !(await page.$(`${cal} .amp-day[data-d="${d}"]`)); i++) await page.click(`${cal} .amp-cal-next`);
    if (opts.key) { await page.focus(`${cal} .amp-day[data-d="${d}"]`); await page.keyboard.press('Enter'); }
    else await page.click(`${cal} .amp-day[data-d="${d}"]`, { force: true }); // force: a real user can still click an aria-disabled day
    await page.waitForTimeout(120);
  }
  async function resetCal() { await page.click(`${cal} .amp-cal-clear`); for (let i = 0; i < 24 && !(await page.$eval(`${cal} .amp-cal-prev`, b => b.disabled)); i++) await page.click(`${cal} .amp-cal-prev`); }
  const store = () => page.evaluate(() => ({ ci: window.AMP.store.ci, co: window.AMP.store.co }));
  const msg = () => page.$eval(`${cal} .amp-cal-msg`, e => e.textContent);

  // 1) Blocked (booked) dates can't be picked
  const booked = await page.evaluate(() => { const t = window.AMP_BK.today; for (let i = 0; i < 120; i++) { const d = new Date(Date.parse(t + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10); if (window.AMP.dayState(d) === 'booked') return d; } });
  ok('found an example booked night in the calendar', !!booked, booked);
  await clickDay(booked);
  let s = await store();
  ok('clicking a booked date does not select it', s.ci === null, `ci=${s.ci}`);
  ok('booked date explains why', /booked/i.test(await msg()), await msg());
  ok('booked day is aria-disabled', await page.$eval(`${cal} .amp-day[data-d="${booked}"]`, b => b.getAttribute('aria-disabled') === 'true'));
  const coOnly = await page.evaluate(() => { const t = window.AMP_BK.today; for (let i = 0; i < 120; i++) { const d = new Date(Date.parse(t + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10); if (window.AMP.dayState(d) === 'co-only') return d; } });
  if (coOnly) { await resetCal(); await clickDay(coOnly); s = await store(); ok('check-out-only day cannot be a check-in', s.ci === null, coOnly + ' · ' + await msg()); }

  // 2) Pick a 3-night (non-summer) stay; minimum nights enforced
  await resetCal();
  const ci = await page.evaluate(() => { const t = window.AMP_BK.today; for (let i = 1; i < 200; i++) { const d = new Date(Date.parse(t + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10); const se = window.AMP.season(d); if (+se.min === 3 && window.AMP.canIn(d) && window.AMP.canOut(d, new Date(Date.parse(d + 'T12:00:00Z') + 3 * 864e5).toISOString().slice(0, 10))) return d; } });
  const se = seasonOf(ci);
  await clickDay(ci, { key: true });
  s = await store(); ok('keyboard (Enter) selects check-in', s.ci === ci, `ci=${s.ci}`);
  await clickDay(add(ci, 1));
  s = await store(); ok(`below-minimum check-out (1 night) rejected (${se.name}: ${se.min}-night min)`, s.co === null && s.ci === ci, await msg());
  ok('minimum-stay message shown', /at least \d+ nights|minimum/i.test(await msg()), await msg());
  ok('too-short check-out is aria-disabled', await page.$eval(`${cal} .amp-day[data-d="${add(ci, 2)}"]`, b => b.getAttribute('aria-disabled') === 'true'));
  await clickDay(add(ci, 3));
  s = await store(); ok('valid 3-night check-out accepted', s.co === add(ci, 3), `${s.ci} → ${s.co}`);

  // 3) Quote updates (sidebar card)
  const exp = Math.round(((3 * se.nightly + CFG.cleaning) * (1 + CFG.tax / 100)) * 100) / 100;
  const total = await page.$eval('.amp-aside [data-amp-total]', e => e.textContent);
  ok('sidebar quote total = nights × rate + cleaning + 6% tax', total === money(exp), `${total} (expected ${money(exp)} = 3×$${se.nightly} + $${CFG.cleaning} + ${CFG.tax}%)`);
  ok('quote shows the "No charge until confirmed" line', await page.$eval('.amp-aside .amp-nocharge', e => /No charge until confirmed/.test(e.textContent)));
  ok('tax rate is 6% (AL 4% + Baldwin Co. 2%)', CFG.tax === 6);
  // guests stepper → quote line updates
  await page.click('.amp-aside .amp-f-g'); await page.click('.amp-aside .amp-g-row[data-k="adults"] .amp-step-up');
  const glabel = await page.$eval('.amp-aside [data-amp-g]', e => e.textContent);
  ok('guest stepper updates the card', glabel === '3 guests', glabel);
  const qg = await page.$eval('.amp-aside .amp-q-total small', e => e.textContent);
  ok('quote reflects guest count', /3 guests/.test(qg), qg);
  // server agrees
  const rest = await page.evaluate(async ([a, b]) => (await fetch(`/wp-json/amp/v1/quote?check_in=${a}&check_out=${b}&guests=3`)).json(), [ci, add(ci, 3)]);
  ok('REST /amp/v1/quote matches the client quote', rest.ok && Math.abs(rest.quote.total - exp) < 0.01, JSON.stringify({ total: rest.quote && rest.quote.total, tax: rest.quote && rest.quote.tax }));
  const restBad = await page.evaluate(async ([a, b]) => { const r = await fetch(`/wp-json/amp/v1/quote?check_in=${a}&check_out=${b}&guests=2`); return { status: r.status, body: await r.json() }; }, [ci, add(ci, 1)]);
  ok('REST rejects a stay below the minimum', restBad.status >= 400, `${restBad.status} ${restBad.body.message || ''}`);
  const restBooked = await page.evaluate(async d => { const r = await fetch(`/wp-json/amp/v1/quote?check_in=${d}&check_out=${new Date(Date.parse(d + 'T12:00:00Z') + 3 * 864e5).toISOString().slice(0, 10)}&guests=2`); return r.status; }, add(booked, -1));
  ok('REST rejects a stay over booked nights', restBooked >= 400, 'HTTP ' + restBooked);

  // 4) Summer 7-night minimum (rules by season)
  const summer = await page.evaluate(() => { const t = window.AMP_BK.today; for (let i = 1; i < 400; i++) { const d = new Date(Date.parse(t + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10); const se = window.AMP.season(d); if (se.key === 'summer' && window.AMP.canIn(d)) return { d, three: window.AMP.canOut(d, new Date(Date.parse(d + 'T12:00:00Z') + 3 * 864e5).toISOString().slice(0, 10)), seven: window.AMP.canOut(d, new Date(Date.parse(d + 'T12:00:00Z') + 7 * 864e5).toISOString().slice(0, 10)), q: window.AMP.quote(d, new Date(Date.parse(d + 'T12:00:00Z') + 3 * 864e5).toISOString().slice(0, 10), 2) }; } });
  ok('summer: 3 nights refused, 7 nights allowed', summer && !summer.three && summer.seven, summer ? `${summer.d} · ${summer.q.error}` : 'no summer date');

  // 5) Request to book → CF7 prefill
  await page.click('.amp-aside [data-amp-cta]');
  await page.waitForURL(/contact-book/); await page.waitForFunction(() => document.querySelector('[data-amp-summary] .amp-q'));
  const f = await page.evaluate(() => { const q = n => document.querySelector(`.wpcf7 form [name="${n}"]`); return { ci: q('check-in').value, co: q('check-out').value, g: q('guests').value, hid: q('quote-summary').value, msg: q('your-message').value, sum: document.querySelector('[data-amp-summary]').textContent }; });
  ok('CF7 check-in prefilled', f.ci === ci, f.ci);
  ok('CF7 check-out prefilled', f.co === add(ci, 3), f.co);
  ok('CF7 guests prefilled', f.g === '3', f.g);
  ok('hidden quote-summary carries the [Example] total', f.hid.includes(money(exp)) && f.hid.includes('[Example]'), f.hid);
  ok('message prefilled with the request', /3 nights/.test(f.msg), f.msg.slice(0, 90) + '…');
  ok('quote summary box shown beside the form', f.sum.includes(money(exp)) && /No charge until confirmed/.test(f.sum));
  ok('URL carries the trip', /check_in=\d{4}-\d\d-\d\d/.test(page.url()), page.url().replace(BASE, ''));

  // 6) Server-side guard: CF7 rejects an invalid stay even if the inputs are edited by hand (submits the form, so skipped in READONLY mode)
  if (!READONLY) {
  await page.fill('.wpcf7 form [name="your-name"]', 'Test Guest'); await page.fill('.wpcf7 form [name="your-email"]', 'test@example.com');
  await page.evaluate(([a, b]) => { const q = n => document.querySelector(`.wpcf7 form [name="${n}"]`); q('check-in').value = a; q('check-out').value = b; }, [add(booked, -1), add(booked, 2)]);
  await page.click('.wpcf7 form [type="submit"]');
  await page.waitForSelector('.wpcf7 form.invalid, .wpcf7 form.sent, .wpcf7 form.failed', { timeout: 15000 }).catch(() => {});
  const st = await page.evaluate(() => ({ cls: document.querySelector('.wpcf7 form').className, tip: [...document.querySelectorAll('.wpcf7-not-valid-tip')].map(e => e.textContent).join(' | ') }));
  ok('CF7 server validation blocks booked/short stays', /invalid/.test(st.cls), st.tip);
  }

  // 7) Mobile: bottom bar + bottom sheet
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await m.newPage(); mp.on('pageerror', e => errors.push('mobile: ' + e.message));
  await mp.goto(BASE + '/the-house/', { waitUntil: 'networkidle' });
  ok('mobile booking bar is visible', await mp.$eval('.amp-mbar', e => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().bottom <= innerHeight + 1));
  ok('sidebar card hidden on mobile', await mp.$eval('.amp-aside', e => getComputedStyle(e).display === 'none'));
  await mp.tap('.amp-mbar-btn'); await mp.waitForSelector('.amp-dialog.is-open');
  ok('bar opens the bottom-sheet calendar (1 month)', await mp.$eval('.amp-dialog .amp-cal-months', e => e.getAttribute('data-n') === '1'));
  await mp.keyboard.press('Escape'); await mp.waitForTimeout(300);
  ok('Escape closes the sheet', await mp.$eval('.amp-dialog', e => e.hidden));
  // hero search bar opens the dialog (desktop home)
  const hp = await ctx.newPage(); await hp.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await hp.waitForFunction(() => window.AMP);
  await hp.click('.amp-search .amp-s-field'); await hp.waitForSelector('.amp-dialog.is-open');
  ok('hero search bar opens the booking dialog (2 months on desktop)', await hp.$eval('.amp-dialog .amp-cal-months', e => e.getAttribute('data-n') === '2'));

  const real = errors.filter(e => !/status of 422/.test(e)); // 422s come from the test's own deliberate bad-quote REST calls
  ok('no console / page errors during the flow', real.length === 0, real.join(' | '));
  console.log(results.join('\n'));
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
