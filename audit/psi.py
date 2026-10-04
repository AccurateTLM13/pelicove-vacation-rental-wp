import sys, json, time, urllib.request, urllib.parse, os
out = sys.argv[1]; base = sys.argv[2] if len(sys.argv) > 2 else 'https://beach.johnpaulpannell.com'
pages = {'home':'/','the-house':'/the-house/','gallery':'/gallery/','rates':'/rates-availability/','contact':'/contact-book/'}
if len(sys.argv) > 3: pages = {k:v for k,v in pages.items() if k in sys.argv[3].split(',')}
os.makedirs(out, exist_ok=True)
for name, path in pages.items():
    for strat in ('mobile', 'desktop'):
        fn = f'{out}/psi-{name}-{strat}.json'
        if os.path.exists(fn) and os.path.getsize(fn) > 10000: continue
        q = urllib.parse.urlencode([('url', base + path), ('strategy', strat)] + [('category', c) for c in ('performance','accessibility','best-practices','seo')])
        for attempt in range(7):
            try:
                with urllib.request.urlopen('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + q, timeout=180) as r:
                    open(fn, 'wb').write(r.read()); print('ok', name, strat, flush=True); break
            except Exception as e:
                body = getattr(e, 'read', lambda: b'')()[:300]
                w = min(300, 20 * 2 ** attempt); print('err', name, strat, e, body, 'sleep', w, flush=True); time.sleep(w)
