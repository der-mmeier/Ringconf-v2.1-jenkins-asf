# Runtime And Data Flow

This document describes the current supported runtime shape after removing legacy shop-specific branches. Standalone and WooCommerce are the supported modes.

## Bootstrap

```mermaid
flowchart TD
  A[src/index2.html] --> B[src/main.ts]
  B --> C[AppModule]
  C --> D[AppComponent]
  D --> E[WebglComponent]
  D --> F[FooterComponent and controls]
```

`src/main.ts` still uses the classic NgModule bootstrap through `platformBrowserDynamic().bootstrapModule(AppModule)`. There is no Angular Router.

## UI To Renderer

```mermaid
flowchart LR
  A[User control] --> B[AppComponent state and RingData]
  B --> C[cRing domain model]
  C --> D[WebglComponent]
  D --> E[Babylon.js scene]
  E --> F[Canvas]
```

`AppComponent`, `RingData`, `cRing`, and `WebglComponent` remain the compatibility-sensitive state/rendering path. The current branch does not redesign that architecture.

## Save And Load

```mermaid
sequenceDiagram
  participant UI as Angular UI
  participant App as AppComponent
  participant API as src/php/api.php
  participant DB as Database
  UI->>App: save/load action
  App->>API: POST rpc + rpp to api.php
  API->>DB: read/write preset or AppData
  DB-->>API: row data / generated id
  API-->>App: JSON response
  App-->>UI: state update
```

`getDistRootUrl()` now resolves the PHP bridge as `api.php` for all supported modes. Existing preset IDs and suffix behavior remain unchanged.

## WooCommerce Build And Deployment

```mermaid
flowchart TD
  A[npm run buildWoocommerce] --> B[ng build --configuration=woocommerce]
  B --> C[_shop/woocommerce/OneRingconf/dist]
  C --> D[postbuild.woocommerce.js]
  D --> E[WooCommerce plugin loads generated assets]
```

The WooCommerce plugin source tree is still created in the next phase. Generated files under `_shop/woocommerce/OneRingconf/dist` are ignored.

## Add-To-Cart Boundary

The former direct shop form submission has been removed. `addToCart()` now saves the current preset through `dbSavePreset(true)` and dispatches `oneringconf:add-to-cart` in WooCommerce mode with `presetId` and `rings` in `detail`. The future plugin integration must consume that event or provide a documented alternative without changing preset contracts silently.

## Failure Paths

- Missing PHP DB configuration now throws a clear `Missing ONERINGCONF_DB_DSN configuration` server error.
- API calls still depend on the legacy RPC dispatcher in `src/php/api.php`.
- WebGL lifecycle and context-loss risks remain as documented in `risk-register.md`.
