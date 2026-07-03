# Build And Deployment Matrix

Current supported targets are standalone and WooCommerce. Historical build targets from the baseline inventory are no longer supported.

## Npm Scripts

| Script | Command | Purpose | Mutates tracked files |
|---|---|---|---|
| `start` | `ng serve --host 127.0.0.1 --port 4200` | Local Angular dev server | No |
| `start & open` | `ng serve --host 127.0.0.1 --port 4200 --open` | Local dev server with browser open | No |
| `build` | `ng build` | Default production build | No |
| `buildWoocommerce` | `ng build --configuration=woocommerce && node postbuild.woocommerce.js` | Legacy WooCommerce build command until replaced by the local test harness | Writes generated files under `_shop/woocommerce/OneRingconf/dist` |

## Angular Build Targets

| Target | Angular configuration | Environment | Output | Assets | Consumer | Verification |
|---|---|---|---|---|---|---|
| development | `development` | `src/environments/environment.ts` | `dist/ringconf-v2.1` | `src/assets`, PHP bridge files from `src/php` | Local dev/build smoke | Not yet executed in this branch |
| production | `production` | `src/environments/environment.ts` | `dist/ringconf-v2.1` | `src/assets`, PHP bridge files from `src/php` | Standalone PHP-capable web server | Not yet executed in this branch |
| woocommerce | `woocommerce` | `src/environments/environment.woocommerce.ts` | `_shop/woocommerce/OneRingconf/dist` | `src/assets`, PHP bridge files from `src/php` | WooCommerce plugin | Not yet executed in this branch |

## PHP Configuration

`angular.json` copies `src/php/config.php` to the build root. The file reads `ONERINGCONF_DB_DSN`, `ONERINGCONF_DB_USERNAME`, `ONERINGCONF_DB_PASSWORD`, `ONERINGCONF_TABLE_DATA`, and `ONERINGCONF_TABLE_PRESET`, with optional local overrides in ignored `src/php/config.local.php`.

`src/php/config.local.example.php` is a safe template and contains no production credentials.

## Known Mutable Steps

`postbuild.woocommerce.js` is still the legacy postbuild script at this point in the branch. It rewrites generated CSS/JS asset paths under `_shop/woocommerce/OneRingconf/dist`. The next build-harness phase should replace it with an idempotent script that writes a manifest for the WordPress plugin.

## Reproducibility Notes

- Host Node `v20.16.0` is not compatible with the Angular 15 baseline.
- Docker is available and should be used for compatible Node runtimes if no local version manager is installed.
- Generated WooCommerce dist files remain ignored and must not be committed.
