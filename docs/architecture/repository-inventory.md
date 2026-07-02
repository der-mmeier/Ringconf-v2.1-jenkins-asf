# Repository Inventory

## 1. Executive Summary

Diese Inventur wurde auf Branch `chore/repository-inventory` statisch erstellt. Der Working Tree war zu Beginn sauber, `git pull --ff-only origin chore/repository-inventory` meldete `Already up to date`. Es gibt nur eine Repository-Anweisung, `AGENTS.md`, gueltig fuer das gesamte Repository.

Der 3D-Ringkonfigurator ist eine Angular-15-Anwendung mit klassischem NgModule-Bootstrap, ohne Angular-Router, mit globalem Konfiguratorzustand in `AppComponent`, zwei `RingData`-Instanzen fuer Damen- und Herrenring und einer Babylon.js-Integration unter `src/app/webgl`. Die Anwendung ist stark monolithisch: `src/app/app.component.ts` enthaelt AppData, Query-Parameter-Verarbeitung, HTTP/PHP-Bridge, Save/Load, PDF-Erzeugung und Shop-Warenkorbcode.

Wichtigste Befunde:

1. Baseline: `package-lock.json` loest Angular auf `15.0.4`, Angular CLI/DevKit auf `15.0.5`, TypeScript auf `4.8.4`, RxJS auf `7.5.7`, Zone.js auf `0.12.0` und Babylon.js auf `5.25.0` auf.
2. Build nicht ausgefuehrt: lokale Umgebung ist Node `v20.16.0`/npm `10.8.3`; Angular 15.0.x ist laut offizieller Angular-Matrix fuer Node `^14.20.0 || ^16.13.0 || ^18.10.0` vorgesehen, nicht fuer Node 20.
3. Shopware-/WooCommerce-Quellstruktur fehlt: `_shop/**` ist weder getrackt noch im Working Tree vorhanden. Nur `angular.json`, Environments und Postbuild-Skripte referenzieren die Ausgabeziele.
4. Kritisch: PHP-Konfigurationen enthalten produktionsartige Datenbankzugangsdaten; zusaetzlich liegt ein auskommentierter PDO-Block mit maskiert dokumentierten Zugangsdaten in `src/php/api.php`.
5. Rendering- und State-Lebenszyklus sind global/intervallbasiert: `WebglComponent.WEBGL`, `RingData.list`, `cRing.list`, `setInterval()` in `WebglComponent` und `cRing`, aber kein `ngOnDestroy`/Dispose fuer Engine, Scene, Listener oder Intervalle.

Verifikationsstatus: statisch verifiziert. Kein Build und keine Laufzeitpruefung wurden ausgefuehrt.

## 2. Verifizierter Baseline-Stand

| Bereich | Befund | Evidenz | Status |
|---|---|---|---|
| App-Version | `2.6.6` | `package.json` `version`; `AppComponent.state.build` liest `package.json` ueber `import * as info from "../../package.json"` in `src/app/app.component.ts:18` und `state.build` in `src/app/app.component.ts:43` | statisch verifiziert |
| Angular | `@angular/core` aufgeloest `15.0.4` | `package-lock.json`, Paket `node_modules/@angular/core` | statisch verifiziert |
| Angular CLI/DevKit | `@angular/cli` `15.0.5`, `@angular-devkit/build-angular` `15.0.5` | `package-lock.json` | statisch verifiziert |
| TypeScript | `4.8.4` | `package-lock.json` | statisch verifiziert |
| RxJS/Zone.js | `rxjs` `7.5.7`, `zone.js` `0.12.0` | `package-lock.json` | statisch verifiziert |
| Babylon.js | alle `@babylonjs/*` direkt verwendeten Pakete `5.25.0` | `package.json`, `package-lock.json`; Imports in `src/app/webgl/webgl.component.ts` und `src/app/webgl/cRing.ts` | statisch verifiziert |
| HTML-Einstieg | `src/index2.html` mit `<x-app-root data-base=""></x-app-root>` | `angular.json` build option `index`; `src/index2.html` | statisch verifiziert |
| Bootstrap | `platformBrowserDynamic().bootstrapModule(AppModule)` | `src/main.ts:1-5` | statisch verifiziert |
| Default Build | `dist/ringconf-v2.1`, defaultConfiguration `production` | `angular.json` | statisch verifiziert |
| Shopware Output | `_shop/shopware5/OneRingconf/Resources/dist` | `angular.json` configuration `shopware5` | statisch verifiziert |
| WooCommerce Output | `_shop/woocommerce/OneRingconf/dist` | `angular.json` configuration `woocommerce` | statisch verifiziert |
| Node lokal | `v20.16.0`; nicht kompatibel fuer Angular 15.0.x | `node --version`; Angular-Matrix siehe `docs/migration/angular-modernization-plan.md` | statisch/extern verifiziert |

`package.json.backup` weicht ab: Version `2.6.3`, `build`/Shopbuilds fuehren `node prebuild.js` aus, und das WooCommerce-Skript heisst dort `buildWooCommerce` statt aktuell `buildWoocommerce`.

## 3. Repository-Struktur

Top-Level, getrackt:

| Pfad | Rolle | Befund |
|---|---|---|
| `AGENTS.md` | Repository-Anweisungen | Einzige AGENTS-Datei; keine tieferen Overrides gefunden |
| `package.json`, `package-lock.json`, `package.json.backup` | npm/Lockfile/Baseline-Vergleich | Lockfile-Version 2; keine Aenderung vorgenommen |
| `angular.json` | Angular Buildmatrix | Browser-Builder, kein Router, PHP-Assets in Build kopiert |
| `tsconfig*.json` | TypeScript-Konfiguration | `strict` und `strictTemplates` aktiviert; `tsconfig.json` inkludiert zusaetzlich `package.json` |
| `.browserslistrc`, `browserslist.js` | Browserliste und PHP-Browserliste | `browserslist.js` schreibt `src/php/browsers.json`; nicht ausgefuehrt |
| `prebuild.js` | mutierender Versionsschritt | inkrementiert `package.json` Version; nicht ausgefuehrt |
| `postbuild.shopware5.js`, `postbuild.woocommerce.js` | mutierende Postbuilds | schreiben generierte CSS/JS und ggf. Plugin-XML; nicht ausgefuehrt |
| `config_vonjacob.de_20250226.json` | externe AppData-Konfiguration | 9 Profile, 7 Materialien, 10 Oberflaechen, 5 Steintypen |
| `src/` | Angular, Assets, PHP | Hauptquellbaum |

`src/`:

