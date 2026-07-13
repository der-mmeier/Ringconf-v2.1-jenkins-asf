<?php

defined('DB_DSN') || define('DB_DSN', 'mysql:host=lr5x.your-database.de;dbname=asfmtm_db35;charset=utf8mb4');
defined('DB_USERNAME') || define('DB_USERNAME', 'asfmtm_35');
defined('DB_PASSWORD') || define('DB_PASSWORD', 'r3+Ed+JW/aW2');

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
