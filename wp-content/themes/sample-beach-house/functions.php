<?php
// Asset cache-buster: theme Version (style.css) + file mtime, so a version bump always refreshes caches
// even if an upload tool preserves the old modification time.
function sbh_asset_ver( $rel ) {
	$f = get_stylesheet_directory() . '/' . $rel;
	return wp_get_theme()->get( 'Version' ) . '.' . ( file_exists( $f ) ? filemtime( $f ) : '0' );
}
// v4.1: use the minified build (build/minify.sh) when it exists, else the readable source.
function sbh_min( $rel ) {
	$min = preg_replace( '/\.(css|js)$/', '.min.$1', $rel );
	return file_exists( get_stylesheet_directory() . '/' . $min ) ? $min : $rel;
}
add_action( 'wp_enqueue_scripts', function () {
	$rel = sbh_min( 'assets/css/site.css' );
	wp_enqueue_style( 'sbh-site', get_stylesheet_directory_uri() . '/' . $rel, array(), sbh_asset_ver( $rel ) );
	wp_style_add_data( 'sbh-site', 'path', get_stylesheet_directory() . '/' . $rel ); // lets WP inline it (see below)
} );
// v4.1: inline the theme CSS (~80 KB minified, ~15 KB gzipped) instead of two render-blocking requests (WP counts its inlined block CSS toward this limit too).
add_filter( 'styles_inline_size_limit', function () { return 240000; } );
add_action( 'after_setup_theme', function () {
	add_editor_style( 'assets/css/site.css' );
} );
// CF7: don't auto-insert <p>/<br> into form markup so our layout grid stays clean.
add_filter( 'wpcf7_autop_or_not', '__return_false' );
add_action( 'init', function () {
	add_post_type_support( 'page', 'excerpt' );
	register_block_style( 'core/button', array( 'name' => 'sbh-light', 'label' => 'Light (sand)' ) );
	register_block_style( 'core/button', array( 'name' => 'sbh-ghost', 'label' => 'Ghost (white outline)' ) );
	register_block_style( 'core/group', array( 'name' => 'sbh-card', 'label' => 'Card' ) );
} );
// Keep straight apostrophes exactly as typed (e.g. "All Mo'h Paradise") — disable smart-quote conversion.
add_filter( 'run_wptexturize', '__return_false' );
// v2: enhancements script (+ Leaflet only on the location page)
add_action( 'wp_enqueue_scripts', function () {
	$dir = get_stylesheet_directory(); $uri = get_stylesheet_directory_uri();
	$deps = array();
	if ( is_page( 'location-area-guide' ) ) {
		wp_enqueue_style( 'leaflet', $uri . '/assets/vendor/leaflet/leaflet.css', array(), '1.9.4' );
		wp_enqueue_script( 'leaflet', $uri . '/assets/vendor/leaflet/leaflet.js', array(), '1.9.4', array( 'in_footer' => true, 'strategy' => 'defer' ) );
		$deps[] = 'leaflet';
	}
	$js = sbh_min( 'assets/js/site.js' );
	wp_enqueue_script( 'sbh-site', "$uri/$js", $deps, sbh_asset_ver( $js ), array( 'in_footer' => true, 'strategy' => 'defer' ) );
} );
// Preconnect to the live-data APIs on the front page (hero poster preload is in the v3 block)
add_action( 'wp_head', function () {
	if ( ! is_front_page() ) return;
	echo '<link rel="preconnect" href="https://api.open-meteo.com" crossorigin><link rel="preconnect" href="https://marine-api.open-meteo.com" crossorigin>' . "\n";
}, 1 );

/* =====================================================================
 * v3 — booking engine, cinematic layer, schema (see README "v3")
 * ===================================================================== */
require_once __DIR__ . '/inc/schema.php';
require_once __DIR__ . '/inc/perf.php';
require_once __DIR__ . '/inc/seo.php';

// Season + JS flags before first paint (no flash of the wrong season)
add_action( 'wp_head', function () {
	echo "<script>(function(d){try{var s=localStorage.getItem('amp-season');}catch(e){}var m=new Date().getMonth()+1;d.setAttribute('data-season',s||([11,12,1,2].indexOf(m)>-1?'snowbird':'summer'));d.classList.add('js');})(document.documentElement);</script>\n";
	// Preload the two text faces used above the fold (the hero poster preload lives in inc/perf.php).
	$f = get_stylesheet_directory_uri() . '/assets/fonts/';
	foreach ( array( 'instrument-sans.woff2', 'instrument-serif.woff2' ) as $font ) {
		echo '<link rel="preload" href="' . esc_url( $f . $font ) . '" as="font" type="font/woff2" crossorigin>' . "\n";
	}
}, 0 );

add_action( 'wp_enqueue_scripts', function () {
	$dir = get_stylesheet_directory(); $uri = get_stylesheet_directory_uri();
	$v = 'sbh_asset_ver';
	$bk = sbh_min( 'assets/js/booking.js' ); $ex = sbh_min( 'assets/js/experience.js' ); $css = sbh_min( 'assets/css/v3.css' );
	wp_enqueue_script( 'amp-booking', "$uri/$bk", array(), $v( $bk ), array( 'in_footer' => true, 'strategy' => 'defer' ) );
	if ( function_exists( 'amp_bk_public_data' ) ) wp_add_inline_script( 'amp-booking', 'window.AMP_BK=' . wp_json_encode( amp_bk_public_data() ) . ';', 'before' );
	// Lenis smooth scroll is loaded on demand by experience.js (desktop / fine pointer only, after load).
	wp_enqueue_script( 'amp-experience', "$uri/$ex", array(), $v( $ex ), array( 'in_footer' => true, 'strategy' => 'defer' ) );
	wp_add_inline_script( 'amp-experience', 'window.AMP_LENIS=' . wp_json_encode( "$uri/assets/vendor/lenis/lenis.min.js?ver=1.3.26" ) . ';', 'before' );
	wp_enqueue_style( 'amp-v3', "$uri/$css", array( 'sbh-site' ), $v( $css ) );
	wp_style_add_data( 'amp-v3', 'path', "$dir/$css" );
}, 20 );

// No mobile booking bar on the inquiry page itself (the form *is* the booking step)
add_filter( 'body_class', function ( $c ) { if ( is_page( 'contact-book' ) ) $c[] = 'amp-no-mbar'; if ( is_page( array( 'the-house', 'rates-availability' ) ) ) $c[] = 'amp-has-aside'; return $c; } );


// v4: make sure the availability table exists when this theme is activated (e.g. after a migration).
add_action( 'after_switch_theme', function () {
	if ( function_exists( 'amp_bk_install' ) ) amp_bk_install();
} );
// Admin notice if the companion booking plugin is not active (the booking card depends on it).
add_action( 'admin_notices', function () {
	if ( function_exists( 'amp_bk_public_data' ) || ! current_user_can( 'activate_plugins' ) ) return;
	echo '<div class="notice notice-warning"><p><strong>All-Moh\'s-Paradise theme:</strong> activate the <em>All-Moh\'s-Paradise Booking (demo)</em> plugin to enable the booking card, calendar and instant quote.</p></div>';
} );

// v4.1: Contact Form 7 assets only where a form is rendered (the Contact & Book page).
add_filter( 'wpcf7_load_js', function ( $load ) { return $load && is_page( 'contact-book' ); } );
add_filter( 'wpcf7_load_css', function ( $load ) { return $load && is_page( 'contact-book' ); } );
