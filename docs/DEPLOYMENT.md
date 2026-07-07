# Deployment

This project uses script-based deployment for versioned standalone test builds. PhpStorm FTP/SFTP deployment can still be used for manual inspection or one-off transfers, but it should not be the primary path for reproducible build folders.

## Local Development

```bash
npm run start
```

The Angular dev server runs on `http://127.0.0.1:4200/` with `proxy.conf.json`. PHP endpoints are served separately by a PHP-capable server. Do not add PHP files back into Angular dev assets.

## Production Build

```bash
npm run build
```

The standard production output stays under `dist/ringconf-v2.1`. WooCommerce output remains separate and is not changed by the standalone deployment scripts.

## Versioned Standalone Test Deployment

Create a local, untracked deployment config:

```bash
copy .deployrc.example.json .deployrc.local.json
```

Fill in FTP/FTPS credentials and the remote base path. Do not commit `.deployrc.local.json`.

Build a versioned deploy package:

```bash
npm run build:deploy
```

This creates a folder like:

```text
.deploy/
  ringconf-2.6.6-feature-x-a1b2c3d-20260704-221500Z/
    index.html
    assets/
    *.js
    *.css
    api.php
    appdata-admin.php
    config.php
    database.php
    browsers.json
    manifest.json
```

The folder name is generated from package version, sanitized Git branch, short Git SHA, and timestamp. Branch names such as `feature/x` become URL-safe, for example `feature-x`.

Preview the upload without transferring files:

```bash
npm run deploy:dry-run
```

Deploy the latest package:

```bash
npm run deploy:staging
```

The default remote layout is:

```text
/configurator/
  builds/
    <versioned-build-folder>/
  current.json
```

`current.json` is updated after upload unless `updateCurrent` is set to `false` in `.deployrc.local.json`.

## Manifest

Each deploy package contains `manifest.json` with build metadata:

- package version
- Git branch
- Git SHA
- build timestamp
- deployment type
- WooCommerce binding flag
- future AppData compatibility fields

Future admin tooling can read these manifests and later mark concrete build/AppData combinations as compatible or incompatible.

## Security Notes

- Do not commit FTP/SFTP credentials.
- Do not print passwords in logs or summaries.
- `.deploy/` is generated and ignored.
- The deployment package may contain server PHP files for the test instance, but local secret overlays such as `src/php/config.local.php` are not copied.
- `license-key` style tenant identifiers are public routing data, not secrets. Real origin/license checks and price/cart authorization must remain server-side with an exact Origin allowlist, correct preflight handling, `Vary: Origin`, and server-side pricing.

## PhpStorm

PhpStorm deployment mappings can help inspect or manually upload files, but dynamic versioned build folders should be created by:

```bash
npm run build:deploy
npm run deploy:dry-run
npm run deploy:staging
```

This keeps folder naming, manifests, PHP copying, and future build/AppData compatibility records reproducible.
