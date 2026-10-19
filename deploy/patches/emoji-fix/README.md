# Emoji icon fix (live /amenities/ and /location-area-guide/)

**Symptom:** 12 `.sbh-icon` spans render `????` (6 on Amenities, 6 of 7 on Location; ⛳ survived because it is a 3-byte character).
**Cause:** the live `wp_posts` table/columns are `utf8`/`utf8mb3`, or the Duplicator import ran in utf8mb3. 4-byte emoji were stored as `?`.
**Fix:** a one-shot must-use plugin. It rewrites only those 13 icon spans, matched by post ID/slug and by the heading text that follows each span. Each icon becomes an HTML numeric entity (e.g. `&#x1F30A;`), which is plain ASCII, so the icons survive any DB charset and look the same in browsers. If the server supports utf8mb4, the plugin also converts any utf8/utf8mb3 `wp_*` tables to utf8mb4.

## Files
`emoji-fix.zip` contains `wp-content/mu-plugins/pelicove-fix-emoji.php`. Paths are relative to the site root `<site-root>`.

## Apply
1. **Back up first:** cPanel → phpMyAdmin → export the database (or at least `wp_posts`). The plugin also keeps its own backup (see Rollback).
2. cPanel → File Manager → open `<site-root>`. Upload `emoji-fix.zip` and **Extract** it there. Result: `<site-root>/wp-content/mu-plugins/pelicove-fix-emoji.php`. Create `mu-plugins` if it does not exist; extracting does that.
3. Log in to `/wp-admin/` as an administrator and load any admin page once. A green notice titled "Pelicove emoji fix ran" shows a JSON log: table collations before and after, server version, and per-icon match counts. Every count should be `1`, and both posts should show `"result": "updated"`.
4. **Delete** `<site-root>/wp-content/mu-plugins/pelicove-fix-emoji.php`. After its first run it does nothing except show a notice reminding you to delete it.
5. If the Bluehost page cache is on, purge it (Bluehost portal → Performance → Clear cache). The plugin already clears Cache Enabler.

## Verify
```bash
for p in amenities location-area-guide; do echo "$p: $(curl -s "https://beach.johnpaulpannell.com/$p/?v=$RANDOM" | grep -o 'sbh-icon" aria-hidden="true">[^<]*' | sed 's/.*>//' | tr '\n' ' ')"; done
# expected:
# amenities: &#x1F30A; &#x1F373; &#x1F6CB;&#xFE0F; &#x1F4F6; &#x1F697; &#x1F9FA;
# location-area-guide: &#x1F3F0; &#x1F985; &#x1F990; &#x26F3; &#x1F334; &#x1F3B6; &#x1F3A1;
curl -s "https://beach.johnpaulpannell.com/wp-json/wp/v2/pages?per_page=100&v=$RANDOM" | grep -c '????'   # expected 0
```

## Rollback
- The pre-fix `post_content` of both pages is stored in option `pelicove_emoji_fix_backup`, an array keyed by post ID. A post revision of the pre-fix state is also created (Pages → edit → Revisions → restore).
- The log is in option `pelicove_emoji_fix_log`. The run flag is `pelicove_emoji_fix_done`. To run the plugin again, delete that option in phpMyAdmin (`wp_options`) and re-upload the file.
- You cannot undo the table conversion to utf8mb4 from here, but you should not need to. It is the WordPress-recommended charset, and it uses the same core logic WordPress runs during upgrades. Restore from the step-1 DB export if you really have to.
- Optional: in `wp-config.php`, change `define( 'DB_CHARSET', 'utf8' );` to `'utf8mb4'`. WordPress already upgrades the connection to utf8mb4 when the server supports it, so this is cosmetic.
