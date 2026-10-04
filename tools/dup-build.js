// Drives Duplicator Lite in wp-admin: New Backup -> Scan -> Create Backup, waits for completion.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, storageState: '/tmp/wp-state.json' }); const p = await c.newPage();
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8080/wp-admin/admin.php?page=duplicator', { waitUntil: 'networkidle' });
  await p.click('text=Add New'); await p.waitForLoadState('networkidle');
  await p.click('text=Next ▶'); await p.waitForLoadState('networkidle');
  const btn = p.locator('text=Create Backup ▶'); await btn.waitFor({ state: 'visible', timeout: 300000 });
  await btn.click(); console.log('build started');
  const t0 = Date.now();
  for (;;) {
    await p.waitForTimeout(5000);
    const txt = (await p.textContent('body')).replace(/\s+/g, ' ');
    if (/Backup Completed|Build Complete|Download Both Files|One-Click Download/i.test(txt)) { console.log('done in', Math.round((Date.now() - t0) / 1000), 's'); break; }
    if (/Build Interrupt|error/i.test(txt) && /failed|interrupt/i.test(txt)) { console.log('ERROR', txt.slice(0, 600)); break; }
    if (Date.now() - t0 > 20 * 60000) { console.log('timeout'); break; }
  }
  await p.screenshot({ path: '/tmp/dup4.png', fullPage: true });
  await b.close();
})();
