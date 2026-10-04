// Logs into wp-admin (credentials from env WP_ADMIN_USER / WP_ADMIN_PASS, never printed) and saves the session to /tmp/wp-state.json
const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const user = process.env.WP_ADMIN_USER || 'admin'; const pass = process.env.WP_ADMIN_PASS; if (!pass) throw new Error('set WP_ADMIN_PASS');
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 } }); const p = await c.newPage();
  await p.goto('http://localhost:8080/wp-login.php');
  await p.fill('#user_login', user); await p.fill('#user_pass', pass); await p.click('#wp-submit');
  await p.waitForURL(/wp-admin/, { timeout: 60000 });
  await c.storageState({ path: '/tmp/wp-state.json' }); console.log('logged in');
  const url = process.argv[2]; if (url) { await p.goto(url, { waitUntil: 'networkidle' }); await p.screenshot({ path: process.argv[3] || '/tmp/admin.png', fullPage: true }); console.log(await p.title()); }
  await b.close();
})();
