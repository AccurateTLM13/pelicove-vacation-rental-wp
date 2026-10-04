const { chromium } = require('playwright-core');
(async () => {
  const qs = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const p = await b.newPage({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', viewport: { width: 1400, height: 1000 } });
  const out = {};
  for (const q of qs) {
    await p.goto('https://unsplash.com/s/photos/' + encodeURIComponent(q) + '?license=free', { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await p.waitForSelector('figure img[src*="images.unsplash.com/photo-"]', { timeout: 40000 }); } catch (e) { out[q] = 'ERR ' + (await p.title()); continue; }
    await p.mouse.wheel(0, 3000); await p.waitForTimeout(1500);
    out[q] = await p.$$eval('figure', fs => fs.map(f => {
      const img = f.querySelector('img[src*="images.unsplash.com/photo-"]');
      const a = f.querySelector('a[href^="/photos/"]');
      const u = f.querySelector('a[href^="/@"]');
      if (!img || !a) return null;
      return { id: (img.src.match(/photo-[A-Za-z0-9-]+/)||[])[0], page: 'https://unsplash.com' + a.getAttribute('href'), alt: img.alt, by: u ? u.textContent.trim() : '', byurl: u ? 'https://unsplash.com' + u.getAttribute('href') : '' };
    }).filter(Boolean));
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