| Pfad | Rolle |
|---|---|
| `src/main.ts` | Angular-Bootstrap und Fullscreen-Helfer |
| `src/index2.html` | Angular HTML-Einstieg |
| `src/styles.scss`, `src/default.scss`, `src/flex.scss` | globale Styles |
| `src/app/` | Komponenten, Ringdaten, WebGL, PDF |
| `src/assets/` | 3D-Assets, UI-Icons, Fonts |
| `src/environments/` | Standalone, Shopware, WooCommerce |
| `src/php/` | PHP-Bridge, Daten, Browser-Gate, Env-Maps |

`src/app/` enthaelt 29 Komponentenverzeichnisse/Featurebereiche, u.a. `config-*`, `webgl`, `save-load`, `logger`, `mts-horizontal`, `stonexy`, `pdf`. Es gibt keine Angular Services mit `@Injectable`, keine Guards, Resolver, Interceptors oder Injection Tokens.

`src/assets/`:

| Pfad | Inhalt |
|---|---|
| `src/assets/img3d` | Environment-Texturen, Diamant-Texturen, Oberflaechentexturen, Schatten/UV-Testbilder |
| `src/assets/imgui` | UI-Icons, PDF-Hintergruende, Slider-Bilder |
| `src/assets/obj/profile` | Profil-OBJ-Dateien und JSON-Konvertate P1, P2, P3, P4, P5, P6, P7, P11, P12 |
| `src/assets/obj/stone` | Stein-OBJ-Dateien fuer Brillant, Princess, Baguette, Krabbe |
| `src/assets/font` | Gravur-/PDF-Fonts |

Quantitative Uebersicht fuer getrackte Dateien:

| Kennzahl | Wert |
|---|---:|
| getrackte Dateien | 386 |
| `.svg` | 144 |
| `.ts` | 54 |
| `.scss` | 32 |
| `.html` | 32 |
| `.json` | 24 |
| `.jpg` | 21 |
| `.png` | 16 |
| `.obj` | 15 |
| `.js` | 9 |
| `.php` | 9 |
| `.ttf` | 6 |
| `.env` | 6 |

Groesste getrackte Dateien:

| Groesse | Pfad | Nutzung/Risiko |
|---:|---|---|
| 12.2 MB | `src/assets/img3d/UVMap2.png` | Debug/UV-Texture, Code in `WebglComponent` ist `if (0)` deaktiviert |
| 6.4 MB | `src/assets/img3d/3DLABbg_UV_Map_Checker_01_4096x4096.jpg` | UV-Testbild, nur auskommentiert referenziert |
| 3.8 MB | `src/assets/img3d/tex_uvref_4096.jpg` | UV-Testbild, nur auskommentiert referenziert |
| 1.4 MB | `src/assets/img3d/tex_uvref_2048.jpg` | UV-Testbild, nur auskommentiert referenziert |
| 1.3 MB | `src/app/pdf/Arial-Gravur-normal.js` | jsPDF-Fontdaten, von PDF-Feature relevant |
| 1.2 MB | `src/assets/img3d/tex_shadow.png` | Schattenmaterial in `WebglComponent` |
| 964 KB | `src/assets/font/Arial-Gravur.ttf` | Gravur/PDF-Font |
| 934 KB | `src/assets/img3d/envTextureKeyShot.env` | aktive Environment-Texture in `WebglComponent` |
| 773 KB | `package-lock.json` | Lockfile |

Generiert vs. gepflegt:

| Kategorie | Pfade | Bewertung |
|---|---|---|
| gepflegte Quellen | `src/app/**/*.ts/html/scss`, `src/assets/**`, `src/php/**`, root configs/scripts | getrackt und analysiert |
| generierte/ausgelagerte Ausgabe | `_shop/shopware5/OneRingconf/Resources/dist`, `_shop/woocommerce/OneRingconf/dist`, `dist/`, `.angular/` | ignoriert bzw. nicht getrackt |
| fehlende Pluginquellen | `_shop/**` ausser Dist-Pfaden | im Checkout nicht vorhanden; Postbuild referenziert dennoch `plugin.xml` |

## 4. Angular-Architektur

Bootstrap:

1. `angular.json` setzt `main` auf `src/main.ts`, `index` auf `src/index2.html`, `polyfills` auf `zone.js`.
2. `src/main.ts` importiert `AppModule` und bootstrapped mit `platformBrowserDynamic().bootstrapModule(AppModule)`.
3. `src/app/app.module.ts` deklariert alle Komponenten/Pipes, importiert `BrowserModule` und `HttpClientModule`, bootstrapped `AppComponent`.
4. `src/index2.html` enthaelt `<x-app-root data-base=""></x-app-root>`.

Angular-Router: nicht vorhanden. `AppModule` importiert kein `RouterModule`; Suche nach `Routes`, `ActivatedRoute`, Guards, Resolvern oder Interceptors ergab keine aktiven Bausteine. Navigation erfolgt ueber Hash-State in `MenuComponent`/`ConfigComponent`.

Globale Initialisierung:

| Symbol | Datei | Aufgabe | Risiko |
|---|---|---|---|
| `AppComponent.app` | `src/app/app.component.ts:30` | statischer Zugriffspunkt fuer AppData, State, HttpClient | globaler Singleton statt DI |
| `RingData.list` | `src/app/app.ringdata.ts:18` | globale Liste der Ring-Presets; Konstruktor erzeugt Damen-/Herrenring | Serialisierung enthaelt private `_`-Felder |
| `WebglComponent.WEBGL` | `src/app/webgl/webgl.component.ts:40` | globaler Renderer-Singleton | keine Angular-Freigabe |
| `cRing.list` | `src/app/webgl/cRing.ts` | globale Render-Ringliste | Lebenszyklus nicht an Angular gebunden |
| `document.addEventListener('visibilitychange', ...)` | `src/app/app.component.ts:4423` | ruft `shopware_setTabId()` beim Tabwechsel | kein Remove |
| `window.addEventListener('resize', ...)` | `src/app/webgl/webgl.component.ts` | Canvas/Engine resize | kein Remove |
| `setInterval()` | `src/app/webgl/webgl.component.ts:100`, `src/app/webgl/cRing.ts:340`, Slider-Komponenten | Polling auf AppReady bzw. Dirty-State | potenzielle Leaks |

## 5. Komponenten- und Serviceinventar

Services im Angular-Sinn sind nicht vorhanden. Gemeinsame Logik liegt in statischen/globalen Klassen und freien Funktionen.

