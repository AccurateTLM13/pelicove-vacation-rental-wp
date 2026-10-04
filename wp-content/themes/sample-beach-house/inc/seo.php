<?php
/**
 * v4.1 on-page SEO for the fictional demo: titles, meta descriptions, canonical-friendly Open Graph /
 * Twitter cards, BreadcrumbList + WebSite JSON-LD, and a couple of crawl-hygiene tweaks.
 * Copy is kept explicit that All-Moh's-Paradise / Pelicove Vacation Homes is a fictional demo.
 * The per-page map below wins over page excerpts so the "fictional demo" wording stays consistent;
 * use the `sbh_seo_meta` filter to change it in code. Pages not in the map fall back to their excerpt.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

function sbh_seo_meta() {
	$site = "All-Moh's-Paradise";
	$map  = array(
		'home'                => array( "All-Moh's-Paradise — Fort Morgan Beach House (Fictional Demo)", "A fictional 4-bedroom Fort Morgan, Alabama beach house demo by the made-up brand Pelicove Vacation Homes: photos, instant example quotes, area guide and sample reviews." ),
		'the-house'           => array( "The House — 4BR Raised Beach Home, Sleeps 8 | $site", "Tour the fictional 4-bedroom, 3½-bath raised beach house: room-by-room details, beds, the primary-suite balcony and honest home truths. A demo site, not a real rental." ),
		'gallery'             => array( "Photo Gallery & 360° Tour | $site", "Room-by-room photo tour of the fictional All-Moh's-Paradise beach house, plus sample 360° views. Stock photos (Unsplash) — this is a demo, not a real property." ),
		'amenities'           => array( "Amenities & What's Included | $site", "Everything included at the fictional All-Moh's-Paradise demo house: Wi-Fi, full kitchen, washer and dryer, grill, beach gear and fresh linens. Demo content." ),
		'rates-availability'  => array( "Rates & Availability — Instant Quote | $site", "Pick dates for an instant example quote with nightly rate, cleaning fee and Alabama lodging tax. Example rates on a fictional demo — nothing is booked or charged." ),
		'location-area-guide' => array( "Fort Morgan Location & Area Guide | $site", "Quiet Fort Morgan, with Gulf Shores and Orange Beach a short drive away: beaches, food, golf, the ferry and the fort. Area guide for a fictional demo rental." ),
		'reviews'             => array( "Sample Guest Reviews | $site", "Sample reviews written for the fictional All-Moh's-Paradise demo: sort by date or rating and filter by topic. Not real guest reviews — clearly labeled demo content." ),
		'contact-book'        => array( "Contact & Request to Book | $site", "Send a free, non-binding request for the fictional All-Moh's-Paradise demo house, or read the booking FAQ. Demo only: fictional phone and email, nothing is booked." ),
	);
	$key = is_front_page() ? 'home' : ( is_page() ? get_post_field( 'post_name', get_queried_object_id() ) : '' );
	$m   = isset( $map[ $key ] ) ? $map[ $key ] : null;
	if ( ! $m && is_singular() ) {
		$ex = get_the_excerpt( get_queried_object_id() );
		$m  = array( '', $ex ? wp_strip_all_tags( $ex ) . ' (Fictional demo site.)' : '' );
	}
	return apply_filters( 'sbh_seo_meta', $m ? array( 'title' => $m[0], 'desc' => $m[1], 'key' => $key ) : null );
}

add_filter( 'pre_get_document_title', function ( $t ) {
	if ( is_404() ) return "Page not found | All-Moh's-Paradise";
	$m = sbh_seo_meta();
	return ( $m && $m['title'] ) ? $m['title'] : $t;
}, 20 );

add_action( 'wp_head', function () {
	if ( is_404() ) return; // noindex is added through the wp_robots filter below
	$m = sbh_seo_meta(); if ( ! $m ) return;
	$url   = is_front_page() ? home_url( '/' ) : get_permalink( get_queried_object_id() );
	$title = $m['title'] ? $m['title'] : wp_get_document_title();
	$img   = get_stylesheet_directory_uri() . '/assets/img/og-cover.jpg';
	$alt   = "All-Moh's-Paradise fictional beach-house demo site shown on a laptop and a phone";
	$tags  = array(
		array( 'name', 'description', $m['desc'] ),
		array( 'property', 'og:type', 'website' ),
		array( 'property', 'og:site_name', "All-Moh's-Paradise (fictional demo)" ),
		array( 'property', 'og:locale', 'en_US' ),
		array( 'property', 'og:title', $title ),
		array( 'property', 'og:description', $m['desc'] ),
		array( 'property', 'og:url', $url ),
		array( 'property', 'og:image', $img ),
		array( 'property', 'og:image:width', '1200' ),
		array( 'property', 'og:image:height', '630' ),
		array( 'property', 'og:image:type', 'image/jpeg' ),
		array( 'property', 'og:image:alt', $alt ),
		array( 'name', 'twitter:card', 'summary_large_image' ),
		array( 'name', 'twitter:title', $title ),
		array( 'name', 'twitter:description', $m['desc'] ),
		array( 'name', 'twitter:image', $img ),
		array( 'name', 'twitter:image:alt', $alt ),
	);
	foreach ( $tags as $t ) printf( '<meta %s="%s" content="%s">' . "\n", $t[0], esc_attr( $t[1] ), esc_attr( $t[2] ) );
	echo '<meta name="theme-color" content="#12304F">' . "\n";

	// JSON-LD: WebSite on the front page, BreadcrumbList on inner pages.
	if ( is_front_page() ) {
		$ld = array( '@context' => 'https://schema.org', '@type' => 'WebSite', '@id' => home_url( '/#website' ), 'url' => home_url( '/' ), 'name' => "All-Moh's-Paradise", 'alternateName' => "All-Moh's-Paradise (fictional demo)", 'inLanguage' => 'en-US', 'publisher' => array( '@id' => home_url( '/#org' ) ) );
	} elseif ( is_page() ) {
		$ld = array( '@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => array(
			array( '@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => home_url( '/' ) ),
			array( '@type' => 'ListItem', 'position' => 2, 'name' => html_entity_decode( get_the_title( get_queried_object_id() ), ENT_QUOTES ), 'item' => $url ),
		) );
	}
	if ( ! empty( $ld ) ) echo '<script type="application/ld+json">' . wp_json_encode( $ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "</script>\n";
}, 2 );

// Author archives on a one-author brochure site are thin duplicates and leak the login name: send them home.
add_action( 'template_redirect', function () {
	if ( is_author() || ( isset( $_GET['author'] ) && ! is_admin() ) ) { wp_safe_redirect( home_url( '/' ), 301 ); exit; }
	if ( is_attachment() ) { $p = wp_get_post_parent_id( get_queried_object_id() ); wp_safe_redirect( $p ? get_permalink( $p ) : home_url( '/' ), 301 ); exit; }
}, 1 );
// Keep the users sitemap out (it would list the admin login name).
add_filter( 'wp_sitemaps_add_provider', function ( $provider, $name ) { return 'users' === $name ? false : $provider; }, 10, 2 );

/** 404: a single robots meta (core's) carrying noindex. */
add_filter( 'wp_robots', function ( $r ) {
	if ( is_404() ) { $r['noindex'] = true; $r['follow'] = true; unset( $r['max-image-preview'] ); }
	return $r;
} );
