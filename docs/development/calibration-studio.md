# Calibration Studio

The Calibration Studio is a development-only tool under the AppData/WebGL admin. Production and WooCommerce builds replace the admin entry with `admin-entry.disabled.ts`, so the studio is not shipped to productive bundles.

## Open And Move

The studio opens as a floating modal independent from the AppData/WebGL admin panel. Closing the admin panel does not destroy an open Studio session. The title bar drags the modal and the edge/corner handles resize it. Geometry is clamped to the viewport and stored locally for the development browser session.

## Database-Backed Views

As of 2.7.10.1, productive camera/view configuration is runtime data loaded through the backend API. Angular builds never read the database, and `src/app/webgl/ring-view-default-presets.ts` is no longer a runtime source.

The local standalone API and WooCommerce REST bridge expose the public RPC:

```text
dbGetCalibrationProfile
```

The development admin endpoint exposes editor-protected actions for authoring:

```text
calibrationBootstrap
calibrationCreateView
calibrationUpdateView
calibrationDuplicateView
calibrationDeleteView
calibrationSortViews
calibrationSetDefaultView
calibrationSetViewEnabled
calibrationActivateProfile
```

Since 2.7.10.2 these actions are posted to `calibration-admin.php`, not to `appdata-admin.php`. `appdata-admin.php` remains the shared helper and AppData editor endpoint. The split keeps calibration request failures concrete in the UI and prevents a missing calibration deployment file from surfacing as a generic AppData-admin failure.

Writes require the existing internal employee verification payload and a change reason. The API uses revision checks; saving stale rows returns a conflict instead of overwriting newer calibration work.

## Data Model

Calibration data is split into three tables configured in `src/php/config.php`:

- `TABLE_CALIBRATION_PROFILE`
- `TABLE_CALIBRATION_COMPOSITION`
- `TABLE_CALIBRATION_VIEW`

A profile owns compositions. A composition describes an active ring-slot setup, startup sequence, natural ring layout, and default framing. A view always belongs to exactly one composition and stores camera pose, zoom/framing and ring presentation layout atomically.

The first migration seeds an active `default-2-7-10` profile from the 2.7.10 defaults. After that migration, the database profile is the runtime source. Existing AppData and preset contracts are not changed.

## Authoring Workflow

1. Open the development build and wait until WebGL is ready.
2. Open Calibration Studio.
3. Use the `Views` tab and select the target composition.
4. Create or edit a view.
5. Use `Aus Kamera uebernehmen`, `Ringaufstellung uebernehmen`, or `Kamera + Aufstellung uebernehmen`.
6. Preview the view live.
7. Enter employee credentials and a concise change reason.
8. Save. If another editor changed the row first, reload and reapply intentionally.

The view table can enable/disable views, set one default view per composition, duplicate views and reorder views. The productive view navbar is built from active database views for the current composition.

## Categories

All variable labels and help texts are centralized in `src/app/development-admin/calibration-studio/calibration-field-definitions.ts`.

Main categories:

- Initiale Ringaufstellung
- Startup-Kamera
- Framing
- Kamerafahrt

Every exported variable has a help text, Babylon mapping where useful, and an explicit export flag.

## Ring Calibration

Ring calibration edits presentation roots only:

- root position
- root rotation through readable Euler controls
- root quaternion in the advanced section
- root visibility

The `Ringe` tab is grouped into `Position`, `Rotation`, `Erweitert: Quaternion` and `Darstellung`. The Euler controls are an authoring aid; persisted data remains the normalized quaternion, so existing calibration and runtime contracts are unchanged.

The Natural State action restores the current natural presentation snapshot from the WebGL service. Discard restores the session snapshot captured when the studio opened.

## Camera And Startup Sequence

The studio captures separate start and end camera poses. Both can be applied live. The startup sequence can be replayed repeatedly with configured delay, duration, and easing.

The Legacy Shopware Intro action creates a compatibility-style start pose by offsetting the current end camera alpha and uses the `legacy-exponential` easing mode.

## Numeric Controls

Every numeric calibration field has a number input and a linked slider. There are exactly two step modes:

- `Grob 1.0`, the default.
- `Fein 0.5`.

Safe ranges are read from the centralized field definitions. Ring presentation roots, camera pose, framing and sequence duration are clamped at edit time before live preview is applied.

As of 2.7.10.2 numeric controls use the shared `x-calibration-number-control`. Label/help, number input and slider stack vertically inside one control. The Studio body is an inline-size container:

- wide Studio window: three controls per row,
- medium Studio window: two controls per row,
- narrow Studio window: one control per row.

The view table is the only intentionally wide surface and scrolls inside its own wrapper. The modal and body use `overflow-x: hidden`, so resizing the Studio must not create a global horizontal scrollbar.

## Runtime Behavior

Applying a value updates existing Babylon objects and forces render frames. It does not reload meshes, textures, the engine, the scene, or RingData. Startup animation can be stopped, paused, or jumped to its end pose.

Calibration state is not written into RingData. Camera pose and ring presentation roots stay separate until saved together as one view row.

## Error Handling

Calibration load and save failures render an in-modal error panel with message, request ID, error code and endpoint. PHP warning output is buffered and discarded before JSON responses are written. Uncaught PHP details are logged server-side with the same request ID and are not returned to Angular as HTML, warnings or stack traces.

`npm run build:deploy:development` copies `calibration-admin.php` and validates direct PHP include dependencies before writing release metadata. A missing `calibration-admin.php` or missing shared include now fails packaging before deployment instead of producing a broken Staging bundle.