| Typ | Symbol | Datei | Verantwortung | Abhaengigkeiten | Konsumenten | Risiko |
|---|---|---|---|---|---|---|
| Module | `AppModule` | `src/app/app.module.ts` | Deklariert alle UI-Bausteine, importiert HTTP | `BrowserModule`, `HttpClientModule` | `main.ts` | keine Featuremodule/Lazy Loading |
| Component | `AppComponent` | `src/app/app.component.ts` | Root, AppData, State, Save/Load, PDF, HTTP/PHP, Shop | `HttpClient`, `RingData`, `WebglComponent`, `jsPDF` | alle Komponenten ueber `AppComponent.app` | monolithisch, globale Seiteneffekte |
| Component | `WebglComponent` | `src/app/webgl/webgl.component.ts` | Babylon Engine/Scene/Kamera/Renderloop/Screenshots | Babylon Core, `Preload`, `cRing`, `RingData` | `AppComponent`, `main.ts`, Admin/Tools | kein `ngOnDestroy`, globaler Singleton |
| Class | `RingData` | `src/app/app.ringdata.ts` | Fachlicher Ringzustand mit Defaults, Settern, Validierungen | `AppComponent.app.data`, `Log` | Config-Komponenten, `cRing`, Save/Load | serialisiert private Felder |
| Class | `cRing` | `src/app/webgl/cRing.ts` | prozedurale Ringgeometrie, Plausibilisierung, Meshes, Material/Stone-Render | Babylon, `RingData`, `stoneCalc`, `Preload` | `WebglComponent`, Config-Komponenten | sehr gross, setInterval, Teil-Fallbacks |
| Functions | `stoneCalc*` | `src/app/webgl/stoneCalc.ts` | Steinpositionen, Groessen, Kollisionen, freie Steine | `cRing`, AppData, `RingData` | `cRing`, `ConfigStoneComponent`, `StonexyComponent` | Schleifen/Mutation waehrend Berechnung |
| Object | `Preload` | `src/app/app.preload.ts` | laedt Profil-JSON, Oberflaechentexturen, Stein-OBJs | `AssetsManager`, Environments | `WebglComponent`, `cRing` | kein Cache invalidation/dispose |
| Pipe | `SafeHtmlPipePipe` | `src/app/safe-html-pipe.pipe.ts` | `bypassSecurityTrustHtml` | `DomSanitizer` | Templates mit HTML | XSS-Vertrauensgrenze |
| Pipe | `RemoveCommaPipePipe` | `src/app/remove-comma-pipe.pipe.ts` | Anzeigeformatierung | - | Templates | gering |

Komponenten:

| Komponente | Selector | Verantwortung | Wichtige Konsumenten |
|---|---|---|---|
| `MenuComponent` | `x-menu` | Hash-Navigation, Desktop/Mobile/PrevNext | `AppComponent` |
| `ConfigComponent` | `x-config` | rendert config views je Hash | `AppComponent` |
| `ConfigProfileComponent` | `x-config-profile` | Profilwahl | `ConfigComponent` |
| `ConfigDimensionComponent` | `x-config-dimension` | Ringbreite/-hoehe/-groesse | `ConfigComponent` |
| `ConfigMaterialComponent` | `x-config-material` | Materialteilung, Material, Feingehalt, Oberflaeche | `ConfigComponent` |
| `ConfigGapComponent` | `x-config-gap` | Fugen, freie Fugen, Stufen | `ConfigComponent` |
| `ConfigStoneComponent` | `x-config-stone` | Steinmodus, Typ, Groesse, Verteilung, Anzahl, freie Steine | `ConfigComponent` |
| `ConfigEngravingComponent` | `x-config-engraving` | Gravurtext, Symbole, Font | `ConfigComponent` |
| `ConfigAdminComponent` | `x-config-admin` | Standardpreset, Wireframe, AppData Import/Export | Admin-Hash |
| `ConfigDiamondComponent` | `x-config-diamond` | Environment-/Diamant-Shader-Presets, Upload/Restore | Diamond-Hash |
| `SaveLoadComponent` | `x-save-load` | Dialog fuer Speichern/Laden | `AppComponent` |
| `LocalStorageComponent` | `x-local-storage` | lokaler Restore-Dialog | `AppComponent` |
| `LoggerComponent` | `x-logger` | Meldungen/Warnungen | `Log()` |
| `FooterComponent` | `x-footer` | Warenkorb/CSRF | `AppComponent` |
| `RingDetailsComponent` | `x-ring-details` | Konfigurationsdetails/Preise | `ToolsComponent` |
| `MultiThumbSliderComponent`, `MtsHorizontalComponent`, `StonexyComponent` | `x-*` | Material-/Fugen-/Steinpositionierung | Config-Komponenten |

Komponentenhierarchie:

```text
x-app-root
  x-menu mode=desktop
  x-webgl
  x-menu mode=mobile
  x-config
    x-config-profile
    x-config-dimension -> x-dropdown, x-property-sync-dialog
    x-config-material -> x-image-card, x-dropdown, x-multi-thumb-slider, x-mts-horizontal
    x-config-gap -> x-tab-control, x-tab-page, x-image-card, x-dropdown, x-multi-thumb-slider, x-mts-horizontal
    x-config-stone -> x-image-card, x-dropdown, x-checkbox, x-multi-thumb-slider, x-stonexy
    x-config-engraving -> x-textbox, x-checkbox
    x-config-admin
    x-config-diamond
  x-tools
  x-menu mode=prevNext
  x-footer
  x-debug (bei state.debug)
  x-logger
  x-save-load (bei state.saveLoad)
  x-ring-details (bei state.ringDetails)
  x-local-storage
```

## 6. Routing und Einstiegspunkte

Angular-Routen: keine.

Direkte Einstiege:

| Einstieg | Ort | Bedeutung | Kompatibilitaetsrisiko |
|---|---|---|---|
| `/` oder Shop-Pfad mit trailing slash | `AppComponent` Konstruktor erzwingt slash in `window.location.pathname` | Basis fuer API-URL-Berechnung | Redirect ueber Mutation von `pathname` |
| Query `?id=XXXX-XXXX` | `src/app/app.component.ts:4438-4488` | laedt Preset-ID statt Standardpreset | externer Vertrag |
| Query `mobile`, `debug`, `admin`, `diamond`, `freeStones` | `src/app/app.component.ts` | UI-/Feature-Schalter | keine zentrale Typisierung |
| Hash `#profil`, `#masse`, `#material`, `#fugen`, `#steinbesatz`, `#gravur` | `MenuComponent`, `ConfigComponent` | View-Auswahl | nicht per Angular Router validiert |
| PHP Browser-Gate | `src/php/index.php` | liefert `index2.html` nur fuer unterstuetzte Browser | eigene UA-Erkennung |

`src/index2.html` enthaelt keine externen Skripte/Styles, aber `angular.json` kopiert PHP-Dateien in den Buildroot. Abhaengige DOM-IDs/Selektoren:

