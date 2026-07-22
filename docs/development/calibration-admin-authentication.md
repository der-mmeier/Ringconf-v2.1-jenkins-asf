# Calibration Admin Authentication

Ringconf 2.7.10.3 gates the development-only Calibration Studio before it loads database-backed view data.

## Flow

```text
Studio button -> Login dialog -> calibrationAuthenticate -> Studio modal -> calibrationBootstrap
```

The Studio modal is not opened until `calibrationAuthenticate` succeeds. After that, the first modal open sends exactly one `calibrationBootstrap` request. If a protected request later returns `401`, `403`, `INVALID_CREDENTIALS` or `FORBIDDEN`, the in-memory session is cleared and the login dialog is shown again. The original request is retried at most once after reauthentication.

## Credential Storage

`AdminSessionService` keeps username and PIN only in Angular memory. It does not use `localStorage`, `sessionStorage`, cookies or generated files for credentials. Debug payload summaries mask `pin`; server responses never echo it.

The Views tab no longer owns separate username/PIN fields. It displays the current session username and allows editing only the change reason used for write actions.

## Endpoint Contract

`src/php/calibration-admin.php` exposes:

```text
calibrationAuthenticate
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

`calibrationAuthenticate` calls the existing employee verification helper with editor permissions and does not open calibration tables, run migrations or save rows. `calibrationBootstrap` requires the verified session payload before it reads or seeds calibration data. Write actions use the same payload and add the shared change reason.

Production and WooCommerce builds still replace the development admin entry with `admin-entry.disabled.ts`; this login gate is not shipped to productive bundles.
