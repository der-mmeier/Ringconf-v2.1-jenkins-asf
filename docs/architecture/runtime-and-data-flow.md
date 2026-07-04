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

## Development AppData Admin Flow

The AppData/WebGL admin is mounted from `src/main.ts` by calling `bootstrapDevelopmentAdmin(...)`. In the `development` build this resolves to `src/app/development-admin/admin-entry.ts`, which creates `DevelopmentAdminComponent` outside the main `AppModule` template. Production and WooCommerce replace that file with `admin-entry.disabled.ts`, so admin components and labels do not enter those dependency graphs.

```mermaid
sequenceDiagram
  participant Main as src/main.ts
  participant Entry as admin-entry.ts
  participant Admin as DevelopmentAdminComponent
  participant Api as /appdata-admin.php
  participant Verify as Internal verification service
  participant Db as AppData version tables

  Main->>Entry: bootstrapDevelopmentAdmin(moduleRef)
  Entry->>Admin: createComponent
  Admin->>Api: POST bootstrap / saveVersion / approveVersion
  Api->>Verify: HTTPS POST with X-Internal-Verification-Key
  Verify-->>Api: verified + permissions
  Api->>Db: transaction, hash, diff, audit
  Db-->>Api: immutable snapshot / assignment
  Api-->>Admin: JSON result without secrets
```

`AppDataAdminService` only uses relative `/appdata-admin.php` requests. Login and PIN are in-memory dialog fields, sent in JSON request bodies for sensitive actions, then cleared. They are never stored in browser storage.

The local endpoint implements the versioning contract from `ringcfg_appdata_build`, `ringcfg_appdata_version`, `ringcfg_appdata_build_compatibility`, `ringcfg_appdata_target`, `ringcfg_appdata_release_history`, and `ringcfg_appdata_audit_log`. It keeps the legacy `TABLE_DATA/appdata` entry as runtime fallback and only mirrors an assigned snapshot back there for the `local-development` target.

The canvas build label is now a build/AppData pair: `WebglComponent.getBuildString()` renders `Build <build> · AppData <version>`. `AppComponent.state.appDataVersionLabel` is updated by the development admin when a versioned snapshot is loaded.
