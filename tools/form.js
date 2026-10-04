const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:8080/contact-book/', { waitUntil: 'networkidle' });
  await p.fill('input[name=your-name]', 'Test Guest');
  await p.fill('input[name=your-email]', 'test@example.com');
  await p.fill('input[name=check-in]', '2026-11-10');
  await p.fill('input[name=check-out]', '2026-11-15');
  await p.selectOption('select[name=guests]', '4');
  await p.fill('textarea[name=your-message]', 'Automated test inquiry from local verification.');
  await p.click('input[type=submit]');
  await p.waitForSelector('.wpcf7-response-output:not(:empty)', { timeout: 15000 });
  console.log(await p.textContent('.wpcf7-response-output'));
  await b.close();
})();
