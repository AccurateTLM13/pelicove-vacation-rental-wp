from playwright.sync_api import sync_playwright
import json, sys
url = sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8080/'
INIT = """window.__tr=[];let last='';(function f(){try{const q=s=>document.querySelector(s);const els={hdr:'.sbh-header-wrap',hero:'.amp-hero',inner:'.amp-hero-inner',title:'.amp-hero-title',search:'.amp-search',rate:'.amp-hero-rate',top:'.amp-hero-top',pitch:'.amp-hero-pitch'};const o={};for(const k in els){const e=q(els[k]);if(e){const r=e.getBoundingClientRect();o[k]=[Math.round(r.top),Math.round(r.height)];}}o.cls=document.documentElement.className;o.fonts=document.fonts.status;const s=JSON.stringify(o);if(s!==last){last=s;window.__tr.push([Math.round(performance.now()),o]);}}catch(e){}if(performance.now()<6000)requestAnimationFrame(f);})();"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = b.new_context(viewport={'width': 412, 'height': 823}, device_scale_factor=1.75, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.goto(url, wait_until='networkidle'); pg.wait_for_timeout(2500)
    for t,o in pg.evaluate('window.__tr'): print(t, json.dumps(o))
    b.close()
