const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const user = process.env.WP_ADMIN_USER || 'admin'; const pass = process.env.WP_ADMIN_PASS; if (!pass) throw new Error('set WP_ADMIN_PASS');
  const B = 'http://127.0.0.1:8090';
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  await p.goto(B + '/wp-login.php'); await p.fill('#user_login', user); await p.fill('#user_pass', pass); await p.click('#wp-submit');
  await p.waitForURL(/wp-admin/, { timeout: 60000 }); await p.waitForTimeout(3000);
  await p.goto(B + '/wp-admin/admin.php?page=ai1wm_import', { waitUntil: 'networkidle' });
  const lim = (await p.textContent('body')).match(/Maximum upload file size:[^.]*/i); console.log('limit:', lim && lim[0]);
  await p.setInputFiles('input[type=file]', process.env.WPRESS_FILE);
  const t0 = Date.now(); let proceeded = false;
  for (;;) { await p.waitForTimeout(3000); const t = (await p.textContent('body')).replace(/\s+/g, ' ');
    if (!proceeded && await p.locator('button:visible', { hasText: /Proceed/i }).count()) { await p.locator('button:visible', { hasText: /Proceed/i }).first().click(); proceeded = true; console.log('proceed clicked'); }
    if (/imported successfully|Your site has been imported/i.test(t)) { console.log('IMPORT OK', Math.round((Date.now()-t0)/1000), 's'); break; }
    if (/Unable|error|exceeds/i.test(t) && Date.now()-t0 > 15000) { await p.screenshot({ path: '/tmp/aioi-err.png' }); }
    if (Date.now()-t0 > 900000) { console.log('timeout'); break; } }
  await p.screenshot({ path: '/tmp/aioi.png' });
  await b.close();
})();
