const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, storageState: '/tmp/wp-state.json' }); const p = await c.newPage();
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8080/wp-admin/admin.php?page=duplicator', { waitUntil: 'networkidle' });
  await p.click('text=Add New'); await p.waitForLoadState('networkidle');
  await p.fill('input[name="package-name-format"], #package-name-format', 'all-mohs-paradise-demo').catch(e => console.log('name field', e.message.slice(0, 80)));
  await p.click('text=Next ▶').catch(async () => { await p.click('#dup-pack-next, button:has-text("Next")'); });
  await p.waitForLoadState('networkidle');
  // scan step
  for (let i = 0; i < 60; i++) { const t = await p.textContent('body'); if (/Scan Complete|Build|Overview|Notice|Good/i.test(t) && !/Scanning Site/i.test(t)) break; await p.waitForTimeout(2000); }
  await p.waitForTimeout(2000);
  await p.screenshot({ path: '/tmp/dup3.png', fullPage: true }); console.log(p.url());
  await b.close();
})();
