<?php

/*
 * Copy this file to appdata-admin.config.local.php for local development.
 * Never commit real credentials, internal verification keys, or production DSNs.
 */

define('ONERINGCONF_USER_VERIFICATION_URL', 'https://toolbox.asf.gmbh/luna/user-verification.php');
define('ONERINGCONF_USER_VERIFICATION_KEY', '');
define('ONERINGCONF_APPDATA_EDITOR_PERMISSIONS', 'appdata:edit');
define('ONERINGCONF_APPDATA_APPROVER_PERMISSIONS', 'appdata:approve');

define('DB_DSN', 'mysql:host=127.0.0.1;dbname=ringconf_local;charset=utf8mb4');
define('DB_USERNAME', 'ringconf_local');
define('DB_PASSWORD', '');
