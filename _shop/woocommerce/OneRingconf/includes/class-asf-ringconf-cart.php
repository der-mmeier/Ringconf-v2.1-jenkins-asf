<?php
/**
 * WooCommerce cart integration.
 *
 * @package ASFRingconf
 */

defined( 'ABSPATH' ) || exit;

final class ASF_Ringconf_Cart {
	private ASF_Ringconf_Database $database;

	public function __construct( ASF_Ringconf_Database $database ) {
		$this->database = $database;
	}

	public function init(): void {
		add_filter( 'woocommerce_add_cart_item_data', array( $this, 'add_cart_item_data' ), 10, 3 );
		add_filter( 'woocommerce_get_cart_item_from_session', array( $this, 'restore_cart_item_from_session' ), 10, 2 );
		add_action( 'woocommerce_before_calculate_totals', array( $this, 'set_server_price' ), 20 );
		add_filter( 'woocommerce_get_item_data', array( $this, 'display_cart_item_data' ), 10, 2 );
		add_filter( 'woocommerce_store_api_cart_item_data', array( $this, 'display_store_api_cart_item_data' ), 10, 2 );
	}

	public function add_configuration_to_cart( string $preset_id ) {
		if ( ! $this->database->is_valid_preset_id( $preset_id ) || '0000-0000' === $preset_id ) {
			return new WP_Error(
				'asf_ringconf_invalid_id',
				__( 'Ungueltige Ring-ID.', 'asf-ringkonfigurator' ),
				array( 'status' => 400 )
			);
		}

		$product_id = $this->resolve_product_id();
		if ( $product_id <= 0 ) {
			return new WP_Error(
				'asf_ringconf_missing_product',
				__( 'Kein WooCommerce-Konfigurationsprodukt hinterlegt.', 'asf-ringkonfigurator' ),
				array( 'status' => 500 )
			);
		}

		if ( null === $this->database->get_preset_price( $preset_id ) ) {
			return new WP_Error(
				'asf_ringconf_missing_preset',
				__( 'Die Ring-ID wurde nicht gefunden.', 'asf-ringkonfigurator' ),
				array( 'status' => 404 )
			);
		}

		if ( ! WC()->cart ) {
			wc_load_cart();
		}

		$existing_key = $this->find_cart_item_key( $preset_id );
		if ( $existing_key ) {
			return array(
				'ok'       => true,
				'cartUrl'  => wc_get_cart_url(),
				'cartHash' => WC()->cart->get_cart_hash(),
				'message'  => 'already-in-cart',
			);
		}

		$cart_item_key = WC()->cart->add_to_cart(
			$product_id,
			1,
			0,
			array(),
			array(
				'rcfg_id'                 => $preset_id,
				'asf_ringconf_unique_key' => 'rcfg_' . $preset_id,
			)
		);

		if ( ! $cart_item_key ) {
			return new WP_Error(
				'asf_ringconf_cart_failed',
				__( 'Das Konfigurationsprodukt konnte nicht in den Warenkorb gelegt werden.', 'asf-ringkonfigurator' ),
				array( 'status' => 500 )
			);
		}

		return array(
			'ok'          => true,
			'cartItemKey' => $cart_item_key,
			'cartUrl'     => wc_get_cart_url(),
			'cartHash'    => WC()->cart->get_cart_hash(),
		);
	}

	public function add_cart_item_data( array $cart_item_data, int $product_id, int $variation_id ): array {
		$preset_id = isset( $_REQUEST['rcfg_id'] ) ? strtoupper( sanitize_text_field( wp_unslash( (string) $_REQUEST['rcfg_id'] ) ) ) : '';
		if ( $this->database->is_valid_preset_id( $preset_id ) ) {
			$cart_item_data['rcfg_id']                 = $preset_id;
			$cart_item_data['asf_ringconf_unique_key'] = 'rcfg_' . $preset_id;
		}

		return $cart_item_data;
	}

	public function restore_cart_item_from_session( array $cart_item, array $values ): array {
		if ( isset( $values['rcfg_id'] ) ) {
			$cart_item['rcfg_id'] = sanitize_text_field( (string) $values['rcfg_id'] );
		}
		if ( isset( $values['asf_ringconf_unique_key'] ) ) {
			$cart_item['asf_ringconf_unique_key'] = sanitize_text_field( (string) $values['asf_ringconf_unique_key'] );
		}

		return $cart_item;
	}

	public function set_server_price( WC_Cart $cart ): void {
		if ( is_admin() && ! wp_doing_ajax() ) {
			return;
		}

		foreach ( $cart->get_cart() as $cart_item ) {
			if ( empty( $cart_item['rcfg_id'] ) || empty( $cart_item['data'] ) || ! is_a( $cart_item['data'], WC_Product::class ) ) {
				continue;
			}

			$price = $this->database->get_preset_price( (string) $cart_item['rcfg_id'] );
			if ( null !== $price ) {
				$cart_item['data']->set_price( $price );
			}
		}
	}

	public function display_cart_item_data( array $item_data, array $cart_item ): array {
		if ( ! empty( $cart_item['rcfg_id'] ) ) {
			$item_data[] = array(
				'key'   => __( 'Ring-ID', 'asf-ringkonfigurator' ),
				'value' => esc_html( (string) $cart_item['rcfg_id'] ),
			);
		}

		return $item_data;
	}

	public function display_store_api_cart_item_data( array $item_data, array $cart_item ): array {
		if ( ! empty( $cart_item['rcfg_id'] ) ) {
			$item_data[] = array(
				'name'  => __( 'Ring-ID', 'asf-ringkonfigurator' ),
				'value' => (string) $cart_item['rcfg_id'],
			);
		}

		return $item_data;
	}

	private function resolve_product_id(): int {
		$product_id = absint( get_option( 'asf_ringconf_product_id', 0 ) );
		if ( $product_id > 0 && wc_get_product( $product_id ) ) {
			return $product_id;
		}

		$sku = (string) get_option( 'asf_ringconf_product_sku', '' );
		if ( '' !== $sku ) {
			$product_id = wc_get_product_id_by_sku( $sku );
			if ( $product_id > 0 ) {
				return $product_id;
			}
		}

		return 0;
	}

	private function find_cart_item_key( string $preset_id ): string {
		if ( ! WC()->cart ) {
			return '';
		}

		foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
			if ( isset( $cart_item['rcfg_id'] ) && $preset_id === (string) $cart_item['rcfg_id'] ) {
				return (string) $cart_item_key;
			}
		}

		return '';
	}
}
