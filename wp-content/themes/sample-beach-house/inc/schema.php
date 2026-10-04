<?php
/**
 * Structured data for the fictional demo. "Pelicove Vacation Homes" is a made-up brand; no street address,
 * only approximate area coordinates (2 decimals, the map's area circle) and no aggregateRating (the reviews on this site are labeled samples).
 * FAQPage is generated from the <details class="amp-faq-item"> blocks on the page, so copy and schema never drift.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

function amp_schema_rental() {
	$imgs = array();
	foreach ( array( 'v4-hero', 'v4-exterior', 'v4-exterior2', 'v4-living', 'v4-kitchen2', 'v4-dining', 'v4-primary', 'v4-bed28', 'v4-bath', 'v4-balcony', 'v4-deck', 'v4-view3' ) as $k ) {
		$a = get_posts( array( 'post_type' => 'attachment', 'meta_key' => '_sbh_key', 'meta_value' => $k, 'numberposts' => 1 ) );
		if ( $a ) $imgs[] = wp_get_attachment_image_url( $a[0]->ID, 'full' );
	}
	$amen = array( 'Wi-Fi', 'Air conditioning', 'Heating', 'Washer', 'Dryer', 'Dishwasher', 'Smart TV', 'Covered parking', 'Grill', 'Balcony', 'Gulf view', 'Ceiling fans' );
	$org = array(
		'@type' => 'Organization', '@id' => home_url( '/#org' ),
		'name' => 'Pelicove Vacation Homes (fictional demo brand)', 'url' => home_url( '/' ),
		'telephone' => '+1-251-555-0142', 'email' => 'hello@pelicove.example',
		'description' => 'A fictional company created for a portfolio demo. Not affiliated with any real rental company or property.',
		'logo' => array( '@type' => 'ImageObject', 'url' => get_stylesheet_directory_uri() . '/assets/img/pelicove-mark-512.png', 'width' => 512, 'height' => 512 ),
	);
	return array(
		'@context' => 'https://schema.org',
		'@graph' => array(
			$org,
			array(
				'@type' => 'VacationRental', '@id' => home_url( '/#rental' ),
				'name' => "All-Moh's-Paradise (demo)", 'url' => home_url( '/' ),
				'description' => 'A fictional four-bedroom, three-and-a-half-bath raised beach house in the Fort Morgan area of Alabama, sleeping 8. Demo content.',
				'image' => $imgs,
				'identifier' => 'pelicove-demo-amp-001',
				'address' => array( '@type' => 'PostalAddress', 'addressLocality' => 'Gulf Shores', 'addressRegion' => 'AL', 'addressCountry' => 'US' ),
				// General Fort Morgan Rd area only (same approximate circle the site map shows) — not a real house location.
				'latitude' => 30.23, 'longitude' => -87.97,
				'containsPlace' => array(
					'@type' => 'Accommodation', 'additionalType' => 'EntirePlace',
					'numberOfBedrooms' => 4, 'numberOfBathroomsTotal' => 4, 'numberOfFullBathrooms' => 3, 'numberOfPartialBathrooms' => 1,
					'occupancy' => array( '@type' => 'QuantitativeValue', 'maxValue' => 8 ),
					'bed' => array(
						array( '@type' => 'BedDetails', 'numberOfBeds' => 2, 'typeOfBed' => 'King' ),
						array( '@type' => 'BedDetails', 'numberOfBeds' => 1, 'typeOfBed' => 'Queen' ),
						array( '@type' => 'BedDetails', 'numberOfBeds' => 2, 'typeOfBed' => 'Twin' ),
					),
					'amenityFeature' => array_map( function ( $a ) { return array( '@type' => 'LocationFeatureSpecification', 'name' => $a, 'value' => true ); }, $amen ),
					'petsAllowed' => false, 'smokingAllowed' => false,
				),
				'brand' => array( '@id' => home_url( '/#org' ) ),
				'knowsLanguage' => 'en',
			),
		),
	);
}

function amp_schema_faq( $content ) {
	if ( stripos( $content, 'amp-faq-item' ) === false ) return null;
	if ( ! preg_match_all( '#<details[^>]*class="[^"]*amp-faq-item[^"]*"[^>]*>\s*<summary[^>]*>(.*?)</summary>(.*?)</details>#si', $content, $m, PREG_SET_ORDER ) ) return null;
	$q = array();
	foreach ( $m as $x ) {
		$q[] = array( '@type' => 'Question', 'name' => trim( wp_strip_all_tags( $x[1] ) ), 'acceptedAnswer' => array( '@type' => 'Answer', 'text' => trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $x[2], false ) ) ) ) );
	}
	return array( '@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => $q );
}

add_action( 'wp_head', function () {
	$out = array();
	if ( is_front_page() || is_page( array( 'the-house', 'rates-availability', 'reviews' ) ) ) $out[] = amp_schema_rental();
	if ( is_singular() ) { $f = amp_schema_faq( get_post_field( 'post_content', get_queried_object_id() ) ); if ( $f ) $out[] = $f; }
	foreach ( $out as $o ) echo '<script type="application/ld+json">' . wp_json_encode( $o, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "</script>\n";
}, 30 );
