# Calibration Export And Hardcode Workflow

Calibration exports are generated from the development-only Calibration Studio.

## Export Formats

The studio can copy deterministic JSON, download JSON, or copy a deterministic TypeScript module. The implementation lives in `src/app/development-admin/calibration-studio/calibration-export.ts`.

The JSON export includes:

- schema version
- project version
- composition profile
- calibrated ring presentation roots
- startup camera sequence

The TypeScript export is generated from the same state and keeps key ordering stable.

## Determinism

Exports use stable object-key ordering and deterministic numeric rounding. Identical calibration state produces byte-identical JSON and TypeScript output.

## Hardcode Policy

Only calibrated presentation and startup camera values belong in these exports. Do not put calibration state into RingData, AppData snapshots, price logic, or preset payloads.

## Legacy Bundle Patcher

The legacy patcher is intentionally separate from Angular. It can inspect or patch a known legacy Shopware bundle only when the bundle hash matches an accepted hash and all expected signatures are unique.

Commands:

```bash
npm run calibration:legacy:inspect -- --bundle=path/to/main.9ed7d4047c3b1bed.js
npm run calibration:legacy:patch -- --bundle=path/to/main.9ed7d4047c3b1bed.js --out=path/to/main.patched.js --calibration=path/to/calibration.json
npm run test:legacy-calibration-patcher
```

The patcher never adds `preset_2` or `preset_3` to a minified bundle by string replacement. It only changes known calibration literals after hash and signature checks.

