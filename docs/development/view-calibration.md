# View Calibration

The view calibration tool is available only through the Development Admin. Production and WooCommerce builds replace the admin entry with the disabled implementation, so calibration UI, LocalStorage override handling, and export helpers are not part of the customer bundle.

## Workflow

1. Start the development build.
2. Select a normal WebGL view, for example `D außen`.
3. Open Development Admin and the view calibration panel.
4. Select the target view ID explicitly.
5. Enable calibration mode.
6. Rotate the existing camera freely, use the mouse wheel to change orthographic `orthoHeight`, and adjust `target.x/y/z` with numeric inputs or nudge buttons.
7. Use `Werte aus Kamera übernehmen`.
8. Use `Kalibrierung speichern` to store a development override in `ringconf.dev.view-calibration.v1`.
9. Export JSON or TypeScript.
10. Copy the TypeScript values into `src/app/webgl/ring-view-default-presets.ts`.
11. Clear overrides and reload to compare the hardcoded result.

No source file is written by the browser.

## Preset Model

The canonical zoom value for orthographic views is `projection.orthoHeight`. Raw `orthoLeft`, `orthoRight`, `orthoTop`, and `orthoBottom` are diagnostics because they depend on the canvas aspect ratio.

`safety.fitMode` supports:

- `fixed`: authored framing is applied directly.
- `zoom-out-only`: authored framing is kept unless visual bounds would crop; then the effective height only grows.
- `auto`: fit is derived from current visual bounds.

Side-specific safety paddings and optional shadow envelope values are relative to projected visual bounds. The global ground plane is not used for framing.

## Shadow Safety

Ring shadows are finite ring-bound meshes. Detail views include them only through the safety path, so they do not force every close-up to include a large global ground plane. `zoom-out-only` keeps the authored composition while still preventing the visible shadow from being cropped on small or portrait canvases.

## Local Overrides

Local overrides are versioned and contain only camera preset data keyed by view ID. Invalid values are ignored. They do not contain RingData, customer input, prices, presets, or order data.