| Selector/ID | Konsument | Zweck |
|---|---|---|
| `#webgl` | `WebglComponent.InitAfterAppReady()` | Canvas |
| `#webglWrapper` | `ToggleFullscreen()` in `src/main.ts` | Fullscreen-Ziel |
| `#a4pdfbg` | `AppComponent.createPdf()` | PDF-Hintergrund |
| `#ring-config-form` | `addToCart()` | Shopware-6-Formularbefuellung |
| `#line-item-testringe`, `#line-item-ringmass`, `#line-item-lieferung-*` | `addToCart()` | optionale Line Items/Produktionszeit |
| `__csrf_token`, Cookie `__csrf_token-1` | `makeHttpHeaders()`/Footer | Shop-CSRF |

## 7. Zustandsmanagement

Zentral:

| Zustand | Ort | Mutation | Serialisierung |
|---|---|---|---|
| UI/App-State | `AppComponent.state` | Root, Menu, Tools, SaveLoad, Query-Schalter | nicht direkt serialisiert |
| AppData/Katalogdaten | `AppComponent.data` | eingebettet; optional durch `dbGetAPPDATA()` ersetzt; Admin kann speichern/importieren | `dbSetAPPDATA`, externe JSON |
| Ringzustand | `RingData.list[0/1]` | Setters in `RingData`, Config-Komponenten, `cRing`, `stoneCalc` | `dbSavePreset` speichert JSON von `RingData.list[0/1]` |
| Rendererzustand | `WebglComponent.WEBGL`, `cRing.list` | WebGL init, Dirty-Polling | Screenshots/OBJ export, nicht kompatibilitaetsstabil |
| Meldungen | `AppComponent.log`, `LoggerComponent`, `Log()` | Validierungen/Fallbacks | nur UI |
| Persistenz | PHP DB Tabellen `ringcfg_2v1_data`, `ringcfg_2v1_preset` | `src/php/api.php` RPCs | externer Vertrag |
| Browser Storage | `localStorage.ringconfId` | `dbSavePreset()` | aktuell Restore-Code fuer Default auskommentiert |

Keine RxJS Subjects/BehaviorSubjects im App-State. HTTP nutzt `lastValueFrom()`.

Fachlich relevante Felder:

| Feld/Key | Typ | Quelle | Default | Aenderungen durch | Serialisierung | Externe Konsumenten | Risiko |
|---|---|---|---|---|---|---|---|
| `_profileName` | string | `RingData` | `P3` | Profilwahl, Clone, Validierung | Preset JSON | PHP DB, Shop | Profilnamen stabil halten |
| `_ringWidth` | number in 1/1000 mm | `RingData` | `5000` | Dimension, Profil, DivPreset, Steinlogik | Preset JSON | Renderer, Preis | automatische Anpassungen |
| `_ringHeight` | number in 1/1000 mm | `RingData` | `1600` | Dimension, Profil, syncRwRh | Preset JSON | Renderer, Preis | Max-Faktor |
| `_ringSize` | number in 1/1000 mm | `RingData` | Damen `54000`, Herren `64000` | Dimension | Preset JSON | Renderer, Preis/PDF | Einheit implizit |
| `_divPreset` | string | `RingData`/AppData `divPreset` | `-:1` | Materialpreset, Profilvalidierung | Preset JSON | UI/Renderer | Stringvertrag |
| `_materialDiv` | number[] sum 10000 | `RingData.divPreset` | `[5000]` nach reset | Slider, Plausibilisierung | Preset JSON | Renderer/Preis | unbekannte Laengen |
| `_material` | number[] | AppData `material` | `[0,5,0,1,0]` | Material UI, MaterialExclude | Preset JSON | Renderer/Preis | IDs stabil |
| `_fineness` | number[] | AppData `material[].fineness` | `[333,...]` | Material UI, `setFineness` | Preset JSON | Preis/PDF | Materialabhaengigkeit |
| `_surface` | number[] | AppData `surface` | `[0,1,0,0,0]` | Surface UI, `checkSurface` | Preset JSON | Renderer | IDs/Texture files |
| `_gapMode` | number | AppData `gapMode` | `3` | Fugen UI, Surface forceGap | Preset JSON | Renderer | maxGapWidth/Fallbacks |
| `_gapWidth` | number | AppData `gapMode.width` | `300` | Fugen UI, Steinmodus | Preset JSON | Renderer | automatische Reduktion |
| `_gapDiv` | number[] | RingData | `[]` | freie Fugen | Preset JSON | Renderer | Summe/Laenge |
| `_gapEnabled` | number[] | RingData | `[1,1,1,1]` | Fugen UI, forceGap | Preset JSON | Renderer | Indexvertrag |
| `_stepMode`, `_stepWidth`, `_stepDepth` | number/number[] | AppData profile/stepMode | `0`, `[300,300]`, `300` | Stufen UI, Profil | Preset JSON | Renderer | Profilabhaengig |
| `_waveAmp`, `_waveCount` | number | Profil `wa/wc` | `60`, `5` | DivPreset, Profil, Steinbesatz | Preset JSON | Renderer | Schleifen/Fallbacks |
| `_engraving`, `_engravingFont` | string/number | RingData, AppData engraving | leer, `0` | Gravur UI | Preset JSON | PDF/Renderer | Font IDs |
| `_stone[].mode` | number | AppData `stoneMode` | Damen `10`, Herren `0` | Stein UI, Fallbacks | Preset JSON | Renderer/Preis | Modus-IDs stabil |
| `_stone[].type` | number | AppData `stoneType` | `1` | Stein UI, Fallbacks | Preset JSON | Renderer/Preis | OBJ/allowed modes |
| `_stone[].size` | number | AppData stone sizes | `1900` | Stein UI, Fallbacks | Preset JSON | Renderer/Preis | automatische Reduktion |
| `_stone[].count`, `countReal` | number | RingData/stoneCalc | `1` | Stein UI, Rendererberechnung | Preset JSON | Preis | `countReal` wird berechnet |
| `_stone[].rows` | number | AppData `stoneRowsMax` | `1` | Stein UI, Fallbacks | Preset JSON | Renderer/Preis | Reihenreduktion |
| `_stone[].distribution` | number | AppData `stoneDistribution` | `0` | Stein UI, mode override | Preset JSON | Renderer | negative count semantics |
| `_stone[].positionDiv` | number[2] | RingData | `[5000,5000]` | Slider/Stonexy/Fallback | Preset JSON | Renderer | Summe 10000 |
| `_stone[].freeStones` | array | freie Steine | optional | Stonexy/stoneCalc_addFreeStone | Preset JSON | Renderer | Kollisionsschleifen |
| `_price` | number | `calcPrice()` | `9999` | PHP RPC | Preset JSON | UI/PDF | Backend liefert derzeit Platzhalter |

## 8. Fachliches Konfigurationsmodell

