# Angular Modernization Plan

No Angular migration has been performed yet on this branch.

## Verified Baseline

| Area | Current baseline |
|---|---|
| App | `2.6.6` |
| Angular core | `15.0.4` resolved in `package-lock.json` |
| Angular CLI / DevKit | `15.0.5` resolved |
| TypeScript | `4.8.4` resolved |
| RxJS | `7.5.7` resolved |
| Zone.js | `0.12.0` resolved |
| Babylon.js | `5.25.0` resolved |
| Lockfile | npm lockfile version 2 |
| Host Node | `v20.16.0`, not compatible with Angular 15 baseline |
| Host npm | `10.8.3` |
| PHP | `8.2.12` |
| Docker | `25.0.2`, compose `2.24.3-desktop.1` |
| nvm | not installed |

## Official Compatibility

Angular's official version table lists Angular `22.0.x` with Node `^22.22.3 || ^24.15.0 || ^26.0.0`, TypeScript `>=6.0.0 <6.1.0`, and RxJS `^6.5.3 || ^7.4.0`.

Node.js release documentation lists Node 24 as LTS and Node 26 as Current. This project should target Node 24 LTS once Angular 22 is reached, using a concrete patch version that satisfies Angular's `^24.15.0` range.

## Migration Sequence

Each Angular major must be a separate commit with a clean working tree before and after:

| Stage | Angular | Node | TypeScript | Command principle | Gates |
|---|---|---|---|---|---|
| Baseline | latest 15.x | Node 18 compatible runtime | Angular-selected 4.8/4.9 range | `npx ng update @angular/core@15 @angular/cli@15` if needed | install, dev/prod/Woo build, unit/smoke |
| 16 | 16.x | Node 18 | Angular matrix | `npx ng update @angular/core@16 @angular/cli@16` | same gates |
| 17 | 17.x | Node 18 or 20 per matrix | Angular matrix | `npx ng update @angular/core@17 @angular/cli@17` | same gates |
| 18 | 18.x | Node 20/22 per matrix | Angular matrix | `npx ng update @angular/core@18 @angular/cli@18` | same gates |
| 19 | 19.x | Node 20/22 per matrix | Angular matrix | `npx ng update @angular/core@19 @angular/cli@19` | same gates |
| 20 | 20.x | Node 22/24 per matrix | Angular matrix | `npx ng update @angular/core@20 @angular/cli@20` | same gates |
| 21 | 21.x | Node 22/24 per matrix | Angular matrix | `npx ng update @angular/core@21 @angular/cli@21` | same gates |
| 22 | 22.x | Node 24 LTS satisfying `^24.15.0` | `>=6.0.0 <6.1.0` | `npx ng update @angular/core@22 @angular/cli@22` | same gates |

Before each stage, consult the Angular Update Guide for exact migration instructions. Do not use `--force`.

## Workstream Separation

1. Reproduce Angular 15 baseline with a compatible Node runtime.
2. Build local standalone and WooCommerce test harnesses.
3. Add smoke coverage and rendering baselines.
4. Upgrade Angular one major at a time.
5. Update Babylon.js separately after Angular 22 is stable.
6. Address PHP security and SQL/CORS risks separately from framework migration.
7. Keep feature work, state-management redesign, and rendering refactors out of major-upgrade commits.

## Branch And Commit Plan

This branch is `upgrade/woocommerce-only-angular-22`. Expected commits:

| Commit theme | Purpose |
|---|---|
| `security: remove tracked credentials from runtime configuration` | Remove current-tree credentials |
| `refactor: remove unsupported shop integration paths` | Remove unsupported build/runtime paths |
| `build: add local standalone and WooCommerce test environments` | Add PHP server, plugin source, wp-env |
| `test: add standalone and WooCommerce smoke coverage` | Add Playwright smokes |
| `build: update Angular 15 to latest patch` | Latest Angular 15 baseline |
| `build: upgrade Angular workspace to 16` through `22` | One major per commit |
| `build: update supported runtime dependencies` | Direct non-Babylon dependencies |
| `build: upgrade Babylon.js runtime packages` | Babylon packages together, versions aligned |
| `ci: verify Angular and WooCommerce builds` | GitHub Actions verification |
