# Build and Deployment Matrix

Alle Angaben sind statisch aus `package.json`, `angular.json`, Environment-Dateien und Buildskripten verifiziert. Es wurden keine Builds ausgefuehrt.

## npm-Skripte

| Skript | Befehl | Mutierend | Status |
|---|---|---|---|
| `start` | `ng serve --host 192.168.178.125` | nein, aber feste LAN-IP | nicht ausgefuehrt |
| `start & open` | `ng serve --open` | nein | nicht ausgefuehrt |
| `build` | `ng build` | erzeugt `dist/` | nicht ausgefuehrt |
| `buildShopware5` | `ng build --configuration=shopware5 && node postbuild.shopware5.js` | ja, Postbuild schreibt CSS/JS und `plugin.xml` | nicht ausgefuehrt |
| `buildWoocommerce` | `ng build --configuration=woocommerce && node postbuild.woocommerce.js` | ja, Postbuild schreibt CSS/JS | nicht ausgefuehrt |

`package.json.backup` enthielt mutierende `node prebuild.js`-Aufrufe; aktuelle `package.json` nicht. `prebuild.js` bleibt dennoch riskant, da es `package.json` inkrementiert.

## Buildmatrix

| Ziel | Befehl | Angular-Konfiguration | Environment | Output | Postbuild | veraenderte Dateien | Verbraucher | Risiken |
|---|---|---|---|---|---|---|---|---|
| standalone production | `npm run build` oder `ng build` | `production` wegen `defaultConfiguration` | `src/environments/environment.ts` | `dist/ringconf-v2.1` | keiner | generierte Dist-Dateien | Standalone/PHP | Node 20 inkompatibel; PHP config copy nutzt Shopware config |
| development | `npx ng build --configuration development` | `development` | `environment.ts` | `dist/ringconf-v2.1` | keiner | generierte Dist-Dateien + sourcemaps | Baseline-Diagnose | nicht ausgefuehrt; sourcemaps nur dev |
| production explizit | `npx ng build --configuration production` | `production` | `environment.ts` | `dist/ringconf-v2.1` | keiner | generierte Dist-Dateien | Standalone | nicht ausgefuehrt |
| shopware5 | `npm run buildShopware5` | `shopware5` | `environment.shopware5.ts` | `_shop/shopware5/OneRingconf/Resources/dist` | `postbuild.shopware5.js` | CSS/JS URL-Rewrites, `plugin.xml` Version | Shopware Plugin | `_shop` fehlt; Postbuild mutiert |
| woocommerce | `npm run buildWoocommerce` | `woocommerce` | `environment.woocommerce.ts` | `_shop/woocommerce/OneRingconf/dist` | `postbuild.woocommerce.js` | CSS/JS URL-Rewrites | WP/Woo Plugin | `_shop` fehlt; keine Hooks getrackt |

## Angular-Konfigurationen

Gemeinsame Build-Optionen:

| Option | Wert |
|---|---|
| Builder | `@angular-devkit/build-angular:browser` |
| `outputPath` | `dist/ringconf-v2.1` |
| `index` | `src/index2.html` |
| `main` | `src/main.ts` |
| `polyfills` | `zone.js` |
| `tsConfig` | `tsconfig.app.json` |
| Styles | `src/styles.scss` |
| Scripts | `[]` |
| `inlineStyleLanguage` | `scss` |
| `allowedCommonJsDependencies` | `lodash` |
| defaultConfiguration | `production` |

Assets, in alle Buildziele kopiert:

| Glob/Input | Output | Bemerkung |
|---|---|---|
| `src/favicon.ico` | root | Standard |
| `src/assets` | `assets/` | alle 3D/UI/Fonts |
| `src/php/api.php` | root | PHP RPC |
| `src/php/browsers.json` | root | Browser-Gate |
| `src/php/shopware5/config.php` | root `config.php` | auch in Standalone/Woo kopiert; enthaelt maskiert dokumentierte Secrets |
| `src/php/database.php` | root | PDO |
| `src/php/index.php` | root | Browser-Gate |

