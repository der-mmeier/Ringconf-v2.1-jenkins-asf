# Angular Modernization Plan

Keine Migration wurde in diesem Auftrag durchgefuehrt. Dieser Plan trennt Baseline-Reproduktion, Angular-Upgrades, Babylon.js-Modernisierung, Refactoring, Tests, Security und Features.

## Baseline

| Paket/Werkzeug | `package.json` | aufgeloest in `package-lock.json` |
|---|---|---|
| App | `2.6.6` | - |
| `@angular/core` | `^15.0.0` | `15.0.4` |
| `@angular/cli` | `~15.0.5` | `15.0.5` |
| `@angular-devkit/build-angular` | `^15.0.5` | `15.0.5` |
| `@angular/compiler-cli` | `^15.0.0` | `15.0.4` |
| TypeScript | `~4.8.2` | `4.8.4` |
| RxJS | `~7.5.0` | `7.5.7` |
| Zone.js | `~0.12.0` | `0.12.0` |
| Babylon.js | `5.25.0` | `5.25.0` |
| jsPDF | `^2.5.1` | `2.5.1` |
| file-saver | `2.0.5` | `2.0.5` |

Lockfile: npm `lockfileVersion: 2`.

Lokal geprueft:

| Tool | Version |
|---|---|
| Node | `v20.16.0` |
| npm | `10.8.3` |

