# 0001 Remove Shopware Support

Date: 2026-07-03

## Decision

Shopware support is removed from the active source tree, build configuration, PHP bridge assumptions, and runtime behavior. WooCommerce is the only supported productive shop integration. Standalone remains supported as a development and test harness.

## Previous State

The historical baseline contained Angular build configuration, environment flags, PHP config copying, postbuild logic, DOM form construction, and comments for Shopware 5 and partially Shopware 6-like runtime behavior.

## Removed Contracts

- Angular `shopware5` build configuration.
- `buildShopware5` npm script.
- `postbuild.shopware5.js`.
- `src/environments/environment.shopware5.ts`.
- `src/php/shopware5/`.
- `_shop/shopware5/` output ignore path.
- `isShopware5` environment field.
- Runtime CSRF/header and tab callbacks tied to Shopware.
- DOM form and line-item construction for Shopware cart integration.

## Supported Targets

- Standalone Angular dev server.
- Standalone production build served by a PHP-capable local server.
- WooCommerce production build and local WordPress/WooCommerce test environment.

## Impact

Existing Shopware deployments are no longer compatibility targets from this commit forward. WooCommerce integration must consume the current preset-save boundary and generated plugin assets. Historical inventory remains available for audit purposes, but current build gates must not require Shopware.

## Rollback

Rollback is only via Git history. There is no compatibility guarantee for Shopware after this decision.
