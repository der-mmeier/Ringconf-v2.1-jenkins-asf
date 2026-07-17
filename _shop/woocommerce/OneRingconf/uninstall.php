<?php
/**
 * Plugin uninstall cleanup.
 *
 * @package ASFRingconf
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'asf_ringconf_product_id' );
delete_option( 'asf_ringconf_product_sku' );
