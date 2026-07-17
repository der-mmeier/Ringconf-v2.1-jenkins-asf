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
				img longtext NULL,
				price decimal(12,2) NULL,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				KEY updated_at (updated_at)
			) {$charset_collate};"
		);
	}

	public static function data_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'asf_ringconf_data';
	}

	public static function preset_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'asf_ringconf_preset';
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

	public function rpc_db_save_preset( string $id, $preset_0, $preset_1, string $img_data, bool $overwrite = false ): array {
		global $wpdb;

		$id = strtoupper( trim( $id ) );
		if ( '' === $id || ! $this->is_valid_preset_id( $id ) ) {
			$id = $this->create_id();
		}

		$preset_0_json = $this->encode_limited_json( $preset_0 );
		$preset_1_json = $this->encode_limited_json( $preset_1 );
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
			$this->insert_preset( $id, $preset_0_json, $preset_1_json, $img_json );
		} elseif ( $overwrite || empty( $row['preset_0'] ) || empty( $row['preset_1'] ) ) {
			$this->update_preset( $id, $preset_0_json, $preset_1_json, $img_json );
		} else {
			$id = $this->next_suffix_id( $id );
			$this->insert_preset( $id, $preset_0_json, $preset_1_json, $img_json );
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

	private function insert_preset( string $id, string $preset_0, string $preset_1, string $img ): void {
		global $wpdb;

		$wpdb->insert(
			self::preset_table(),
			array(
				'id'       => $id,
				'preset_0' => $preset_0,
				'preset_1' => $preset_1,
				'img'      => $img,
				'price'    => $this->calculate_price( null ),
			),
			array( '%s', '%s', '%s', '%s', '%f' )
		);
	}

	private function update_preset( string $id, string $preset_0, string $preset_1, string $img ): void {
		global $wpdb;

		$wpdb->update(
			self::preset_table(),
			array(
				'preset_0'   => $preset_0,
				'preset_1'   => $preset_1,
				'img'        => $img,
				'price'      => $this->calculate_price( null ),
				'updated_at' => current_time( 'mysql' ),
			),
			array( 'id' => $id ),
			array( '%s', '%s', '%s', '%f', '%s' ),
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
}
