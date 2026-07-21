# Calibration Studio

The Calibration Studio is a development-only tool under the AppData/WebGL admin. Production and WooCommerce builds replace the admin entry with `admin-entry.disabled.ts`, so the studio is not shipped to productive bundles.

## Open And Move

The studio opens as a floating modal. The title bar drags the modal and the resize handle changes its size. Geometry is clamped to the viewport and stored locally for the development browser session.

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
- root quaternion
- root visibility

The Natural State action restores the current natural presentation snapshot from the WebGL service. Discard restores the session snapshot captured when the studio opened.

## Camera And Startup Sequence

The studio captures separate start and end camera poses. Both can be applied live. The startup sequence can be replayed repeatedly with configured delay, duration, and easing.

The Legacy Shopware Intro action creates a compatibility-style start pose by offsetting the current end camera alpha and uses the `legacy-exponential` easing mode.

## Runtime Behavior

Applying a value updates existing Babylon objects and forces render frames. It does not reload meshes, textures, the engine, the scene, or RingData. Startup animation can be stopped, paused, or jumped to its end pose.

