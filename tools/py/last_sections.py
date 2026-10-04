import sys, json
from playwright.sync_api import sync_playwright
base = sys.argv[1]; widths=[int(x) for x in sys.argv[2].split(',')]
paths = ['/','/the-house/','/gallery/','/amenities/','/rates-availability/','/location-area-guide/','/reviews/','/contact-book/']
JS = r"""() => {
 const r = e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; };
 const pc = document.querySelector('.wp-block-post-content');
 const kids = [...pc.children].filter(e => e.offsetHeight > 0);
 // content extents: union of descendants' text-bearing blocks at depth<=3
 const ext = el => { let L=1e9,R=-1e9; el.querySelectorAll('h1,h2,h3,p,ul,ol,.wp-block-buttons,.wp-block-columns,figure,table,form,.wp-block-group.sbh-section-head').forEach(c=>{ if(c.closest('.amp-aside')) return; const b=c.getBoundingClientRect(); if(b.width>0 && b.height>0){L=Math.min(L,b.left);R=Math.max(R,b.right);} }); return [Math.round(L),Math.round(R)]; };
 return kids.slice(-3).map(k => ({cls: k.className.replace(/wp-container\S+|wp-block-group-is\S+|is-layout\S+/g,'').replace(/\s+/g,' ').trim().slice(0,90), box: r(k), content: ext(k), ml: getComputedStyle(k).marginLeft, pl: getComputedStyle(k).paddingLeft}));
}"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    for w in widths:
        pg = b.new_page(viewport={'width': w, 'height': 900})
        for path in paths:
            pg.goto(base + path, wait_until='domcontentloaded', timeout=60000); pg.wait_for_timeout(800)
            print(w, path); [print('   ', json.dumps(x)) for x in pg.evaluate(JS)]
        pg.close()
    b.close()
