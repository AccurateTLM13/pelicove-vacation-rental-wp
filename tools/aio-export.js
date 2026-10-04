const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, storageState: '/tmp/wp-state.json', acceptDownloads: true }); const p = await c.newPage();
  await p.goto('http://localhost:8080/wp-admin/admin.php?page=ai1wm_export', { waitUntil: 'networkidle' });
  await p.screenshot({ path: '/tmp/aio1.png', fullPage: true });
  await p.getByText('Export site to', { exact: false }).first().click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: '/tmp/aio1b.png' }); await p.locator('#ai1wm-export-file').first().click();
  const t0 = Date.now();
  for (;;) { await p.waitForTimeout(4000); const t = (await p.textContent('body')).replace(/\s+/g, ' ');
    const m = t.match(/Download [^ ]+.{0,40}/); if (await p.locator('.ai1wm-modal-container a.ai1wm-button-green, a:has-text("Download")').count()) { console.log('ready', Math.round((Date.now()-t0)/1000)); break; }
    if (/error|unable/i.test(t.slice(-3000)) && Date.now()-t0 > 20000) { console.log('maybe error:', t.slice(-800)); }
    if (Date.now() - t0 > 900000) { console.log('timeout'); break; } }
  await p.screenshot({ path: '/tmp/aio2.png', fullPage: true });
  await b.close();
})();