Production:

| Option | Wert |
|---|---|
| Budgets initial | warning 5000 KB, error 10 MB |
| Budgets component style | warning 6000 KB, error 10000 KB |
| `outputHashing` | `all` |

Development:

| Option | Wert |
|---|---|
| `buildOptimizer` | false |
| `optimization` | false |
| `vendorChunk` | true |
| `extractLicenses` | false |
| `sourceMap` | true |
| `namedChunks` | true |

Shopware/Woo:

| Ziel | Spezifische Optionen |
|---|---|
| `shopware5` | `outputHashing: all`, `deleteOutputPath: true`, outputPath Shopware, replacement `environment.ts -> environment.shopware5.ts` |
| `woocommerce` | `outputHashing: all`, `deleteOutputPath: true`, outputPath Woo, replacement `environment.ts -> environment.woocommerce.ts` |

## Prebuild/Postbuild

| Skript | Verhalten | Risiko |
|---|---|---|
| `prebuild.js` | liest `package.json`, inkrementiert letzte Versionsstelle, schreibt `package.json` | mutiert Dependency-/Metadatei; in diesem Auftrag nicht ausgefuehrt |
| `postbuild.shopware5.js` | findet CSS/JS im Shopware-Dist, ersetzt `url(/assets/` durch `/custom/plugins/OneRingconf/Resources/dist/assets/`, schreibt `plugin.xml` Version aus `package.json` | mutiert generierte Dateien und nicht vorhandenes `plugin.xml` |
| `postbuild.woocommerce.js` | findet CSS/JS im Woo-Dist, ersetzt `url(/assets/` durch `/wp-content/plugins/OneRingconf/dist/assets/` | mutiert generierte Dateien; Plugin-XML-Code auskommentiert |
| `browserslist.js` | schreibt `src/php/browsers.json` aus Browserslist | wuerde getrackte PHP-Daten aendern; nicht ausgefuehrt |

## Serverpfade und Runtime-URLs

| Umgebung | `assetFolderLocation` | API-Endung in `getDistRootUrl()` |
|---|---|---|
| Standalone | `""` | `api.php` |
| Shopware5 | `/custom/plugins/OneRingconf/Resources/dist/` | `api` |
| WooCommerce | `/wp-content/plugins/OneRingconf/dist/` | `api.php` |
| Lokales LAN | Start host `192.168.178.125`; API bei `192.168.*` auf Port `8081` | `http(s)://host:8081/api.php` bzw. `api` |

## Reproduzierbarkeit

| Thema | Befund |
|---|---|
| Lockfile | npm lockfileVersion 2 vorhanden |
| Cache | Angular CLI cache deaktiviert (`cli.cache.enabled: false`) |
| Node Version | keine `.nvmrc`/`.node-version`; AGENTS nennt Node 18.20.x, lokal Node 20.16.0 |
| CI/Jenkins | kein `Jenkinsfile` getrackt; Repo-Name nennt Jenkins, aber keine CI-Konfiguration vorhanden |
| Buildausgaben | `dist/`, `.angular/`, `_shop/**/dist` ignoriert |
| Shopquellen | `_shop/**` nicht vorhanden; Postbuild nicht reproduzierbar aus Checkout allein |

## Verifikationsstatus je Ziel

| Ziel | Status | Befehl | Ergebnis/Blocker |
|---|---|---|---|
| development | nicht ausgefuehrt | `npx ng build --configuration development` | Node `v20.16.0` nicht kompatibel mit Angular 15.0.x; keine Installation vorhanden/verwendet |
| production | nicht ausgefuehrt | `npx ng build --configuration production` | gleicher Blocker |
| shopware5 | statisch analysiert | `npm run buildShopware5` | Postbuild mutierend; `_shop` Struktur fehlt |
| woocommerce | statisch analysiert | `npm run buildWoocommerce` | Postbuild mutierend; `_shop` Struktur fehlt |
