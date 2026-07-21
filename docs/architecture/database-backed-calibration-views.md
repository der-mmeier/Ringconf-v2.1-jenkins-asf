# Database-Backed Calibration Views

Ringconf 2.7.10.1 moves productive view calibration from generated TypeScript defaults to runtime data served by the backend.

## Runtime Source

Angular builds never connect to the database. The active calibration profile is loaded at application startup through the existing RPC transport:

```text
dbGetCalibrationProfile
```

Standalone development uses `src/php/api.php`. WooCommerce uses the WordPress REST RPC bridge. Both return the same normalized profile shape so the frontend view navbar can be built without build-time data access.

If no active database view exists for a composition, the runtime exposes no hardcoded TypeScript fallback. This keeps missing calibration visible during testing instead of silently shipping stale defaults.

## Model

The database stores calibration in three layers:

- Profile: versioned activation boundary.
- Composition: ring-slot setup such as `wedding-pair` or `engagement-only`.
- View: one atomic camera, zoom/framing and ring-layout snapshot belonging to a composition.

Views are ordered per composition. Only enabled views are exposed to productive runtimes. Disabled views remain visible to the development admin workflow.

## Migration Seed

On first access, the standalone database layer and the development admin calibration endpoint create the calibration tables if needed and seed one active profile:

```text
default-2-7-10
```

The seed is a one-time migration from the 2.7.10 authored defaults. After it exists, `default.ts` style generated defaults are not a runtime source.

## Frontend Flow

1. `AppComponent` loads AppData and `dbGetCalibrationProfile`.
2. `RingViewService` determines the current presentation composition.
3. `createRuntimeViewPresets()` maps active DB views to `iRingViewPreset`.
4. The view navbar renders the active composition's DB views in sort order.
5. Applying a view sets the authored camera pose and inline ring layout.

RingData, preset payloads and price contracts are unchanged.

## Authoring

Calibration Studio is development-only and independent from the AppData admin panel window state. It uses the dedicated development-only `calibration-admin.php` endpoint for authenticated writes:

```text
calibrationCreateView
calibrationUpdateView
calibrationDuplicateView
calibrationDeleteView
calibrationSortViews
calibrationSetDefaultView
calibrationSetViewEnabled
calibrationActivateProfile
```

Each write requires employee verification, a change reason and current row revision where applicable. Conflicting revisions return a conflict response and do not overwrite.

The Studio captures camera pose and ring presentation roots separately, but a saved view row always contains camera, framing and ring layout atomically.

`appdata-admin.php` is still used for AppData authoring and shared helper functions. Calibration authoring is routed separately so deployment omissions and server errors report the concrete Calibration endpoint and request ID.

## Build Boundary

Development, production and WooCommerce builds do not run migrations and do not need database credentials. Database access is runtime-only through PHP endpoints. Development admin code remains excluded from production and WooCommerce bundles through the existing Angular file replacement.

Development deploy packaging copies `calibration-admin.php` with the other development PHP endpoints and validates direct PHP include dependencies before writing release metadata.
