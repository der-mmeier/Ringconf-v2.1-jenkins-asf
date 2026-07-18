# Generated Colored Stone Previews

Ringconf 2.7.8 uses generated SVG previews for colored stones. The AppData
`stoneColor` palette is the only color source; the frontend no longer maintains a
second hard-coded preview palette.

## Source And Safety

The generator is a manual development workflow:

```bash
npm run stones:generate -- --dry-run
npm run stones:generate
npm run stones:verify
```

Only `stones:generate` reads the local AppData database. Normal Angular,
production, and WooCommerce builds use the committed SVGs and manifest and do
not require a database connection or `config.local.php`.

The Node generator never parses PHP configuration files. It starts the PHP CLI
adapter at `tools/stone-preview-generator/php/read-stone-palette.php`, which:

- runs only under `PHP_SAPI === 'cli'`;
- loads the existing local PHP configuration through `src/php/config.php`;
- performs read-only `SELECT` queries;
- writes normalized palette JSON to stdout;
- writes diagnostics to stderr without connection details or credentials.

No AppData row, snapshot, target assignment, or database schema is changed.

## AppData Selection

By default, the adapter resolves the productive target used by the configurator:

1. active AppData target assignment for `default-production`;
2. approved AppData version only;
3. compatibility with the current package build version when a fallback lookup is
   needed.

For controlled local checks, pass explicit options:

```bash
npm run stones:generate -- --target=default-production
npm run stones:generate -- --version=<appdata-version-label-or-id>
npm run stones:generate -- --state=draft --version=<draft-version>
```

Use draft state only in a local development context.

## Outputs

Generated SVGs live in:

```text
src/assets/imgui/stones/generated/
```

The Angular manifest lives in:

```text
src/app/generated/colored-stone-preview-manifest.ts
```

The manifest contains only public frontend data: stable color ID, label, asset
path, preview hex value, and non-secret AppData version metadata. It does not
contain DSNs, hosts, usernames, passwords, tokens, or complete AppData snapshots.

## SVG Template

The current colored stones all use the same brilliant-style preview template.
Each generated SVG is fully vector based:

- transparent root;
- `viewBox="0 0 512 384"`;
- clipped faceted crown and pavilion paths;
- deterministic gradients;
- a visible outline;
- no `<image>` element;
- no `data:image`;
- no embedded PNG or other raster payload.

Future cut templates can be added as separate template IDs once the actual UI
needs them. Ringconf 2.7.8 intentionally ships only the currently needed
brilliant-style template.

## Color Derivation

The adapter normalizes AppData colors into a `previewHex`. The generator then
derives a deterministic facet palette:

- `deepShadow`
- `shadow`
- `base`
- `midLight`
- `light`
- `specularTint`
- `outline`

White or very light stones receive cool gray outlines and visible facets so they
remain readable on a white UI. Black stones are rendered as anthracite facets
with controlled highlights instead of a flat black fill. Saturated colors keep
their color character in highlights and do not use random values, dates, or
runtime-dependent output.

## Frontend Resolution

`src/app/stone-preview-assets.ts` resolves previews in this order:

1. explicit valid AppData preview asset;
2. generated manifest asset by stable AppData color ID;
3. generated neutral faceted fallback.

The legacy `assets/imgui/stones/colors/` circle-style placeholders are treated
as placeholders and are not used as final explicit preview assets. Selection,
pricing, preset data, and WebGL shader values continue to use the original
AppData color ID and color object.

## Verification

`npm run stones:verify` does not use the database. It checks the committed
manifest and generated SVG directory for:

- missing referenced assets;
- unreferenced generated SVGs;
- unsafe filenames and path traversal;
- duplicate IDs;
- raster references;
- missing `viewBox`;
- missing faceted paths or outline;
- accidental circle placeholders.

Run it after every AppData color change and before builds.

## After An AppData Color Change

1. Update the AppData in the normal development workflow.
2. Run `npm run stones:generate -- --dry-run`.
3. Run `npm run stones:generate`.
4. Run `npm run stones:verify`.
5. Review the diff. Only the affected generated SVGs and manifest values should
   change.

Do not copy reference PNG/SVG files into `src/assets`, do not embed Base64
assets, and do not write generated asset paths back into AppData.
