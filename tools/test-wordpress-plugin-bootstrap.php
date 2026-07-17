<?php
/**
 * Minimal bootstrap smoke test for the WordPress plugin entrypoint.
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This test must run on the PHP CLI.\n");
    exit(1);
}

$scenario = $argv[1] ?? null;
if ($scenario === null) {
    foreach (['active', 'inactive', 'double'] as $childScenario) {
        $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' ' . escapeshellarg($childScenario);
        passthru($command, $exitCode);
        if ($exitCode !== 0) {
            exit($exitCode);
        }
    }
    echo "WordPress plugin bootstrap smoke test passed.\n";
    exit(0);
}

$root = dirname(__DIR__);
$pluginFile = $root . '/_shop/woocommerce/OneRingconf/asf-ringkonfigurator.php';

$GLOBALS['wp_actions'] = [];
$GLOBALS['wp_shortcodes'] = [];
$GLOBALS['wp_admin_menus'] = [];
$GLOBALS['wp_filters'] = [];
$GLOBALS['wp_notices'] = [];
$GLOBALS['wp_styles'] = [];
$GLOBALS['wp_scripts'] = [];
$GLOBALS['wp_script_modules'] = [];
$GLOBALS['wp_enqueued_script_modules'] = [];
$GLOBALS['wp_inline_scripts'] = [];

define('ABSPATH', $root . '/');

if ($scenario === 'active' || $scenario === 'double') {
    class WooCommerce {}
    define('WC_VERSION', '9.0.0');
}

class WC_AJAX {
    public static function get_endpoint($endpoint) {
        return '/?wc-ajax=' . $endpoint;
    }
}

function add_action($hook, $callback, $priority = 10, $accepted_args = 1) {
    $GLOBALS['wp_actions'][$hook][$priority][] = $callback;
}

function add_filter($hook, $callback, $priority = 10, $accepted_args = 1) {
    $GLOBALS['wp_filters'][$hook][$priority][] = $callback;
}

function do_action($hook) {
    if (empty($GLOBALS['wp_actions'][$hook])) {
        return;
    }
    ksort($GLOBALS['wp_actions'][$hook]);
    foreach ($GLOBALS['wp_actions'][$hook] as $callbacks) {
        foreach ($callbacks as $callback) {
            $callback();
        }
    }
}

function add_shortcode($tag, $callback) {
    $GLOBALS['wp_shortcodes'][$tag] = $callback;
}

function shortcode_exists($tag) {
    return isset($GLOBALS['wp_shortcodes'][$tag]);
}

function do_shortcode($content) {
    return preg_replace_callback('/\[([A-Za-z0-9_-]+)\]/', function ($matches) {
        $tag = $matches[1];
        if (!shortcode_exists($tag)) {
            return $matches[0];
        }
        return (string) call_user_func($GLOBALS['wp_shortcodes'][$tag], []);
    }, $content);
}

function plugin_dir_path($file) {
    return dirname($file) . '/';
}

function plugin_dir_url($file) {
    return 'https://example.test/wp-content/plugins/asf-ringkonfigurator/';
}

function trailingslashit($value) {
    return rtrim((string) $value, "/\\") . '/';
}

function register_activation_hook($file, $callback) {}
function current_user_can($capability) { return true; }
function esc_html__($text, $domain = null) { return $text; }
function __($text, $domain = null) { return $text; }
function esc_html($text) { return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8'); }
function esc_attr($text) { return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8'); }
function esc_url_raw($url) { return (string) $url; }
function sanitize_text_field($value) { return trim(strip_tags((string) $value)); }
function wp_unslash($value) { return $value; }
function wp_create_nonce($action) { return 'nonce'; }
function wp_json_encode($data, $flags = 0, $depth = 512) { return json_encode($data, $flags, $depth); }
function wp_unique_id($prefix = '') { static $id = 0; $id++; return $prefix . $id; }
function rest_url($path = '') { return 'https://example.test/wp-json/' . ltrim((string) $path, '/'); }
function home_url($path = '') { return 'https://example.test/' . ltrim((string) $path, '/'); }
function wc_get_cart_url() { return 'https://example.test/cart/'; }
function wc_get_checkout_url() { return 'https://example.test/checkout/'; }
function wp_enqueue_style($handle, $src, $deps = [], $ver = false) {
    $GLOBALS['wp_styles'][$handle] = compact('handle', 'src', 'deps', 'ver');
}
function wp_enqueue_script($handle, $src, $deps = [], $ver = false, $args = []) {
    $GLOBALS['wp_scripts'][$handle] = compact('handle', 'src', 'deps', 'ver', 'args');
}
function wp_register_script_module($id, $src, $deps = [], $version = false) {
    $GLOBALS['wp_script_modules'][$id] = compact('id', 'src', 'deps', 'version');
}
function wp_enqueue_script_module($id, $src = '', $deps = [], $version = false) {
    if ($src !== '') {
        wp_register_script_module($id, $src, $deps, $version);
    }
    $GLOBALS['wp_enqueued_script_modules'][] = $id;
}
function wp_script_add_data($handle, $key, $value) {
    throw new RuntimeException('wp_script_add_data must not be used by the plugin.');
}
function wp_add_inline_script($handle, $data, $position = 'after') {
    $GLOBALS['wp_inline_scripts'][] = compact('handle', 'data', 'position');
}
function shortcode_atts($pairs, $atts, $shortcode = '') { return array_merge($pairs, $atts); }
function absint($value) { return abs((int) $value); }
function get_option($key, $default = false) { return $default; }
function add_submenu_page($parent, $page_title, $menu_title, $capability, $menu_slug, $callback) {
    $GLOBALS['wp_admin_menus'][] = compact('parent', 'page_title', 'menu_title', 'capability', 'menu_slug');
}
function register_setting($group, $name, $args = []) {}
function settings_fields($group) {}
function submit_button() {}
function wp_die($message) { throw new RuntimeException((string) $message); }

require $pluginFile;

if (isset($GLOBALS['wp_shortcodes']['asf_ringkonfigurator'])) {
    fwrite(STDERR, "Plugin registered the shortcode before plugins_loaded.\n");
    exit(1);
}

if (empty($GLOBALS['wp_actions']['plugins_loaded'][20])) {
    fwrite(STDERR, "Plugin did not register plugins_loaded initialization at priority 20.\n");
    exit(1);
}

do_action('plugins_loaded');

if (!shortcode_exists('asf_ringkonfigurator')) {
    fwrite(STDERR, "asf_ringkonfigurator shortcode was not registered in scenario {$scenario}.\n");
    exit(1);
}

$rendered = do_shortcode('[asf_ringkonfigurator]');
if (str_contains($rendered, '[asf_ringkonfigurator]')) {
    fwrite(STDERR, "Shortcode was left unprocessed in scenario {$scenario}.\n");
    exit(1);
}

if ($scenario === 'active') {
    if (!shortcode_exists('3D-Trauringkonfigurator')) {
        fwrite(STDERR, "Alias shortcode was not registered.\n");
        exit(1);
    }
    if (substr_count($rendered, 'class="asf-ringconf-runtime"') !== 1 || substr_count($rendered, 'type="application/json"') !== 1) {
        fwrite(STDERR, "Shortcode did not render exactly one runtime JSON element.\n");
        exit(1);
    }
    if (!preg_match('/<script[^>]+class="asf-ringconf-runtime"[^>]*>(.*?)<\/script>/s', $rendered, $matches)) {
        fwrite(STDERR, "Runtime JSON script tag was not found.\n");
        exit(1);
    }
    $runtime = json_decode($matches[1], true);
    if (!is_array($runtime) || ($runtime['schemaVersion'] ?? null) !== 1 || empty($runtime['restUrl']) || empty($runtime['assetBaseUrl'])) {
        fwrite(STDERR, "Runtime JSON is not parseable or misses required fields.\n");
        exit(1);
    }
    if (empty($GLOBALS['wp_script_modules']['asf-ringconf-app'])) {
        fwrite(STDERR, "Angular module entry was not registered with wp_register_script_module.\n");
        exit(1);
    }
    if (!in_array('asf-ringconf-app', $GLOBALS['wp_enqueued_script_modules'], true)) {
        fwrite(STDERR, "Angular module entry was not enqueued with wp_enqueue_script_module.\n");
        exit(1);
    }
    if (!str_contains($GLOBALS['wp_script_modules']['asf-ringconf-app']['src'], '/dist/browser/asf-ringconf-entry.js')) {
        fwrite(STDERR, "Registered script module does not point to asf-ringconf-entry.js.\n");
        exit(1);
    }
    foreach ($GLOBALS['wp_scripts'] as $script) {
        if (str_contains($script['src'], '/dist/browser/') || str_contains($script['src'], 'asf-ringconf-entry.js')) {
            fwrite(STDERR, "Angular build was registered through wp_enqueue_script.\n");
            exit(1);
        }
    }
    if (empty($GLOBALS['wp_styles'])) {
        fwrite(STDERR, "Angular stylesheet was not enqueued.\n");
        exit(1);
    }
    if (!empty($GLOBALS['wp_filters']['script_loader_tag'])) {
        fwrite(STDERR, "script_loader_tag filter must not be registered.\n");
        exit(1);
    }
    if (!empty($GLOBALS['wp_inline_scripts'])) {
        fwrite(STDERR, "Runtime configuration must not be emitted with wp_add_inline_script.\n");
        exit(1);
    }
    if (empty($GLOBALS['wp_actions']['rest_api_init']) || empty($GLOBALS['wp_filters']['woocommerce_add_cart_item_data'])) {
        fwrite(STDERR, "WooCommerce integrations were not registered for active WooCommerce.\n");
        exit(1);
    }
    do_action('admin_menu');
    if (empty($GLOBALS['wp_admin_menus']) || $GLOBALS['wp_admin_menus'][0]['menu_slug'] !== 'asf-ringkonfigurator') {
        fwrite(STDERR, "WooCommerce admin submenu was not registered.\n");
        exit(1);
    }
}

if ($scenario === 'inactive') {
    if (empty($GLOBALS['wp_actions']['admin_notices'])) {
        fwrite(STDERR, "Missing WooCommerce admin notice was not registered.\n");
        exit(1);
    }
    if (!empty($GLOBALS['wp_actions']['rest_api_init']) || !empty($GLOBALS['wp_filters']['woocommerce_add_cart_item_data'])) {
        fwrite(STDERR, "WooCommerce integrations were registered without WooCommerce.\n");
        exit(1);
    }
}

if ($scenario === 'double') {
    $shortcodeCount = count($GLOBALS['wp_shortcodes']);
    $restHookCount = count($GLOBALS['wp_actions']['rest_api_init'][10] ?? []);
    $moduleRegistrationCount = count($GLOBALS['wp_script_modules']);
    $moduleEnqueueCount = count($GLOBALS['wp_enqueued_script_modules']);
    $secondRender = do_shortcode('[asf_ringkonfigurator]');
    if (substr_count($secondRender, 'class="asf-ringconf-runtime"') !== 0) {
        fwrite(STDERR, "Second shortcode render duplicated runtime JSON.\n");
        exit(1);
    }
    if ($moduleRegistrationCount !== count($GLOBALS['wp_script_modules']) || $moduleEnqueueCount !== count($GLOBALS['wp_enqueued_script_modules'])) {
        fwrite(STDERR, "Second shortcode render duplicated module registration/enqueue.\n");
        exit(1);
    }
    ASF_Ringconf_Plugin::instance()->init();
    if ($shortcodeCount !== count($GLOBALS['wp_shortcodes']) || $restHookCount !== count($GLOBALS['wp_actions']['rest_api_init'][10] ?? [])) {
        fwrite(STDERR, "Plugin initialization is not idempotent.\n");
        exit(1);
    }
}

echo "Scenario {$scenario}: OK\n";
