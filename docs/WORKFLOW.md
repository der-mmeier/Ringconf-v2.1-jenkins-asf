# Verbindlicher Workflow: Build, AppData, Kompatibilität und Freigabe

## 1. Begriffe

### Buildversion

Eine Buildversion bezeichnet ein unveränderliches, aus Git erzeugtes Artefakt des Konfigurators.

Beispiel:

```text
Build 2.6.6
Git Commit abc1234
Angular 22.x
Babylon.js x.y.z
```

Ein bereits veröffentlichtes Build wird nicht nachträglich überschrieben. Ein Kunde darf auf einem älteren Build bleiben.

### AppData-Version

Eine AppData-Version ist ein unveränderlicher vollständiger JSON-Snapshot.

Beispiel:

```text
AppData 3.0.216.5
```

Eine Änderung erzeugt immer eine neue Version. Bestehende Versionen werden nicht überschrieben und nicht gelöscht.

### Kompatibilität

Eine AppData-Version ist nicht automatisch mit jedem Build kompatibel.

Für jede Kombination gilt einer dieser Zustände:

```text
untested
compatible
incompatible
```

Nur `compatible` darf produktiv zugeordnet werden.

### Freigabe

Eine AppData-Version kann folgende Zustände haben:

```text
draft
validated
approved
retired
```

`approved` bedeutet: Die Version ist grundsätzlich für den Produktiveinsatz freigegeben.

### Aktivierung

Eine Aktivierung ordnet einem konkreten Ziel eine konkrete Build-/AppData-Kombination zu.

Beispiele:

```text
default-production
customer-juwelier-muelheim
customer-example
local-development
staging
```

Ein Ziel kann dadurch dauerhaft auf einem älteren Build und einer dazu kompatiblen AppData-Version verbleiben.

---

## 2. Anzeige im Canvas

Die bisherige alleinige Anzeige:

```text
2.6.6
```

wird fest definiert als:

```text
Build 2.6.6 · AppData 3.0.216.5
```

Optional zusätzlich im Admin-Panel:

```text
Git abc1234 · Kompatibilität: geprüft
```

Die Buildversion kommt aus dem Buildartefakt. Die AppData-Version kommt aus dem geladenen Snapshot.

---

## 3. Bearbeitungsworkflow

1. Mitarbeiter startet den Konfigurator mit `npm run start`.
2. Das Zahnrad öffnet `AppData und WebGL-Settings`.
3. Das Panel lädt:
   - aktuelle Buildversion,
   - aktive AppData-Version,
   - vollständigen Snapshot,
   - bekannte Versionen,
   - Kompatibilitäten,
   - Zielzuordnungen.
4. Der Snapshot wird vollständig geklont.
5. Formulare verändern ausschließlich konkrete JSON-Pfade.
6. Unbekannte Felder bleiben unverändert erhalten.
7. Live-fähige WebGL-Werte werden sofort im Canvas angewendet.
8. Werte mit Neuladepflicht werden markiert.
9. Vor dem Speichern erfolgen:
   - JSON-Validierung,
   - fachliche Referenzprüfung,
   - Änderungsvorschau,
   - Anzeige des serverseitig später zu bestätigenden Diffs.
10. Mitarbeiter klickt `Neue AppData-Version speichern`.
11. Dialog verlangt:
    - internen Login,
    - PIN,
    - Änderungsgrund.
12. Angular sendet an den lokalen PHP-Admin-Endpunkt.
13. Der PHP-Endpunkt ruft serverseitig die Mitarbeiterverifikation auf.
14. Nur bei erfolgreicher Verifikation:
    - Optimistic-Lock über Basisversion und SHA-256 prüfen,
    - serverseitigen Diff berechnen,
    - neuen unveränderlichen Snapshot einfügen,
    - Audit-Event schreiben,
    - Transaktion committen.
15. Login und PIN werden weder gespeichert noch geloggt.

---

## 4. Versionserzeugung

Ausgang:

