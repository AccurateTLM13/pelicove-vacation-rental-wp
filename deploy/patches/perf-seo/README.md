# Performance + SEO patch: theme 4.1.0, Pelicove Performance mu-plugin, Cache Enabler, WebP copies

Site root on the server: `<site-root>/`.
Every path in the zips and in `MANIFEST.sha256` is relative to that folder; each one starts with `wp-content/`.
The database is not changed by the upload. The only DB writes come from the one-time wp-admin visit in step 3:
- a few `pelicove_*` options
- Cache Enabler's own option and its activation
- the `active_plugins` entry for Cache Enabler

## Deploy (3 steps)

1. **Upload.** In Bluehost File Manager, open `<site-root>/` and upload `perf-seo-all.zip` (about 26 MB; theme, mu-plugin, Cache Enabler and the WebP copies).
   - If the upload size is a problem, upload the two parts instead: `perf-seo-site.zip` (0.8 MB) and `perf-seo-uploads-webp.zip` (25 MB).
2. **Extract.** Right-click the zip, choose **Extract**, keep the target folder as the site root, and overwrite existing files.
   - This replaces 11 theme files.
   - It adds the new theme files, `wp-content/mu-plugins/pelicove-performance.php`, `wp-content/plugins/cache-enabler/` and 301 `*.jpg.webp` / `*.png.webp` files in `wp-content/uploads/2026/10/`.
   - Delete the zip afterwards.
3. **Log in to wp-admin once, then open Tools → Pelicove Performance.**
   - That first admin page load does three things:
     - writes the `# BEGIN Pelicove Performance` block (gzip/deflate, 1-year cache for static files, nosniff, Referrer-Policy) into `.htaccess`
     - writes the `# BEGIN Pelicove WebP` block into `wp-content/uploads/.htaccess`
     - activates Cache Enabler (6-hour expiry; cache cleared whenever a page is saved, a plugin changes, or availability/rates change)
   - The Tools page should show **OK** for both .htaccess rules and for the page cache, and about 0 images missing a WebP copy.

That is all. Cache Enabler's "Clear cache" button sits in the admin bar if you ever need it.

### Quick checks after deploy
- `curl -sI -H 'Accept-Encoding: gzip' https://beach.johnpaulpannell.com/` should include `content-encoding: gzip`.
  - When `curl -sI -H 'Accept: text/html' …` is run twice, the second response should include `x-cache-handler: cache-enabler-engine`.
- `curl -sI -H 'Accept: image/webp' https://beach.johnpaulpannell.com/wp-content/uploads/2026/10/amp-demo-hero.jpg` should return `content-type: image/webp`.
- `.../wp-content/themes/sample-beach-house/assets/css/v3.min.css` should return `cache-control: public, max-age=31536000, immutable`.
- Run PageSpeed Insights on the five pages, mobile and desktop.

## Fallbacks (only if step 3 doesn't show OK)
- **".htaccess NOT written"** means the file isn't writable. In File Manager, edit `.htaccess` in the site root and paste `htaccess-root-snippet.txt` **above** `# BEGIN WordPress`.
  - Edit or create `wp-content/uploads/.htaccess` and paste `htaccess-uploads-snippet.txt`.
  - Then click "re-write now" on the Tools page; it should then show OK. You can also leave it, because the pasted rules already work.
- **"Cache Enabler not active"** means `wp-config.php` wasn't writable when it activated. Go to Plugins, activate **Cache Enabler** by hand, and make sure `define( 'WP_CACHE', true );` is in `wp-config.php` above "That's all, stop editing".
  - To use Bluehost's own caching instead, set the `PELICOVE_NO_AUTO_CACHE` constant to `true` in `wp-config.php` before step 3. Then enable caching under Bluehost portal → Websites → Settings → Performance.
  - Use only one page cache, not both.
- **WebP copies missing** (for example, only `perf-seo-site.zip` was uploaded): the Tools page has a **Convert the next batch** button. It uses the server's GD/Imagick WebP support, converts about 40 files per click and continues automatically.
  - New uploads get a WebP copy automatically.
  - All 301 local originals were checked against live, and the size of every one matches byte-for-byte. The pre-made copies are therefore exact.

