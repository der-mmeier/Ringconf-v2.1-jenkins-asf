# Angular Modernization Plan

This document is the current migration plan after the Angular 15 to 22 upgrade work. The detailed execution log is in [angular-15-to-22-result.md](angular-15-to-22-result.md).

## Current Framework Baseline

| Area | Current baseline |
|---|---|
| App | `2.6.6` |
| Angular core | `22.0.5` |
| Angular CLI / DevKit | CLI `22.0.5`, DevKit build-angular `22.0.5` |
| TypeScript | `6.0.3` |
| RxJS | `7.5.7` |
| Zone.js | `0.15.1` |
| Babylon.js | `5.25.0` |
| Final Node target | `24.15.0` |
| Final npm target | npm `11.12.1` from Node `24.15.0` |
| Lockfile | npm lockfile version 3 |
| Supported shop integration | WooCommerce only |

## Official Compatibility

The upgrade target was checked against Angular's official version table and update documentation:

- Angular version compatibility: <https://angular.dev/reference/versions>
- Angular Update Guide: <https://angular.dev/update-guide>
- Angular CLI update command: <https://angular.dev/cli/update>

For Angular `22.0.x`, the official table lists Node `^22.22.3 || ^24.15.0 || ^26.0.0`, TypeScript `>=6.0.0 <6.1.0`, and RxJS `^6.5.3 || ^7.4.0`. This project uses Node `24.15.0`, TypeScript `6.0.3`, and RxJS `7.5.7`.

## Completed Migration Sequence

| Stage | Angular | Node used | TypeScript | Command principle | Gates |
|---|---|---|---|---|---|
| Latest 15.x | `15.2.10` core, `15.2.11` CLI | `18.20.8` | `4.8.4` | `npx ng update @angular/cli@^15 @angular/core@^15` | development, production, WooCommerce builds |
| 16 | `16.2.12` | `18.20.8` | `5.1.6` | `npx ng update @angular/cli@^16 @angular/core@^16` | same gates |
| 17 | `17.3.12` | `18.20.8` | `5.4.5` | `npx ng update @angular/cli@^17 @angular/core@^17` | same gates |
| 18 | `18.2.14` | `20.19.5` | `5.4.5` | `npx ng update @angular/cli@^18 @angular/core@^18` | same gates |
| 19 | `19.2.25` | `20.19.5` | `5.8.3` | `npx ng update @angular/cli@^19 @angular/core@^19` | same gates |
| 20 | `20.3.25` | `20.19.5` | `5.8.3` | `npx ng update @angular/cli@^20 @angular/core@^20` | same gates |
| 21 | `21.2.17` | `20.19.5` | `5.9.3` | `npx ng update @angular/cli@^21 @angular/core@^21` | same gates |
| 22 | `22.0.5` | `24.15.0` | `6.0.3` | `npx ng update @angular/cli@^22 @angular/core@^22` | same gates |

Existing `test:ci` and `test:smoke` scripts were not present in `package.json`; no new test harness was introduced in this Angular-only branch.

## Current Follow-Up Workstreams

1. Keep Angular 22 stable with the existing `@angular-devkit/build-angular:browser` builder until a separate builder migration can verify the WooCommerce output contract.
2. Migrate Sass `@import` usage separately; Angular 22 builds currently warn but do not fail.
3. Evaluate CommonJS warnings from `canvg` transitive dependencies separately from the framework upgrade.
4. Upgrade Babylon.js only in a dedicated rendering branch after screenshot and WebGL smoke coverage exists.
5. Add or restore automated CI/test scripts in a separate testing task.
6. Keep PHP API behavior, Preset/AppData fields, configuration IDs, Babylon assets, and WooCommerce output paths unchanged.
