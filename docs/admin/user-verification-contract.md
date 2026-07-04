# User Verification Contract

Angular must never call the employee-verification service directly.

```text
Development admin -> /appdata-admin.php -> server-side HTTPS verification -> database transaction
```

`src/php/appdata-admin.php` sends the internal header `X-Internal-Verification-Key` from local configuration or environment. The key must never appear in Angular source, generated bundles, Git, docs, browser storage, logs, or audit metadata.

## Configuration

Use environment variables or ignored `src/php/appdata-admin.config.local.php`:

| Name | Purpose |
|---|---|
| `ONERINGCONF_USER_VERIFICATION_URL` | Internal HTTPS verification endpoint. |
| `ONERINGCONF_USER_VERIFICATION_KEY` | Secret server-side verification key. |
| `ONERINGCONF_APPDATA_EDITOR_PERMISSIONS` | Comma-separated permissions accepted for edit actions. |
| `ONERINGCONF_APPDATA_APPROVER_PERMISSIONS` | Comma-separated permissions accepted for approval and target assignment. |
| `ONERINGCONF_DB_DSN` | Local/admin database DSN. |
| `ONERINGCONF_DB_USERNAME` | Database user. |
| `ONERINGCONF_DB_PASSWORD` | Database password. |

`src/php/appdata-admin.config.local.example.php` contains only placeholders.

## Error Codes

The endpoint maps verification and workflow failures to stable client codes: `INVALID_CREDENTIALS`, `RATE_LIMITED`, `FORBIDDEN`, `CONFLICT`, `VALIDATION_FAILED`, and `SERVER_ERROR`. Responses do not include SQL, stack traces, credentials, PINs, or internal key values.
