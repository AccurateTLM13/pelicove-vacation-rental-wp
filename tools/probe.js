const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:8080' + (process.argv[2]||'/'), { waitUntil: 'networkidle' });
  console.log(await p.evaluate(new Function(process.argv[3])));
  await b.close();
})();
