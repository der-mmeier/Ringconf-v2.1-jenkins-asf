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
- Existing configuration IDs and ID suffix behavior.
- `src/index2.html` as the Angular HTML entry.
- PHP RPC names and request/response shapes in `src/php/api.php`.
- Babylon.js asset paths under `src/assets` and copied PHP asset paths.
- WooCommerce plugin output path `_shop/woocommerce/OneRingconf/dist`.

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
