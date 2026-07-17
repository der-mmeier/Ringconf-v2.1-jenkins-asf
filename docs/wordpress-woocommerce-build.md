# WordPress-/WooCommerce-Build

## Architektur

Der WooCommerce-Weg laedt den aktuellen Angular-Konfigurator lokal aus dem WordPress-Plugin. Er ist getrennt vom zentralen `loader.js`-/iFrame-Modell fuer externe Webseiten.

Das Plugin setzt WordPress 6.5 oder neuer voraus und nutzt die offizielle Script Modules API fuer den Angular-ES-Modulgraphen. Es gibt genau einen generierten Einstieg:

```text
dist/browser/asf-ringconf-entry.js
```

Dieser Einstieg importiert deterministisch `polyfills` vor `main`. Runtime-Daten werden nicht als Inline-JavaScript und nicht ueber globale `window`-Variablen ausgegeben. Der Shortcode rendert stattdessen pro Instanz ein sicheres `application/json`-Element, das Angular synchron vor dem ersten REST-Aufruf liest und validiert.

## Build

Kanonischer Befehl:

```bash
npm run build:woocommerce
```

Der Befehl baut Angular mit der Konfiguration `woocommerce`, prueft den Admin-Ausschluss, erzeugt den Modul-Einstiegspunkt, schreibt `dist/asf-ringconf-manifest.json`, kopiert die Pluginquellen nach `.deploy/woocommerce/asf-ringkonfigurator/`, erzeugt die installierbare ZIP `.deploy/woocommerce/asf-ringkonfigurator-2.7.7.2.zip`, validiert die fertige ZIP und fuehrt PHP-/Node-Smoke-Tests aus.

Der interne Angular-Stagingpfad bleibt `_shop/woocommerce/OneRingconf/dist`. Dieser Ordner ist generiert und wird nicht committed.

## Manifest

Schema v2:

```json
{
  "schemaVersion": 2,
  "pluginVersion": "2.7.7.2",
  "moduleEntry": "asf-ringconf-entry.js",
  "moduleImports": [
    "polyfills-ABC123.js",
    "main-XYZ789.js"
  ],
  "styles": [
    "styles-ABC123.css"
  ]
}
```

Das Plugin registriert `moduleEntry` mit `wp_register_script_module()` und laedt ihn mit `wp_enqueue_script_module()`. Styles werden weiter ueber `wp_enqueue_style()` geladen. Es gibt keinen `script_loader_tag`-Filter, kein `wp_script_add_data(..., 'type', 'module')` und kein `wp_add_inline_script()` fuer Runtime-Daten.

Erwartete Ausgabe im Seitenquelltext sinngemaess:

```html
<script type="module" src=".../dist/browser/asf-ringconf-entry.js?ver=2.7.7.2"></script>
```

Die genaue WordPress-Ausgabe kann zusaetzliche Attribute enthalten.

## ZIP-Struktur und Pruefungen

Die ZIP besitzt genau einen Wurzelordner:

```text
asf-ringkonfigurator/
|-- asf-ringkonfigurator.php
|-- includes/
|-- assets/
|-- dist/
`-- readme.txt
```

Alle ZIP-Eintraege muessen POSIX-Pfade mit `/` verwenden. Backslashes, absolute Pfade, Laufwerksbuchstaben, Pfad-Traversal, doppelte Plugin-Verschachtelung, fehlende Hauptdatei, fehlendes Manifest, fehlender Modul-Einstieg, fehlende Manifest-Assets, Source Maps und lokale Konfigurationsdateien brechen den Build ab.

Automatisierte Pruefungen:

```bash
npm run check:woocommerce-module-entry
npm run check:wordpress-plugin-static
npm run check:woocommerce-package
npm run test:wordpress-plugin-bootstrap
npm run test:wordpress-package-validator
```

`check:woocommerce-module-entry` prueft `asf-ringconf-entry.js`, Importreihenfolge und Manifest. `check:wordpress-plugin-static` blockiert verbotene Legacy-Muster in Plugin-/Runtime-Code. `check:woocommerce-package` liest die fertige ZIP erneut ein und prueft die realen Archiveintraege. `test:wordpress-plugin-bootstrap` laedt die echte Plugin-Hauptdatei mit minimalen WordPress-Stubs und prueft Shortcode, Runtime-JSON, Script Modules API, deaktiviertes WooCommerce und idempotente Initialisierung. `test:wordpress-package-validator` erzeugt kuenstliche Backslash- und Missing-Main-Regressionsproben, die der Validator ablehnen muss.

## Shortcodes

Primaer:

```text
[asf_ringkonfigurator]
```

Alias:

```text
[3D-Trauringkonfigurator]
```

Optional kann eine Konfigurations-ID uebergeben werden:

```text
[asf_ringkonfigurator id="ABCD-EFGH"]
```

Erlaubte Queryparameter fuer eine Start-ID sind `rcfg_id`, `ringconf_id` und `id`. Pro Seite wird ein Angular-Root gerendert; weitere Shortcode-Aufrufe werden kontrolliert mit einer Meldung blockiert.

## Runtime-JSON

Beispiel im Shortcode-Markup:

```html
<div class="asf-ringconf-shell" data-asf-ringconf-instance="asf-ringconf-1">
  <script type="application/json" id="asf-ringconf-1-runtime" class="asf-ringconf-runtime">
    {"schemaVersion":1,"instanceId":"asf-ringconf-1","restUrl":"https://example.test/wp-json/asf-ringconf/v1/rpc","restNonce":"...","assetBaseUrl":"https://example.test/wp-content/plugins/asf-ringkonfigurator/dist/browser","context":"public","woocommerce":{"enabled":true,"productId":123}}
  </script>
  <x-app-root data-base="" data-asf-ringconf-runtime-id="asf-ringconf-1-runtime"></x-app-root>