```text
3.0.216.4
```

Standardmäßige reine Datenkorrektur:

```text
3.0.216.5
```

Der letzte Block wird automatisch erhöht.

Für spätere Schemaänderungen muss das Panel einen bewusst gewählten Bump-Typ unterstützen:

```text
revision
patch
minor
major
```

Die Semantik wird im Projekt dokumentiert. Automatisch ist nur `revision`.

---

## 5. Kompatibilitätsprüfung

Nach Speicherung ist die neue AppData zunächst:

```text
draft
```

Für den aktuell laufenden Build kann der Mitarbeiter einen vollständigen Smoke-Test ausführen.

Danach:

1. Login/PIN erneut abfragen.
2. Status der Kombination auf `compatible` oder `incompatible` setzen.
3. Tester, Zeitpunkt und Notiz speichern.

Eine Freigabe ist nur erlaubt, wenn mindestens eine geprüfte kompatible Buildbeziehung existiert.

---

## 6. Freigabe

`Für Produktion freigeben` ist eine eigene Aktion, getrennt vom Speichern.

Erforderlich:

- erneute Mitarbeiterverifikation,
- passende Freigabeberechtigung,
- Änderungs-/Freigabekommentar,
- mindestens eine kompatible Buildbeziehung.

Gespeichert werden:

- freigebender Mitarbeiter,
- Berechtigungswert,
- Zeitpunkt,
- Kommentar,
- AppData-Version.

---

## 7. Zielzuordnung

Eine freigegebene AppData wird nicht automatisch überall aktiv.

Für eine Zielzuordnung müssen ausgewählt werden:

- Ziel,
- Build,
- kompatible AppData,
- Kommentar.

Beispiel:

```text
customer-juwelier-a
Build 2.6.6
AppData 3.0.216.5
```

Ein anderer Kunde kann weiterhin verwenden:

```text
customer-juwelier-b
Build 2.5.9
AppData 3.0.190.8
```

Jede Zuordnung wird historisiert. Ein Rollback ist eine neue Zuordnungsaktion, keine Löschung.

---

## 8. Konfliktschutz

Jeder Speichervorgang überträgt:

```text
baseVersionId
baseVersionLabel
baseHash
```

Ist die Basis inzwischen veraltet:

```http
409 Conflict
```

Das Panel darf nicht überschreiben. Es muss die aktuelle Version laden und den Mitarbeiter den Konflikt bewusst lösen lassen.

---

## 9. Diff

Der verbindliche Diff wird serverseitig erzeugt.

Gespeichert werden:

1. maschinenlesbarer JSON-Patch-ähnlicher Diff,
2. semantische Zusammenfassung für Listen mit stabilen IDs.

Beispiele:

```text
material[id=3].color3d
#d66e49 → #d86f4a
```

```text
stoneType[id=2].size[size=2500].minRingHeight
2200 → 2300
```

---

## 10. Deployment-Ausschluss

Das Development-Admin-Panel muss über Angular-Dateiersetzung oder einen gleichwertigen Compile-Time-Mechanismus vollständig aus folgenden Builds verschwinden:

```text
production
woocommerce
```

Nicht ausreichend:

- CSS `display:none`
- Runtime-Flag
- versteckter Button
- URL-Parameter

Im ausgelieferten Bundle dürfen weder Admin-Texte noch interne Endpunkte oder Authentifizierungslogik enthalten sein.

---

## 11. Lokale versus zentrale Speicherung

Die Oberfläche ist lokal. Die Versionsdatenbank muss für mehrere Mitarbeiter zentral sein.

Nicht zulässig als organisatorische Quelle:

```text
Mitarbeiter A → eigene lokale MySQL-Datenbank
Mitarbeiter B → andere lokale MySQL-Datenbank
```

Zulässig:

```text
mehrere lokale Development-Instanzen
→ dieselbe zentral konfigurierte Ringconf-Versionierungsdatenbank
→ dieselbe zentrale Mitarbeiterverifikation
```
