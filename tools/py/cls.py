import sys, json
from playwright.sync_api import sync_playwright
url = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = b.new_context(viewport={'width': 412, 'height': 823}, device_scale_factor=1.75, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (Linux; Android 11; moto g power) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
    pg = ctx.new_page()
    pg.add_init_script("""window.__ls=[];new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__ls.push({v:e.value,t:Math.round(e.startTime),src:(e.sources||[]).map(s=>({n:(s.node&&s.node.className)||String(s.node),prev:[s.previousRect.y,s.previousRect.height],cur:[s.currentRect.y,s.currentRect.height]}))})}}).observe({type:'layout-shift',buffered:true});""")
    pg.goto(url, wait_until='networkidle'); pg.wait_for_timeout(3000)
    print(json.dumps(pg.evaluate('window.__ls'), indent=1))
    b.close()
