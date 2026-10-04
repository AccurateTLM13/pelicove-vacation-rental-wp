<?php
/**
 * v4.1 front-end performance helpers (theme-specific; site-wide server tweaks live in the
 * "Pelicove Performance" mu-plugin). Everything here only changes rendered HTML — no database writes.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

/** Season shown by default (matches the inline head script when the visitor has no saved choice). */
function sbh_default_season() {
	$m = (int) wp_date( 'n', null, new DateTimeZone( 'America/Chicago' ) );
	return in_array( $m, array( 11, 12, 1, 2 ), true ) ? 'snowbird' : 'summer';
}

/** Responsive hero poster sources (AVIF + WebP; portrait crops for phones). */
function sbh_hero_sources( $season ) {
	$u = get_stylesheet_directory_uri() . '/assets/media/hero-' . $season;
	$m = array( 'avif' => "$u-m480.avif 480w, $u-m608.avif 608w", 'webp' => "$u-m480.webp 480w, $u-m608.webp 608w" );
	$d = array( 'avif' => "$u-960.avif 960w, $u-1280.avif 1280w, $u-1920.avif 1920w", 'webp' => "$u-960.webp 960w, $u-1280.webp 1280w, $u-1920.webp 1920w" );
	return array( 'mobile' => $m, 'desktop' => $d, 'fallback' => get_stylesheet_directory_uri() . '/assets/media/hero-' . $season . '-poster.jpg' );
}

/** Preload the LCP hero poster for the default season (front page only). */
add_action( 'wp_head', function () {
	if ( ! is_front_page() ) return;
	$s = sbh_hero_sources( sbh_default_season() );
	printf( '<link rel="preload" as="image" type="image/avif" media="(max-width: 760px)" imagesrcset="%s" imagesizes="100vw" fetchpriority="high">' . "\n", esc_attr( $s['mobile']['avif'] ) );
	printf( '<link rel="preload" as="image" type="image/avif" media="(min-width: 761px)" imagesrcset="%s" imagesizes="100vw" fetchpriority="high">' . "\n", esc_attr( $s['desktop']['avif'] ) );
}, 1 ); // after <meta name="viewport"> (priority 0) so the media queries are evaluated against the real mobile width

/** Let WordPress inline the small shared block-library CSS too (one less render-blocking request). */
add_action( 'wp_enqueue_scripts', function () {
	$f = ABSPATH . WPINC . '/css/dist/block-library/common.min.css';
	if ( wp_style_is( 'wp-block-library', 'registered' ) && file_exists( $f ) && false !== strpos( (string) wp_styles()->registered['wp-block-library']->src, 'common' ) ) wp_style_add_data( 'wp-block-library', 'path', $f );
	// Same for Contact Form 7 (contact page) and Leaflet (location page) stylesheets.
	if ( wp_style_is( 'contact-form-7', 'enqueued' ) && defined( 'WPCF7_PLUGIN_DIR' ) && file_exists( WPCF7_PLUGIN_DIR . '/includes/css/styles.css' ) ) wp_style_add_data( 'contact-form-7', 'path', WPCF7_PLUGIN_DIR . '/includes/css/styles.css' );
	if ( wp_style_is( 'leaflet', 'enqueued' ) ) wp_style_add_data( 'leaflet', 'path', get_stylesheet_directory() . '/assets/vendor/leaflet/leaflet.css' );
}, 99 );

