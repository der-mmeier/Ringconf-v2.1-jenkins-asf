# AGENTS.md

## 1. Purpose and scope

This repository contains the source code of a production-oriented 3D ring configurator used across B2C and B2B sales channels.

The application must support multiple delivery targets, including:

- standalone browser usage,
- mobile and tablet usage,
- Shopware 5 integration,
- WooCommerce integration,
- existing PHP bridge and deployment files,
- saved and reloadable ring configurations.

These instructions apply to the entire repository unless a more specific `AGENTS.md` exists in a subdirectory.

## 2. Primary engineering objectives

Prioritize the following, in this order:

1. Preserve existing configurator behavior and data contracts.
2. Establish a reproducible baseline for the delivered legacy application.
3. Document the architecture before major refactoring.
4. Modernize Angular and its toolchain in controlled, reviewable steps.
5. Improve maintainability without silently changing pricing, configuration, rendering, preset, or shop-integration behavior.
6. Keep all supported build targets operational.

Do not treat this repository as a generic Angular demo. It is a domain-specific 3D commerce application with legacy integration contracts.

## 3. Known legacy baseline

At the time this file was introduced, the delivered project reports approximately:

- application package version: `2.6.6`,
- Angular core packages: `^15.0.0`,
- Angular CLI: `~15.0.5`,
- Angular build tooling: `^15.0.5`,
- TypeScript: `~4.8.2`,
- RxJS: `~7.5.0`,
- Zone.js: `~0.12.0`,
- styles: SCSS,
- source root: `src`,
- legacy development runtime: Node.js 18.20.x.

The originally delivered Angular 15 baseline is not expected to run correctly under Node.js 20 without modernization.

Do not modify the baseline merely to suppress audit warnings. First reproduce, inventory, and document it.

## 4. Known Angular build targets

The root `angular.json` currently defines at least these configurations:

- `development`,
- `production`,
- `shopware5`,
- `woocommerce`.

Known output paths include:

- standard build: `dist/ringconf-v2.1`,
- Shopware 5: `_shop/shopware5/OneRingconf/Resources/dist`,
- WooCommerce: `_shop/woocommerce/OneRingconf/dist`.

Known environment replacements include:

- `src/environments/environment.shopware5.ts`,
- `src/environments/environment.woocommerce.ts`.

The configured HTML entry point is currently `src/index2.html`. Do not rename or replace it until its purpose and all deployment references have been verified.

The Angular asset configuration also copies PHP files from `src/php`. These files may be part of active deployment contracts. Do not remove, relocate, rename, or stop copying them without tracing their consumers.

## 5. Domain invariants

Changes must preserve the externally visible behavior of the ring configurator unless a task explicitly changes a requirement.

Important domain areas include:

- 3D ring rendering and scene lifecycle,
- ring type and profile selection,
- ring width, thickness, size, geometry, and compatibility rules,
- metal, alloy, material, surface, and color selection,
- stone settings and stone colors,
- colored-stone placeholders and rendering,
- ring-pair configuration,
- saved presets and reloadable configurations,
- unique configuration IDs,
- AppData and preset compatibility,
- pricing and downstream shop integration,
- Shopware 5 and WooCommerce environment behavior,
- mobile and tablet operation.

Existing serialized field names, preset keys, query parameters, API payloads, output filenames, and shop-facing contracts are compatibility-sensitive.

Do not rename or normalize them merely for aesthetics.

When a selected profile or ring dimension cannot fit the current stone setting, the intended user experience is a safe automatic fallback to the closest smaller compatible stone setting, accompanied by a clear notice. The configurator must not enter a warning loop or trap the customer.

## 6. Mandatory repository inventory before major work

Before the first Angular migration or large refactor, inspect the complete repository and document at least:

- application bootstrap and module structure,
- routing,
- component hierarchy,
- state management and shared services,
- 3D engine and rendering integration,
- model, texture, image, and other asset loading,
- configuration and preset schemas,
- AppData flow,
- API and PHP bridge endpoints,
- Shopware 5 integration,
- WooCommerce integration,
- environment files,
- build and deployment scripts,
- generated versus maintained files,
- test coverage and missing critical tests,
- likely secrets or environment-specific credentials,
- dependency risks,
- browser, mobile, and tablet assumptions.

Create or update these documents before substantive migration work:

- `docs/architecture/repository-inventory.md`
- `docs/architecture/runtime-and-data-flow.md`
- `docs/migration/angular-modernization-plan.md`

