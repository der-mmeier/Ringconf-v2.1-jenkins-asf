# Build And Deployment Matrix

Current supported targets are standalone and WooCommerce. Historical build targets from the baseline inventory are no longer supported.

## Npm Scripts

| Script | Command | Purpose | Mutates tracked files |
|---|---|---|---|
| `start` | `ng serve --host 127.0.0.1 --port 4200 --proxy-config proxy.conf.json` | Local Angular dev server with `/api.php` and `/appdata-admin.php` proxying to the local PHP server | No |
| `start & open` | `ng serve --host 127.0.0.1 --port 4200 --open` | Local dev server with browser open | No |
| `build` | `ng build` | Default production build | No |
| `build:development` | `ng build --configuration development` | Development build with the AppData/WebGL admin entry enabled | No |
| `build:production` | `ng build --configuration production` | Standalone production build with the disabled admin entry replacement | No |
| `build:woocommerce` | `ng build --configuration woocommerce` | WooCommerce production build with the disabled admin entry replacement | Writes generated files under `_shop/woocommerce/OneRingconf/dist` |
| `buildWoocommerce` | `ng build --configuration=woocommerce && node postbuild.woocommerce.js` | Legacy WooCommerce build command until replaced by the local test harness | Writes generated files under `_shop/woocommerce/OneRingconf/dist` |
| `check:admin-exclusion` | `node tools/check-admin-exclusion.mjs` | Scans standalone production and WooCommerce output for development-admin markers | No |

## Angular Build Targets

| Target | Angular configuration | Environment | Output | Assets | Consumer | Verification |
|---|---|---|---|---|---|---|
| development | `development` | `src/environments/environment.ts` | `dist/ringconf-v2.1` | `src/assets`, selected PHP bridge files from `src/php` | Local dev/build smoke; AppData/WebGL admin enabled through `src/app/development-admin/admin-entry.ts` | `npm run build:development` succeeded on 2026-07-04 with existing Sass/CommonJS warnings |
| production | `production` | `src/environments/environment.ts`; file replacement `src/app/development-admin/admin-entry.ts` -> `admin-entry.disabled.ts` | `dist/ringconf-v2.1` | `src/assets`, selected PHP bridge files from `src/php`; excludes `appdata-admin.php` | Standalone PHP-capable web server | `npm run build:production` and `npm run check:admin-exclusion` succeeded on 2026-07-04; existing bundle budget warning remains |
| woocommerce | `woocommerce` | `src/environments/environment.woocommerce.ts`; file replacement `src/app/development-admin/admin-entry.ts` -> `admin-entry.disabled.ts` | `_shop/woocommerce/OneRingconf/dist` | `src/assets`, selected PHP bridge files from `src/php`; excludes `appdata-admin.php` | WooCommerce plugin | `npm run build:woocommerce` and `npm run check:admin-exclusion` succeeded on 2026-07-04 |

## PHP Configuration

`angular.json` copies `src/php/config.php` to the build root. The file reads `ONERINGCONF_DB_DSN`, `ONERINGCONF_DB_USERNAME`, `ONERINGCONF_DB_PASSWORD`, `ONERINGCONF_TABLE_DATA`, and `ONERINGCONF_TABLE_PRESET`, with optional local overrides in ignored `src/php/config.local.php`.

`src/php/config.local.example.php` is a safe template and contains no production credentials.

`src/php/appdata-admin.php` is a development-only endpoint for immutable AppData snapshots, build compatibility, target assignments, and audit logging. It is reached through the Angular dev proxy at `/appdata-admin.php` and reads only environment/local configuration for database and employee-verification settings. The production and WooCommerce asset lists in `angular.json` do not copy this file.

`src/php/appdata-admin.config.local.example.php` is a safe template. Real values belong in ignored `src/php/appdata-admin.config.local.php` or server environment variables.

## Development Admin Exclusion

The production and WooCommerce configurations replace the real admin entry with `src/app/development-admin/admin-entry.disabled.ts`. `tools/check-admin-exclusion.mjs` scans `dist/ringconf-v2.1` and `_shop/woocommerce/OneRingconf/dist` for admin UI labels, the verification script marker, and accidental `appdata-admin.php` copies.

## Known Mutable Steps

`postbuild.woocommerce.js` is still the legacy postbuild script at this point in the branch. It rewrites generated CSS/JS asset paths under `_shop/woocommerce/OneRingconf/dist`. The next build-harness phase should replace it with an idempotent script that writes a manifest for the WordPress plugin.

## Reproducibility Notes

- Host Node `v20.16.0` is not compatible with the Angular 15 baseline.
- Docker is available and should be used for compatible Node runtimes if no local version manager is installed.
- Generated WooCommerce dist files remain ignored and must not be committed.
