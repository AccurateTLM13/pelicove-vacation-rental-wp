<?php
/**
 * Plugin Name: Pelicove Performance (must-use)
 * Description: Site-wide speed tweaks for the All-Moh's-Paradise / Pelicove demo: removes unused WordPress front-end bloat, writes browser-caching + compression rules to .htaccess, serves pre-generated WebP copies of uploads to browsers that accept them, makes WebP copies of new uploads, and (once) activates the bundled Cache Enabler page cache.
 * Version: 1.1.0
 * Author: Pelicove demo
 *
 * Must-use plugins load automatically (no activation). The .htaccess blocks are (re)written the next time an
 * administrator opens wp-admin; remove this file and the "# BEGIN Pelicove …" blocks to undo everything.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

const PELICOVE_PERF_VER = '1.0.0';

/* ------------------------------------------------------------------ 1. Front-end bloat */
add_action( 'init', function () {
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
	remove_action( 'wp_enqueue_scripts', 'wp_enqueue_emoji_styles' );
	remove_action( 'admin_print_scripts', 'print_emoji_detection_script' );
	remove_action( 'admin_print_styles', 'print_emoji_styles' );
	remove_filter( 'the_content_feed', 'wp_staticize_emoji' );
	remove_filter( 'comment_text_rss', 'wp_staticize_emoji' );
	remove_filter( 'wp_mail', 'wp_staticize_emoji_for_email' );
	add_filter( 'emoji_svg_url', '__return_false' );
	remove_action( 'wp_head', 'wp_oembed_add_discovery_links' );
	remove_action( 'wp_head', 'rsd_link' );
	remove_action( 'wp_head', 'wlwmanifest_link' );
	remove_action( 'wp_head', 'wp_shortlink_wp_head' );
	remove_action( 'template_redirect', 'wp_shortlink_header', 11 );
	remove_action( 'wp_head', 'wp_generator' );
	remove_action( 'wp_head', 'feed_links_extra', 3 ); // comment feeds etc. (site has no posts/comments)
} );
add_filter( 'wp_resource_hints', function ( $urls, $type ) { // drop the emoji CDN dns-prefetch
	return 'dns-prefetch' === $type ? array_filter( $urls, function ( $u ) { return false === strpos( is_array( $u ) ? ( $u['href'] ?? '' ) : $u, 's.w.org' ); } ) : $urls;
}, 10, 2 );
add_action( 'wp_enqueue_scripts', function () {
	if ( ! is_user_logged_in() ) { wp_dequeue_style( 'dashicons' ); wp_deregister_style( 'dashicons' ); }
	wp_dequeue_script( 'wp-embed' );
}, 100 );

