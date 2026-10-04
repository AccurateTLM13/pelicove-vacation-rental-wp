const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files', '--force-color-profile=srgb'] });
  const p = await b.newPage({ viewport: { width: 2400, height: 1350 }, deviceScaleFactor: 1 });
  await p.goto('file://' + __dirname + '/../showcase/src/' + process.argv[2] + '.html');
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  await p.screenshot({ path: __dirname + '/../showcase/' + process.argv[3] });
  await b.close();
})();
