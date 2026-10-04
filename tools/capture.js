const { chromium } = require('playwright-core');
const OUT = __dirname + '/../showcase/src/';
async function cap(b, name, vp, dsf, mobile) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dsf, isMobile: !!mobile, hasTouch: !!mobile });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: '#wpadminbar,.qm-no-js,#query-monitor-main,.cookie-notice,.cky-consent-container{display:none!important} html{margin-top:0!important} *{animation-play-state:paused}' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => [...document.querySelectorAll('.sbh-hero img, header img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 20000 });
  // load weather (below fold) so it's ready, then return to top
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
  await p.waitForFunction(() => !document.querySelector('[data-sbh-weather]') || document.querySelector('.sbh-weather.is-loaded, .sbh-weather-error'), null, { timeout: 20000 }).catch(() => console.log('weather timeout'));
  await p.evaluate(() => document.querySelectorAll('.sbh-reveal, .sbh-card, .sbh-review, .sbh-section-head, .wp-block-column').forEach(e => e.classList.add('is-visible')));
  // v3 cinematic hero: wait for the summer clip to be playing, then freeze a frame
  await p.evaluate(() => { localStorage.setItem('amp-season', 'summer'); });
  await p.waitForFunction(() => { const v = document.querySelector('video[data-season-video="summer"]'); return v && v.classList.contains('is-playing') && v.currentTime > 2; }, null, { timeout: 30000 }).catch(() => console.log('video timeout'));
  await p.evaluate(() => document.querySelectorAll('video').forEach(v => v.pause()));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + name + '.png' });
  // also a weather-band capture for the tablet view
  console.log(name, 'ok', await p.evaluate(() => !!document.querySelector('.sbh-weather.is-loaded')));
  await ctx.close();
}
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required'] });
  await cap(b, 'home-desktop-1440x900@2x', { width: 1440, height: 900 }, 2);
  await cap(b, 'home-mobile-390x844@3x', { width: 390, height: 844 }, 3, true);
  await cap(b, 'home-tablet-820x1180@2x', { width: 820, height: 1180 }, 2, true);
  await b.close();
})();
