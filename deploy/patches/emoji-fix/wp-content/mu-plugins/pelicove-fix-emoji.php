<?php
/**
 * Plugin Name: Pelicove – one-shot emoji icon fix
 * Description: Runs ONCE on the next wp-admin page load by an administrator. Restores the .sbh-icon emoji on
 *              /amenities/ and /location-area-guide/ as ASCII-safe HTML entities, converts utf8/utf8mb3 WP tables
 *              to utf8mb4 when the server supports it, logs to option `pelicove_emoji_fix_log`, clears Cache Enabler,
 *              then becomes a no-op (flag option `pelicove_emoji_fix_done`). Delete this file afterwards.
 * Version: 1.0.0
 */
defined( 'ABSPATH' ) || exit;

if ( get_option( 'pelicove_emoji_fix_done' ) ) {
	// Already ran: no-op, except a one-line admin notice so the admin knows it's safe to delete the file.
	add_action( 'admin_notices', function () {
		if ( current_user_can( 'manage_options' ) ) {
			echo '<div class="notice notice-info"><p>Pelicove emoji fix already ran (' . esc_html( get_option( 'pelicove_emoji_fix_done' ) ) . '). You can delete <code>wp-content/mu-plugins/pelicove-fix-emoji.php</code>.</p></div>';
		}
	} );
	return;
}

add_action( 'admin_init', 'pelicove_emoji_fix_run', 1 );

function pelicove_emoji_fix_map() {
	// slug => [ heading text that follows the span => entity ]. Context-matched; nothing else is touched.
	return array(
		28 => array( 'slug' => 'amenities', 'icons' => array(
			'Beach & Outdoors'   => array( '&#x1F30A;', "\u{1F30A}" ),          // 🌊
			'Kitchen & Dining'   => array( '&#x1F373;', "\u{1F373}" ),          // 🍳
			'Comfort'            => array( '&#x1F6CB;&#xFE0F;', "\u{1F6CB}\u{FE0F}" ), // 🛋️
			'Connect & Work'     => array( '&#x1F4F6;', "\u{1F4F6}" ),          // 📶
			'Parking & Access'   => array( '&#x1F697;', "\u{1F697}" ),          // 🚗
			'Practical & Safety' => array( '&#x1F9FA;', "\u{1F9FA}" ),          // 🧺
		) ),
		30 => array( 'slug' => 'location-area-guide', 'icons' => array(
			'History & the bay'     => array( '&#x1F3F0;', "\u{1F3F0}" ),       // 🏰
			'Nature'                => array( '&#x1F985;', "\u{1F985}" ),       // 🦅
			'Eat & drink nearby'    => array( '&#x1F990;', "\u{1F990}" ),       // 🦐
			'Play & provisions'     => array( '&#x26F3;', "\u{26F3}" ),         // ⛳ (3-byte; was not damaged, normalised anyway)
			'Parks & beaches'       => array( '&#x1F334;', "\u{1F334}" ),       // 🌴
			'Food & fun'            => array( '&#x1F3B6;', "\u{1F3B6}" ),       // 🎶
			'Orange Beach & beyond' => array( '&#x1F3A1;', "\u{1F3A1}" ),       // 🎡
		) ),
	);
}

