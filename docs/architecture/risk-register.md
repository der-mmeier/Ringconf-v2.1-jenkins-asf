# Risk Register

Sensitive values are intentionally not repeated. Severity order: Critical, High, Medium, Low, Informational.

| ID | Area | Evidence | Impact | Likelihood | Severity | Recommendation | Phase |
|---|---|---|---|---|---|---|---|
| SEC-001 | Credentials history | Current tree reads DB settings from `ONERINGCONF_*`, but earlier commits contained production-like DB constants in PHP config files | The values may remain exposed through Git history or remotes | High | Critical | Rotate/suspend affected credentials externally; do not claim history cleanup without explicit rewrite approval | Security |
| SEC-002 | SQL construction | `src/php/api.php` still interpolates IDs and JSON payloads into SQL strings | Injection, data loss, preset manipulation | High | Critical | Move to prepared statements and validate RPC inputs in a dedicated security branch | Security |
| SEC-003 | CORS/Auth | `src/php/api.php` allows broad CORS and RPC access | Cross-site invocation of backend actions | Medium | High | Add origin allowlist and server-side authorization/CSRF appropriate to deployment | Security |
| SEC-004 | Upload/file operations | `uploadFile()` and `uploadDiamondEnvMap.php` write files from request data | Path or content misuse | Medium | High | Whitelist paths, validate MIME/extension, require authorization | Security |
| DATA-001 | Preset compatibility | `RingData.clone()` copies known keys only | Unknown legacy fields can be lost on save/load | High | High | Add fixture-based preset compatibility tests before schema changes | Tests |
| DATA-002 | Configuration ID contract | `api.php::create_id()` and `dbSavePreset()` define external ID/suffix behavior | Existing links and shop data can break | Medium | High | Treat ID behavior as a contract and cover with tests | Tests |
| RENDER-001 | WebGL lifecycle | `WebglComponent` creates Babylon resources without comprehensive `dispose()` coverage | GPU memory leaks and mobile instability | High | High | Add lifecycle cleanup after migration gates exist | Rendering |
| RENDER-002 | Context loss | `engine.doNotHandleContextLost = true` | Empty canvas after GPU/context loss | Medium | High | Define context-loss fallback and smoke tests | Rendering |
| TEST-001 | Sparse automated coverage | Baseline has only minimal Karma coverage and no browser smoke suite yet | Framework migration regressions can pass unnoticed | High | Critical | Add Playwright standalone and WooCommerce smoke coverage before major upgrades | Tests |
| BUILD-001 | Node mismatch | Host Node `v20.16.0`; Angular 15 baseline requires Node 14/16/18 according to Angular matrix | Baseline install/build may fail before app compilation | High | High | Use Docker or a version manager for each supported Angular major | Build |
| BUILD-002 | Legacy postbuild | `postbuild.woocommerce.js` rewrites generated files asynchronously and writes no manifest | Non-deterministic plugin assets | Medium | Medium | Replace with idempotent manifest-based Node script | Build |
| MOBILE-001 | Mobile rendering assumptions | Large assets, UA detection, global listeners, context-loss disabled | Tablet/phone instability | Medium | High | Add desktop/tablet/mobile smoke and rendering checks | Tests |
| DOMAIN-001 | Stone compatibility fallback | Current domain code may reduce stones or clear settings without a tested deterministic fallback | Customer-visible configuration loss | High | Critical | Specify fallback matrix and tests before feature work | Domain |
