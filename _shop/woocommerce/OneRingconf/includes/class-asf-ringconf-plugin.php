<?php
/**
 * Main plugin bootstrap.
 *
 * @package ASFRingconf
 */

defined( 'ABSPATH' ) || exit;

final class ASF_Ringconf_Plugin {
	private static ?ASF_Ringconf_Plugin $instance = null;

	private ?ASF_Ringconf_Assets $assets = null;
	private ?ASF_Ringconf_Database $database = null;
	private bool $initialized = false;

	public static function instance(): ASF_Ringconf_Plugin {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	public function init(): void {
		if ( $this->initialized ) {
			return;
		}

		$this->initialized = true;
		$this->load_dependencies();

		$this->assets = new ASF_Ringconf_Assets();

		if ( ! $this->is_woocommerce_available() ) {
			( new ASF_Ringconf_Shortcode( $this->assets, false ) )->init();
			add_action( 'admin_notices', array( $this, 'render_missing_woocommerce_notice' ) );
			return;
		}

		$this->database = new ASF_Ringconf_Database();

		( new ASF_Ringconf_Shortcode( $this->assets, true ) )->init();
		( new ASF_Ringconf_Rest( $this->database ) )->init();
		( new ASF_Ringconf_Cart( $this->database ) )->init();
		( new ASF_Ringconf_Order() )->init();

		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	public function render_missing_woocommerce_notice(): void {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		echo '<div class="notice notice-error"><p>';
		echo esc_html__( 'ASF Ringkonfigurator benoetigt ein aktives WooCommerce-Plugin. Die Warenkorb-Integration bleibt deaktiviert, bis WooCommerce aktiv ist.', 'asf-ringkonfigurator' );
		echo '</p></div>';
	}

	public function add_settings_page(): void {
		add_submenu_page(
			'woocommerce',
			__( 'ASF Ringkonfigurator', 'asf-ringkonfigurator' ),
			__( 'ASF Ringkonfigurator', 'asf-ringkonfigurator' ),
			'manage_woocommerce',
			'asf-ringkonfigurator',
			array( $this, 'render_settings_page' )
		);
	}

	public function register_settings(): void {
		register_setting(
			'asf_ringconf_settings',
			'asf_ringconf_product_id',
			array(
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'default'           => 0,
			)
		);
		register_setting(
			'asf_ringconf_settings',
			'asf_ringconf_product_sku',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			)
		);
	}

	public function render_settings_page(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'Keine Berechtigung.', 'asf-ringkonfigurator' ) );
		}

		$product_id  = absint( get_option( 'asf_ringconf_product_id', 0 ) );
		$product_sku = (string) get_option( 'asf_ringconf_product_sku', '' );
		?>
		<div class="wrap">
			<h1><?php echo esc_html__( 'ASF Ringkonfigurator', 'asf-ringkonfigurator' ); ?></h1>
			<form method="post" action="options.php">
				<?php settings_fields( 'asf_ringconf_settings' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="asf_ringconf_product_id"><?php echo esc_html__( 'Konfigurationsprodukt-ID', 'asf-ringkonfigurator' ); ?></label></th>
						<td><input name="asf_ringconf_product_id" id="asf_ringconf_product_id" type="number" min="0" value="<?php echo esc_attr( (string) $product_id ); ?>" class="regular-text"></td>
					</tr>
					<tr>
						<th scope="row"><label for="asf_ringconf_product_sku"><?php echo esc_html__( 'Konfigurationsprodukt-SKU', 'asf-ringkonfigurator' ); ?></label></th>
						<td><input name="asf_ringconf_product_sku" id="asf_ringconf_product_sku" type="text" value="<?php echo esc_attr( $product_sku ); ?>" class="regular-text"></td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}

	private function load_dependencies(): void {
		require_once ASF_RINGCONF_PLUGIN_DIR . 'includes/class-asf-ringconf-assets.php';
		require_once ASF_RINGCONF_PLUGIN_DIR . 'includes/class-asf-ringconf-shortcode.php';
		require_once ASF_RINGCONF_PLUGIN_DIR . 'includes/class-asf-ringconf-rest.php';
		require_once ASF_RINGCONF_PLUGIN_DIR . 'includes/class-asf-ringconf-cart.php';
		require_once ASF_RINGCONF_PLUGIN_DIR . 'includes/class-asf-ringconf-order.php';
	}

	private function is_woocommerce_available(): bool {
		return class_exists( 'WooCommerce' ) || defined( 'WC_VERSION' );
	}
}