AppData liegt doppelt vor: eingebettet in `AppComponent.data` ab `src/app/app.component.ts:2194` und extern in `config_vonjacob.de_20250226.json`. Beide besitzen dieselben Top-Level-Keys: `profile`, `ringWidth`, `ringHeight`, `ringSize`, `divPreset`, `material`, `surface`, `gapMode`, `stepMode`, `stoneMode`, `stoneType`, `stoneQuality`, `stoneDistribution`, `stonePosition`, `stoneRowsMax`, `stoneCount`, `engraving`, `webglSettings`. Die externe JSON enthaelt nach statischer Analyse keine `materialExclude`, waehrend `iAppData` und `AppComponent.data` ein `materialExclude`-Feld vorsehen; das ist eine Schemaabweichung.

Fachbereiche:

| Bereich | Datenquelle | Verarbeitender Code |
|---|---|---|
| Profile | `iProfile`, AppData `profile`, OBJ/JSON unter `assets/obj/profile` | `RingData.profileName`, `cRing.preComputeMeshes`, `Preload.load` |
| Ringmasse | AppData `ringWidth`, `ringHeight`, `ringSize`, profilbezogene Overrides | `ConfigDimensionComponent`, `RingData` Setters, `cRing` |
| Materialien/Legierungen | AppData `material`, `materialExclude`, `_material`, `_fineness` | `ConfigMaterialComponent`, `RingData.setMaterial`, `RingData.setFineness` |
| Oberflaechen | AppData `surface`, Texturen `assets/img3d/tex-*` | `ConfigMaterialComponent`, `RingData.checkSurface`, `cRing` PBR materials |
| Fugen/Teilungen | `divPreset`, `gapMode`, `gapDiv`, `stepMode` | `ConfigGapComponent`, `RingData`, `cRing.gapDiv_calc/adapt` |
| Steine | `stoneMode`, `stoneType`, `stoneQuality`, `stoneDistribution`, `stoneCount` | `ConfigStoneComponent`, `RingData`, `cRing`, `stoneCalc` |
| Gravur | AppData `engraving`, Fonts, PDF fonts | `ConfigEngravingComponent`, `cRing` Textur-Rendering, `createPdf()` |
| Preis | PHP `calcPrice`, `RingData._price` | `calcPrice()` in TS/PHP; PHP gibt derzeit `9999.99` zurueck |

## 9. Presets, AppData und Save/Load

Ablauf:

1. Konfiguration entsteht durch zwei `new RingData()` im `AppComponent` Konstruktor.
2. `RingData.reset()` setzt Defaults fuer Damen-/Herrenring.
3. UI-Komponenten mutieren `RingData.list[ringId]` ueber Setters/statische Methoden.
4. `cRing` beobachtet `ringData.isDirty` per `setInterval()` und berechnet Meshes/Steindaten neu.
5. Speichern: `dbSavePreset()` erstellt Screenshot via `createScreenshot(600)`, entfernt `stone[0].odm`, POSTet `rpc=dbSavePreset` mit `[preset_id, RingData.list[0], RingData.list[1], imgData, false]`.
6. PHP `src/php/api.php::dbSavePreset()` JSON-encodiert `preset_0`, `preset_1`, `img`; bestehende IDs werden bei Nicht-Overwrite durch Suffix `-1`, `-2`, ... erweitert.
7. Laden: `dbLoadPreset(id)` prueft erst `state.dbSaveItems`, sonst POST `rpc=dbLoadPreset`; `RingData.clone(JSON.parse(...))` kopiert bekannte Felder.
8. Standardpreset: ID `0000-0000`; bei fehlendem Preset versucht PHP Default zu laden oder TS `dbResetStdPreset()`.

Eindeutige ID: `src/php/api.php::create_id()` erzeugt `XXXX-XXXX` aus Zeichensatz `23456789ABCDEFGHIJKLMNPQRSTUVWXYZ`, prueft gegen Tabelle `TABLE_PRESET`. `dbSavePreset()` kann bei Kollision/bestehenden Daten einen Suffix ergaenzen. TS behandelt IDs mit Regex `\w{4}-\w{4}` fuer URL-Load.

Verluststellen:

| Stelle | Risiko |
|---|---|
| `RingData.clone(other)` kopiert nur Keys, die bereits in `this` existieren | unbekannte Legacy-Felder gehen verloren |
| `dbSavePreset()` setzt nur `stone[0].odm = undefined` | nur erste Steingruppe wird bereinigt; zukuenftige Gruppen koennen Renderer-Daten speichern |
| PHP `json_encode($preset_0)` nach `json_decode(rpp)` | unbekannte Felder bleiben in PHP erhalten, aber nicht nach TS-Clone |
| `localStorage.ringconfId` | Save schreibt, Default-Load aus LocalStorage ist auskommentiert |

## 10. Babylon.js- und WebGL-Architektur

Babylon-Lebenszyklus:

| Phase | Datei/Symbol | Aktion | Ressourcen | Freigabe vorhanden | Risiko |
|---|---|---|---|---|---|
| AppReady Poll | `WebglComponent.constructor` | `setInterval` wartet auf `AppComponent.app.state.ready` | Timer | nur `clearInterval` fuer diesen Timer | okay, aber Polling |
| Canvas | `InitAfterAppReady()` | `querySelector('#webgl')`, Wheel listener | DOM listener | kein remove | Leak bei Remount |
| Engine | `new Engine(canvas, true, { preserveDrawingBuffer, stencil }, true)` | Babylon Engine | WebGL context | kein `engine.dispose()` | hoher Leak |
| Context Lost | `engine.doNotHandleContextLost = true` | Context-Loss Handling deaktiviert | WebGL | keine Recovery | mobil kritisch |
| Scene | `new Scene(engine)` | ClearColor, ImageProcessing | Scene | kein `scene.dispose()` | Leak |
| Kamera | `initCamera()` | ArcRotateCamera, Ortho-Modus, attachControl | Camera/Input listener | kein detach/dispose | Touch/Mouse-Leak |
| Resize | `window.addEventListener("resize", ...)` | resize/renderFrame | Listener | kein remove | Leak |
| Environment | `CubeTexture.CreateFromPrefilteredData(...envTextureKeyShot.env)` | Reflection/env texture | CubeTexture | kein dispose | Speicher |
| Shader/Material | `ShaderMaterial`, `PBRMaterial`, `StandardMaterial` | Ring/Stein/Schatten | Materials/textures | Mesh dispose nur teilweise | Speicher |
| Preload | `Preload.load()` | AssetsManager laedt Profil-JSON, Oberflaechen, Stone OBJ | Texturen/Meshes | kein unload | Mehrfachladung bei Reinit |
| Ring Dirty Loop | `cRing.constructor` | `setInterval` pro Ring, `compute()` bei Dirty | Timer, Meshes | kein clearInterval | Leak/CPU |
| Mesh Update | `cRing.compute()` | `disposeMeshes()`, neue Meshes/ThinInstances | Meshes, VertexData | Mesh dispose ja; Materialien/Texturen nein | Teilfreigabe |
| Render | `enableRenderLoop(false)` | eigenes `setInterval` mit maxFps | Timer | bei true clearInterval; kein Destroy | laufende Intervalle moeglich |
| Screenshot | `createScreenshot`, `createRingScreenshot` | RenderTarget Screenshot, layerMask | temporar | Renderloop toggled | Seiteneffekte |
| OBJ Export | `exportObj()` | `OBJExport.OBJ(webgl.scene.meshes, ...)` | Download blob | URL nicht revoked | gering |