function pelicove_emoji_fix_run() {
	if ( ! current_user_can( 'manage_options' ) || wp_doing_ajax() || get_option( 'pelicove_emoji_fix_done' ) ) {
		return;
	}
	global $wpdb;
	// Claim the run first so a concurrent admin request can't run it twice.
	if ( ! add_option( 'pelicove_emoji_fix_done', 'running ' . gmdate( 'c' ), '', 'no' ) ) {
		return;
	}
	$log = array( 'started' => gmdate( 'c' ), 'server' => $wpdb->db_server_info(), 'conn_charset' => $wpdb->charset,
		'conn_collate' => $wpdb->collate, 'DB_CHARSET' => DB_CHARSET, 'utf8mb4_supported' => (bool) $wpdb->has_cap( 'utf8mb4' ) );

	// 1) Table charset: record before, convert utf8/utf8mb3 -> utf8mb4 (WP core logic, plus utf8mb3 names).
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$tables = $wpdb->get_col( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $wpdb->prefix ) . '%' ) );
	$collate = $wpdb->has_cap( 'utf8mb4_520' ) ? 'utf8mb4_unicode_520_ci' : 'utf8mb4_unicode_ci';
	foreach ( $tables as $t ) {
		$st     = $wpdb->get_row( "SHOW TABLE STATUS LIKE '" . esc_sql( $t ) . "'" );
		$cols   = $wpdb->get_results( "SHOW FULL COLUMNS FROM `$t`" );
		$cs     = array();
		foreach ( (array) $cols as $c ) {
			if ( $c->Collation ) { $cs[ $c->Field ] = $c->Collation; }
		}
		$entry  = array( 'before' => $st ? $st->Collation : '?', 'cols' => array_count_values( $cs ) );
		$needs  = false; $safe = true;
		foreach ( $cs as $coll ) {
			$p = strtolower( strtok( $coll, '_' ) );
			if ( 'utf8' === $p || 'utf8mb3' === $p ) { $needs = true; } elseif ( 'utf8mb4' !== $p ) { $safe = false; }
		}
		if ( $st && in_array( strtolower( strtok( $st->Collation, '_' ) ), array( 'utf8', 'utf8mb3' ), true ) ) { $needs = true; }
		if ( ! $needs ) {
			$entry['action'] = 'already utf8mb4';
		} elseif ( ! $wpdb->has_cap( 'utf8mb4' ) ) {
			$entry['action'] = 'skipped: server lacks utf8mb4';
		} elseif ( ! $safe ) {
			$entry['action'] = 'skipped: non-utf8 columns';
		} else {
			$r = maybe_convert_table_to_utf8mb4( $t ); // handles "utf8_*" names
			$st2 = $wpdb->get_row( "SHOW TABLE STATUS LIKE '" . esc_sql( $t ) . "'" );
			$left = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND (COLLATION_NAME LIKE 'utf8\\_%%' OR COLLATION_NAME LIKE 'utf8mb3%%')", $t ) );
			if ( 0 !== strpos( $st2->Collation, 'utf8mb4' ) || false === $r || $left > 0 ) {
				// "utf8mb3_*" names (MySQL 8.0.30+/MariaDB 10.6+) are refused by core; same safe ALTER here.
				$r = $wpdb->query( "ALTER TABLE `$t` CONVERT TO CHARACTER SET utf8mb4 COLLATE $collate" );
				$st2 = $wpdb->get_row( "SHOW TABLE STATUS LIKE '" . esc_sql( $t ) . "'" );
			}
			$entry['action'] = ( false === $r ? 'FAILED: ' . $wpdb->last_error : 'converted' ) . ' -> ' . $st2->Collation;
		}
		$log['tables'][ $t ] = $entry;
	}

	// 2) Posts: back up, save a revision, then context-match each icon span.
	$backup = array();
	foreach ( pelicove_emoji_fix_map() as $id => $def ) {
		$post = get_post( $id );
		if ( ! $post || $post->post_name !== $def['slug'] ) {
			$post = get_page_by_path( $def['slug'] );
		}
		if ( ! $post ) { $log['posts'][ $def['slug'] ] = 'NOT FOUND'; continue; }
		$old = $post->post_content; $new = $old; $hits = array();
		foreach ( $def['icons'] as $label => $pair ) {
			list( $entity, $glyph ) = $pair;
			$lab = str_replace( '&', '&(?:amp;|#038;)?', preg_quote( $label, '~' ) );
			// Inner text must be damaged (?-runs, optionally with surviving U+FE0F), the original glyph, or the entity already.
			$inner = '(?:\?+(?:\x{FE0F}|&#xFE0F;)?|' . preg_quote( $glyph, '~' ) . '|' . preg_quote( $entity, '~' ) . ')';
			$re = '~(<span class="sbh-icon" aria-hidden="true">)' . $inner . '(</span>\s*' . $lab . '\s*</h3>)~u';
			$c = 0;
			$new = preg_replace_callback( $re, function ( $m ) use ( $entity ) { return $m[1] . $entity . $m[2]; }, $new, -1, $c );
			$hits[ $label ] = $c;
		}
		$entry = array( 'id' => $post->ID, 'matches' => $hits, 'damaged_before' => substr_count( $old, '>????' ) );
		if ( $new !== $old && null !== $new ) {
			$backup[ $post->ID ] = $old;
			$rev = _wp_put_post_revision( $post ); // revision = pre-fix content
			$ok  = $wpdb->update( $wpdb->posts, array( 'post_content' => $new ), array( 'ID' => $post->ID ) );
			clean_post_cache( $post->ID );
			$entry['revision_id'] = is_wp_error( $rev ) ? $rev->get_error_message() : $rev;
			$entry['result'] = false === $ok ? 'FAILED: ' . $wpdb->last_error : 'updated';
		} else {
			$entry['result'] = 'unchanged';
		}
		$log['posts'][ $def['slug'] ] = $entry;
	}
	if ( $backup ) { update_option( 'pelicove_emoji_fix_backup', $backup, false ); }

	// 3) Caches.
	do_action( 'cache_enabler_clear_complete_cache' );
	$dir = WP_CONTENT_DIR . '/cache/cache-enabler';
	if ( is_dir( $dir ) ) {
		$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::CHILD_FIRST );
		foreach ( $it as $f ) { $f->isDir() ? @rmdir( $f->getPathname() ) : @unlink( $f->getPathname() ); }
	}
	wp_cache_flush();
	do_action( 'epc_purge' ); // Bluehost/Endurance page cache, if present.
	$log['cache'] = 'cleared';

	$log['finished'] = gmdate( 'c' );
	update_option( 'pelicove_emoji_fix_log', $log, false );
	update_option( 'pelicove_emoji_fix_done', 'done ' . gmdate( 'c' ), false );

	add_action( 'admin_notices', function () use ( $log ) {
		echo '<div class="notice notice-success"><p><strong>Pelicove emoji fix ran.</strong> Now delete <code>wp-content/mu-plugins/pelicove-fix-emoji.php</code>.</p><pre style="max-height:300px;overflow:auto">'
			. esc_html( wp_json_encode( $log, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) ) . '</pre></div>';
	} );
}
