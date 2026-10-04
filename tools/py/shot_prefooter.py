import sys
from playwright.sync_api import sync_playwright
base, path, w, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_page(viewport={'width': w, 'height': 900})
    pg.goto(base + path, wait_until='networkidle', timeout=60000)
    pg.add_style_tag(content='*{transition:none!important;animation:none!important} .reveal,[data-reveal]{opacity:1!important;transform:none!important}')
    el = pg.locator('.sbh-cta')
    el.scroll_into_view_if_needed(); pg.wait_for_timeout(1500)
    top = pg.evaluate("document.querySelector('.sbh-cta').getBoundingClientRect().top + scrollY")
    h = pg.evaluate("document.querySelector('.sbh-cta').offsetHeight")
    pg.evaluate(f"scrollTo(0,{top-620})"); pg.wait_for_timeout(1200)
    pg.screenshot(path=out, clip={'x':0,'y':top-620,'width':w,'height':h+780}, full_page=True)
    b.close()