Renderer-Eingaben:

| Konfigurationsfeld | aufrufender Code | Babylon-Ziel | sichtbare Wirkung | Aktualisierung |
|---|---|---|---|---|
| `profileName` | `RingData.profileName`, `cRing` | Profil-JSON/Geometrie | Querschnitt | Dirty-Poll |
| `ringWidth`, `ringHeight`, `ringSize` | Dimension UI, `cRing` | Vertex-Erzeugung, Kamera | Masse/Umfang | Dirty-Poll |
| `divPreset`, `materialDiv` | Material/Gaps UI | Mesh-Segmente, UV/Materialzuordnung | Teilung/Farbbereiche | Dirty-Poll |
| `material`, `fineness` | Material UI | `DynamicTexture`/PBR albedo | Metallfarbe/Punze/Preis | Dirty-Poll |
| `surface` | Material UI | PBR roughness/bump texture | Oberflaeche | Dirty-Poll |
| `gapMode`, `gapWidth`, `gapDiv`, `gapEnabled` | Gap UI | Fugenmesh/Outline | Fugen | Dirty-Poll |
| `stepMode`, `stepWidth` | Gap UI | Profilgeometrie | Stufen | Dirty-Poll |
| `waveAmp`, `waveCount` | Material/Gaps, `cRing` | Kurvenpfad | Welle/Schraege | Dirty-Poll |
| `stone[].mode/type/size/rows/count/distribution/positionDiv/freeStones` | Stone UI, `stoneCalc` | Stone meshes, thinInstances | Steinbesatz | Dirty-Poll |
| `webglSettings.environmentPreset` | Diamond/Admin UI | Shader uniforms, env matrix | Diamant/Beleuchtung | Renderloop setzt Uniforms |

Assets:

| Asset | Format | Ladeort | Konsument | Cache/Mehrfachladung | mobile Relevanz |
|---|---|---|---|---|---|
| `assets/obj/profile/json/*.json` | JSON | `Preload.load()` | `cRing` Profil | `Preload.prf` global | gering |
| `assets/obj/stone/*.obj` | OBJ | `Preload.load()` | Steinmeshes in `cRing` | hidden source meshes, clones/thin instances | mittel |
| `assets/img3d/envTextureKeyShot.env` | ENV | `WebglComponent` | Scene/PBR reflections | CubeTexture global | hoch |
| `assets/img3d/tex-*.jpg` | JPG | `Preload.load()` fuer AppData surfaces | Bump textures | `Preload.surface` | mittel |
| Diamantbilder `diamondMap_*`, `diamond_*`, `diamondHighlight`, `diamondSparkle`, `diamondFire` | JPG/PNG/JPEG | `WebglComponent` Shader-Textures | Stone Shader | global textures | mittel |
| `tex_shadow.png` | PNG | `WebglComponent` | Shadow material | Texture | mittel |
| UI SVG/PNG | SVG/PNG | Templates | Buttons/PDF/UI | Browser cache | gering |

## 11. Fachliche Ringlogik

Regellogik liegt hauptsaechlich in `RingData` und `cRing.preComputeMeshes()`, nicht getrennt von Rendererlogik.

| Regelbereich | Code | Verhalten |
|---|---|---|
| Profilvalidierung | `RingData.validateProfile`, `profileName` setter | unbekanntes Profil -> erstes AppData-Profil |
| Breite/Hoehe/Groesse | `RingData` Setters | clamp auf globale oder profilbezogene Min/Max/Step |
| syncRwRh | `profile.syncRwRh`, `RingData`/`cRing` | koppelt Breite/Hoehe |
| Welle/Schraege | `RingData.checkWave`, `cRing` | clamp `waveAmp`, `waveCount`, Entfernung nicht erlaubter Wellen |
| Materialkombination | `RingData.setMaterial` | prueft `materialExclude` |
| Oberflaeche | `RingData.checkSurface` | minSegmentWidth/maxDivision/forceGap |
| Fuge | `RingData.gapMode/gapWidth`, `cRing` | Breitenclamp, forceGap, Teilungsanpassung |
| Stufe | `RingData.stepMode/setStepWidth`, `cRing` | profilabhaengige Stufenbreite/Entfernung |
| Steinmodus | `cRing` und `stoneCalc` | Profil-/Ringbreiten-/Fugen-/Wellenkompatibilitaet |
| Preis | `calcPrice` TS/PHP | PHP gibt aktuell `9999.99`; alter Preiscode ist auskommentiert |

Steinbesatz-Fallback fuer bekannte Zukunftsanforderung:

| Frage | Bestand |
|---|---|
| Existiert Logik fuer kleinere kompatible Steine? | Teilweise. `cRing` sucht bei zu grosser `stoneSize` kleinere `iStoneSize` (`0x1` bis `0x4` Meldungen). `stoneCalc` nutzt `getStoneSize_2()` und reduziert `stoneGroup.size`/`rows`. |
| Existiert sortierte Alternative? | Implizit ueber Reihenfolge in `stoneType.size`; keine explizite stabile Sortierung/Comparator-Dokumentation. |
| Wird Steinmodus alternativ gewaehlt? | Nur wenn `stoneMode.minRingWidth` und `alternativeMode` gesetzt sind; sonst haeufig Reset auf `mode=0`. |
| Loop-Schutz? | `cRing` hat `adaptLoop` ohne explizites Max; `stoneCalc_addFreeStone` hat `doLoopCount++ < 1000`. |
| Kundenmeldung? | `Log("info", ...)` Meldungen, aber nicht zentral klassifiziert. |
| Schleifenrisiko? | Ja: Mutationen in `cRing.compute()` setzen Dirty-State/Felder; kein formaler "already adjusted" Guard pro Ursache. |
| Tests? | Keine fachlichen Tests fuer Profil-/Mass-/Stein-Fallback. |

## 12. PHP-Bruecken

