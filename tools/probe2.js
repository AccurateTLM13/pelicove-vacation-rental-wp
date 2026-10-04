const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  const el = p.locator('img.wp-image-15').first();
  await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
  console.log(await el.evaluate(i => { const c = getComputedStyle(i); return JSON.stringify({complete:i.complete,nw:i.naturalWidth,cur:i.currentSrc.split('/').pop(),vis:c.visibility,op:c.opacity,disp:c.display,cv:c.contentVisibility,h:i.height,w:i.width, sizes:i.sizes, pos:c.position}); }));
  await p.screenshot({ path: '/tmp/vp.png' });
  await b.close();
})();