Baseline-Blocker: Angular 15.0.x verlangt laut offizieller Angular-Versionstabelle Node `^14.20.0 || ^16.13.0 || ^18.10.0`, TypeScript `~4.8.2` und RxJS `^6.5.3 || ^7.4.0` (Quelle: https://angular.dev/reference/versions). Node 20 ist fuer diese Baseline nicht gelistet. Daher wurden `npm ci`, `npx ng version` und Builds nicht ausgefuehrt.

Zustand:

| Bereich | Befund |
|---|---|
| Tests | eine Spec-Datei, wahrscheinlich ungueltig fuer nicht-Standalone-Komponente |
| development build | nicht ausgefuehrt |
| production build | nicht ausgefuehrt |
| shopware5 build | nur statisch analysiert; `_shop` fehlt |
| woocommerce build | nur statisch analysiert; `_shop` fehlt |
| Security | kritische Secrets/SQL/CORS-Befunde |

## Zielauswahl

Extern verifiziert am Auftragstag ueber offizielle/Primaerquellen:

| Quelle | Relevanter Befund |
|---|---|
| Angular Version Compatibility | Angular-Dokumentation listet aktive Versionen bis Angular 22; Angular 22.0.x verlangt Node `^22.22.3 || ^24.15.0 || ^26.0.0`, TypeScript `>=6.0.0 <6.1.0`, RxJS `^6.5.3 || ^7.4.0` |
| Angular Update Guide | Offizielles Werkzeug fuer majorweise Updates unter https://angular.dev/update-guide |
| Node.js Releases | Node 24 ist LTS, Node 22 ist LTS, Node 20 ist EOL; Node 26 ist Current; Produktion soll Active/Maintenance LTS verwenden (Quelle: https://nodejs.org/en/about/previous-releases) |
| Babylon.js Releases | GitHub Releases zeigen Babylon.js 9.15.0 als Latest am 2026-07-02 (Quelle: https://github.com/BabylonJS/Babylon.js/releases) |

Empfohlenes Ziel fuer Angular:

| Option | Bewertung |
|---|---|
| Angular 22 direkt als Endziel | fachlich sinnvoll als langfristiges Ziel, aber hoher Sprung von Angular 15, Node 22.22/24.15/26 erforderlich |
| Angular 20 als Zwischenziel | offiziell aktiv unterstuetzt, Node `^20.19.0 || ^22.12.0 || ^24.0.0`, TypeScript `>=5.8.0 <6.0.0`; kann als stabileres Zwischenziel dienen |
| Empfehlung | Zuerst Baseline auf Node 18 reproduzieren, dann majorweise bis Angular 20 als erstes grosses Modernisierungsziel; danach Angular 21/22 separat entscheiden, wenn Node 24/26 und TS 6 fuer das Projekt tragbar sind |

Grund: Dieses Projekt hat kritische Legacy-Vertraege (PHP, Presets, Shop-Ausgaben, Babylon/WebGL). Ein direktes Springen auf Angular 22 wuerde Framework-, Node-, TypeScript-, Builder- und Browserbaseline-Aenderungen mit ungetesteter 3D-/Shoplogik koppeln.

Babylon.js: nicht automatisch mit Angular aktualisieren. Das Projekt nutzt Babylon 5.25.0 tief in `WebglComponent`, `cRing`, `stoneCalc`, `Preload`, Shadern, OBJ-Loadern und Serializers. Babylon 9.x muss eigener Arbeitsstrang mit Rendering-Screenshots und mobiler GPU-Pruefung sein.

## Migrationssequenz

Grundregel: eine Angular-Major-Stufe pro Branch/Commitserie, offizielle `ng update`-Migrationshinweise je Stufe vorher pruefen.

| Stufe | Angular | Node | TypeScript | RxJS/Zone | offizieller Befehl | erwartete Migrationen | Buildgates | Rollback |
|---|---|---|---|---|---|---|---|---|
| 0 | 15.0.x Baseline | Node 18.20.x empfohlen; Angular 15.0.x erlaubt `^18.10.0` | `~4.8.2` | RxJS 7.5, Zone 0.12 | `npm ci`, `npx ng version`, Builds | keine | dev/prod/shop/woo + vorhandene Tests | Branch verwerfen |
| 1 | 16.x | Node 18.10+ oder 16.14+ laut Matrix | `>=4.9.3 <5.2` | RxJS `^7.4`, Zone passend | `npx ng update @angular/core@16 @angular/cli@16` | Angular 16 Migrations | alle Buildgates | Revert Stufe |
| 2 | 17.x | Node `^18.13.0 || ^20.9.0` | `>=5.2 <5.5` je Minor | RxJS `^7.4` | `npx ng update @angular/core@17 @angular/cli@17` | Builder/TS/Angular Migrations | alle Buildgates | Revert Stufe |
| 3 | 18.x | Node `^18.19.1 || ^20.11.1 || ^22.0.0` | `>=5.4 <5.6` | RxJS `^7.4` | `npx ng update @angular/core@18 @angular/cli@18` | Angular 18 Migrations | alle Buildgates | Revert Stufe |
| 4 | 19.x | Node `^18.19.1 || ^20.11.1 || ^22.0.0` | `>=5.5 <5.9` | RxJS `^7.4` | `npx ng update @angular/core@19 @angular/cli@19` | Angular 19 Migrations | alle Buildgates | Revert Stufe |
| 5 | 20.x | Node `^20.19.0 || ^22.12.0 || ^24.0.0` | `>=5.8 <6.0` | RxJS `^7.4` | `npx ng update @angular/core@20 @angular/cli@20` | Angular 20 Migrations | alle Buildgates | Revert Stufe |
| 6 | 21.x | Node `^20.19.0 || ^22.12.0 || ^24.0.0` | `>=5.9 <6.0` | RxJS `^7.4` | `npx ng update @angular/core@21 @angular/cli@21` | Angular 21 Migrations | alle Buildgates | Revert Stufe |
| 7 | 22.x | Node `^22.22.3 || ^24.15.0 || ^26.0.0` | `>=6.0 <6.1` | RxJS `^7.4` | `npx ng update @angular/core@22 @angular/cli@22` | Angular 22 Migrations | alle Buildgates | Revert Stufe |

Die exakten Befehlsvarianten und Zwischenschritte pro Minor muessen unmittelbar vor jeder Stufe mit dem Angular Update Guide validiert werden.

## Buildgates pro Major

Nach jedem Major muessen mindestens bestehen:

| Gate | Befehl/Check |
|---|---|
| Install | `npm ci` ohne Lockfile-/Package-Aenderung ausser geplant |
| Angular Version | `npx ng version` |
| Development | `npx ng build --configuration development` |
| Production | `npx ng build --configuration production` |
| Shopware | `npx ng build --configuration shopware5` plus separat gepruefter Postbuild, wenn `_shop` vorhanden |
| WooCommerce | `npx ng build --configuration woocommerce` plus separat gepruefter Postbuild, wenn `_shop` vorhanden |
| Unit Tests | `npx ng test --watch=false` nach Reparatur der Testinfrastruktur |
| Preset Load | Fixture `0000-0000`, reale ID, Suffix-ID |
| Save | `dbSavePreset` contract, ID-Erhalt |
| 3D | Canvas nicht leer, Ring sichtbar, Kamera/Zoom/Resize |
| Fachlogik | Profil, Masse, Material, Oberflaeche, Fugen, Steinbesatz |
| Shop | erwartete PHP-Dateien/Assets im Output |
| Mobile | Tablet/Phone Viewport, Touch, WebGL memory smoke |

## Trennung der Arbeitsstraenge

1. Reproduzierbare Angular-15-Baseline: Node 18 pinnen, `npm ci`, Builds, Ist-Fehler dokumentieren.
2. Angular-Major-Upgrades: nur Angular/CLI/TS/RxJS/Zone kompatibel je Stufe.
3. Babylon.js-Upgrade: eigener Branch, Rendering- und Assetloader-Vertraege, keine Kopplung an Angular ausser zwingend.
4. Architekturrefactoring: erst nach Tests; Singletons/Services/Lifecycle herausarbeiten.
5. Testaufbau: Preset-Fixtures, PHP-Contracts, WebGL-Smokes, Stein-Fallbacks.
6. Sicherheitsbereinigung: Secrets/SQL/CORS/Uploads; moeglichst vor produktiver Reproduktion klaeren.
7. Featureentwicklung: Steinbesatz-Fallback, neue Profile/Farben erst nach Baseline und Tests.

## Branch- und Commitplan

| Phase | Branch | Ziel |
|---|---|---|
| Inventur | `chore/repository-inventory` | diese Dokumentation |
| Baseline | `chore/reproduce-angular-15-baseline` | Node 18, `npm ci`, Builds, Smoke-Doku |
| Security | `security/remove-committed-secrets` | nach Rotation/Entscheidung, keine stille Historienarbeit |
| Tests | `test/add-baseline-contract-smokes` | Preset/PHP/WebGL/Shop-Smokes |
| Upgrade 16 | `upgrade/angular-16` | ein Major |
| Upgrade 17 | `upgrade/angular-17` | ein Major |
| Upgrade 18 | `upgrade/angular-18` | ein Major |
| Upgrade 19 | `upgrade/angular-19` | ein Major |
| Upgrade 20 | `upgrade/angular-20` | erstes empfohlenes Modernisierungsziel |
| Upgrade 21/22 | `upgrade/angular-21`, `upgrade/angular-22` | nach Neubewertung |
| Babylon | `upgrade/babylon-major` | separat nach Angular-Stabilisierung oder vorher nur wenn zwingend |

Jede erfolgreiche Stufe braucht einen fokussierten Commit mit Build-/Testnachweis. Keine Force-Flags, kein `npm audit fix --force`, kein `--legacy-peer-deps`.
