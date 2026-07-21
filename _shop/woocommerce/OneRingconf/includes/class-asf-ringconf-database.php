<?php
/**
 * WordPress database adapter for public configurator data.
 *
 * @package ASFRingconf
 */

defined( 'ABSPATH' ) || exit;

final class ASF_Ringconf_Database {
	private const DATA_KEY_APPDATA = 'appdata';
	private const MAX_JSON_BYTES = 1048576;
	private const MAX_IMAGE_BYTES = 2097152;

	public static function install(): void {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = $wpdb->get_charset_collate();
		$data_table      = self::data_table();
		$preset_table    = self::preset_table();
		$profile_table   = self::calibration_profile_table();
		$composition_table = self::calibration_composition_table();
		$view_table      = self::calibration_view_table();

		dbDelta(
			"CREATE TABLE {$data_table} (
				id varchar(50) NOT NULL,
				value longtext NULL,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id)
			) {$charset_collate};"
		);

		dbDelta(
			"CREATE TABLE {$preset_table} (
				id varchar(24) NOT NULL,
				preset_0 longtext NULL,
				preset_1 longtext NULL,
				preset_2 longtext NULL,
				preset_3 longtext NULL,
				img longtext NULL,
				price decimal(12,2) NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				KEY updated_at (updated_at)
			) {$charset_collate};"
		);

		dbDelta(
			"CREATE TABLE {$profile_table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				profile_key varchar(80) NOT NULL,
				name varchar(160) NOT NULL,
				schema_version int unsigned NOT NULL DEFAULT 1,
				status varchar(20) NOT NULL DEFAULT 'draft',
				revision int unsigned NOT NULL DEFAULT 1,
				is_active tinyint(1) NOT NULL DEFAULT 0,
				created_by varchar(120) NULL,
				updated_by varchar(120) NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				activated_at datetime NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY profile_key (profile_key),
				KEY active_status (is_active, status)
			) {$charset_collate};"
		);

		dbDelta(
			"CREATE TABLE {$composition_table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				profile_id bigint(20) unsigned NOT NULL,
				composition_key varchar(80) NOT NULL,
				label varchar(160) NOT NULL,
				active_slots_json longtext NOT NULL,
				startup_sequence_json longtext NOT NULL,
				natural_ring_layout_json longtext NOT NULL,
				default_framing_json longtext NOT NULL,
				enabled tinyint(1) NOT NULL DEFAULT 1,
				sort_order int NOT NULL DEFAULT 0,
				revision int unsigned NOT NULL DEFAULT 1,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				UNIQUE KEY profile_composition (profile_id, composition_key),
				KEY profile_enabled_sort (profile_id, enabled, sort_order)
			) {$charset_collate};"
		);

		dbDelta(
			"CREATE TABLE {$view_table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				composition_id bigint(20) unsigned NOT NULL,
				view_key varchar(80) NOT NULL,
				name varchar(160) NOT NULL,
				enabled tinyint(1) NOT NULL DEFAULT 1,
				is_default tinyint(1) NOT NULL DEFAULT 0,
				sort_order int NOT NULL DEFAULT 0,
				camera_json longtext NOT NULL,
				ring_layout_json longtext NOT NULL,
				framing_json longtext NOT NULL,
				revision int unsigned NOT NULL DEFAULT 1,
				created_by varchar(120) NULL,
				updated_by varchar(120) NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				UNIQUE KEY composition_view (composition_id, view_key),
				KEY composition_enabled_sort (composition_id, enabled, sort_order)
			) {$charset_collate};"
		);

		self::seed_default_calibration_profile();
	}

	public static function data_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'asf_ringconf_data';
	}

	public static function preset_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'asf_ringconf_preset';
	}

	public static function calibration_profile_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'asf_ringconf_calibration_profiles';
	}

	public static function calibration_composition_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'asf_ringconf_calibration_compositions';
	}

	public static function calibration_view_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'asf_ringconf_calibration_views';
	}

	public function rpc_db_get_id(): array {
		global $wpdb;

		$id = $this->create_id();
		$wpdb->insert(
			self::preset_table(),
			array(
				'id' => $id,
			),
			array( '%s' )
		);

		return array( 'id' => $id );
	}

	public function rpc_db_check_id_exist( string $id ): array {
		global $wpdb;

		if ( ! $this->is_valid_preset_id( $id ) ) {
			return array( 'result' => 0 );
		}

		$count = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::preset_table() . ' WHERE id = %s', strtoupper( $id ) )
		);

		return array( 'result' => $count > 0 ? 1 : 0 );
	}

	public function rpc_db_get_appdata( $target_key = null, $build_key = null ): array {
		global $wpdb;

		$value = $wpdb->get_var(
			$wpdb->prepare( 'SELECT value FROM ' . self::data_table() . ' WHERE id = %s', self::DATA_KEY_APPDATA )
		);

		if ( is_string( $value ) && '' !== $value ) {
			$decoded = json_decode( $value, true );
			if ( is_array( $decoded ) ) {
				return array(
					'ok'   => true,
					'data' => $decoded,
					'meta' => array(
						'source'              => 'wordpress',
						'targetKey'           => is_string( $target_key ) ? $target_key : 'woocommerce',
						'buildKey'            => is_string( $build_key ) ? $build_key : ASF_RINGCONF_VERSION,
						'appDataVersionId'    => null,
						'appDataVersionLabel' => 'wordpress',
						'appDataHash'         => hash( 'sha256', $value ),
					),
				);
			}
		}

		return array(
			'ok'   => true,
			'data' => null,
			'meta' => array(
				'source'              => 'angular-default',
				'targetKey'           => 'woocommerce',
				'buildKey'            => is_string( $build_key ) ? $build_key : ASF_RINGCONF_VERSION,
				'appDataVersionId'    => null,
				'appDataVersionLabel' => 'bundled-default',
				'appDataHash'         => '',
			),
		);
	}

	public function rpc_db_save_preset( string $id, $preset_0, $preset_1, string $img_data, bool $overwrite = false, $preset_slots = null ): array {
		global $wpdb;

		$id = strtoupper( trim( $id ) );
		if ( '' === $id || ! $this->is_valid_preset_id( $id ) ) {
			$id = $this->create_id();
		}

		$preset_0_json = $this->encode_limited_json( $preset_0 );
		$preset_1_json = $this->encode_limited_json( $preset_1 );
		$preset_2_json = $this->optional_preset_slot_json( $preset_slots, 'preset_2' );
		$preset_3_json = $this->optional_preset_slot_json( $preset_slots, 'preset_3' );
		$img_json      = $this->encode_limited_image( $img_data );

		if ( null === $preset_0_json || null === $preset_1_json || null === $img_json ) {
			return array(
				'errorCode' => 2,
				'error'     => 'Preset payload is too large or invalid.',
				'id'        => $id,
			);
		}

		$row = $this->get_preset_row( $id );
		if ( null === $row ) {
			$this->insert_preset( $id, $preset_0_json, $preset_1_json, $preset_2_json, $preset_3_json, $img_json );
		} elseif ( $overwrite || empty( $row['preset_0'] ) || empty( $row['preset_1'] ) ) {
			$this->update_preset( $id, $preset_0_json, $preset_1_json, $preset_2_json, $preset_3_json, $img_json );
		} else {
			$id = $this->next_suffix_id( $id );
			$this->insert_preset( $id, $preset_0_json, $preset_1_json, $preset_2_json, $preset_3_json, $img_json );
		}

		return array(
			'errorCode' => 0,
			'id'        => $id,
			'overwrite' => $overwrite,
		);
	}

	public function rpc_db_load_preset( string $id ): array {
		global $wpdb;

		$id = strtoupper( trim( $id ) );
		if ( ! $this->is_valid_preset_id( $id ) ) {
			return array(
				'errorCode' => -2,
				'info'      => 'Ungueltige Konfigurations-ID.',
				'id'        => $id,
			);
		}

		$row = $this->get_preset_row( $id );
		if ( null === $row || empty( $row['preset_0'] ) || empty( $row['preset_1'] ) ) {
			$default = $this->get_preset_row( '0000-0000' );
			if ( null === $default || empty( $default['preset_0'] ) || empty( $default['preset_1'] ) ) {
				return array(
					'errorCode' => -1,
					'info'      => 'Kein Standardpreset vorhanden',
					'id'        => $id,
				);
			}

			return array(
				'errorCode' => -2,
				'info'      => 'Preset nicht gefunden! Es wurde das Standardpreset geladen.',
				'id'        => $this->create_id(),
				'preset_0'  => $default['preset_0'],
				'preset_1'  => $default['preset_1'],
				'preset_2'  => $default['preset_2'] ?? null,
				'preset_3'  => $default['preset_3'] ?? null,
				'img'       => $default['img'],
			);
		}

		$base_id = substr( $id, 0, 9 );
		$db_items = $wpdb->get_results(
			$wpdb->prepare( 'SELECT id FROM ' . self::preset_table() . ' WHERE id LIKE %s ORDER BY created_at ASC LIMIT 20', $wpdb->esc_like( $base_id ) . '%' ),
			ARRAY_A
		);

		return array(
			'errorCode' => 0,
			'info'      => '',
			'id'        => $id,
			'preset_0'  => $row['preset_0'],
			'preset_1'  => $row['preset_1'],
			'preset_2'  => $row['preset_2'] ?? null,
			'preset_3'  => $row['preset_3'] ?? null,
			'img'       => $row['img'],
			'dbItems'   => is_array( $db_items ) ? $db_items : array(),
		);
	}

	public function rpc_calc_price( $preset ): array {
		return array( 'price' => $this->calculate_price( $preset ) );
	}

	public function get_preset_price( string $preset_id ): ?float {
		$row = $this->get_preset_row( $preset_id );
		if ( null === $row ) {
			return null;
		}

		return $this->calculate_price( null );
	}

	public function is_valid_preset_id( string $id ): bool {
		return 1 === preg_match( '/^(0000-0000|[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}(?:-\d{1,4})?)$/', strtoupper( $id ) );
	}

	private function create_id(): string {
		do {
			$id = $this->random_id();
		} while ( null !== $this->get_preset_row( $id ) );

		return $id;
	}

	private function random_id(): string {
		$alphabet = '23456789ABCDEFGHIJKLMNPQRSTUVWXYZ';
		$part = static function () use ( $alphabet ): string {
			$result = '';
			for ( $i = 0; $i < 4; $i++ ) {
				$result .= $alphabet[ random_int( 0, strlen( $alphabet ) - 1 ) ];
			}
			return $result;
		};

		return $part() . '-' . $part();
	}

	private function get_preset_row( string $id ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM ' . self::preset_table() . ' WHERE id = %s LIMIT 1', strtoupper( $id ) ),
			ARRAY_A
		);

		return is_array( $row ) ? $row : null;
	}

	private function insert_preset( string $id, string $preset_0, string $preset_1, ?string $preset_2, ?string $preset_3, string $img ): void {
		global $wpdb;

		$wpdb->insert(
			self::preset_table(),
			array(
				'id'       => $id,
				'preset_0' => $preset_0,
				'preset_1' => $preset_1,
				'preset_2' => $preset_2,
				'preset_3' => $preset_3,
				'img'      => $img,
				'price'    => $this->calculate_price( null ),
			),
			array( '%s', '%s', '%s', '%s', '%s', '%s', '%f' )
		);
	}

	public function rpc_db_get_calibration_profile(): array {
		global $wpdb;

		$profile = $wpdb->get_row(
			'SELECT * FROM ' . self::calibration_profile_table() . " WHERE is_active = 1 AND status = 'active' ORDER BY activated_at DESC, id DESC LIMIT 1",
			ARRAY_A
		);
		if ( ! is_array( $profile ) ) {
			return array(
				'ok'    => false,
				'error' => array(
					'code'    => 'CALIBRATION_NOT_FOUND',
					'message' => 'No active calibration profile exists.',
				),
			);
		}

		return array(
			'ok'   => true,
			'data' => $this->hydrate_calibration_profile( $profile ),
		);
	}

	private function update_preset( string $id, string $preset_0, string $preset_1, ?string $preset_2, ?string $preset_3, string $img ): void {
		global $wpdb;

		$values = array(
			'preset_0'   => $preset_0,
			'preset_1'   => $preset_1,
			'img'        => $img,
			'price'      => $this->calculate_price( null ),
			'updated_at' => current_time( 'mysql' ),
		);
		$formats = array( '%s', '%s', '%s', '%f', '%s' );
		if ( null !== $preset_2 ) {
			$values['preset_2'] = $preset_2;
			$formats[]          = '%s';
		}
		if ( null !== $preset_3 ) {
			$values['preset_3'] = $preset_3;
			$formats[]          = '%s';
		}

		$wpdb->update(
			self::preset_table(),
			$values,
			array( 'id' => $id ),
			$formats,
			array( '%s' )
		);
	}

	private function next_suffix_id( string $id ): string {
		$base = substr( $id, 0, 9 );
		$next = 1;
		do {
			$candidate = $base . '-' . $next;
			$next++;
		} while ( null !== $this->get_preset_row( $candidate ) );

		return $candidate;
	}

	private function encode_limited_json( $value ): ?string {
		$json = wp_json_encode( $value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( ! is_string( $json ) || strlen( $json ) > self::MAX_JSON_BYTES ) {
			return null;
		}

		return $json;
	}

	private function optional_preset_slot_json( $preset_slots, string $key ): ?string {
		if ( ! is_array( $preset_slots ) && ! is_object( $preset_slots ) ) {
			return null;
		}

		$exists = false;
		$value  = null;
		if ( is_array( $preset_slots ) && array_key_exists( $key, $preset_slots ) ) {
			$exists = true;
			$value  = $preset_slots[ $key ];
		} elseif ( is_object( $preset_slots ) && property_exists( $preset_slots, $key ) ) {
			$exists = true;
			$value  = $preset_slots->{$key};
		}

		if ( ! $exists || null === $value || '' === $value ) {
			return null;
		}

		if ( is_string( $value ) ) {
			json_decode( $value, true );
			if ( JSON_ERROR_NONE === json_last_error() && strlen( $value ) <= self::MAX_JSON_BYTES ) {
				return $value;
			}
		}

		return $this->encode_limited_json( $value );
	}

	private function encode_limited_image( string $img_data ): ?string {
		if ( strlen( $img_data ) > self::MAX_IMAGE_BYTES ) {
			return null;
		}

		return wp_json_encode( $img_data );
	}

	private function calculate_price( $preset ): float {
		$price = (float) apply_filters( 'asf_ringconf_calculated_price', 9999.99, $preset );
		return max( 0.0, $price );
	}

	private static function seed_default_calibration_profile(): void {
		global $wpdb;

		$count = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . self::calibration_profile_table() );
		if ( $count > 0 ) {
			return;
		}

		$wpdb->insert(
			self::calibration_profile_table(),
			array(
				'profile_key'    => 'default-2-7-10',
				'name'           => 'Default calibration migrated from 2.7.10',
				'schema_version' => 1,
				'status'         => 'active',
				'revision'       => 1,
				'is_active'      => 1,
				'created_by'     => 'migration-2.7.10.1',
				'updated_by'     => 'migration-2.7.10.1',
				'activated_at'   => current_time( 'mysql' ),
			),
			array( '%s', '%s', '%d', '%s', '%d', '%d', '%s', '%s', '%s' )
		);
		$profile_id = (int) $wpdb->insert_id;

		foreach ( self::default_calibration_compositions() as $composition ) {
			$wpdb->insert(
				self::calibration_composition_table(),
				array(
					'profile_id'                 => $profile_id,
					'composition_key'            => $composition['composition_key'],
					'label'                      => $composition['label'],
					'active_slots_json'          => wp_json_encode( $composition['active_slots'] ),
					'startup_sequence_json'      => wp_json_encode( $composition['startup_sequence'] ),
					'natural_ring_layout_json'   => wp_json_encode( $composition['natural_ring_layout'] ),
					'default_framing_json'       => wp_json_encode( $composition['default_framing'] ),
					'enabled'                    => 1,
					'sort_order'                 => $composition['sort_order'],
					'revision'                   => 1,
				),
				array( '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%d' )
			);
			$composition_id = (int) $wpdb->insert_id;
			foreach ( $composition['views'] as $view ) {
				$wpdb->insert(
					self::calibration_view_table(),
					array(
						'composition_id'   => $composition_id,
						'view_key'         => $view['view_key'],
						'name'             => $view['name'],
						'enabled'          => 1,
						'is_default'       => $view['is_default'] ? 1 : 0,
						'sort_order'       => $view['sort_order'],
						'camera_json'      => wp_json_encode( $view['camera'] ),
						'ring_layout_json' => wp_json_encode( $view['ring_layout'] ),
						'framing_json'     => wp_json_encode( $view['framing'] ),
						'revision'         => 1,
						'created_by'       => 'migration-2.7.10.1',
						'updated_by'       => 'migration-2.7.10.1',
					),
					array( '%d', '%s', '%s', '%d', '%d', '%d', '%s', '%s', '%s', '%d', '%s', '%s' )
				);
			}
		}
	}

	private function hydrate_calibration_profile( array $profile ): array {
		global $wpdb;

		$composition_rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::calibration_composition_table() . ' WHERE profile_id = %d AND enabled = 1 ORDER BY sort_order ASC, composition_key ASC',
				(int) $profile['id']
			),
			ARRAY_A
		);

		$compositions = array();
		foreach ( is_array( $composition_rows ) ? $composition_rows : array() as $composition ) {
			$compositions[] = $this->hydrate_calibration_composition( $composition );
		}

		return array(
			'schemaVersion' => (int) $profile['schema_version'],
			'profileKey'    => $profile['profile_key'],
			'name'          => $profile['name'],
			'status'        => $profile['status'],
			'revision'      => (int) $profile['revision'],
			'compositions'  => $compositions,
		);
	}

	private function hydrate_calibration_composition( array $composition ): array {
		global $wpdb;

		$view_rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::calibration_view_table() . ' WHERE composition_id = %d AND enabled = 1 ORDER BY sort_order ASC, name ASC',
				(int) $composition['id']
			),
			ARRAY_A
		);
		$views = array();
		foreach ( is_array( $view_rows ) ? $view_rows : array() as $view ) {
			$views[] = array(
				'id'         => (int) $view['id'],
				'viewKey'    => $view['view_key'],
				'name'       => $view['name'],
				'enabled'    => (bool) $view['enabled'],
				'isDefault'  => (bool) $view['is_default'],
				'sortOrder'  => (int) $view['sort_order'],
				'revision'   => (int) $view['revision'],
				'camera'     => json_decode( (string) $view['camera_json'], true ),
				'ringLayout' => json_decode( (string) $view['ring_layout_json'], true ),
				'framing'    => json_decode( (string) $view['framing_json'], true ),
				'updatedAt'  => $view['updated_at'],
			);
		}

		return array(
			'id'                => (int) $composition['id'],
			'compositionKey'    => $composition['composition_key'],
			'label'             => $composition['label'],
			'activeSlots'       => json_decode( (string) $composition['active_slots_json'], true ),
			'startupSequence'   => json_decode( (string) $composition['startup_sequence_json'], true ),
			'naturalRingLayout' => json_decode( (string) $composition['natural_ring_layout_json'], true ),
			'defaultFraming'    => json_decode( (string) $composition['default_framing_json'], true ),
			'enabled'           => (bool) $composition['enabled'],
			'sortOrder'         => (int) $composition['sort_order'],
			'revision'          => (int) $composition['revision'],
			'views'             => $views,
		);
	}

	private static function default_calibration_compositions(): array {
		$pair_views = array(
			self::default_calibration_view( 'pair', 'Paar', 'all', 0, -M_PI / 2, M_PI / 2.6, 23.5, true ),
			self::default_calibration_view( 'ring0-outside', 'D außen', 'ring0', 10, -M_PI / 2, M_PI / 2.6, 15.5 ),
			self::default_calibration_view( 'ring0-inside', 'D innen', 'ring0', 20, M_PI / 2, M_PI / 2.2, 15.5 ),
			self::default_calibration_view( 'ring1-outside', 'H außen', 'ring1', 30, -M_PI / 2, M_PI / 2.6, 15.5 ),
			self::default_calibration_view( 'ring1-inside', 'H innen', 'ring1', 40, M_PI / 2, M_PI / 2.2, 15.5 ),
		);

		return array(
			self::default_calibration_composition( 'wedding-pair', 'Trauringpaar', array( 0, 1 ), 0, $pair_views ),
			self::default_calibration_composition( 'wedding-plus-engagement', 'Trauringpaar mit Verlobungsring', array( 0, 1, 2 ), 10, $pair_views ),
			self::default_calibration_composition( 'wedding-plus-memoire', 'Trauringpaar mit Memoirering', array( 0, 1, 3 ), 20, $pair_views ),
			self::default_calibration_composition( 'wedding-plus-both', 'Trauringpaar mit Verlobungsring und Memoirering', array( 0, 1, 2, 3 ), 30, $pair_views ),
			self::default_calibration_composition( 'engagement-only', 'Verlobungsring', array( 2 ), 40, array(
				self::default_calibration_view( 'engagement-outside', 'Verlobungsring außen', 'ring2', 0, -M_PI / 2, M_PI / 2.6, 15.5, true ),
				self::default_calibration_view( 'engagement-inside', 'Verlobungsring innen', 'ring2', 10, M_PI / 2, M_PI / 2.2, 15.5 ),
			) ),
			self::default_calibration_composition( 'memoire-only', 'Memoirering', array( 3 ), 50, array(
				self::default_calibration_view( 'memoire-outside', 'Memoirering außen', 'ring3', 0, -M_PI / 2, M_PI / 2.6, 15.5, true ),
				self::default_calibration_view( 'memoire-inside', 'Memoirering innen', 'ring3', 10, M_PI / 2, M_PI / 2.2, 15.5 ),
			) ),
		);
	}

	private static function default_calibration_composition( string $key, string $label, array $slots, int $sort_order, array $views ): array {
		return array(
			'composition_key'      => $key,
			'label'                => $label,
			'active_slots'         => $slots,
			'startup_sequence'     => array( 'enabled' => false, 'delayMs' => 0, 'durationMs' => 1200, 'easing' => 'ease-in-out', 'interruptOnUserInput' => true ),
			'natural_ring_layout'  => array( 'rings' => array() ),
			'default_framing'      => array( 'fitMode' => 'zoom-out-only', 'includeShadowEnvelope' => true ),
			'sort_order'           => $sort_order,
			'views'                => $views,
		);
	}

	private static function default_calibration_view( string $key, string $name, string $focus, int $sort_order, float $alpha, float $beta, float $ortho_height, bool $default = false ): array {
		return array(
			'view_key'    => $key,
			'name'        => $name,
			'is_default'  => $default,
			'sort_order'  => $sort_order,
			'camera'      => array(
				'alpha'      => $alpha,
				'beta'       => $beta,
				'target'     => array( 0, 10, 0 ),
				'projection' => array( 'mode' => 'orthographic', 'orthoHeight' => $ortho_height, 'radius' => 60, 'screenOffsetX' => 0, 'screenOffsetY' => 0 ),
				'safety'     => array( 'fitMode' => 'zoom-out-only', 'paddingTop' => 0.08, 'paddingRight' => 0.1, 'paddingBottom' => 'all' === $focus ? 0.18 : 0.24, 'paddingLeft' => 0.1, 'includeShadowEnvelope' => true, 'shadowExtraBottom' => 0.18, 'shadowExtraLeft' => 0.05, 'shadowExtraRight' => 0.05 ),
				'focus'      => $focus,
				'targetMode' => 'selection-center',
			),
			'ring_layout' => array( 'rings' => array() ),
			'framing'     => array( 'fitMode' => 'zoom-out-only', 'includeShadowEnvelope' => true ),
		);
	}
}
