# Angular 15 to 22 Upgrade Result

## Scope

This branch upgrades the existing WooCommerce-only Angular workspace from Angular 15 to Angular 22. It does not change Ringconf business logic, Preset/AppData fields, configuration IDs, PHP RPC contracts, Babylon.js assets, WooCommerce data contracts, or Babylon.js package versions.

Official references used:

- Angular version compatibility: <https://angular.dev/reference/versions>
- Angular Update Guide: <https://angular.dev/update-guide>
- Angular CLI update command: <https://angular.dev/cli/update>
- Node.js distribution metadata: <https://nodejs.org/dist/index.json>

## Starting Versions

| Component | Starting version |
|---|---:|
| Angular core | `15.0.4` |
| Angular CLI | `15.0.5` |
| Angular DevKit build-angular | `15.0.5` |
| TypeScript | `4.8.4` |
| RxJS | `7.5.7` |
| Zone.js | `0.12.0` |
| Babylon.js packages | `5.25.0` |
| Host Node before portable runtimes | `20.16.0`, not supported for the Angular 15 baseline |
| Host npm before portable runtimes | `10.8.3` |

The Angular 15 baseline was verified with portable official Node `18.20.8` because local `nvm` was unavailable and Docker Desktop was not running.

## Final Versions

| Component | Final version |
|---|---:|
| Node | `24.15.0` |
| npm | `11.12.1` |
| Angular core | `22.0.5` |
| Angular CLI | `22.0.5` |
| Angular DevKit build-angular | `22.0.5` |
| TypeScript | `6.0.3` |
| RxJS | `7.5.7` |
| Zone.js | `0.15.1` |
| Babylon.js packages | `5.25.0` |

`.nvmrc`, `.node-version`, and `package.json#engines` now target Node `24.15.0` in the Node 24 LTS line.

## Major Stages

| Target | Node used | Update command | Development | Production | WooCommerce | Commit |
|---|---|---|---|---|---|---|
| latest 15.x | `18.20.8` | `npx ng update @angular/cli@^15 @angular/core@^15` | successful | successful | successful | `056f9bf` |
| 16 | `18.20.8` | `npx ng update @angular/cli@^16 @angular/core@^16` | successful | successful | successful | `da84d50` |
| 17 | `18.20.8` | `npx ng update @angular/cli@^17 @angular/core@^17` | successful | successful | successful | `d628d48` |
| 18 | `20.19.5` | `npx ng update @angular/cli@^18 @angular/core@^18` | successful | successful | successful | `0a3413f` |
| 19 | `20.19.5` | `npx ng update @angular/cli@^19 @angular/core@^19` | successful | successful | successful | `ff9217d` |
| 20 | `20.19.5` | `npx ng update @angular/cli@^20 @angular/core@^20` | successful | successful | successful | `5b19e67` |
| 21 | `20.19.5` | `npx ng update @angular/cli@^21 @angular/core@^21` | successful | successful | successful | `f1fb9c8` |
| 22 | `24.15.0` | `npx.cmd ng update @angular/cli@^22 @angular/core@^22` plus `ng update @angular/core --migrate-only --from 21.2.17 --to 22.0.5` | successful | successful | successful | `ed5d5d9` |

The PowerShell execution policy blocked Node 24 `npm.ps1` and `npx.ps1`; the same official Node runtime was used through `npm.cmd` and `npx.cmd`.

## Migration Notes

