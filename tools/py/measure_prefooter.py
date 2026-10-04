import sys, json
from playwright.sync_api import sync_playwright
base = sys.argv[1]; paths = sys.argv[2].split(','); widths = [int(w) for w in sys.argv[3].split(',')]
shot = sys.argv[4] if len(sys.argv) > 4 else None
JS = r"""() => {
 const r = e => { if(!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), Math.round(b.width)]; };
 const cta = document.querySelector('.sbh-cta'); if(!cta) return {cta:null};
 const inner = cta.querySelector('.wp-block-cover__inner-container');
 const kids = [...inner.children].map(c => [c.tagName, r(c)]);
 const prev = cta.previousElementSibling;
 const pick = el => { const firsts = el ? [...el.querySelectorAll(':scope > *')] : []; return firsts.slice(0,3).map(c => [c.tagName + '.' + (c.className||'').split(' ').slice(0,2).join('.'), r(c)]); };
 const par = cta.parentElement; const cs = getComputedStyle(cta), ps = getComputedStyle(par);
 const foot = document.querySelector('footer .wp-block-columns');
 return { vw: innerWidth, docW: document.documentElement.clientWidth, cta: r(cta), ctaMargin: [cs.marginLeft, cs.marginRight], ctaPad:[cs.paddingLeft, cs.paddingRight],
   inner: r(inner), innerPad: [getComputedStyle(inner).paddingLeft, getComputedStyle(inner).paddingRight], kids,
   parent: [par.tagName, par.className.slice(0,140), r(par), ps.paddingLeft, ps.paddingRight],
   prev: prev ? [prev.tagName + '.' + prev.className.slice(0,80), r(prev)] : null, prevKids: pick(prev), footerCols: r(foot) };
}"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    for w in widths:
        pg = b.new_page(viewport={'width': w, 'height': 900})
        for path in paths:
            pg.goto(base + path, wait_until='networkidle', timeout=60000)
            print(json.dumps({'w': w, 'path': path, **pg.evaluate(JS)}))
            if shot and w == widths[0] and path == paths[0]:
                el = pg.locator('.sbh-cta'); el.scroll_into_view_if_needed(); pg.wait_for_timeout(800)
                bb = el.bounding_box(); y = pg.evaluate('scrollY')
                pg.screenshot(path=shot, clip={'x':0,'y':max(0,bb['y']-250),'width':w,'height':bb['height']+450}, full_page=False) if False else None
        pg.close()
    b.close()
