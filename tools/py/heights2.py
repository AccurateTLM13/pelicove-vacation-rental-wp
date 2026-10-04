from playwright.sync_api import sync_playwright
import json
JS="""(()=>{const i=document.querySelector('.amp-hero-inner');const cs=getComputedStyle(i);return {inner:[Math.round(i.getBoundingClientRect().top),Math.round(i.getBoundingClientRect().height),cs.paddingTop,cs.paddingBottom], kids:[...i.children].map(c=>[c.className.slice(0,18),Math.round(c.getBoundingClientRect().height)]), hdr: Math.round(document.querySelector('header,.sbh-header-wrap').getBoundingClientRect().height), hero:[Math.round(document.querySelector('.amp-hero').getBoundingClientRect().top),Math.round(document.querySelector('.amp-hero').getBoundingClientRect().height)], cls: document.documentElement.className}})()"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    for js in (False, True):
        ctx = b.new_context(viewport={'width': 412, 'height': 823}, device_scale_factor=1.75, is_mobile=True, has_touch=True, java_script_enabled=js)
        pg = ctx.new_page(); pg.goto('http://localhost:8080/', wait_until='networkidle'); pg.wait_for_timeout(1500)
        print('JS' if js else 'noJS', json.dumps(pg.evaluate(JS)))
    b.close()
