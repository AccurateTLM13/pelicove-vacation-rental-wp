from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    for block in (True, False):
        ctx = b.new_context(viewport={'width': 412, 'height': 823}, device_scale_factor=1.75, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        if block: pg.route('**/*.woff2', lambda r: r.abort())
        pg.goto('http://localhost:8080/', wait_until='networkidle'); pg.wait_for_timeout(1500)
        print('fonts blocked' if block else 'fonts loaded', json.dumps(pg.evaluate("""[...document.querySelector('.amp-hero-inner').children].map(c=>[c.className.slice(0,25), Math.round(c.getBoundingClientRect().height), getComputedStyle(c).display])""")))
        ctx.close()
    b.close()
