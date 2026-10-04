# Theme 4.1.2: hero paints on the first frame (on top of the deployed 4.1.1 patch)

Site root: `<site-root>/`. The paths in the zip are relative to it.
No plugin files change. There is one automatic settings change: the first time an admin opens wp-admin after deploy, the mu-plugin turns on Cache Enabler's "Pre-compress cached pages" option (see the table).

## Why
On mobile, the home page hero (the LCP image) appeared about 2.5 s after the page started loading, even though the image itself was small and preloaded. Lighthouse measured mobile LCP at 3.3 s on the box with a full system font set (score 92), or 2.5 s with a minimal font set (score 97).

Root cause:
1. **The font preloads held back the first frame.** The theme preloaded the two text fonts (Instrument Sans and Instrument Serif). Chrome treats preloaded fonts as render-blocking for up to about 1.5 s after navigation starts. On real-world mobile latency, that kept the finished first frame off screen, hero photo included, until the fonts arrived.
2. **Below-the-fold extras competed with the hero for bandwidth.** These were two live-weather API calls, the sunrise/sunset API call, the handwritten Caveat font (51 KB, first used about 1,350 px down) and, on phones, the five "A day at" story photos (about 270 KB). They all started during the first second of loading.

Dropping the preloads would have made text jump when the web fonts swapped in, because the fallback fonts were about 3% too wide. The patch therefore also re-tunes the metric-matched fallbacks.

## What changes (12 files)
| Path | Change |
|---|---|
| `wp-content/themes/sample-beach-house/style.css` | Version 4.1.2 |
| `wp-content/themes/sample-beach-house/functions.php` | Removes the two `<link rel="preload" as="font">` tags. Fonts are now requested during the first layout, about 30 ms later. The inline head script also adds a "page has painted" signal: once the first contentful paint is on screen and the browser is idle (3 s cap), it adds class `amp-p` to `<html>` and fires `amp:painted`. Nothing visible waits on this signal. |
| `wp-content/themes/sample-beach-house/assets/css/site.css`, `site.min.css` | Re-tuned metric-matched fallback faces for Instrument Serif and Instrument Sans, so the hero title, pitch and eyebrow wrap onto the same lines in the fallback and web fonts at 320–430 px. Adds Android fallbacks: "Instrument Serif Fallback N" (Noto Serif) and "Instrument Sans Fallback R" (Roboto). |
| `wp-content/themes/sample-beach-house/theme.json`, `assets/css/v3.css`, `v3.min.css` | Adds the new fallback faces to the serif and sans font stacks. Until `amp-p` is set, v3.css uses "Segoe Print" in place of the Caveat face, and phones (≤900 px) hide the story photos. Those photos sit inside a `content-visibility` block, so hiding them changes no visible layout. |
| `wp-content/themes/sample-beach-house/assets/js/site.js`, `site.min.js` | The live-weather widget (about 4,000 px down) starts its API calls after `amp:painted` (3.5 s cap). |
| `wp-content/themes/sample-beach-house/assets/js/experience.js`, `experience.min.js` | The sunrise/sunset times (about 2,500 px down) start after `amp:painted` (3.5 s cap). |
| `wp-content/mu-plugins/pelicove-performance.php` | v1.1.0. The host gzips HTML at a low level: the home page is 68 KB on the wire, against 42 KB at gzip -9. The first time an admin opens wp-admin after deploy, this turns on Cache Enabler's "Pre-compress cached pages" option, then clears the cache. This runs once. To undo it, untick the option in Settings → Cache Enabler. Define `PELICOVE_NO_AUTO_CACHE` to skip it. |

## Local results (Lighthouse, median of 3, box; "std" = full system font set, "min" = Liberation/DejaVu only)
| Page | Before P / LCP / CLS (std) | After P / LCP / CLS (std) | Before → after (min) |
|---|---|---|---|
| Home, mobile | 92 / 3.31 s / 0.001 | **99 / 1.84 s / 0.003** | 97 / 2.48 s → 99 / 1.88 s |
| Home, desktop | 100 / 0.54 s / 0.000 | 100 / 0.48 s / 0.001 | 100 → 100 |
| The House, mobile | 98 / 2.40 s / 0.000 | 98 / 2.40 s / 0.001 | 98 → 98 |
| Gallery, mobile | 97 / 2.55 s / 0.000 | 98 / 2.40 s / 0.000 | 97 → 96 |
| Rates, mobile | 99 / 1.95 s / 0.000 | 99 / 1.80 s / 0.000 | 99 → 99 (CLS 0.037) |
| Contact, mobile | 99 / 2.25 s / 0.001 | 99 / 2.10 s / 0.001 | 99 → 99 |
| All pages, desktop | 99–100 | 100 | 99–100 → 100 |

Trade-off: mobile FCP on the inner pages is about 0.3 s later (for example The House went from 0.90 s to 1.20 s), because text now paints after the first layout requests the fonts rather than after a preload. LCP is unchanged or better on every page.

Booking test (`node tools/test-booking.js`): 33/33. Desktop smoke test: the hero video plays and switches to the snowbird clip with the season switch. Lenis smooth scrolling, scroll-reveal animations, the Caveat font, live weather, the gallery lightbox and the 360° tour all work, with no console errors. Hero screenshots at matching viewports look the same as 4.1.1 apart from the video frame (`audit/shots/4.1.2/before|after/`).

## Deploy (2 steps)
1. In File Manager, upload `perf-4.1.2.zip` to `<site-root>/`, then **Extract** it there, overwriting existing files. Delete the zip afterwards.
2. **Clear the page cache.** The theme CSS is inlined in the cached HTML, so this step is required.
   - In File Manager, delete the folder `wp-content/cache/cache-enabler/`.
   - Or, in wp-admin, use the admin-bar **Clear site cache** button. Opening wp-admin also triggers the one-time pre-compress setting described above.

Check: `curl -s -H 'Accept: text/html' https://beach.johnpaulpannell.com/ | grep -c 'amp:painted'` should print `1`, and `... | grep -c 'as="font"'` should print `0`.

## Rollback
Extract `rollback-to-4.1.1.zip` at the site root (it restores the same 12 files), then clear the cache as in step 2. To undo the pre-compress setting, untick "Pre-compress cached pages" in Settings → Cache Enabler.
