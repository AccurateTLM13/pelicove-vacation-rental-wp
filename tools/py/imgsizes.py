from playwright.sync_api import sync_playwright
import json, sys
url=sys.argv[1]
JS="""async()=>{for(let y=0;y<document.body.scrollHeight;y+=500){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));} await new Promise(r=>setTimeout(r,800));
return [...document.images].filter(i=>i.currentSrc&&i.getBoundingClientRect().width>0).map(i=>{const anc=i.closest('[class*=amp-],[class*=sbh-],figure');return [Math.round(i.getBoundingClientRect().width), i.naturalWidth, (i.currentSrc.split('/').pop()).slice(0,40), (i.parentElement.closest('[class]')||{}).className.slice(0,50), i.getAttribute('sizes')]})}"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    for vp,dpr in [((412,823),1.75),((1350,940),1)]:
        pg=b.new_page(viewport={'width':vp[0],'height':vp[1]},device_scale_factor=dpr); pg.goto(url,wait_until='networkidle')
        rows=pg.evaluate(JS); print('==',vp,dpr)
        for r in rows:
            flag='  OVER' if r[1] > r[0]*dpr*1.5 else ''
            print('  ',r[0],r[1],r[2],'|',r[3],'|',r[4],flag)
        pg.close()
    b.close()
