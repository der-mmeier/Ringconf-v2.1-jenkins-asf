<?php

namespace One;

$localConfig = __DIR__ . '/../config.local.php';
if (is_file($localConfig)) {
    include $localConfig;
}

function envValue(string $name, string $default = ''): string
{
    $value = getenv($name);
    return $value === false ? $default : $value;
}

if (!defined('DB_DSN')) {
    define('DB_DSN', envValue('ONERINGCONF_DB_DSN'));
}
if (!defined('DB_USERNAME')) {
    define('DB_USERNAME', envValue('ONERINGCONF_DB_USERNAME'));
}
if (!defined('DB_PASSWORD')) {
    define('DB_PASSWORD', envValue('ONERINGCONF_DB_PASSWORD'));
}
if (!defined('TABLE_DATA')) {
    define('TABLE_DATA', envValue('ONERINGCONF_TABLE_DATA', 'ringcfg_2v1_data'));
}
if (!defined('TABLE_PRESET')) {
    define('TABLE_PRESET', envValue('ONERINGCONF_TABLE_PRESET', 'ringcfg_2v1_preset'));
}
