<?php
/**
 * Public REST/RPC bridge for the Angular configurator.
 *
 * @package ASFRingconf
 */

defined( 'ABSPATH' ) || exit;

final class ASF_Ringconf_Rest {
	private ASF_Ringconf_Database $database;

	public function __construct( ASF_Ringconf_Database $database ) {
		$this->database = $database;
	}

	public function init(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	public function register_routes(): void {
		register_rest_route(
			'asf-ringconf/v1',
			'/rpc',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_rpc' ),
				'permission_callback' => array( $this, 'check_public_nonce' ),
			)
		);

		register_rest_route(
			'asf-ringconf/v1',
			'/cart/add',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_cart_add' ),
				'permission_callback' => array( $this, 'check_public_nonce' ),
			)
		);

		register_rest_route(
			'asf-ringconf/v1',
			'/pdf',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_pdf' ),
				'permission_callback' => array( $this, 'check_public_nonce' ),
			)
		);
	}

	public function check_public_nonce( WP_REST_Request $request ) {
		$nonce = $request->get_header( 'x_wp_nonce' ) ?: $request->get_header( 'x-wp-nonce' );
		if ( is_string( $nonce ) && wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return true;
		}

		return new WP_Error(
			'asf_ringconf_forbidden',
			__( 'Ungueltiger oder fehlender WordPress-Nonce.', 'asf-ringkonfigurator' ),
			array( 'status' => 403 )
		);
	}

	public function handle_rpc( WP_REST_Request $request ) {
		$rpc = sanitize_text_field( (string) $request->get_param( 'rpc' ) );
		$rpp = $request->get_param( 'rpp' );
		if ( is_string( $rpp ) ) {
			$rpp = json_decode( $rpp, true );
		}
		if ( ! is_array( $rpp ) ) {
			$rpp = array();
		}

		switch ( $rpc ) {
			case 'dbGetId':
				return rest_ensure_response( $this->database->rpc_db_get_id() );
			case 'dbCheckIdExist':
				return rest_ensure_response( $this->database->rpc_db_check_id_exist( (string) ( $rpp[0] ?? '' ) ) );
			case 'dbGetAPPDATA':
				return rest_ensure_response( $this->database->rpc_db_get_appdata( $rpp[0] ?? null, $rpp[1] ?? null ) );
			case 'dbSavePreset':
				return rest_ensure_response(
					$this->database->rpc_db_save_preset(
						(string) ( $rpp[0] ?? '' ),
						$rpp[1] ?? null,
						$rpp[2] ?? null,
						(string) ( $rpp[3] ?? '' ),
						(bool) ( $rpp[4] ?? false )
					)
				);
			case 'dbLoadPreset':
				return rest_ensure_response( $this->database->rpc_db_load_preset( (string) ( $rpp[0] ?? '' ) ) );
			case 'calcPrice':
				return rest_ensure_response( $this->database->rpc_calc_price( $rpp[0] ?? null ) );
			case 'getWordPressContext':
				return rest_ensure_response(
					array(
						'ok'       => true,
						'cartUrl'  => wc_get_cart_url(),
						'siteUrl'  => home_url( '/' ),
						'checkout' => wc_get_checkout_url(),
					)
				);
		}

		return new WP_Error(
			'asf_ringconf_rpc_forbidden',
			__( 'RPC ist im oeffentlichen WordPress-Endpunkt nicht erlaubt.', 'asf-ringkonfigurator' ),
			array( 'status' => 403 )
		);
	}

	public function handle_cart_add( WP_REST_Request $request ) {
		$preset_id = strtoupper( sanitize_text_field( (string) $request->get_param( 'presetId' ) ) );
		$cart      = new ASF_Ringconf_Cart( $this->database );
		$result    = $cart->add_configuration_to_cart( $preset_id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return rest_ensure_response( $result );
	}

	public function handle_pdf() {
		return new WP_Error(
			'asf_ringconf_pdf_not_configured',
			__( 'PDF-Erzeugung ist fuer das WordPress-Plugin noch nicht konfiguriert.', 'asf-ringkonfigurator' ),
			array( 'status' => 501 )
		);
	}
}
