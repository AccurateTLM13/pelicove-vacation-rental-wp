<?php
/**
 * Plugin Name: All-Moh's-Paradise Booking (demo)
 * Description: Lightweight availability + instant quote for the All-Moh's-Paradise demo: blocked-night ranges in a custom MariaDB table (editable in WP Admin → Availability), seasonal [Example] rates, min-night rules, REST quote endpoint, CF7 server-side validation, iCal import/export.
 * Version: 1.1.0
 * Author: Demo build (fictional Pelicove Vacation Homes brand)
 * Requires at least: 6.3
 * Requires PHP: 7.4
 */
if ( ! defined( 'ABSPATH' ) ) exit;

define( 'AMP_BK_VER', '1.1.0' );

/* ------------------------------------------------------------------ *
 * Storage
 * ------------------------------------------------------------------ */
function amp_bk_table() { global $wpdb; return $wpdb->prefix . 'amp_blocked'; }

function amp_bk_install() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$t = amp_bk_table(); $c = $wpdb->get_charset_collate();
	dbDelta( "CREATE TABLE $t (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		check_in date NOT NULL,
		check_out date NOT NULL,
		label varchar(190) NOT NULL DEFAULT '',
		source varchar(20) NOT NULL DEFAULT 'manual',
		uid varchar(190) NOT NULL DEFAULT '',
		created datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY  (id),
		KEY check_in (check_in),
		KEY source (source)
	) $c;" );
	if ( ! get_option( 'amp_bk_settings' ) ) update_option( 'amp_bk_settings', amp_bk_default_settings() );
	update_option( 'amp_bk_db', AMP_BK_VER );
}
register_activation_hook( __FILE__, 'amp_bk_install' );
function amp_bk_table_exists() {
	global $wpdb; $t = amp_bk_table();
	return $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $t ) ) ) === $t;
}
/**
 * Self-heal after a migration (Duplicator / All-in-One WP Migration / manual import): if the schema version
 * changed or the table is missing, (re)create it. The SHOW TABLES check runs at most every 12 hours.
 */
function amp_bk_maybe_install() {
	static $done = false; if ( $done ) return; $done = true;
	if ( get_option( 'amp_bk_db' ) !== AMP_BK_VER ) { amp_bk_install(); set_transient( 'amp_bk_table_ok', 1, 12 * HOUR_IN_SECONDS ); return; }
	if ( get_transient( 'amp_bk_table_ok' ) ) return;
	if ( ! amp_bk_table_exists() ) amp_bk_install();
	set_transient( 'amp_bk_table_ok', 1, 12 * HOUR_IN_SECONDS );
}
add_action( 'plugins_loaded', 'amp_bk_maybe_install' );
add_action( 'admin_init', function () { delete_transient( 'amp_bk_table_ok' ); }, 1 );

function amp_bk_default_settings() {
	return array(
		// All rates are [Example] figures for this fictional demo.
		'seasons' => array(
			array( 'key' => 'winter', 'name' => 'Snowbird winter', 'months' => array( 11, 12, 1, 2 ), 'nightly' => 300, 'min' => 3 ),
			array( 'key' => 'spring', 'name' => 'Spring', 'months' => array( 3, 4, 5 ), 'nightly' => 475, 'min' => 3 ),
			array( 'key' => 'summer', 'name' => 'Summer peak', 'months' => array( 6, 7, 8 ), 'nightly' => 650, 'min' => 7 ),
			array( 'key' => 'fall', 'name' => 'Fall', 'months' => array( 9, 10 ), 'nightly' => 450, 'min' => 3 ),
		),
		'cleaning_fee' => 250,       // [Example]
		'weekly_discount' => 10,      // [Example] % off nightly total for 7+ nights
		'monthly_discount' => 25,     // [Example] % off for 28+ nights (demo: monthly snowbird stays Nov – Feb)
		'tax_rate' => 6.0,            // Verified: AL state lodging 4% + Baldwin County lodging tax district 2% (unincorporated Fort Morgan)
		'tax_label' => 'Lodging tax 6% (AL 4% + Baldwin Co. 2%)',
		'tax_source' => 'https://www.gulfshores.com/partners/lodging-tax-information/',
		'max_guests' => 8,
		'max_nights' => 90,
		'ical_url' => '',
	);
}
function amp_bk_settings() { return wp_parse_args( get_option( 'amp_bk_settings', array() ), amp_bk_default_settings() ); }

