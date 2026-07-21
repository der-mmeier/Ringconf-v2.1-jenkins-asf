# Shopware 6 Compiled Calibration Notes

The historical minified Shopware bundle is reverse-engineering reference only. It must not be committed, copied into builds, or used as a source for current app logic.

## Supported Use

Use the legacy patcher to inspect or patch only a local copy of the compiled bundle:

```bash
npm run calibration:legacy:inspect -- --bundle=path/to/main.9ed7d4047c3b1bed.js
npm run calibration:legacy:patch -- --bundle=path/to/main.9ed7d4047c3b1bed.js --out=path/to/main.patched.js --calibration=path/to/calibration.json
```

The patcher requires the expected SHA-256 hash unless an explicit accepted hash is provided by the caller for tests or controlled local analysis. It refuses ambiguous signatures and refuses bundles that already contain `preset_2` or `preset_3` markers.

## Mapping Caveats

Legacy names are not always current concepts:

- legacy `camera` arrays map to Babylon alpha, beta, and radius values
- `cameraMinOrthoSize` maps to current orthographic framing height
- `ringRotationX` and related names are not the current canonical visible root rotation
- current visible ring rotations export as quaternions

Do not infer product-state changes from legacy presentation constants.

