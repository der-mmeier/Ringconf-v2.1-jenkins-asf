<?php
/**
 * Shortcode rendering.
 *
 * @package ASFRingconf
 */

defined( 'ABSPATH' ) || exit;

final class ASF_Ringconf_Shortcode {
	private ASF_Ringconf_Assets $assets;
	private bool $rendered = false;
	private bool $woocommerce_available;

	public function __construct( ASF_Ringconf_Assets $assets, bool $woocommerce_available = true ) {
		$this->assets                = $assets;
		$this->woocommerce_available = $woocommerce_available;
	}

	public function init(): void {
		add_shortcode( 'asf_ringkonfigurator', array( $this, 'render' ) );
		add_shortcode( '3D-Trauringkonfigurator', array( $this, 'render' ) );
	}

	public function render( array $attrs = array() ): string {
		if ( ! $this->woocommerce_available ) {
			return '<p class="asf-ringconf-message">' . esc_html__( 'Der ASF Ringkonfigurator benoetigt ein aktives WooCommerce-Plugin.', 'asf-ringkonfigurator' ) . '</p>';
		}

		if ( $this->rendered ) {
			return '<p class="asf-ringconf-message">' . esc_html__( 'Der ASF Ringkonfigurator kann nur einmal pro Seite geladen werden.', 'asf-ringkonfigurator' ) . '</p>';
		}

		if ( ! $this->assets->is_manifest_available() ) {
			return '<p class="asf-ringconf-message">' . esc_html__( 'Der ASF Ringkonfigurator-Build fehlt. Bitte das Pluginpaket aus dem WooCommerce-Build installieren.', 'asf-ringkonfigurator' ) . '</p>';
		}

		$this->rendered = true;

		$atts = shortcode_atts(
			array(
				'id'      => '',
				'context' => '',
			),
			$attrs,
			'asf_ringkonfigurator'
		);

		$context   = $this->resolve_context( (string) $atts['context'] );
		$preset_id = $this->resolve_preset_id( (string) $atts['id'] );
		$product   = $this->resolve_product_config();
		$instance_id = $this->create_instance_id();
		$runtime_id  = $instance_id . '-runtime';

		$runtime_config = array(
			'schemaVersion'   => 1,
			'instanceId'      => $instance_id,
			'assetBaseUrl'    => $this->assets->asset_base_url(),
			'restUrl'         => esc_url_raw( rest_url( 'asf-ringconf/v1/rpc' ) ),
			'pdfUrl'          => esc_url_raw( rest_url( 'asf-ringconf/v1/pdf' ) ),
			'cartAddUrl'      => esc_url_raw( rest_url( 'asf-ringconf/v1/cart/add' ) ),
			'restNonce'       => wp_create_nonce( 'wp_rest' ),
			'wcAjaxUrl'       => esc_url_raw( WC_AJAX::get_endpoint( '%%endpoint%%' ) ),
			'cartUrl'         => esc_url_raw( wc_get_cart_url() ),
			'checkoutUrl'     => esc_url_raw( wc_get_checkout_url() ),
			'siteUrl'         => esc_url_raw( home_url( '/' ) ),
			'woocommerce'     => array(
				'enabled'    => true,
				'productId'  => $product['id'],
				'productSku' => $product['sku'],
			),
			'initialPresetId' => $preset_id,
			'context'         => $context,
		);

		$runtime_json = wp_json_encode(
			$runtime_config,
			JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
		);
		if ( false === $runtime_json ) {
			return '<p class="asf-ringconf-message">' . esc_html__( 'Die Laufzeitkonfiguration konnte nicht erzeugt werden.', 'asf-ringkonfigurator' ) . '</p>';
		}

		$this->assets->enqueue();

		return sprintf(
			'<div class="asf-ringconf-shell" data-context="%1$s" data-asf-ringconf-instance="%2$s"><script type="application/json" id="%3$s" class="asf-ringconf-runtime">%4$s</script><x-app-root data-base="" data-asf-ringconf-runtime-id="%3$s"></x-app-root></div>',
			esc_attr( $context ),
			esc_attr( $instance_id ),
			esc_attr( $runtime_id ),
			$runtime_json
		);
	}

	private function create_instance_id(): string {
		$raw = function_exists( 'wp_unique_id' ) ? wp_unique_id( 'asf-ringconf-' ) : uniqid( 'asf-ringconf-', false );
		return preg_replace( '/[^A-Za-z0-9_-]/', '-', $raw );
	}

	private function resolve_context( string $explicit_context ): string {
		$allowed = array( 'public', 'account', 'order-create' );
		if ( in_array( $explicit_context, $allowed, true ) ) {
			return $explicit_context;
		}

		if ( function_exists( 'is_account_page' ) && is_account_page() ) {
			return 'account';
		}

		return 'public';
	}

	private function resolve_preset_id( string $shortcode_id ): string {
		foreach ( array( $shortcode_id, $_GET['rcfg_id'] ?? '', $_GET['ringconf_id'] ?? '', $_GET['id'] ?? '' ) as $candidate ) {
			$value = strtoupper( sanitize_text_field( wp_unslash( (string) $candidate ) ) );
			if ( preg_match( '/^[A-Z0-9]{4}-[A-Z0-9]{4}(?:-\d+)?$/', $value ) ) {
				return $value;
			}
		}

		return '';
	}

	private function resolve_product_config(): array {
		return array(
			'id'  => absint( get_option( 'asf_ringconf_product_id', 0 ) ),
			'sku' => (string) get_option( 'asf_ringconf_product_sku', '' ),
		);
	}
}