function amp_bk_ranges( $from = null, $to = null ) {
	global $wpdb; $t = amp_bk_table();
	$from = $from ?: gmdate( 'Y-m-d', strtotime( '-7 days', current_time( 'timestamp' ) ) );
	$to = $to ?: gmdate( 'Y-m-d', strtotime( '+24 months', current_time( 'timestamp' ) ) );
	return $wpdb->get_results( $wpdb->prepare( "SELECT id, check_in, check_out, label, source FROM $t WHERE check_out > %s AND check_in < %s ORDER BY check_in", $from, $to ), ARRAY_A );
}
function amp_bk_add_range( $in, $out, $label = '', $source = 'manual', $uid = '' ) {
	global $wpdb;
	if ( ! amp_bk_valid_date( $in ) || ! amp_bk_valid_date( $out ) || $out <= $in ) return new WP_Error( 'amp_dates', 'Check-out must be after check-in.' );
	$wpdb->insert( amp_bk_table(), array( 'check_in' => $in, 'check_out' => $out, 'label' => $label, 'source' => $source, 'uid' => $uid ) );
	return (int) $wpdb->insert_id;
}
function amp_bk_valid_date( $d ) { return is_string( $d ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $d ) && checkdate( (int) substr( $d, 5, 2 ), (int) substr( $d, 8, 2 ), (int) substr( $d, 0, 4 ) ); }

/* ------------------------------------------------------------------ *
 * Rules + quote (mirrors assets/js/booking.js so client and server agree)
 * ------------------------------------------------------------------ */
function amp_bk_season_for( $ymd, $s = null ) {
	$s = $s ?: amp_bk_settings(); $m = (int) substr( $ymd, 5, 2 );
	foreach ( $s['seasons'] as $se ) if ( in_array( $m, array_map( 'intval', $se['months'] ), true ) ) return $se;
	return $s['seasons'][0];
}
function amp_bk_booked_nights( $ranges ) {
	$n = array();
	foreach ( $ranges as $r ) { for ( $t = strtotime( $r['check_in'] . ' 12:00 UTC' ); $t < strtotime( $r['check_out'] . ' 12:00 UTC' ); $t += DAY_IN_SECONDS ) $n[ gmdate( 'Y-m-d', $t ) ] = true; }
	return $n;
}
function amp_bk_quote( $in, $out, $guests = 2 ) {
	$s = amp_bk_settings(); $today = current_time( 'Y-m-d' );
	if ( ! amp_bk_valid_date( $in ) || ! amp_bk_valid_date( $out ) ) return new WP_Error( 'amp_dates', 'Please choose a check-in and check-out date.' );
	if ( $in < $today ) return new WP_Error( 'amp_past', 'Check-in can’t be in the past.' );
	$nights = (int) round( ( strtotime( "$out 12:00 UTC" ) - strtotime( "$in 12:00 UTC" ) ) / DAY_IN_SECONDS );
	if ( $nights < 1 ) return new WP_Error( 'amp_order', 'Check-out must be after check-in.' );
	$season = amp_bk_season_for( $in, $s );
	if ( $nights < (int) $season['min'] ) return new WP_Error( 'amp_min', sprintf( '%s stays have a %d-night minimum.', $season['name'], $season['min'] ) );
	if ( $nights > (int) $s['max_nights'] ) return new WP_Error( 'amp_max', 'For stays over 90 nights, please contact us.' );
	$guests = (int) $guests; if ( $guests < 1 || $guests > (int) $s['max_guests'] ) return new WP_Error( 'amp_guests', 'The house sleeps up to 8 guests.' );
	$booked = amp_bk_booked_nights( amp_bk_ranges( $in, $out ) );
	$lines = array(); $rent = 0;
	for ( $i = 0; $i < $nights; $i++ ) {
		$d = gmdate( 'Y-m-d', strtotime( "$in 12:00 UTC" ) + $i * DAY_IN_SECONDS );
		if ( isset( $booked[ $d ] ) ) return new WP_Error( 'amp_booked', 'Some of those nights are already booked.' );
		$se = amp_bk_season_for( $d, $s ); $k = $se['key'];
		if ( ! isset( $lines[ $k ] ) ) $lines[ $k ] = array( 'season' => $se['name'], 'nightly' => (float) $se['nightly'], 'nights' => 0 );
		$lines[ $k ]['nights']++; $rent += (float) $se['nightly'];
	}
	$pct = $nights >= 28 ? (float) $s['monthly_discount'] : ( $nights >= 7 ? (float) $s['weekly_discount'] : 0 );
	$disc = round( $rent * $pct / 100, 2 );
	$clean = (float) $s['cleaning_fee'];
	$taxable = $rent - $disc + $clean;
	$tax = round( $taxable * (float) $s['tax_rate'] / 100, 2 );
	return array( 'check_in' => $in, 'check_out' => $out, 'nights' => $nights, 'guests' => $guests, 'lines' => array_values( $lines ), 'rent' => round( $rent, 2 ), 'discount_pct' => $pct, 'discount' => $disc, 'cleaning' => $clean, 'tax_rate' => (float) $s['tax_rate'], 'tax' => $tax, 'total' => round( $taxable + $tax, 2 ), 'example' => true );
}

