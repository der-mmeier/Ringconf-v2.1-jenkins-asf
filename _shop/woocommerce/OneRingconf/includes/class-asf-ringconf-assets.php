<?php
/**
 * Frontend asset registration from the generated Angular manifest.
 *
 * @package ASFRingconf
 */

defined( 'ABSPATH' ) || exit;

final class ASF_Ringconf_Assets {
	private ?array $manifest = null;
	private bool $enqueued = false;

	public function enqueue(): void {
		if ( $this->enqueued ) {
			return;
		}

		$manifest = $this->get_manifest();
		if ( empty( $manifest ) ) {
			return;
		}

		$this->enqueued = true;

		foreach ( $manifest['styles'] ?? array() as $index => $style ) {
			$handle = 'asf-ringconf-style-' . $index;
			wp_enqueue_style(
				$handle,
				$this->dist_url( $style ),
				array(),
				$this->asset_version( $style )
			);
		}

		$module_entry = (string) ( $manifest['moduleEntry'] ?? '' );
		if ( '' !== $module_entry && function_exists( 'wp_register_script_module' ) && function_exists( 'wp_enqueue_script_module' ) ) {
			wp_register_script_module(
				'asf-ringconf-app',
				$this->dist_url( $module_entry ),
				array(),
				$this->asset_version( $module_entry )
			);
			wp_enqueue_script_module( 'asf-ringconf-app' );
		}

		wp_enqueue_script(
			'asf-ringconf-frontend-bridge',
			ASF_RINGCONF_PLUGIN_URL . 'assets/js/frontend-bridge.js',
			array(),
			ASF_RINGCONF_VERSION,
			true
		);
	}

	public function asset_base_url(): string {
		return trailingslashit( ASF_RINGCONF_PLUGIN_URL . 'dist/browser' );
	}

	public function is_manifest_available(): bool {
		return ! empty( $this->get_manifest() );
	}

	private function get_manifest(): array {
		if ( null !== $this->manifest ) {
			return $this->manifest;
		}

		$path = ASF_RINGCONF_PLUGIN_DIR . 'dist/asf-ringconf-manifest.json';
		if ( ! is_readable( $path ) ) {
			$this->manifest = array();
			return $this->manifest;
		}

		$decoded = json_decode( (string) file_get_contents( $path ), true );
		if (
			is_array( $decoded )
			&& 2 === (int) ( $decoded['schemaVersion'] ?? 0 )
			&& ! empty( $decoded['moduleEntry'] )
			&& is_array( $decoded['styles'] ?? null )
			&& $this->manifest_assets_exist( $decoded )
		) {
			$this->manifest = $decoded;
			return $this->manifest;
		}

		$this->manifest = array();
		return $this->manifest;
	}

	private function dist_url( string $file ): string {
		return $this->asset_base_url() . ltrim( $file, '/' );
	}

	private function manifest_assets_exist( array $manifest ): bool {
		$files = array_merge(
			array( (string) $manifest['moduleEntry'] ),
			array_map( 'strval', $manifest['styles'] ?? array() )
		);

		foreach ( $files as $file ) {
			if ( '' === $file || str_contains( $file, '\\' ) || str_contains( $file, '../' ) ) {
				return false;
			}
			if ( ! is_readable( ASF_RINGCONF_PLUGIN_DIR . 'dist/browser/' . ltrim( $file, '/' ) ) ) {
				return false;
			}
		}

		return true;
	}

	private function asset_version( string $file ): string {
		if ( preg_match( '/[-.]([A-Za-z0-9_-]{8,})\.(?:js|css)$/', $file, $matches ) ) {
			return $matches[1];
		}

		return ASF_RINGCONF_VERSION;
	}
}
