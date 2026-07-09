<?php

defined('DB_DSN') || define('DB_DSN', 'mysql:host=localhost;dbname=konfigurator;charset=utf8mb4');
defined('DB_USERNAME') || define('DB_USERNAME', 'root');
defined('DB_PASSWORD') || define('DB_PASSWORD', '');

defined('TABLE_DATA') || define('TABLE_DATA', 'ringcfg_2v1_data');
defined('TABLE_PRESET') || define('TABLE_PRESET', 'ringcfg_2v1_preset');

defined('ONERINGCONF_USER_VERIFICATION_URL') || define(
  'ONERINGCONF_USER_VERIFICATION_URL',
  'https://toolbox.asf.gmbh/luna/user-verification.php'
);

defined('ONERINGCONF_USER_VERIFICATION_KEY') || define(
  'ONERINGCONF_USER_VERIFICATION_KEY',
  'b9d072c8163af4e5'
);

defined('ONERINGCONF_APPDATA_EDITOR_PERMISSIONS') || define(
  'ONERINGCONF_APPDATA_EDITOR_PERMISSIONS',
  'appdata:edit'
);

defined('ONERINGCONF_APPDATA_APPROVER_PERMISSIONS') || define(
  'ONERINGCONF_APPDATA_APPROVER_PERMISSIONS',
  'appdata:approve'
);
