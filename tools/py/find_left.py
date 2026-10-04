import sys, json
from playwright.sync_api import sync_playwright
base=sys.argv[1]; w=int(sys.argv[2]); paths=sys.argv[3].split(',')
JS = r"""() => { const pc=document.querySelector('.wp-block-post-content'); const out=[];
 [...pc.children].forEach((sec,i)=>{ const pl=parseFloat(getComputedStyle(sec).paddingLeft); const sb=sec.getBoundingClientRect();
   [...sec.children].forEach(c=>{ const b=c.getBoundingClientRect(); if(!b.width) return; const cs=getComputedStyle(c);
     const L=b.left-sb.left-pl, R=sb.right-pl-b.right; if (Math.abs(L-R)>4 && !c.matches('.alignfull,.amp-aside')) out.push({sec:i, secCls: sec.className.split(' ').filter(x=>!/wp-container|is-layout|layout-/.test(x)).join(' ').slice(0,80), el: c.tagName+'.'+c.className.split(' ').slice(0,4).join('.'), box:[Math.round(b.left),Math.round(b.right)], gapL:Math.round(L), gapR:Math.round(R), ml:cs.marginLeft, mr:cs.marginRight, maxw:cs.maxWidth}); }); });
 return out; }"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=b.new_page(viewport={'width':w,'height':900})
    for path in paths:
        pg.goto(base+path, wait_until='domcontentloaded'); pg.wait_for_timeout(800); print(path); [print('  ',json.dumps(x)) for x in pg.evaluate(JS)]
    b.close()
