from playwright.sync_api import sync_playwright
import json
JS="""(()=>{const i=document.querySelector('.amp-hero-inner');return {inner:[Math.round(i.getBoundingClientRect().top),Math.round(i.getBoundingClientRect().height)], kids:[...i.children].map(c=>[c.className.slice(0,18),Math.round(c.getBoundingClientRect().height)]), hero:Math.round(document.querySelector('.amp-hero').getBoundingClientRect().height)}})()"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    for blk in ('none','booking.js','experience.js','site.js','lenis'):
        ctx = b.new_context(viewport={'width': 412, 'height': 823}, device_scale_factor=1.75, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        if blk!='none': pg.route(f'**/*{blk}*', lambda r: r.abort())
        pg.goto('http://localhost:8080/', wait_until='networkidle'); pg.wait_for_timeout(1000)
        print(blk, json.dumps(pg.evaluate(JS)))
    b.close()
