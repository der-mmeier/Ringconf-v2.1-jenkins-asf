# SFTP Deployment

The ASF 3D configurator is deployed as versioned standalone packages below the shared builds root. PHP files are copied into deploy packages after the Angular build. They are not added to Angular dev-server assets.

## Channels

Two deployment channels are supported:

- `releases`: public/stable release packages.
- `development`: internal development, admin, and AppData packages.

If no channel is provided, deploy tooling defaults to `releases`. Unknown channels are rejected.

## Server Layout

```text
/public_html/toolbox/3d-konfigurator/builds/
  releases/
    2.7.1-build.11/
      index.html
      assets/
      api.php
      config.php
      database.php
      browsers.json
      release.json
    current.json
  development/
    2.7.1-build.11/
      index.html
      assets/
      api.php
      appdata-admin.php
      config.php
      database.php
      browsers.json
      release.json
    current.json
  indexes/
    releases.json
    development.json
```

The authoritative release lists are channel-specific: `indexes/releases.json` and `indexes/development.json`.

## Local Config

Create a local SFTP config from the example:

```powershell
Copy-Item .deployrc.example.json .deployrc.json
```

`.deployrc.json` and `.deployrc.local.json` are ignored by Git. Do not commit host names, users, passwords, private key paths, passphrases, or customer data.

The remote base points to `builds`, not to a channel:

```json
{
  "sftp": {
    "host": "dedi2432.your-server.de",
    "port": 22,
    "username": "asfmtm",
    "password": "..."
  },
  "remote": {
    "baseDir": "/public_html/toolbox/3d-konfigurator/builds",
    "publicBaseUrl": "https://toolbox.asf.gmbh/3d-konfigurator/builds",
    "indexesDir": "indexes",
    "updateCurrent": true
  }
}
```

Do not configure `remote.baseDir` as `.../builds/releases` or `.../builds/development`.

## Commands

```powershell
npm run build
npm run build:deploy:release
npm run build:deploy:development
npm run deploy:dry-run:release
npm run deploy:dry-run:development
npm run deploy:release
npm run deploy:development
```

Compatibility aliases remain available:

```powershell
npm run build:deploy
npm run deploy:dry-run
npm run deploy:sftp
```

Those aliases target the `releases` channel. `npm run deploy:staging` builds and deploys the `development` channel.

## PHP Files

`releases` packages contain:

- `api.php`
- `config.php`
- `database.php`
- `browsers.json`

`development` packages contain:

- `api.php`
- `appdata-admin.php`
- `config.php`
- `database.php`
- `browsers.json`

`appdata-admin.php` is development-only and must not exist in public release packages.

## Package Metadata

Local packages are written to:

```text
.deploy/releases/<releaseId>/
.deploy/development/<releaseId>/
```

`release.json` contains `channel`, `baseHref`, `publicUrl`, version, build number, branch, short SHA, build time, AppData contract, price contract, and copied PHP files.

Example release URL:

```text
https://toolbox.asf.gmbh/3d-konfigurator/builds/releases/2.7.1-build.11/
```

Example development URL:

```text
https://toolbox.asf.gmbh/3d-konfigurator/builds/development/2.7.1-build.11/
```

## Current Pointers

When `remote.updateCurrent` is enabled, deploy writes channel-specific pointers:

```text
builds/releases/current.json
builds/development/current.json
```

There is no global `current` pointer shared by release and development builds.

## Server PDF Infrastructure

Server-side PDF rendering is central infrastructure next to `builds/`, not part of an individual release or development package.

Repo source:

```text
server/pdf/create.php
```

Server target:

```text
/public_html/toolbox/3d-konfigurator/pdf/create.php
```

FPDF 1.9 is installed separately on the server and is included by `create.php` with:

```php
require_once __DIR__ . '/../fpdf/1.9/fpdf.php';
```

Expected server layout:

```text
/public_html/toolbox/3d-konfigurator/
  builds/
  fpdf/1.9/
  pdf/
    create.php
    tmp/
    logs/
    templates/
```

Phase 1 keeps Angular responsible for saving the preset, collecting ring screenshots, and assembling details. Angular posts that payload to `/3d-konfigurator/pdf/create.php`; PHP/FPDF validates the request and streams the final PDF.

Until a dedicated deploy script exists, copy `server/pdf/create.php` to `/public_html/toolbox/3d-konfigurator/pdf/create.php` via the server deployment process. Do not copy it into `.deploy/<channel>/<releaseId>/` packages.

## Troubleshooting

Assets load from `/assets`: verify the package index contains `<base href="./">`, `environment.assetFolderLocation` is `"."` for standalone builds, and CSS in the deploy package does not contain `url(/assets...)`.

`appdata-admin.php` GET shows `METHOD_NOT_ALLOWED`: this is acceptable if the endpoint only supports POST. It should only be reachable in the `development` channel.

Wrong channel deployed: check the dry-run output. It prints `Channel`, local package path, remote release dir, remote index path, and public URL.

`appdata-admin.php` exists under `releases`: rebuild with `npm run build:deploy:release`; release packages intentionally copy only the public PHP runtime files.

Server PDF returns JSON instead of a file: inspect the `error.code` and `error.message` response. Invalid payloads return `VALIDATION_FAILED`; rate limiting returns HTTP 429 with `Retry-After`.

Server PDF fails with `PDF_FAILED`: verify `/public_html/toolbox/3d-konfigurator/fpdf/1.9/fpdf.php` exists and `pdf/tmp/` plus `pdf/logs/` are writable by PHP.
