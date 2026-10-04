from playwright.sync_api import sync_playwright
import sys
url=sys.argv[1]; w=int(sys.argv[2]) if len(sys.argv)>2 else 412
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx=b.new_context(viewport={'width':w,'height':823}, device_scale_factor=1.75 if w<800 else 1, is_mobile=w<800, has_touch=w<800)
    pg=ctx.new_page(); out=[]
    pg.on('request', lambda r: out.append((r.resource_type, r.url.split('/')[-1][:70])))
    pg.goto(url, wait_until='load'); pg.wait_for_timeout(500)
    for t,u in out:
        if t in ('image','media','font','script','stylesheet'): print(t,u)
    b.close()
