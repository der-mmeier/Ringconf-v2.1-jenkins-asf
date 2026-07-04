# Repository Instructions

This repository contains the Ringconf v2.1 Angular/Babylon.js ring configurator.

## Supported Targets

- Standalone browser development build.
- Standalone production build served by a PHP-capable web server.
- WooCommerce production integration.

WooCommerce is the only supported productive shop integration. Do not add build targets, runtime branches, PHP bridges, DOM contracts, or documentation for other shop systems unless a later explicit decision reintroduces them.

## Protected Contracts

Treat these as compatibility-sensitive:

- Preset and AppData JSON fields.
- AppData version labels, hashes, immutable snapshot semantics, build/AppData compatibility rows, and target assignment history.
- Existing configuration IDs and ID suffix behavior.
- `src/index2.html` as the Angular HTML entry.
- PHP RPC names and request/response shapes in `src/php/api.php`.
- Babylon.js asset paths under `src/assets` and copied PHP asset paths.
- WooCommerce plugin output path `_shop/woocommerce/OneRingconf/dist`.

## Development Admin Rules

- The AppData/WebGL admin is development-only. Production and WooCommerce builds must use `src/app/development-admin/admin-entry.disabled.ts` through `angular.json` file replacements.
- Do not expose admin components, admin labels, employee login/PIN UI, or the internal verification endpoint in production or WooCommerce bundles.
- `src/php/appdata-admin.php` is a local development endpoint and must not be copied into production or WooCommerce build outputs.
- Employee verification is server-to-server only: Angular calls `/appdata-admin.php`; PHP calls the verification service with `X-Internal-Verification-Key` from local config or environment.
- Never store login or PIN in browser storage, logs, database tables, audit metadata, commits, or documentation.
- AppData edits must clone and preserve the complete snapshot. Unknown fields are compatibility-sensitive and must not be dropped by partial form reconstruction.

## Build And Runtime Rules

- Do not run `prebuild.js` unless the task explicitly asks for version mutation.
- Do not commit generated outputs: `node_modules/`, `dist/`, `.angular/`, `coverage/`, `out-tsc/`, `_shop/woocommerce/OneRingconf/dist/`, source maps, minified bundles, IDE files, or temporary analysis outputs.
- Keep local secrets out of Git. Use `src/php/config.local.php` or environment variables matching `ONERINGCONF_*`.
- Do not print credentials, tokens, private endpoints, customer data, or production-like database details in docs, terminal summaries, commits, or PR text.
- Do not use `npm audit fix --force`, `npm install --force`, `npm install --legacy-peer-deps`, or force flags for framework migrations.

## Required Checks

For changes that affect build, runtime, PHP contracts, WooCommerce output, or dependencies, run and report the applicable subset:

```bash
npm ci
npm run build:development
npm run build:production
npm run build:woocommerce
npm run check:admin-exclusion
npm run test:ci
npm run test:smoke
```

Run WooCommerce/wp-env checks when Docker is available and the task touches the plugin integration:

```bash
npm run wp:start
npm run wp:setup
npm run wp:test
npm run wp:stop
```

If a compatible Node runtime or external tool is unavailable, stop the relevant verification path, document the exact blocker, and do not substitute unsupported package-manager flags.

## Documentation

Current architecture documents live under `docs/architecture/`. Development setup lives under `docs/development/`. Architectural decisions live under `docs/decisions/`.

The inventory document may describe historical baseline behavior. Current build and migration documents must describe the supported WooCommerce-only state.