| Stage | Automatic or manual change | Reason |
|---|---|---|
| 16 | `tsconfig.json` added `skipLibCheck: true` | TypeScript 5.1 exposed an external DOM/WebGL declaration conflict while Babylon.js remained frozen at `5.25.0`. |
| 17 | `angular.json` changed `browserTarget` to `buildTarget` for serve/extract-i18n targets | Official CLI workspace migration. |
| 18 | `src/app/app.module.ts` moved HTTP setup to `provideHttpClient(withInterceptorsFromDi())` | Official Angular migration away from deprecated HTTP module usage. |
| 19 | Angular added `standalone: false` to declared components and pipes | Official Angular migration to preserve NgModule-based semantics. |
| 19 | `src/app/webgl/webgl.component.ts` casts the disabled `helperOverlay` debug element through `unknown` | TypeScript 5.8 tightened DOM cast checks; the code is inside an existing disabled debug block and does not alter runtime behavior. |
| 20 | `angular.json` added schematics defaults and `tsconfig.json` changed `moduleResolution` to `bundler` | Official CLI migrations. |
| 21 | `src/main.ts` added `provideZoneChangeDetection()` in bootstrap providers | Official Angular migration for bootstrap option compatibility. |
| 21 | Angular attempted the control-flow template migration; the generated template changes were reverted | The existing templates build successfully on Angular 21 and the task explicitly excluded template syntax modernization. |
| 21 | `tsconfig.json` removed explicit `lib` entries | Official CLI migration to use current defaults. |
| 22 | `package.json` added `istanbul-lib-instrument` | Official CLI migration for Karma unit-test instrumentation support. |
| 22 | `tsconfig.json` added `ignoreDeprecations: "6.0"` | TypeScript 6.0 otherwise fails on existing `baseUrl` and `downlevelIteration` deprecations. The existing options are preserved. |
| 22 | Components received `ChangeDetectionStrategy.Eager` | Official Angular 22 migration to preserve pre-v22 change-detection behavior. |
| 22 | `src/app/app.module.ts` changed to `provideHttpClient(withXhr(), withInterceptorsFromDi())` | Official Angular 22 migration because the app uses `HttpXhrBackend`. |
| 22 | `tsconfig.app.json` and `tsconfig.spec.json` suppress two extended diagnostics | Official Angular 22 migration to preserve pre-v22 diagnostic behavior. |

## Buildsystem Decision

The workspace still uses:

```json
"builder": "@angular-devkit/build-angular:browser"
```

The optional `use-application-builder` migration was offered in multiple stages and was not executed. Angular 22 emits a deprecation warning for the Webpack/browser builder, but the protected output contracts remain intact:

- Standalone output: `dist/ringconf-v2.1`
- WooCommerce output: `_shop/woocommerce/OneRingconf/dist`
- HTML entry: `src/index2.html`
- PHP and asset copy rules from `angular.json`

Migrating to `@angular/build:application` should be a separate builder-output contract task because it can introduce output layout changes such as a `browser/` subdirectory.

## Verification

| Check | Status | Command |
|---|---|---|
| Angular 15 baseline install | successful | `npm ci` under Node `18.20.8` |
| Angular 15 baseline builds | successful | `npx ng build --configuration development`, `production`, `woocommerce` |
| Each major build gate | successful | Development, production, and WooCommerce builds after each Angular major |
| Angular 22 version | successful | `npx.cmd ng version` under Node `24.15.0` |
| Angular 22 dependency tree | successful | `npm.cmd ls @angular/core @angular/cli @angular-devkit/build-angular @angular/compiler-cli typescript rxjs zone.js --depth=0` |
| Tests | not executed | `test:ci` and `test:smoke` scripts are not present in `package.json` |

Final verification after documentation changes is tracked in the command log of the branch completion report.

## Remaining Warnings

- Angular 22 warns that `@angular-devkit/build-angular:browser` is deprecated as part of Webpack support deprecation.
- Sass warns that existing `@import` rules will be removed in Dart Sass 3.0.0.
- `canvg` transitive dependencies still trigger CommonJS optimization warnings.
- Production bundles still exceed the warning budget but not the error budget.

These warnings existed or became visible through toolchain changes and were not fixed in this Angular-only migration branch.

## Explicitly Not Treated

- The local Angular dev-server `http://127.0.0.1/api.php` 404 is unchanged. The Angular dev server does not execute PHP, and this branch does not alter PHP API URLs or contracts.
- Babylon.js remains frozen at `5.25.0`.
- No feature work, Ringconf business-rule changes, Preset/AppData schema changes, configuration-ID changes, PHP contract changes, WooCommerce contract changes, state-management rewrite, Signals migration, Standalone Components migration, or UI redesign was performed.
