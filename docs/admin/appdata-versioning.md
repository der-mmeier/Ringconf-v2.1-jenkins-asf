# AppData Versioning

AppData versions are immutable snapshots stored server-side. The development admin calls only `/appdata-admin.php`; the PHP endpoint validates, normalizes, hashes, diffs, and writes the version in a database transaction.

## Tables

The endpoint uses the schema from `sql/001_ringconf_appdata_versioning.sql`:

| Table | Role |
|---|---|
| `ringcfg_appdata_build` | Build registry with app version, optional Git commit, Angular version, and Babylon version. |
| `ringcfg_appdata_version` | Immutable AppData snapshots, semantic version parts, SHA-256 hash, state, base version, and diff metadata. |
| `ringcfg_appdata_build_compatibility` | Exact build/AppData compatibility status. |
| `ringcfg_appdata_target` | Active target or customer assignment. |
| `ringcfg_appdata_release_history` | Assignment and rollback history. |
| `ringcfg_appdata_audit_log` | Employee action audit trail without credentials. |

The legacy `TABLE_DATA/appdata` value remains the runtime fallback. After a `local-development` target assignment, the selected immutable snapshot is mirrored back to `TABLE_DATA/appdata` as a runtime cache. Production targets are not mirrored by local development assignment.

## Version Rules

`saveVersion` requires `baseVersionId`, `baseHash`, `bump`, `changeReason`, and a complete `appData` object. The backend locks the base version, compares the hash, rejects conflicts with HTTP 409, rejects identical snapshots, computes the next version label, stores the full snapshot, and creates an `untested` compatibility row for the current build.

Unknown fields are intentionally retained. The frontend and backend both validate common structural rules, but the backend recomputes the authoritative hash and diff.

## Baseline Import

`importCurrentBaseline` is available only while no version row exists. It imports the existing legacy `TABLE_DATA` row with `id = appdata`, creates the baseline snapshot, writes an audit event, and marks compatibility with the current build as `untested`.
