# SFTP Deployment

The ASF 3D configurator is deployed as a versioned standalone release on the central ASF platform. PHP files are copied into the release package after the Angular production build. They are not added to Angular dev-server assets.

## Server Layout

```text
/3d-konfigurator/
  releases/
    2.6.9-build.1/
    2.6.9-build.2/
  release-index.json
  current/
  admin/
```

`current/` is optional. The authoritative release list is `release-index.json`.

## Local Config

Create a local SFTP config from the example:

```powershell
Copy-Item .deployrc.example.json .deployrc.json
```

`.deployrc.json` and `.deployrc.local.json` are ignored by Git. Do not commit host names, users, passwords, private key paths, passphrases, or customer data.

Relevant config fields:

- `channel`: deployment channel, for example `staging`.
- `publicBaseUrl`: public base URL, for example `https://toolbox.asf.gmbh/3d-konfigurator`.
- `sftp.host`, `sftp.port`, `sftp.username`, `sftp.password`.
- `sftp.privateKeyPath` and `sftp.passphrase` for key-based auth.
- `remote.baseDir`: usually `/3d-konfigurator`.
- `remote.releasesDir`: usually `releases`.
- `release.nameTemplate`: default `{version}-build.{buildNumber}`.

## Commands

```powershell
npm run build
npm run build:deploy
npm run deploy:dry-run
npm run deploy:staging
```

`npm run build:deploy` runs the Angular production build, finds the Angular 22 output folder, creates `.deploy/<releaseId>/`, copies runtime PHP files, and writes `release.json`.

`npm run deploy:dry-run` prints the target SFTP paths and does not upload.

`npm run deploy:staging` uploads the latest `.deploy/<releaseId>/` package to:

```text
/3d-konfigurator/releases/<releaseId>/
```

## Release IDs

`package.json` remains SemVer, for example:

```text
2.6.9
```

The build number is separate. It is read from `RINGCONF_BUILD_NUMBER` or `BUILD_NUMBER`. If neither is set, the package builder increments the highest local build number for the current version from `.deploy/release-index.json`.

Default release folder:

```text
2.6.9-build.1
```

`release.json` contains version, build number, branch, short SHA, build time, channel, AppData contract, price contract, and public URL.

## Release Index

The deploy script downloads the remote `release-index.json` when present, upserts the new release entry, and uploads it again.

Minimal shape:

```json
{
  "current": "2.6.9-build.1",
  "releases": [
    {
      "id": "2.6.9-build.1",
      "version": "2.6.9",
      "buildNumber": 1,
      "branch": "main",
      "shortSha": "a1b2c3d",
      "createdAt": "2026-07-08T12:00:00.000Z",
      "url": "https://toolbox.asf.gmbh/3d-konfigurator/releases/2.6.9-build.1/",
      "status": "testing",
      "compatible": null,
      "appDataContract": "2.6",
      "priceContract": "1.0"
    }
  ]
}
```

## Admin Version Select

The development admin panel has a minimal `Build-Releases` section under `Versionen und Freigaben`.

It can:

- load `release-index.json`;
- show available releases;
- display status, branch, SHA, AppData contract, and price contract;
- switch the preview iframe to the selected release URL.

Compatibility persistence for build releases is intentionally not implemented here. Long-term write access belongs behind a protected server-side admin endpoint.

## Security

- Protect `/3d-konfigurator/admin/` server-side.
- `licenseKey` values are public tenant identifiers, not secrets.
- Tenant enablement, Origin allowlists, price calculation, and cart authorization must remain server-side.
- SFTP credentials and private keys stay in ignored local config or CI secrets.
