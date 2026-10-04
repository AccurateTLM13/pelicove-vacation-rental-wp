# Theme 4.1.1: home-page mobile LCP follow-up (on top of the deployed perf-seo / 4.1.0 patch)

Site root: `<site-root>/`. The paths in the zip are relative to it.
This patch contains no database changes and no plugin changes.

## Why
After the 4.1.0 deploy, the median live mobile score for the home page was 90 (runs of 89, 90 and 98). Every other page scored 97–100.

The cause was the "A day at" story section's five mobile photos (about 270 KB). They sit 2,400–3,700 px down the page, but on slower connections Chrome widens its lazy-load margin and starts them during page load. They then compete with the hero, and Lighthouse adds them to the LCP chain.

The "binder" photo also had no srcset or width/height, so phones downloaded the 1024 px version (85 KB) for a 344 px slot.

## What changes (4 files)
| Path | Change |
|---|---|
| `wp-content/themes/sample-beach-house/style.css` | Version 4.1.1 |
| `wp-content/themes/sample-beach-house/inc/perf.php` | Hand-written `<img>` tags pointing at an upload now get srcset/sizes plus width/height (class `sbh-sized`). |
| `wp-content/themes/sample-beach-house/assets/css/v3.css` and `v3.min.css` | On phones (≤900 px), the story section uses `content-visibility:auto` with `contain-intrinsic-size:auto 3200px`, so its images load only when it nears the viewport. Also adds `img.sbh-sized{height:auto}`. |

Local results: home mobile Lighthouse went from 91–92 to 97 on the box, measured with a normal-sized system font set (see note). The other pages are unchanged at 98–100. Booking test: 33/33. CLS stays at 0.001.

## Deploy (2 steps)
1. In File Manager, upload `perf-seo-4.1.1.zip` to `<site-root>/`, then **Extract** it there, overwriting existing files. Delete the zip afterwards.
2. **Clear the page cache.** The theme CSS is inlined in the cached HTML, so this step is required.
   - In wp-admin, use the admin-bar **Clear site cache** button (Cache Enabler).
   - Or, in File Manager, delete the folder `wp-content/cache/cache-enabler/`.

Check: `curl -s -H 'Accept: text/html' https://beach.johnpaulpannell.com/ | grep -c 'amp-demo-binder-768x512.jpg 768w'` should print `1`, and the page should contain `content-visibility`.

## Rollback
Extract `rollback-to-4.1.0.zip` at the site root (it restores the same 4 files), then clear the cache as in step 2.

## Note on the box measurements
The audit box has about 3,500 system fonts installed. Each font-family lookup in Chrome then takes about 20 ms, which inflated the home page's first layout to about 220 ms (about 0.9 s under Lighthouse's 4× CPU throttling).

With a normal font set (`FONTCONFIG_FILE` limited to Liberation and DejaVu), the same layout takes about 28 ms. PageSpeed Insights' servers and real phones are not affected by this.