| Datei | Rolle | Aufrufer | Request | Response | Auth/CORS | Datenquelle | Buildziel | Risiko |
|---|---|---|---|---|---|---|---|---|
| `src/php/api.php` | RPC-Dispatcher | TS `getDistRootUrl()`/`HttpClient.post` | GET/POST `rpc`, `rpp` JSON, `tabId` | JSON je RPC | `Access-Control-Allow-Origin: *`, Methods GET/POST, Headers `*`; CSRF nur von TS gesetzt, PHP prueft nicht sichtbar | `Database`, `data/`, Uploads | kopiert als `api.php` | callable RPC aus Request, SQL-Stringkonkat |
| `src/php/database.php` | PDO wrapper, Tabellenanlage | `api.php` | Konstruktor | DB-Verbindung oder fatal | keine Auth | `config.php` | kopiert als `database.php` | Secrets, `show tables` |
| `src/php/config.php` | DB-Konstanten | `database.php` im Standalone/Woo | - | - | - | DB-Zugang | nicht direkt kopiert? `angular.json` kopiert stattdessen Shopware config nach root | kritisches Secret |
| `src/php/shopware5/config.php` | Shopware-Build-Konfig | `database.php` nach Copy in Buildroot | - | - | - | DB-Zugang | kopiert als `config.php` | kritisches Secret |
| `src/php/index.php` | Browser-Gate | Server request | HTTP UA | `index2.html` oder Text | keine Auth | `browsers.json` | kopiert als `index.php` | UA-Sniffing, PHP liefert Angular HTML |
| `src/php/info.php` | `phpinfo()` | direkt | HTTP | phpinfo | keine Auth | Server | nicht in `angular.json` assets | Infoleak falls deployed |
| `src/php/uploadDiamondEnvMap.php` | direkter ENV Upload | direkt | `$_FILES["diamondEnvMap"]` | Text | keine Auth | Dateisystem | nicht in `angular.json` assets | ungeschuetzter Upload |
| `src/php/drafts/slider.php` | Draft | unbekannt | PHP/HTML | unbekannt | unbekannt | - | nicht kopiert | nicht aktiver Vertrag belegt |
| `src/assets/obj/profile/profile_obj2json.php` | Konverter | manuell | Dateisystem | JSON | - | OBJ | Assetpfad | Tooling, nicht Runtime |

RPCs in `api.php`: `apiTestServer`, `dbGetId`, `dbCheckIdExist`, `dbGetAPPDATA`, `dbSetAPPDATA`, `dbSavePreset`, `dbLoadPreset`, `calcPrice`, `uploadFile`, `restoreEnvTexture`, `dbSaveEnvironmentPreset`, `dbGetEnvironmentPresetList`.

SQL-Risiko: mehrere Queries interpolieren `$id`, `$data`, `$preset`, `$name` direkt. PDO ist ohne Emulate Prepares konfiguriert, aber Prepared Statements werden nicht verwendet.

## 13. Shopware-5-Integration

Statisch vorhandene Teile:

| Teil | Evidenz | Befund |
|---|---|---|
| Angular-Konfiguration | `angular.json` `shopware5` | outputPath `_shop/shopware5/OneRingconf/Resources/dist`, `outputHashing: all`, `deleteOutputPath: true`, Environment-Replacement auf `environment.shopware5.ts` |
| Environment | `src/environments/environment.shopware5.ts` | `assetFolderLocation: "/custom/plugins/OneRingconf/Resources/dist/"`, `isShopware5: true` |
| PHP Config Copy | `angular.json` assets | kopiert `src/php/shopware5/config.php` als `config.php` in Buildroot; plus `api.php`, `database.php`, `index.php`, `browsers.json` |
| Postbuild | `postbuild.shopware5.js` | ersetzt `url(/assets/` in CSS/JS durch `/custom/plugins/OneRingconf/Resources/dist/assets/`; aktualisiert `_shop/shopware5/OneRingconf/plugin.xml` Version |
| Runtime API URL | `getDistRootUrl()` | bei `environment.isShopware5` wird `api` statt `api.php` angehaengt |

Nicht vorhanden: `_shop/shopware5/OneRingconf` Pluginquellen und `plugin.xml` fehlen im Checkout. Postbuild wuerde deshalb ohne zuvor vorhandene Struktur scheitern.

Zusaetzliche Unsicherheit: `addToCart()` enthaelt aktiven Shopware-6-Code (`/checkout/line-item/add`, `window.PluginManager.getPluginInstances('OffCanvasCart')`) und nur auskommentierten Shopware-5-Code (`rcfgAddToBasket`, `preset_id`, `rcfgBuyBtn`). Das Buildziel heisst weiterhin `shopware5`.

## 14. WooCommerce-Integration

Statisch vorhandene Teile:

| Teil | Evidenz | Befund |
|---|---|---|
| Angular-Konfiguration | `angular.json` `woocommerce` | outputPath `_shop/woocommerce/OneRingconf/dist`, `outputHashing: all`, `deleteOutputPath: true`, Environment-Replacement |
| Environment | `src/environments/environment.woocommerce.ts` | `assetFolderLocation: "/wp-content/plugins/OneRingconf/dist/"`, `isWooCommerce: true` |
| PHP Copy | `angular.json` assets | kopiert generische PHP-Dateien und Shopware5 config als root `config.php` auch in Woo-Build |
| Postbuild | `postbuild.woocommerce.js` | ersetzt Assetpfade in CSS/JS; Plugin-XML Update auskommentiert |

Nicht vorhanden: `_shop/woocommerce/OneRingconf` Pluginquellen fehlen im Checkout. Keine WordPress-/WooCommerce-Hooks, REST- oder AJAX-PHP-Dateien sind getrackt. WooCommerce-Vertrag ist daher nur ueber Angular Environment und Outputpfad belegbar.

## 15. Assets

Zentrale Assetverwendung:

| Assetgruppe | Pfade | Konsument |
|---|---|---|
| Profil-JSON | `src/assets/obj/profile/json/*.json` | `Preload.load()` per `addTextFileTask` |
| Profil-OBJ | `src/assets/obj/profile/*.obj` | Konverter/Quelle; Runtime nutzt JSON |
| Stein-OBJ | `src/assets/obj/stone/*.obj` | `Preload.load()` per `addMeshTask`; `cRing` klont/thin-instanced |
| Surface Textures | `src/assets/img3d/tex-*.jpg` | AppData `surface[].material.file`, `Preload.surface`, PBR bump |
| Env Textures | `src/assets/img3d/envTextureKeyShot.env`, `src/php/assets/img3d/envTexture.env` | Renderer bzw. Upload/Restore |
| PDF | `src/app/pdf/*.js`, `src/assets/imgui/a4-pdf*.png` | `AppComponent.createPdf()` |
| Fonts | `src/assets/font/*.ttf`, `src/app/mts-horizontal/Montserrat-VariableFont_wght.ttf` | Gravur/PDF/UI |

