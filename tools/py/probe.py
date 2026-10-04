from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=b.new_page(viewport={'width':1440,'height':900})
    pg.goto('http://localhost:8080/', wait_until='networkidle')
    print(pg.evaluate("""()=>{const h=document.querySelector('.sbh-cta h2'); h.scrollIntoView({block:'center'}); const b=h.getBoundingClientRect(); const x=(b.left+b.right)/2, y=b.bottom+5;
      return document.elementsFromPoint(x,y).slice(0,6).map(e=>e.tagName+'.'+e.className+' #'+e.id).join(' | ') + ' || li strong: ' + [...document.querySelectorAll('.amp-trust li strong')].map(s=>s.parentElement.tagName+':'+s.textContent).join(', ');}"""))
    b.close()
