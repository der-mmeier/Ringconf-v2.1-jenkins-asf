<?php
/**
 * WooCommerce order integration.
 *
 * @package ASFRingconf
 */

defined( 'ABSPATH' ) || exit;

final class ASF_Ringconf_Order {
	public function init(): void {
		add_action( 'woocommerce_checkout_create_order_line_item', array( $this, 'add_order_line_meta' ), 10, 4 );
	}

	public function add_order_line_meta( WC_Order_Item_Product $item, string $cart_item_key, array $values, WC_Order $order ): void {
		if ( empty( $values['rcfg_id'] ) ) {
			return;
		}

		$item->add_meta_data( 'Ring-ID', sanitize_text_field( (string) $values['rcfg_id'] ), true );
		$item->add_meta_data( '_rcfg_id', sanitize_text_field( (string) $values['rcfg_id'] ), true );
	}
}
