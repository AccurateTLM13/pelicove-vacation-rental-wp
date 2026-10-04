const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  // DB credentials for the throwaway test-install database come from the environment.
  const dbpass = process.env.TEST_DB_PASS; if (!dbpass) throw new Error('set TEST_DB_PASS');
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:8090/installer.php', { waitUntil: 'networkidle' });
  await p.fill('#s1-input-form input[name="dbhost"], input[name="dbhost"]', '127.0.0.1:3307');
  await p.fill('input[name="dbname"]', 'duptest');
  await p.fill('input[name="dbuser"]', process.env.TEST_DB_USER || 'wp');
  await p.fill('input[name="dbpass"]', dbpass);
  await p.locator('button:visible', { hasText: 'Validate' }).first().click(); await p.waitForTimeout(8000);
  await p.screenshot({ path: '/tmp/di2.png', fullPage: true });
  const chk = p.locator('input[type=checkbox][name*="accept"], #accept-warnings'); if (await chk.count()) await chk.first().check().catch(() => {});
  await p.screenshot({ path: '/tmp/di2b.png', fullPage: true }); const next = p.locator('button:visible', { hasText: 'Next' }); console.log('next buttons', await next.count()); await next.first().click();
  await p.waitForTimeout(3000);
  const ok = p.locator('button:has-text("OK"), button:has-text("Yes")'); if (await ok.count()) await ok.first().click().catch(() => {});
  const t0 = Date.now();
  for (;;) { await p.waitForTimeout(5000); const t = (await p.textContent('body')).replace(/\s+/g, ' ');
    if (/Step 2 of 2|Admin Login|Installation Complete|Final Step/i.test(t)) { console.log('reached final step'); break; }
    if (Date.now() - t0 > 900000) { console.log('timeout'); break; } }
  await p.waitForTimeout(3000);
  await p.screenshot({ path: '/tmp/di3.png', fullPage: true });
  console.log((await p.textContent('body')).replace(/\s+/g, ' ').slice(0, 800));
  await b.close();
})();