The initial inventory task must not make broad runtime changes. Documentation and minimal diagnostic corrections are acceptable; feature changes are not.

## 7. Angular modernization policy

Angular upgrades must be incremental and auditable.

Rules:

1. Determine the exact installed baseline from `package.json` and `package-lock.json`.
2. Reproduce the legacy baseline with a compatible Node.js version before upgrading, where reasonably possible.
3. Select the final Angular and Node.js target explicitly and document why.
4. Upgrade one Angular major version at a time unless an official migration tool requires a narrower intermediate sequence.
5. Keep Angular framework packages, CLI, compiler CLI, build tooling, TypeScript, RxJS, and Zone.js mutually compatible.
6. Run the official Angular migrations for each major step.
7. Review every migration diff before continuing.
8. Build and test all supported targets after each major step.
9. Commit each successful major step separately.
10. Do not combine dependency modernization with unrelated feature work.

Never use the following as a migration strategy:

```text
npm audit fix --force
npm install --force
npm install --legacy-peer-deps
blindly installing all latest package versions
manually editing the lockfile
```

These commands may only be used when a task explicitly requires them and the consequences have been documented.

Security findings must be triaged. Distinguish runtime vulnerabilities from development-only tooling findings, then resolve them through compatible upgrades rather than dependency-tree coercion.

## 8. Package management rules

- Use the package manager implied by the committed lockfile.
- Prefer `npm ci` for reproducible installs.
- Do not delete or regenerate `package-lock.json` without an explicit reason.
- Any lockfile change must correspond to an intentional dependency change.
- Never edit files inside `node_modules`.
- Do not commit `node_modules`, Angular caches, coverage output, or generated build artifacts.
- Record the required Node.js and npm versions in repository documentation and, once agreed, in a version file such as `.nvmrc` or `.node-version`.

## 9. Build and verification commands

For the legacy Angular 15 baseline, use a compatible Node.js 18 runtime.

Typical baseline commands are:

```powershell
npm ci
npx ng version
npx ng build --configuration development
npx ng build --configuration production
npx ng build --configuration shopware5
npx ng build --configuration woocommerce
```

After modernization, use the Node.js version supported by the selected Angular target and update these instructions if commands change.

Do not claim a build is successful unless the command was actually run and its exit status was successful.

If a build cannot run because the original dependency graph is unavailable or inconsistent, document the exact blocker instead of hiding it with force flags.

## 10. Required functional smoke checks

Where automated tests do not yet exist, document and perform the relevant manual smoke checks after behavior-affecting changes:

1. Application starts without fatal console errors.
2. The 3D scene and configured ring model load.
3. Camera, zoom, rotation, and responsive canvas behavior work.
4. Ring type and profile can be changed.
5. Ring size, width, and thickness changes are reflected correctly.
6. Materials, alloys, colors, and surfaces can be selected.
7. Stone setting can be selected and rendered.
8. Stone color selection persists and is represented in the renderer and preset data.
9. An incompatible stone setting falls back to a smaller compatible option without a loop.
10. Ring-pair configuration keeps both rings consistent.
11. A configuration can be saved with its unique ID and reloaded without data loss.
12. Existing presets remain compatible, or a migration path is provided.
13. Shopware 5 build uses the correct environment and output path.
14. WooCommerce build uses the correct environment and output path.
15. Required PHP bridge files and static assets are present in the correct build output.
16. Core interaction remains usable on desktop, tablet, and mobile viewport sizes.

Convert these checks into automated tests as the architecture becomes testable.

## 11. 3D and asset handling rules

- Identify the actual 3D engine and its version before changing rendering code.
- Preserve coordinate systems, units, model orientation, camera assumptions, material names, mesh names, and asset paths unless all consumers are migrated.
- Do not replace rendering or asset-loading mechanisms during an Angular upgrade unless required for compatibility.
- Avoid loading the same heavy model, texture, or scene asset more than once.
- Dispose of scenes, meshes, materials, textures, observables, subscriptions, animation frames, and event handlers when components are destroyed.
- Treat WebGL context loss, mobile GPU limits, and memory usage as production concerns.
- Keep rendering behavior deterministic for identical configuration data.
- Do not commit proprietary source assets to new locations without verifying licensing and repository policy.

## 12. PHP and shop integration rules

The repository contains Angular code and PHP integration files. Do not assume PHP files are dead code simply because Angular builds the frontend.

Before changing a PHP file or its copied output:

