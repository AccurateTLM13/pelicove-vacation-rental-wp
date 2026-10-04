# Pelicove Vacation Homes — WordPress demo (custom code)

Custom theme, booking plugin and tooling behind the **Pelicove Vacation Homes** vacation-rental demo:
**https://beach.johnpaulpannell.com**

> **Fictional demo.** "Pelicove Vacation Homes" and "All-Moh's-Paradise" are made-up brands. The phone number
> (251-555-0142) and email (`hello@pelicove.example`) are deliberately fake, there is no street address, rates are
> labelled *[Example]*, and every review is an original **sample/placeholder** review. Photos are stock
> (Unsplash License), hero videos are Pexels, 360° panoramas are Poly Haven CC0 — none of them show a real
> property. Full credits: [`CREDITS.md`](wp-content/themes/sample-beach-house/CREDITS.md).

## What's here

| Path | What |
|---|---|
| `wp-content/themes/sample-beach-house/` | Block (FSE) child theme of Twenty Twenty-Five: `theme.json` palette/typography, templates & parts, `inc/perf.php` (responsive AVIF/WebP hero, preloads, lazy-loading, CSS inlining), `inc/seo.php` (titles, meta, Open Graph, JSON-LD), `inc/schema.php` (VacationRental / FAQPage). JS: `booking.js` (range calendar, live quote, booking dialog/bottom sheet, CF7 prefill), `experience.js` (season switch, video hero, scrollspy, parallax, Lenis, reviews filter, lazy Pannellum 360° tours), `site.js` (reveal, weather/marine widget via Open-Meteo, lightbox, Leaflet/OSM map). Vendored Leaflet, Pannellum, Lenis; self-hosted fonts. |
| `wp-content/plugins/amp-booking/` | Custom availability & pricing plugin (v1.1.0): `wp_amp_blocked` table (self-creating), seasons/rates/min-nights/fees/discounts/tax settings, WP Admin → **Availability**, iCal import + export (`/?amp_ical=1`), REST `GET /wp-json/amp/v1/availability` and `GET /wp-json/amp/v1/quote?check_in=&check_out=&guests=` (422 on invalid stays), server-side re-validation of Contact Form 7 booking inquiries. |
| `wp-content/mu-plugins/pelicove-performance.php` | Must-use plugin: strips emoji/oEmbed/RSD/generator/visitor dashicons, writes `.htaccess` compression + caching + WebP rules, activates/clears Cache Enabler, Tools → Pelicove Performance status page and batch WebP converter. |
| `build/` | `minify.sh` (csso + terser → `*.min.css` / `*.min.js`), `clear-cache.sh`. |
| `tools/` | Playwright helpers: `test-booking.js` (end-to-end booking-flow test, 33 checks), screenshot scripts (`shot.js`, `shot-mobile.js`, `v3-shots.js`), showcase rendering (`capture.js`, `render.js`), migration-package helpers (`dup-*.js`, `aio-*.js`), `py/` layout/CLS probes. |
| `audit/` | Lighthouse runner (`lh.sh`), PageSpeed Insights API runner (`psi.py`), `median.py`, `summarize.py`; `results/live-after-SUMMARY.txt` = median live scores. |
| `deploy/patches/` | Incremental theme/mu-plugin patches as deployed (READMEs, diffs, `.htaccess` snippets, small zips + rollbacks). |

Stack: WordPress 7.x · PHP 8.2+ (built/tested on 8.4) · MariaDB/MySQL · Contact Form 7 + Flamingo (inquiries) ·
Cache Enabler (page cache) · Node 18+ with `playwright-core`, `csso-cli`, `terser`, `lighthouse` for tooling.

## Local setup

1. Run any local WordPress (wp-env, LocalWP, Docker, or `php -S` + MariaDB) with PHP ≥ 8.2.
2. Copy/symlink into its `wp-content/`:
   - `wp-content/themes/sample-beach-house` (also install the parent theme **Twenty Twenty-Five**)
   - `wp-content/plugins/amp-booking`
   - `wp-content/mu-plugins/pelicove-performance.php`
3. Install & activate **Contact Form 7** and **Flamingo** (and optionally **Cache Enabler**), activate the theme and `amp-booking`
   (`wp theme activate sample-beach-house && wp plugin activate amp-booking contact-form-7 flamingo`).
4. Create the pages (Home, The House, Gallery, Amenities, Rates & Availability, Location, Reviews, Contact & Book)
   and a CF7 form named "Booking Inquiry". *The page-content build scripts and the database are not part of this repo
   (they are tied to the demo's media library).*
5. Tooling: `cd tools && npm install`, then e.g. `BASE=http://localhost:8080 node test-booking.js`
   (`BASE` defaults to `http://localhost:8080`). Rebuild minified assets with `bash build/minify.sh`.
6. Scripts that log into wp-admin read credentials from the environment only:
   `WP_ADMIN_USER`, `WP_ADMIN_PASS` (and `TEST_DB_USER` / `TEST_DB_PASS` for the throwaway Duplicator test install).

**Media note:** the two full-size desktop hero clips (`assets/media/hero-summer.mp4`, `hero-summer.webm`, >5 MB each)
are not committed. Phones/small screens use the committed `*-sm.*` clips and posters; for the desktop summer clip,
drop your own Pexels clip at those paths (or the poster image shows instead).

## Deploying (notes)

- The site URL is not hardcoded anywhere in the theme or plugin.
- Install at the root of a (sub)domain — content uses root-relative links.
- Initial deploy was a full-site migration package (Duplicator / All-in-One WP Migration); those archives contain
  the database and are **not** in this repo. Later changes were shipped as file patches — see `deploy/patches/*/README.md`
  (`<site-root>` = the WordPress root on the host).
- After deploying theme changes, clear the page cache (Cache Enabler admin-bar button), since theme CSS is inlined.
- Post-install checklist: re-save permalinks, force HTTPS, set a strong admin password and a real admin email,
  configure SMTP (e.g. WP Mail SMTP) and remove `skip_mail: on` from the CF7 form if you want inquiry emails.
- Never commit `wp-config.php`, `.env`, database dumps, migration archives or `wp-content/uploads/` (see `.gitignore`).

## License

Custom code: MIT (see [LICENSE](LICENSE)). Third-party assets keep their own licenses (listed in LICENSE / CREDITS.md).