/* ------------------------------------------------------------------ 2. .htaccess rules */
function pelicove_root_rules() {
	return array(
		'# Compression (mod_brotli where available, else mod_deflate) for text assets and HTML',
		'<IfModule mod_brotli.c>',
		'  AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/css text/xml text/javascript application/javascript application/json application/ld+json application/xml application/rss+xml image/svg+xml',
		'</IfModule>',
		'<IfModule mod_deflate.c>',
		'  AddOutputFilterByType DEFLATE text/html text/plain text/css text/xml text/javascript application/javascript application/x-javascript application/json application/ld+json application/xml application/rss+xml application/xhtml+xml image/svg+xml image/x-icon font/ttf font/otf',
		'  <IfModule mod_headers.c>',
		'    Header append Vary Accept-Encoding env=!dont-vary',
		'  </IfModule>',
		'</IfModule>',
		'<IfModule mod_mime.c>',
		'  AddType image/avif .avif',
		'  AddType image/webp .webp',
		'  AddType font/woff2 .woff2',
		'  AddType video/webm .webm',
		'</IfModule>',
		'# Browser caching: versioned theme/core assets, fonts, images and video for 1 year; HTML/JSON always revalidated',
		'<IfModule mod_expires.c>',
		'  ExpiresActive On',
		'  ExpiresByType text/html "access plus 0 seconds"',
		'  ExpiresByType application/json "access plus 0 seconds"',
		'  ExpiresByType text/css "access plus 1 year"',
		'  ExpiresByType text/javascript "access plus 1 year"',
		'  ExpiresByType application/javascript "access plus 1 year"',
		'  ExpiresByType image/avif "access plus 1 year"',
		'  ExpiresByType image/webp "access plus 1 year"',
		'  ExpiresByType image/jpeg "access plus 1 year"',
		'  ExpiresByType image/png "access plus 1 year"',
		'  ExpiresByType image/gif "access plus 1 year"',
		'  ExpiresByType image/svg+xml "access plus 1 year"',
		'  ExpiresByType image/x-icon "access plus 1 year"',
		'  ExpiresByType font/woff2 "access plus 1 year"',
		'  ExpiresByType video/mp4 "access plus 1 year"',
		'  ExpiresByType video/webm "access plus 1 year"',
		'</IfModule>',
		'<IfModule mod_headers.c>',
		'  <FilesMatch "\.(css|js|mjs|woff2?|avif|webp|jpe?g|png|gif|svg|ico|mp4|webm)$">',
		'    Header set Cache-Control "public, max-age=31536000, immutable"',
		'  </FilesMatch>',
		'  Header always set X-Content-Type-Options "nosniff"',
		'  Header always set Referrer-Policy "strict-origin-when-cross-origin"',
		'</IfModule>',
	);
}
function pelicove_uploads_rules() {
	return array(
		'# Serve the pre-generated "<image>.jpg.webp" copy to browsers that accept WebP (same URL, smaller file)',
		'<IfModule mod_rewrite.c>',
		'  RewriteEngine On',
		'  RewriteCond %{HTTP_ACCEPT} image/webp',
		'  RewriteCond %{REQUEST_FILENAME} -f',
		'  RewriteCond %{REQUEST_FILENAME}.webp -f',
		'  RewriteRule ^(.+)\.(jpe?g|png)$ $1.$2.webp [NC,T=image/webp,L]',
		'</IfModule>',
		'<IfModule mod_headers.c>',
		'  <FilesMatch "(?i)\.(jpe?g|png)(\.webp)?$">',
		'    Header append Vary Accept',
		'  </FilesMatch>',
		'</IfModule>',
		'<IfModule mod_mime.c>',
		'  AddType image/webp .webp',
		'</IfModule>',
	);
}
function pelicove_write_htaccess() {
	if ( ! function_exists( 'insert_with_markers' ) ) require_once ABSPATH . 'wp-admin/includes/misc.php';
	$up    = wp_get_upload_dir();
	$root  = ABSPATH . '.htaccess';
	$upl   = trailingslashit( $up['basedir'] ) . '.htaccess';
	$ok_r  = ( file_exists( $root ) ? is_writable( $root ) : is_writable( ABSPATH ) ) && insert_with_markers( $root, 'Pelicove Performance', pelicove_root_rules() );
	$ok_u  = ( file_exists( $upl ) ? is_writable( $upl ) : is_writable( $up['basedir'] ) ) && insert_with_markers( $upl, 'Pelicove WebP', pelicove_uploads_rules() );
	return array( 'root' => (bool) $ok_r, 'uploads' => (bool) $ok_u );
}
add_action( 'admin_init', function () {
	if ( ! current_user_can( 'manage_options' ) || wp_doing_ajax() ) return;
	if ( get_option( 'pelicove_perf_htaccess' ) === PELICOVE_PERF_VER ) return;
	$r = pelicove_write_htaccess();
	update_option( 'pelicove_perf_htaccess_result', $r, false );
	if ( $r['root'] && $r['uploads'] ) update_option( 'pelicove_perf_htaccess', PELICOVE_PERF_VER, false );
} );

