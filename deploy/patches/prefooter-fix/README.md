# Pre-footer alignment fix (theme 4.0.1)

Upload these 3 files with cPanel → File Manager, overwriting the existing ones. No database changes.

| Staged file (in this folder) | Destination on the server |
|---|---|
| `wp-content/themes/sample-beach-house/style.css` | `<site-root>/wp-content/themes/sample-beach-house/style.css` |
| `wp-content/themes/sample-beach-house/functions.php` | `<site-root>/wp-content/themes/sample-beach-house/functions.php` |
| `wp-content/themes/sample-beach-house/assets/css/v3.css` | `<site-root>/wp-content/themes/sample-beach-house/assets/css/v3.css` |

`*.diff` files show the exact changes (they are for review only; don't upload them).

After uploading:
- View the page source. It should show `v3.css?ver=4.0.1.<timestamp>` and `site.css?ver=4.0.1.<timestamp>`.
- If Bluehost caching is on, purge it (Bluehost portal → Performance / Caching → Clear cache).
- At ≥1440px wide, the "Why book direct" icons on Home and Contact, and the "Getting around" list on Location, should now be centered under their headings.
