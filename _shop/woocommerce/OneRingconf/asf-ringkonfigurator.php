<?php
/**
 * Plugin Name: ASF Ringkonfigurator
 * Description: Lokale WordPress-/WooCommerce-Integration fuer den ASF 3D-Ringkonfigurator.
 * Version: 2.7.9.1
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Requires Plugins: woocommerce
 * Text Domain: asf-ringkonfigurator
 *
 * @package ASFRingconf
 */

defined( 'ABSPATH' ) || exit;

define( 'ASF_RINGCONF_VERSION', '2.7.9.1' );
define( 'ASF_RINGCONF_PLUGIN_FILE', __FILE__ );
define( 'ASF_RINGCONF_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'ASF_RINGCONF_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once ASF_RINGCONF_PLUGIN_DIR . 'includes/class-asf-ringconf-plugin.php';
require_once ASF_RINGCONF_PLUGIN_DIR . 'includes/class-asf-ringconf-database.php';

register_activation_hook(
	__FILE__,
	static function (): void {
		ASF_Ringconf_Database::install();
	}
);

add_action(
	'before_woocommerce_init',
	static function (): void {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
		}
	}
);

add_action(
	'plugins_loaded',
	static function (): void {
		ASF_Ringconf_Plugin::instance()->init();
	},
	20
);