/* ------------------------------------------------------------------ 3. Page cache: activate bundled Cache Enabler once */
add_action( 'admin_init', function () {
	if ( ! current_user_can( 'activate_plugins' ) || get_option( 'pelicove_perf_cache_done' ) ) return;
	if ( defined( 'PELICOVE_NO_AUTO_CACHE' ) && PELICOVE_NO_AUTO_CACHE ) return;
	$p = 'cache-enabler/cache-enabler.php';
	if ( ! file_exists( WP_PLUGIN_DIR . '/' . $p ) ) return;
	if ( ! function_exists( 'is_plugin_active' ) ) require_once ABSPATH . 'wp-admin/includes/plugin.php';
	if ( ! is_plugin_active( $p ) ) { $res = activate_plugin( $p ); update_option( 'pelicove_perf_cache_result', is_wp_error( $res ) ? $res->get_error_message() : 'activated', false ); }
	// Sensible defaults: cached pages expire after 6 hours (the booking calendar embeds "today" and booked dates)
	// and the whole cache is cleared whenever a post/page is saved.
	$s = get_option( 'cache_enabler' );
	if ( is_array( $s ) ) {
		$s['cache_expires'] = 1; $s['cache_expiry_time'] = 6; $s['clear_site_cache_on_saved_post'] = 1; $s['clear_site_cache_on_changed_plugin'] = 1;
		update_option( 'cache_enabler', $s );
		if ( class_exists( 'Cache_Enabler' ) && method_exists( 'Cache_Enabler', 'update_backend' ) ) Cache_Enabler::update_backend(); // validates + rewrites its settings file
	}
	update_option( 'pelicove_perf_cache_done', 1, false ); // only once: if you deactivate it later it stays off
}, 20 );

/* v1.1 (theme 4.1.2): the host gzips HTML at a low level (home page: 68 KB on the wire, 42 KB at gzip -9). Let Cache Enabler
 * store pre-compressed copies of each cached page (gzip -9, or Brotli where PHP has it) and send those instead.
 * Runs once, on the first wp-admin visit after deploy; untick "Pre-compress cached pages" in Settings → Cache Enabler to undo. */
add_action( 'admin_init', function () {
	if ( ! current_user_can( 'manage_options' ) || get_option( 'pelicove_perf_compress_done' ) ) return;
	if ( defined( 'PELICOVE_NO_AUTO_CACHE' ) && PELICOVE_NO_AUTO_CACHE ) return;
	$s = get_option( 'cache_enabler' );
	if ( ! is_array( $s ) || ! class_exists( 'Cache_Enabler' ) ) return;
	if ( empty( $s['compress_cache'] ) ) {
		$s['compress_cache'] = 1;
		update_option( 'cache_enabler', $s );
		if ( method_exists( 'Cache_Enabler', 'update_backend' ) ) Cache_Enabler::update_backend(); // validates + rewrites its settings file
		do_action( 'cache_enabler_clear_complete_cache' ); // drop the uncompressed copies
	}
	update_option( 'pelicove_perf_compress_done', 1, false );
}, 21 );

/* Clear the page cache when availability or rates change (Availability admin page, or the settings option). */
function pelicove_clear_page_cache() { do_action( 'cache_enabler_clear_complete_cache' ); }
add_action( 'admin_init', function () {
	if ( 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? '' ) && 'amp-availability' === ( $_GET['page'] ?? '' ) ) add_action( 'shutdown', 'pelicove_clear_page_cache' );
} );
add_action( 'update_option_amp_bk_settings', 'pelicove_clear_page_cache' );

/* ------------------------------------------------------------------ 4. WebP copies of uploads */
function pelicove_webp_supported() { return wp_image_editor_supports( array( 'mime_type' => 'image/webp' ) ); }
function pelicove_make_webp( $file, $quality = 78 ) {
	if ( ! preg_match( '/\.(jpe?g|png)$/i', $file ) || ! file_exists( $file ) || file_exists( $file . '.webp' ) ) return false;
	$ed = wp_get_image_editor( $file );
	if ( is_wp_error( $ed ) ) return false;
	$ed->set_quality( $quality );
	$r = $ed->save( $file . '.webp', 'image/webp' );
	if ( is_wp_error( $r ) ) return false;
	if ( filesize( $file . '.webp' ) >= filesize( $file ) ) { @unlink( $file . '.webp' ); return false; } // not smaller: keep the original only
	return true;
}
function pelicove_attachment_files( $id, $meta = null ) {
	$meta = $meta ?: wp_get_attachment_metadata( $id );
	$file = get_attached_file( $id );
	if ( ! $file || empty( $meta ) ) return array();
	$dir = trailingslashit( dirname( $file ) ); $out = array( $file );
	if ( ! empty( $meta['original_image'] ) ) $out[] = $dir . $meta['original_image'];
	foreach ( (array) ( $meta['sizes'] ?? array() ) as $s ) if ( ! empty( $s['file'] ) ) $out[] = $dir . $s['file'];
	return array_unique( $out );
}
add_filter( 'wp_generate_attachment_metadata', function ( $meta, $id ) {
	if ( pelicove_webp_supported() ) foreach ( pelicove_attachment_files( $id, $meta ) as $f ) pelicove_make_webp( $f );
	return $meta;
}, 20, 2 );
add_action( 'delete_attachment', function ( $id ) {
	foreach ( pelicove_attachment_files( $id ) as $f ) if ( file_exists( $f . '.webp' ) ) @unlink( $f . '.webp' );
} );