- identify its callers,
- identify required request and response fields,
- identify authentication and CORS behavior,
- identify whether Shopware 5, WooCommerce, standalone deployment, or another system consumes it,
- preserve response contracts unless the task explicitly introduces a versioned contract.

Do not place credentials, database passwords, private tokens, certificates, or production secrets in committed PHP, TypeScript, JSON, or environment files.

Use example files and documented environment injection for secrets.

## 13. Data compatibility rules

Configuration data is business-critical.

Before changing interfaces, classes, schemas, or property names related to saved configurations:

- locate every serializer and deserializer,
- locate URL, local storage, backend, and preset representations,
- compare existing sample payloads,
- preserve backward compatibility,
- add explicit migrations when compatibility cannot be preserved,
- add fixtures for representative legacy configurations.

Never silently discard unknown fields from existing presets unless the task explicitly approves it.

The existing unique configuration-ID process is an external contract and must not be replaced casually.

## 14. Refactoring rules

- Prefer small, behavior-preserving steps.
- Separate framework migration, architecture refactoring, and feature development.
- Do not rewrite large components solely to modernize syntax.
- Introduce strict typing progressively and resolve errors intentionally.
- Remove dead code only after proving that it is unreachable and not part of a deployment variant.
- Preserve public APIs until all consumers have been identified.
- Avoid introducing a new state-management library, UI framework, or 3D engine without an explicit architectural decision.
- Keep user-facing German terminology consistent with existing product language unless localization is introduced deliberately.

## 15. Git workflow

- Do not work directly on `main` for migrations or feature changes.
- Never force-push `main`.
- Never rewrite remote history without explicit approval.
- Start from a clean working tree.
- Inspect `git status` and the complete diff before committing.
- Keep commits focused and reversible.
- Do not mix generated output into source commits.

Recommended branch sequence:

```text
chore/repository-inventory
chore/reproduce-angular-15-baseline
upgrade/angular-16
upgrade/angular-17
upgrade/angular-18
...
```

Use the actually required intermediate versions rather than assuming this exact sequence is complete.

Recommended commit style:

```text
chore: document repository architecture
chore: establish reproducible Angular 15 baseline
build: upgrade workspace to Angular 16
fix: preserve shopware build asset output
fix: restore preset compatibility after framework migration
```

## 16. Secret and privacy controls

Before pushing or committing changes, inspect at least:

- `src/php/database.php`,
- `src/php/**/config.php`,
- `src/environments/**`,
- API configuration files,
- deployment scripts,
- certificates and private keys,
- copied production configuration,
- sample customer or order data.

If a secret has already been committed locally but not pushed, remove it from the commit history before the first push.

If a secret has been pushed, report it immediately and recommend rotation. Deleting it in a later commit is not sufficient.

## 17. Files that must not be edited as source

Unless a task explicitly states otherwise, do not edit or commit:

- `node_modules/`,
- `dist/`,
- `.angular/`,
- coverage output,
- generated Shopware or WooCommerce `dist` directories,
- minified bundles,
- generated source maps,
- IDE-specific project state.

Change their source inputs instead.

## 18. Task execution protocol

For every non-trivial task:

1. Read this file and any nested `AGENTS.md` files.
2. Inspect the relevant code and existing tests before editing.
3. State the observed architecture and constraints.
4. State the intended minimal change.
5. Implement the change.
6. Run the narrowest relevant checks first.
7. Run all affected build targets and tests.
8. Review the diff for accidental generated files, secrets, and unrelated changes.
9. Report what changed, what was verified, and what remains uncertain.

Do not claim that a requirement is satisfied based only on static inspection when runtime verification is possible.

## 19. Definition of done

A task is complete only when:

- the requested behavior is implemented,
- relevant compatibility contracts are preserved or explicitly migrated,
- relevant builds succeed,
- relevant tests or smoke checks succeed,
- no secrets or generated artifacts were introduced,
- dependency changes are intentional and documented,
- the diff contains no unrelated edits,
- documentation is updated where behavior, architecture, setup, or deployment changed,
- remaining risks and unverified areas are stated clearly.

## 20. Required final report from an agent

Every completed coding task must end with a concise report containing:

- summary of changes,
- files changed,
- commands executed,
- build and test results,
- compatibility considerations,
- unresolved risks or follow-up work.

For migration work, also report:

- previous and new Angular versions,
- previous and new Node.js requirements,
- package and lockfile changes,
- migrations executed,
- deprecated APIs still present,
- status of development, production, Shopware 5, and WooCommerce builds.
