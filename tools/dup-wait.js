const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, storageState: '/tmp/wp-state.json' }); const p = await c.newPage();
  await p.goto('http://localhost:8080/wp-admin/admin.php?page=duplicator', { waitUntil: 'networkidle' });
  const t0 = Date.now();
  for (;;) {
    await p.waitForTimeout(10000);
    const row = (await p.locator('table').first().innerText()).replace(/\s+/g, ' ');
    console.log(Math.round((Date.now() - t0) / 1000), row.slice(0, 200));
    if (!/Building|Creating|Initializing/i.test(row)) break;
    if (Date.now() - t0 > 25 * 60000) break;
  }
  await p.screenshot({ path: '/tmp/dup5.png', fullPage: true });
  await b.close();
})();