Grosse Assets sollten vor mobiler Modernisierung bewertet werden, insbesondere nicht aktiv referenzierte UV-Testbilder.

## 16. Testbestand

Vorhanden ist genau eine Spec-Datei: `src/app/mts-horizontal/mts-horizontal.component.spec.ts`. Sie importiert `MtsHorizontalComponent` in `imports`, obwohl die Komponente in `AppModule` deklariert und nicht als `standalone` markiert ist. Ohne Build/Testlauf ist das statisch als wahrscheinlicher Testfehler einzustufen.

Testlueckenmatrix:

| Fachbereich | vorhandener Test | Abdeckung | Risiko ohne Test | empfohlener Testtyp | Prioritaet |
|---|---|---|---|---|---|
| App-Start | nein | 0 | Bootstrap/API-AppData bricht unbemerkt | smoke/e2e | Critical |
| 3D-Szene | nein | 0 | WebGL blank/leaks | Playwright + WebGL smoke | Critical |
| Profilwechsel | nein | 0 | Masse/Steine brechen | Unit + e2e | High |
| Masse | nein | 0 | falsche Dimensionen/Preise | Unit | High |
| Materialien/Oberflaechen | nein | 0 | falsche Darstellung/forceGap | Unit + visual smoke | High |
| Steinbesatz | nein | 0 | Datenverlust/Loops | Unit fuer `stoneCalc`/`cRing` | Critical |
| Ringpaar | nein | 0 | Warenkorb/PDF falsch | e2e | High |
| Save/Load/ID | nein | 0 | Preset inkompatibel | API contract + fixture | Critical |
| Shopware Build | nein | 0 | fehlende Pluginstruktur | build gate | High |
| WooCommerce Build | nein | 0 | fehlende Pluginstruktur | build gate | High |
| PHP-Vertraege | nein | 0 | SQL/CORS/API Regression | contract tests | Critical |
| Mobile/Tablet | nein | 0 | Touch/WebGL unbrauchbar | Playwright device smoke | High |
| Ressourcenfreigabe | nein | 0 | Memory leaks | component lifecycle test | Medium |
| Stein-Fallback | nein | 0 | Warnschleife/Reset | deterministic unit fixtures | Critical |

## 17. Sicherheitsbefunde

Siehe vollstaendiges Register in `docs/architecture/risk-register.md`. Kurzfassung:

| ID | Schweregrad | Bereich | Fundstelle | Beschreibung | Empfehlung |
|---|---|---|---|---|---|
| SEC-001 | Critical | Secrets | `src/php/config.php`, `src/php/shopware5/config.php` | produktionsartige DB-Konstanten inkl. Passwort | sofort rotieren, aus Repo entfernen, Historie pruefen |
| SEC-002 | Critical | Secrets | `src/php/api.php` auskommentierter PDO-Block | auskommentierte DB-Zugangsdaten | rotieren, bereinigen |
| SEC-003 | Critical | SQL Injection | `src/php/api.php` | direkte Stringkonkat in SQL | Prepared Statements |
| SEC-004 | High | CORS/Auth | `src/php/api.php` | `Access-Control-Allow-Origin: *`, keine serverseitige Auth sichtbar | Auth/CSRF serverseitig pruefen |
| SEC-005 | High | Upload | `uploadFile`, `uploadDiamondEnvMap.php` | Pfad/Dateiname aus Request bzw. direkter Upload | Whitelist, Auth, Pfadnormalisierung |
| SEC-006 | High | InfoLeak | `src/php/info.php` | `phpinfo()` | nicht deployen |
| SEC-007 | Medium | XSS/DOM | `form.innerHTML = ""`, `SafeHtmlPipePipe` | HTML-Vertrauensgrenzen | sanitizen/isolieren |

## 18. Technische Schulden

| Bereich | Evidenz | Auswirkung |
|---|---|---|
| Monolith | `AppComponent` ~160 KB, `cRing.ts` ~232 KB, `stoneCalc.ts` ~300 KB | schwer testbar/migrierbar |
| globale Singletons | `AppComponent.app`, `WebglComponent.WEBGL`, `RingData.list`, `cRing.list` | Kopplung, Lifecycle-Probleme |
| fehlende Dispose | kein `ngOnDestroy`, Engine/Scene/Texture/Listener nicht freigegeben | mobile Speicherlecks |
| fehlende Shopquellen | `_shop/**` nicht vorhanden | Build-/Deployment unvollstaendig |
| Security | Secrets/SQL/CORS | produktionskritisch |
| Tests | nur eine wahrscheinlich falsche Spec | keine Gates |
| Node/Angular | Angular 15.0.x unter Node 20 nicht kompatibel | Baseline nicht reproduziert |
| Encoding | viele falsch dargestellte Umlaute im Quelltext | Doku/UI/Logs schwer lesbar |
| `@ts-ignore` | 345 Treffer | Typvertrauen gering |
| Konsolenlogs | 356 Treffer | Produktion/Debug vermischt |

## 19. Offene Fragen und unbestaetigte Annahmen

| Frage | Grund |
|---|---|
| Wo liegen die gepflegten Shopware-5- und WooCommerce-Pluginquellen? | `_shop/**` fehlt, Postbuild referenziert Dateien ausserhalb getrackter Quellen |
| Ist die aktive `addToCart()`-Logik Shopware 6 statt Shopware 5? | Code spricht fuer Shopware 6, Buildziel heisst `shopware5` |
| Welche DB-/API-Umgebung ist produktiv? | Zugangsdaten wurden maskiert; keine Ausfuehrung |
| Ist `config_vonjacob.de_20250226.json` Quelle oder Export? | Struktur passt AppData, aber `materialExclude`-Abweichung |
| Sind UV-Testbilder bewusst getrackt? | im Code nur deaktiviert/auskommentiert referenziert |
| Welche Node-18-Version ist fuer CI vorgesehen? | AGENTS nennt Node 18.20.x, keine `.nvmrc` vorhanden |

## 20. Priorisierte naechste Schritte

1. Secrets rotieren und aus aktiven Dateien entfernen; Historie/Remote-Exposure bewerten.
2. Reproduzierbare Angular-15-Baseline mit Node 18.20.x herstellen, ohne Dependency-Aenderung.
3. Shopware-/WooCommerce-Quellstruktur klaeren oder als externes Artefakt dokumentieren.
4. Save/Load-Fixtures fuer `0000-0000`, bestehende IDs, Suffix-IDs und freie Steine erstellen.
5. Steinbesatz-Fallback als isolierte Testmatrix erfassen, bevor Verhalten geaendert wird.
6. WebGL-Lifecycle und mobile Smoke-Checks automatisiert messbar machen.
7. Angular-Major-Upgrades strikt majorweise planen, Babylon.js separat.