</div>
```

Das JSON wird serverseitig mit `wp_json_encode()` und `JSON_HEX_*`-Flags erzeugt. Angular akzeptiert im WooCommerce-Modus nur eine valide Struktur. Bei fehlendem oder ungueltigem Runtime-JSON wird eine Konsolenmeldung mit `[ASF Ringconf]` ausgegeben, eine kontrollierte Meldung im Shortcode-Container angezeigt und keine relative `api.php`-Adresse kontaktiert.

Mindestens relevante Felder:

```json
{
  "schemaVersion": 1,
  "instanceId": "asf-ringconf-1",
  "restUrl": "https://example.test/wp-json/asf-ringconf/v1/rpc",
  "restNonce": "...",
  "assetBaseUrl": "https://example.test/wp-content/plugins/asf-ringkonfigurator/dist/browser",
  "context": "public",
  "woocommerce": {
    "enabled": true,
    "productId": 123,
    "productSku": ""
  }
}
```

## Browser-Events

Angular sendet nach erfolgreichem Speichern:

```text
oneringconf:add-to-cart
```

`assets/js/frontend-bridge.js` liest `event.detail.presetId`, nutzt das Runtime-JSON fuer REST-Endpunkt und Nonce, sendet die ID an den Plugin-REST-Endpunkt und gibt zurueck:

```text
asf-ringconf:cart-success
asf-ringconf:cart-error
```

Die Bridge beobachtet keine Angular-DOM-Strukturen und patcht keine Buttons.

## REST-/RPC-Vertrag

RPC-Endpunkt:

```text
POST /wp-json/asf-ringconf/v1/rpc
```

Erwartet werden die bestehenden Angular-Felder `rpc`, `rpp` und `tabId`. Erlaubt sind `dbGetId`, `dbCheckIdExist`, `dbGetAPPDATA`, `dbSavePreset`, `dbLoadPreset`, `calcPrice` und `getWordPressContext`. Nicht erlaubte RPCs liefern 403 und fuehren nichts aus.

Warenkorb-Endpunkt:

```text
POST /wp-json/asf-ringconf/v1/cart/add
```

Body:

```json
{"presetId":"ABCD-EFGH"}
```

Alle WordPress-REST-Anfragen senden `X-WP-Nonce` aus dem Runtime-JSON.

## WooCommerce-Produkt

Unter `WooCommerce -> ASF Ringkonfigurator` wird das Konfigurationsprodukt per Produkt-ID oder SKU hinterlegt. Das Plugin speichert `rcfg_id` im Cart Item, zeigt die Ring-ID im Warenkorb/Checkout an und schreibt `Ring-ID` sowie `_rcfg_id` per WooCommerce-CRUD in die Order-Line-Meta. HPOS wird als kompatibel deklariert.

Der Preis wird serverseitig ueber den bestehenden Preisvertrag gesetzt. Bis zur fachlichen Preisformel bleibt der bisherige Platzhalterwert erhalten und kann ueber den Filter `asf_ringconf_calculated_price` erweitert werden.

## Lokaler Testablauf

1. `npm ci`
2. `npm run build:woocommerce`
3. In WordPress ueber `Plugins -> Neues Plugin hinzufuegen -> Plugin hochladen` die Datei `.deploy/woocommerce/asf-ringkonfigurator-2.7.7.2.zip` installieren.
4. WooCommerce aktivieren, Plugin aktivieren, Produkt-ID oder SKU speichern.
5. Seite mit `[asf_ringkonfigurator]` anlegen und speichern/laden/In-den-Warenkorb testen.
6. Denselben Test in einem WooCommerce-Mein-Konto-Endpunkt ausfuehren.

Nach der Installation kann der Shortcode per WP-CLI geprueft werden:

```bash
wp eval 'echo shortcode_exists("asf_ringkonfigurator") ? "OK\n" : "FAIL\n";'
```

Erwartet:

```text
OK
```

Bei deaktiviertem WooCommerce darf kein Fatal Error entstehen; stattdessen zeigt das Plugin einen kontrollierten Adminhinweis und der Shortcode gibt eine Abhaengigkeitsmeldung aus.

## Fehlersuche

Fehlendes Manifest: Pluginpaket mit `npm run build:woocommerce` neu erzeugen und die ZIP installieren, nicht den Quellordner ohne `dist`.

Fehlender Modul-Einstieg: `npm run check:woocommerce-module-entry` ausfuehren. Der Test meldet fehlende oder mehrdeutige `polyfills`-/`main`-Bundles.

Fehlendes Runtime-JSON: Seitenquelltext auf `script.asf-ringconf-runtime[type="application/json"]` und `data-asf-ringconf-runtime-id` am `x-app-root` pruefen.

## Nicht enthalten

Nicht umgesetzt sind Etui-Zusatzprodukt, Testringe, Ringmassband, B2B-Paketlogik, Branding, temporaere Modullizenzen, Supporttickets, Juwelier-Bestelluebersicht und individuelles Produkt-Template-Replacement.
