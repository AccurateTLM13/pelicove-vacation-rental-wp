import json,glob,statistics as st,sys,os
d=sys.argv[1]; names=['home','the-house','gallery','rates','contact']
out={}
for n in names:
  for s in ['mobile','desktop']:
    runs=[]
    for f in sorted(glob.glob(f'{d}/run*/lh-{n}-{s}.json')):
      j=json.load(open(f)); c=j['categories']; a=j['audits']
      runs.append(dict(P=round(c['performance']['score']*100),A=round(c['accessibility']['score']*100),BP=round(c['best-practices']['score']*100),SEO=round(c['seo']['score']*100),
        FCP=a['first-contentful-paint']['numericValue']/1000,LCP=a['largest-contentful-paint']['numericValue']/1000,TBT=a['total-blocking-time']['numericValue'],CLS=a['cumulative-layout-shift']['numericValue'],SI=a['speed-index']['numericValue']/1000,TTFB=a['server-response-time']['numericValue']))
    m={k:st.median([r[k] for r in runs]) for k in runs[0]}; m['runs']=[r['P'] for r in runs]; out[f'{n}-{s}']=m
    print(f"{n:10} {s:7} P{m['P']:>4} A{m['A']:>4} BP{m['BP']:>4} SEO{m['SEO']:>4} | FCP {m['FCP']:.1f} LCP {m['LCP']:.1f} TBT {m['TBT']:.0f} CLS {m['CLS']:.3f} SI {m['SI']:.1f} TTFB {m['TTFB']:.0f}ms | perf runs {m['runs']}")
json.dump(out,open(f'{d}/median.json','w'),indent=1)
