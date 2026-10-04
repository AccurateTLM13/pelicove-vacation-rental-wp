from playwright.sync_api import sync_playwright
import sys, json
url, sel = sys.argv[1], sys.argv[2]
props = sys.argv[3].split(',')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=b.new_page(viewport={'width':1440,'height':900}); pg.goto(url, wait_until='networkidle')
    print(json.dumps(pg.evaluate("([s,ps])=>[...document.querySelectorAll(s)].slice(0,3).map(e=>{const c=getComputedStyle(e);const r=e.getBoundingClientRect();return [e.tagName, Math.round(r.top), Math.round(r.height), ...ps.map(p=>c[p])]})", [sel, props])))
    b.close()