/** Rewrite rendered post content: responsive hero posters, no video poster, one high-priority image per page, heading order. */
add_filter( 'the_content', function ( $html ) {
	if ( is_admin() || ! is_singular() || ! in_the_loop() && ! did_action( 'wp_head' ) ) return $html;
	if ( is_front_page() && strpos( $html, 'amp-hero-poster' ) !== false ) {
		$html = str_replace( ' fetchpriority="high"', '', $html );
		$def = sbh_default_season();
		$html = preg_replace_callback( '#<picture class="amp-hero-poster" data-season-show="(summer|snowbird)">.*?</picture>#s', function ( $m ) use ( $def ) {
			$season = $m[1]; $s = sbh_hero_sources( $season ); $lcp = ( $season === $def );
			$o  = '<picture class="amp-hero-poster" data-season-show="' . $season . '">';
			$o .= '<source type="image/avif" media="(max-width: 760px)" srcset="' . esc_attr( $s['mobile']['avif'] ) . '" sizes="100vw">';
			$o .= '<source type="image/webp" media="(max-width: 760px)" srcset="' . esc_attr( $s['mobile']['webp'] ) . '" sizes="100vw">';
			$o .= '<source type="image/avif" srcset="' . esc_attr( $s['desktop']['avif'] ) . '" sizes="100vw">';
			$o .= '<source type="image/webp" srcset="' . esc_attr( $s['desktop']['webp'] ) . '" sizes="100vw">';
			$o .= '<img src="' . esc_url( $s['fallback'] ) . '" width="1920" height="1080" alt="" decoding="' . ( $lcp ? 'sync' : 'async' ) . '"' . ( $lcp ? ' fetchpriority="high"' : ' loading="lazy" fetchpriority="low"' ) . '>';
			return $o . '</picture>';
		}, $html );
		// Everything below the full-screen hero is off-screen at load: lazy-load any content image without a loading attribute.
		$html = preg_replace_callback( '#<img\b(?![^>]*\bloading=)[^>]*>#', function ( $m ) {
			return ( strpos( $m[0], 'hero-summer-poster' ) !== false || strpos( $m[0], 'hero-snowbird-poster' ) !== false ) ? $m[0] : preg_replace( '#^<img\b#', '<img loading="lazy"', $m[0] );
		}, $html );
		// The poster is already painted by the <picture>; a video poster would be a second download competing for LCP.
		$html = preg_replace_callback( '#<video class="amp-hero-video"[^>]*>#', function ( $m ) { return preg_replace( '# poster="[^"]*"#', '', $m[0] ); }, $html );
	} elseif ( ! is_front_page() ) {
		// The template's cover image is the LCP on inner pages; nothing in the content should compete with it.
		$html = str_replace( ' fetchpriority="high"', '', $html );
	}
	// Hand-written <img> tags pointing at a resized upload (no wp-image-N class, so core adds no srcset/size):
	// add width/height (prevents layout shift) and a srcset so phones get a smaller rendition.
	$html = preg_replace_callback( '#<img\b(?![^>]*\bsrcset=)[^>]*\bsrc="([^"]+/wp-content/uploads/[^"]+?)(?:-(\d+)x(\d+))?\.(jpe?g|png)"[^>]*>#i', 'sbh_img_add_srcset', $html );
	// Heading order: if the first heading in the content is deeper than h2, promote it to h2 (keeps its look via .sbh-hN).
	if ( preg_match( '#<h([1-6])([^>]*)>#', $html, $h, PREG_OFFSET_CAPTURE ) && (int) $h[1][0] > 2 ) {
		$lvl = (int) $h[1][0]; $start = $h[0][1];
		$end = strpos( $html, '</h' . $lvl . '>', $start );
		if ( $end !== false ) {
			$open = $h[0][0];
			$new  = preg_match( '#class="#', $open ) ? preg_replace( '#class="#', 'class="sbh-h' . $lvl . ' ', $open, 1 ) : str_replace( '<h' . $lvl, '<h' . $lvl . ' class="sbh-h' . $lvl . '"', $open );
			$new  = '<h2' . substr( $new, 3 );
			$html = substr( $html, 0, $start ) . $new . substr( $html, $start + strlen( $open ), $end - $start - strlen( $open ) ) . '</h2>' . substr( $html, $end + 5 );
		}
	}
	return $html;
}, 20 );

/** Only the first image on a page (the hero / cover) is above the fold on every layout: lazy-load everything after it. */
add_filter( 'wp_omit_loading_attr_threshold', function () { return 1; } );

/** Callback for the content filter above: srcset/sizes/width/height for a bare upload <img>. */
function sbh_img_add_srcset( $m ) {
	$tag = $m[0];
	$id  = attachment_url_to_postid( $m[1] . '.' . $m[4] );
	if ( ! $id ) return $tag;
	$meta = wp_get_attachment_metadata( $id );
	if ( empty( $meta['width'] ) ) return $tag;
	$w = $m[2] ? (int) $m[2] : (int) $meta['width'];
	$h = $m[3] ? (int) $m[3] : (int) $meta['height'];
	$srcset = wp_calculate_image_srcset( array( $w, $h ), $m[0] ? preg_replace( '#.*\bsrc="([^"]+)".*#s', '$1', $tag ) : '', $meta, $id );
	if ( ! $srcset ) return $tag;
	$sizes = apply_filters( 'sbh_bare_img_sizes', '(max-width: 900px) calc(100vw - 64px), ' . min( $w, 640 ) . 'px', $id );
	$extra = ' srcset="' . esc_attr( $srcset ) . '" sizes="' . esc_attr( $sizes ) . '"';
	if ( ! preg_match( '#\bwidth=#', $tag ) ) {
		$extra .= ' width="' . $w . '" height="' . $h . '"';
		// keep the CSS-driven box (e.g. aspect-ratio) authoritative: the attributes only supply the ratio before load
		$tag = preg_match( '#\bclass="#', $tag ) ? preg_replace( '#\bclass="#', 'class="sbh-sized ', $tag, 1 ) : preg_replace( '#^<img\b#', '<img class="sbh-sized"', $tag );
	}
	return preg_replace( '#^<img\b#', '<img' . $extra, $tag );
}