/* ------------------------------------------------------------------ *
 * Front-end data + REST
 * ------------------------------------------------------------------ */
function amp_bk_public_data() {
	$s = amp_bk_settings();
	$ranges = array_map( function ( $r ) { return array( 'in' => $r['check_in'], 'out' => $r['check_out'], 'ex' => $r['source'] === 'example' ); }, amp_bk_ranges() );
	return array(
		'today' => current_time( 'Y-m-d' ),
		'seasons' => $s['seasons'], 'cleaning' => (float) $s['cleaning_fee'], 'weekly' => (float) $s['weekly_discount'], 'monthly' => (float) $s['monthly_discount'],
		'tax' => (float) $s['tax_rate'], 'taxLabel' => $s['tax_label'], 'taxSource' => $s['tax_source'], 'maxGuests' => (int) $s['max_guests'], 'maxNights' => (int) $s['max_nights'],
		'booked' => $ranges, 'contactUrl' => home_url( '/contact-book/' ), 'home' => home_url( '/' ), 'rest' => esc_url_raw( rest_url( 'amp/v1/' ) ),
	);
}
add_action( 'rest_api_init', function () {
	register_rest_route( 'amp/v1', '/availability', array( 'methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => function () { return amp_bk_public_data(); } ) );
	register_rest_route( 'amp/v1', '/quote', array( 'methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => function ( $req ) {
		$q = amp_bk_quote( sanitize_text_field( $req['check_in'] ), sanitize_text_field( $req['check_out'] ), absint( $req['guests'] ?: 2 ) );
		return is_wp_error( $q ) ? new WP_REST_Response( array( 'ok' => false, 'code' => $q->get_error_code(), 'message' => $q->get_error_message() ), 422 ) : array( 'ok' => true, 'quote' => $q );
	} ) );
} );

/* ------------------------------------------------------------------ *
 * CF7: refuse inquiries for unavailable dates / too-short stays / >8 guests
 * ------------------------------------------------------------------ */
add_filter( 'wpcf7_validate', function ( $result, $tags ) {
	$in = isset( $_POST['check-in'] ) ? sanitize_text_field( wp_unslash( $_POST['check-in'] ) ) : '';
	$out = isset( $_POST['check-out'] ) ? sanitize_text_field( wp_unslash( $_POST['check-out'] ) ) : '';
	$g = isset( $_POST['guests'] ) ? absint( $_POST['guests'] ) : 2;
	if ( ! $in || ! $out ) return $result;
	$q = amp_bk_quote( $in, $out, max( 1, $g ) );
	if ( is_wp_error( $q ) ) {
		foreach ( $tags as $tag ) { if ( $tag->name === 'check-out' ) { $result->invalidate( $tag, $q->get_error_message() ); break; } }
	}
	return $result;
}, 20, 2 );

/* ------------------------------------------------------------------ *
 * iCal: export blocked nights; optional import from any external iCal feed URL
 * ------------------------------------------------------------------ */
add_action( 'init', function () {
	if ( ! isset( $_GET['amp_ical'] ) ) return;
	header( 'Content-Type: text/calendar; charset=utf-8' );
	$host = wp_parse_url( home_url(), PHP_URL_HOST ) ?: 'example.com';
	$o = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//All-Mohs-Paradise demo//EN\r\n";
	foreach ( amp_bk_ranges() as $r ) $o .= "BEGIN:VEVENT\r\nUID:amp-{$r['id']}@{$host}\r\nDTSTART;VALUE=DATE:" . str_replace( '-', '', $r['check_in'] ) . "\r\nDTEND;VALUE=DATE:" . str_replace( '-', '', $r['check_out'] ) . "\r\nSUMMARY:Blocked\r\nEND:VEVENT\r\n";
	echo $o . "END:VCALENDAR\r\n"; exit;
} );
function amp_bk_ical_import( $url ) {
	global $wpdb;
	$res = wp_remote_get( $url, array( 'timeout' => 15 ) );
	if ( is_wp_error( $res ) ) return $res;
	$body = wp_remote_retrieve_body( $res ); $n = 0;
	if ( strpos( $body, 'BEGIN:VCALENDAR' ) === false ) return new WP_Error( 'amp_ical', 'That URL did not return an iCal feed.' );
	$wpdb->delete( amp_bk_table(), array( 'source' => 'ical' ) );
	preg_match_all( '/BEGIN:VEVENT(.*?)END:VEVENT/s', str_replace( "\r\n ", '', $body ), $m );
	foreach ( $m[1] as $ev ) {
		if ( ! preg_match( '/DTSTART[^:]*:(\d{8})/', $ev, $a ) || ! preg_match( '/DTEND[^:]*:(\d{8})/', $ev, $b ) ) continue;
		$uid = preg_match( '/UID:(.+)/', $ev, $u ) ? trim( $u[1] ) : '';
		$fmt = function ( $x ) { return substr( $x, 0, 4 ) . '-' . substr( $x, 4, 2 ) . '-' . substr( $x, 6, 2 ); };
		if ( ! is_wp_error( amp_bk_add_range( $fmt( $a[1] ), $fmt( $b[1] ), 'iCal import', 'ical', substr( $uid, 0, 190 ) ) ) ) $n++;
	}
	return $n;
}

/* ------------------------------------------------------------------ *
 * WP Admin → Availability
 * ------------------------------------------------------------------ */
add_action( 'admin_menu', function () {
	add_menu_page( 'Availability & Rates', 'Availability', 'manage_options', 'amp-availability', 'amp_bk_admin_page', 'dashicons-calendar-alt', 26 );
} );
add_action( 'admin_post_amp_bk', function () {
	if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Not allowed' );
	check_admin_referer( 'amp_bk' );
	global $wpdb; $do = sanitize_key( $_POST['do'] ?? '' ); $msg = '';
	if ( $do === 'add' ) {
		$r = amp_bk_add_range( sanitize_text_field( wp_unslash( $_POST['check_in'] ?? '' ) ), sanitize_text_field( wp_unslash( $_POST['check_out'] ?? '' ) ), sanitize_text_field( wp_unslash( $_POST['label'] ?? '' ) ), 'manual' );
		$msg = is_wp_error( $r ) ? $r->get_error_message() : 'Blocked dates added.';
	} elseif ( $do === 'delete' ) {
		$wpdb->delete( amp_bk_table(), array( 'id' => absint( $_POST['id'] ?? 0 ) ) ); $msg = 'Range removed.';
	} elseif ( $do === 'settings' ) {
		$s = amp_bk_settings();
		foreach ( $s['seasons'] as $i => $se ) {
			$s['seasons'][ $i ]['nightly'] = max( 0, (float) ( $_POST['nightly'][ $i ] ?? $se['nightly'] ) );
			$s['seasons'][ $i ]['min'] = max( 1, absint( $_POST['min'][ $i ] ?? $se['min'] ) );
		}
		foreach ( array( 'cleaning_fee', 'weekly_discount', 'monthly_discount', 'tax_rate' ) as $k ) if ( isset( $_POST[ $k ] ) ) $s[ $k ] = max( 0, (float) $_POST[ $k ] );
		$s['ical_url'] = esc_url_raw( wp_unslash( $_POST['ical_url'] ?? '' ) );
		update_option( 'amp_bk_settings', $s ); $msg = 'Settings saved.';
	} elseif ( $do === 'ical' ) {
		$s = amp_bk_settings(); $r = $s['ical_url'] ? amp_bk_ical_import( $s['ical_url'] ) : new WP_Error( 'x', 'Add an iCal URL first.' );
		$msg = is_wp_error( $r ) ? $r->get_error_message() : "Imported $r event(s) from iCal.";
	}
	wp_safe_redirect( add_query_arg( array( 'page' => 'amp-availability', 'amp_msg' => rawurlencode( $msg ) ), admin_url( 'admin.php' ) ) ); exit;
} );
function amp_bk_admin_page() {
	$s = amp_bk_settings(); $rows = amp_bk_ranges( '2000-01-01', '2100-01-01' ); $act = esc_url( admin_url( 'admin-post.php' ) );
	$hid = '<input type="hidden" name="action" value="amp_bk">' . wp_nonce_field( 'amp_bk', '_wpnonce', true, false );
	echo '<div class="wrap"><h1>Availability &amp; Rates <small style="font-size:13px;color:#666">All-Moh\'s-Paradise · fictional demo</small></h1>';
	if ( ! amp_bk_table_exists() ) { amp_bk_install(); echo '<div class="notice notice-success"><p>The availability table was missing and has been created.</p></div>'; }
	if ( ! empty( $_GET['amp_msg'] ) ) echo '<div class="notice notice-info is-dismissible"><p>' . esc_html( wp_unslash( $_GET['amp_msg'] ) ) . '</p></div>';
	echo '<p>Blocked ranges are stored in <code>' . esc_html( amp_bk_table() ) . '</code>. A range blocks the nights from check-in up to (not including) check-out, so the check-out day stays open for the next arrival. Ranges marked <em>example</em> are sample data created by the build script.</p>';
	echo '<h2>Block dates</h2><form method="post" action="' . $act . '" style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">' . $hid . '<input type="hidden" name="do" value="add"><label>Check-in<br><input type="date" name="check_in" required></label><label>Check-out<br><input type="date" name="check_out" required></label><label>Label<br><input type="text" name="label" placeholder="Owner stay, maintenance…"></label><button class="button button-primary">Block these nights</button></form>';
	echo '<table class="widefat striped" style="margin-top:16px;max-width:900px"><thead><tr><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Label</th><th>Source</th><th></th></tr></thead><tbody>';
	foreach ( $rows as $r ) {
		$n = (int) round( ( strtotime( $r['check_out'] ) - strtotime( $r['check_in'] ) ) / DAY_IN_SECONDS );
		echo '<tr><td>' . esc_html( $r['check_in'] ) . '</td><td>' . esc_html( $r['check_out'] ) . '</td><td>' . $n . '</td><td>' . esc_html( $r['label'] ) . '</td><td>' . esc_html( $r['source'] ) . '</td><td><form method="post" action="' . $act . '">' . $hid . '<input type="hidden" name="do" value="delete"><input type="hidden" name="id" value="' . (int) $r['id'] . '"><button class="button-link-delete" style="border:0;background:none;cursor:pointer">Remove</button></form></td></tr>';
	}
	if ( ! $rows ) echo '<tr><td colspan="6">No blocked dates.</td></tr>';
	echo '</tbody></table>';
	echo '<h2 style="margin-top:28px">Rates &amp; rules <span style="font-weight:400;font-size:13px">([Example] figures for this fictional demo)</span></h2><form method="post" action="' . $act . '">' . $hid . '<input type="hidden" name="do" value="settings"><table class="form-table" role="presentation"><tbody>';
	foreach ( $s['seasons'] as $i => $se ) echo '<tr><th>' . esc_html( $se['name'] ) . '<br><small>months ' . esc_html( implode( ', ', $se['months'] ) ) . '</small></th><td>$<input type="number" step="1" name="nightly[' . $i . ']" value="' . esc_attr( $se['nightly'] ) . '" style="width:90px"> / night &nbsp; min <input type="number" name="min[' . $i . ']" value="' . esc_attr( $se['min'] ) . '" style="width:60px"> nights</td></tr>';
	echo '<tr><th>Cleaning fee</th><td>$<input type="number" name="cleaning_fee" value="' . esc_attr( $s['cleaning_fee'] ) . '" style="width:90px"></td></tr>';
	echo '<tr><th>Discounts</th><td>7+ nights <input type="number" name="weekly_discount" value="' . esc_attr( $s['weekly_discount'] ) . '" style="width:60px">% &nbsp; 28+ nights <input type="number" name="monthly_discount" value="' . esc_attr( $s['monthly_discount'] ) . '" style="width:60px">%</td></tr>';
	echo '<tr><th>Lodging tax</th><td><input type="number" step="0.1" name="tax_rate" value="' . esc_attr( $s['tax_rate'] ) . '" style="width:70px">% <small>Fort Morgan (unincorporated): AL 4% + Baldwin County lodging district 2% — <a href="' . esc_url( $s['tax_source'] ) . '" target="_blank">source</a></small></td></tr>';
	echo '<tr><th>iCal import URL</th><td><input type="url" name="ical_url" value="' . esc_attr( $s['ical_url'] ) . '" class="regular-text" placeholder="https://www.airbnb.com/calendar/ical/…"><p class="description">Optional. Export feed of this calendar: <code>' . esc_html( home_url( '/?amp_ical=1' ) ) . '</code></p></td></tr>';
	echo '</tbody></table><p><button class="button button-primary">Save rates &amp; rules</button></p></form>';
	echo '<form method="post" action="' . $act . '">' . $hid . '<input type="hidden" name="do" value="ical"><button class="button">Import from iCal URL now</button></form></div>';
}