## Rollback
1. Extract `rollback-theme-4.0.1-files.zip` at the site root. This restores the 11 replaced theme files to 4.0.1; the new extra theme files are harmless.
2. Delete `wp-content/mu-plugins/pelicove-performance.php`.
3. Deactivate and delete Cache Enabler under Plugins. Its deactivation removes `advanced-cache.php` and `WP_CACHE`.
4. Delete the `# BEGIN/END Pelicove …` blocks from `.htaccess` and `wp-content/uploads/.htaccess`.
5. Optionally delete `wp-content/uploads/2026/10/*.webp`.

## What's in the patch
| Path (relative to site root) | What |
|---|---|
| `wp-content/themes/sample-beach-house/style.css` | version 4.1.0 |
| `.../theme.json` | font stacks gain metric-matched fallbacks (no layout shift when web fonts swap in) |
| `.../functions.php` | prefers `.min` assets; inlines theme CSS (no render-blocking CSS); font preloads; Lenis loaded lazily on fine pointers only; CF7 JS/CSS on the contact page only; loads `inc/perf.php` and `inc/seo.php` |
| `.../inc/perf.php` (new) | hero `<picture>` with AVIF/WebP responsive sources plus a mobile portrait crop; `<link rel=preload>` for the LCP poster (`fetchpriority=high`); lazy-loads images below the fold; inlines block-library / CF7 / Leaflet CSS; heading-order fix |
| `.../inc/seo.php` (new) | per-page title and meta description (all saying "fictional demo"); Open Graph and Twitter cards with `og-cover.jpg`; WebSite and BreadcrumbList JSON-LD; noindex on the 404; author archives and `?author=` redirected; users sitemap removed; attachment pages redirect to their parent |
| `.../inc/schema.php` | VacationRental: 12 images, identifier, rounded (approximate-area) coordinates, Organization logo |
| `.../parts/header.html`, `parts/footer.html` | accessible-name fixes (visible text matches the label); footer column headings changed from h4 to h2 |
| `.../assets/css/site.css`, `v3.css` (+ `.min.css`) | fallback `@font-face` metrics; contrast fixes; mobile sound-button label; v4.1 styles |
| `.../assets/js/site.js`, `experience.js`, `booking.js` (+ `.min.js`) | reveal without layout thrash; hero video waits for load + idle and is skipped on phones, reduced-motion, data-saver and 2G; calendar month titles h3; day-button labels; CF7 prefill re-applied after the cached-page form reset |
| `.../assets/media/hero-{summer,snowbird}-{960,1280,1920,m480,m608}.{avif,webp}` (new) | responsive hero posters |
| `.../assets/img/og-cover.jpg` (new) | 1200×630 social card ("Fictional demo") |
| `wp-content/mu-plugins/pelicove-performance.php` (new) | removes emoji/oEmbed/RSD/generator/dashicons-for-visitors; writes .htaccess caching and compression; WebP serving; activates Cache Enabler; clears the cache on availability changes; WebP converter page |
| `wp-content/plugins/cache-enabler/` (new) | Cache Enabler 1.8.17 (free, from wordpress.org) |
| `wp-content/uploads/2026/10/*.{jpg,png}.webp` (301 new) | WebP copies (cwebp q78), served automatically to browsers that accept WebP |

`MANIFEST.sha256` lists every file's sha256. `ZIPS.sha256` covers the zips. `files/` and `files-webp/` hold the same content unzipped, for review.

## Notes
- **jQuery:** not loaded for visitors (CF7 6.x doesn't need it), so there is nothing to remove.
- **Duplicator / All-in-One WP Migration:** these aren't needed on the live site and can be deactivated and deleted. They don't affect front-end speed, but they are an attack surface.
- **Booking calendar and page cache:** cached pages expire after 6 hours, because the calendar uses "today". Saving availability in wp-admin clears the cache straight away. The quote REST API and form submissions are never cached.
- **Search engines:** the site stays indexable ("Discourage search engines" is off), and the titles, descriptions, schema and footer all say it is a fictional demo.
