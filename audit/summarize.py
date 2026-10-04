import json, glob, sys, os
d = sys.argv[1]; pre = sys.argv[2] if len(sys.argv) > 2 else 'lh'
rows = []
for f in sorted(glob.glob(f'{d}/{pre}-*.json')):
    j = json.load(open(f)); lr = j.get('lighthouseResult', j)
    c = lr['categories']; a = lr['audits']
    g = lambda k: a.get(k, {}).get('displayValue', '-')
    name = os.path.basename(f)[len(pre)+1:-5]
    sc = [round((c[k]['score'] or 0) * 100) for k in ('performance','accessibility','best-practices','seo')]
    print(f"{name:20} P{sc[0]:>3} A{sc[1]:>3} BP{sc[2]:>3} SEO{sc[3]:>3} | FCP {g('first-contentful-paint'):>7} LCP {g('largest-contentful-paint'):>7} TBT {g('total-blocking-time'):>7} CLS {g('cumulative-layout-shift'):>6} SI {g('speed-index'):>7}")
    if '-v' in sys.argv:
        fails = [(k, v.get('title'), v.get('displayValue','')) for k, v in a.items() if v.get('score') is not None and v['score'] < 0.9 and v.get('scoreDisplayMode') in ('binary','numeric','metricSavings')]
        for k,t,dv in fails: print('     -', k, '|', t, '|', dv)
        lcp = a.get('largest-contentful-paint-element', {}).get('details', {})
        try: print('     LCP el:', lcp['items'][0]['items'][0]['node']['snippet'][:160])
        except Exception: pass
        le = j.get('loadingExperience') or {}
        if le.get('metrics'): print('     CrUX:', {k: v.get('percentile') for k, v in le['metrics'].items()}, le.get('overall_category'))
