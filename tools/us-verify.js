const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const P = JSON.parse(fs.readFileSync('/tmp/picked.json'));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const p = await b.newPage({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });
  for (const [k, x] of Object.entries(P)) {
    try {
      await p.goto(x.page, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForFunction(() => document.title && !/not a bot|Oh noes/i.test(document.title), null, { timeout: 40000 });
      await p.waitForTimeout(800);
      const info = await p.evaluate(() => {
        const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent).join('\n');
        const body = document.body.innerText;
        return { title: document.title, ld: ld.slice(0, 1500), plus: /Unsplash\+/.test(body.slice(0, 4000)), lic: (body.match(/Free to use under the Unsplash License|Unsplash License/)||[''])[0] };
      });
      x.title = info.title; x.plus = info.plus; x.lic = info.lic;
      try { const j = JSON.parse(info.ld.split('\n')[0]); x.ldj = j; } catch (e) { x.ldraw = info.ld.slice(0, 600); }
    } catch (e) { x.err = String(e).slice(0, 200); }
    console.error(k, x.title, x.plus, x.lic);
  }
  fs.writeFileSync('/tmp/verified.json', JSON.stringify(P, null, 1));
  await b.close();
})();