/* Tools → Pelicove Performance: status + batch-convert any uploads that still lack a WebP copy. */
add_action( 'admin_menu', function () {
	add_management_page( 'Pelicove Performance', 'Pelicove Performance', 'manage_options', 'pelicove-perf', 'pelicove_perf_page' );
} );
function pelicove_missing_webp( $limit = 0 ) {
	$ids = get_posts( array( 'post_type' => 'attachment', 'post_mime_type' => array( 'image/jpeg', 'image/png' ), 'numberposts' => -1, 'fields' => 'ids' ) );
	$missing = array();
	foreach ( $ids as $id ) foreach ( pelicove_attachment_files( $id ) as $f ) if ( file_exists( $f ) && ! file_exists( $f . '.webp' ) ) { $missing[] = $f; if ( $limit && count( $missing ) >= $limit ) return $missing; }
	return $missing;
}
function pelicove_perf_page() {
	if ( ! current_user_can( 'manage_options' ) ) return;
	$done = 0;
	if ( isset( $_GET['pelicove_convert'] ) && check_admin_referer( 'pelicove_convert' ) && pelicove_webp_supported() ) {
		$t = microtime( true );
		foreach ( pelicove_missing_webp( 40 ) as $f ) { pelicove_make_webp( $f ); $done++; if ( microtime( true ) - $t > 20 ) break; }
	}
	if ( isset( $_GET['pelicove_htaccess'] ) && check_admin_referer( 'pelicove_htaccess' ) ) { update_option( 'pelicove_perf_htaccess_result', pelicove_write_htaccess(), false ); }
	$missing = count( pelicove_missing_webp() );
	$r = get_option( 'pelicove_perf_htaccess_result', array() );
	echo '<div class="wrap"><h1>Pelicove Performance</h1>';
	echo '<p><strong>.htaccess rules:</strong> root ' . ( ! empty( $r['root'] ) ? '<span style="color:#0a7a2f">OK — written</span>' : '<span style="color:#b32d2e">NOT written (file not writable — paste the block from the deploy README)</span>' ) . ' · uploads ' . ( ! empty( $r['uploads'] ) ? '<span style="color:#0a7a2f">OK — written</span>' : '<span style="color:#b32d2e">NOT written</span>' ) . ' — <a href="' . esc_url( wp_nonce_url( admin_url( 'tools.php?page=pelicove-perf&pelicove_htaccess=1' ), 'pelicove_htaccess' ) ) . '">re-write now</a></p>';
	echo '<p><strong>Page cache:</strong> ' . ( is_plugin_active( 'cache-enabler/cache-enabler.php' ) ? '<span style="color:#0a7a2f">OK — Cache Enabler active</span>' : '<span style="color:#b32d2e">Cache Enabler not active</span>' ) . ' (' . esc_html( (string) get_option( 'pelicove_perf_cache_result', 'n/a' ) ) . ')</p>';
	echo '<p><strong>WebP:</strong> server support ' . ( pelicove_webp_supported() ? '<span style="color:#0a7a2f">yes</span>' : '<span style="color:#b32d2e">no</span> (GD/Imagick without WebP — upload the pre-generated WebP zip instead)' ) . ' · image files still without a .webp copy: <strong>' . (int) $missing . '</strong>' . ( $done ? ' (converted ' . $done . ' just now)' : '' ) . '</p>';
	if ( $missing && pelicove_webp_supported() ) {
		$u = wp_nonce_url( admin_url( 'tools.php?page=pelicove-perf&pelicove_convert=1' ), 'pelicove_convert' );
		echo '<p><a class="button button-primary" href="' . esc_url( $u ) . '">Convert the next batch</a></p>';
		if ( $done ) echo '<script>setTimeout(function(){location.href=' . wp_json_encode( $u ) . ';},800);</script><p>Continuing automatically…</p>';
	}
	echo '</div>';
}
