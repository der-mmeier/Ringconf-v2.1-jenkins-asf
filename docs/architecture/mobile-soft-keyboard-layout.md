# Mobile Soft Keyboard Layout

Ringconf 2.7.9.1.1 trennt die stabile Konfigurator-Klassifikation vom temporär verkleinerten `visualViewport` einer mobilen Soft-Tastatur.

## Problem

Chrome auf Android verkleinert beim Öffnen von Gboard den sichtbaren `visualViewport`. Auf einem Pixel 8a im Portrait kann dadurch die gemessene Höhe kleiner als die Breite werden. Eine reine `width >= height`-Klassifikation schaltet dann fälschlich in `phone-landscape` und aktiviert die vertikale Step-Rail.

## Klassifikation

Der Layout-Service misst weiter primär den Konfigurator-Host. Ergänzend werden Layout-Viewport, Visual-Viewport, Pointer-Fähigkeit und fokussiertes Textelement erfasst.

Eine Soft-Tastatur gilt als geöffnet, wenn:

- ein textfähiges Feld fokussiert ist,
- der Pointer `coarse` ist,
- `visualViewport.height` deutlich kleiner als der Layout-Viewport ist,
- die Viewport-Breite stabil bleibt.

Wenn der stabile Modus `phone-portrait` ist und der Layout-Viewport weiterhin Portrait ist, bleibt der effektive Modus während der Tastaturöffnung `phone-portrait`. Eine echte Rotation wird nicht eingefroren, weil ein landscape-orientierter Layout-Viewport weiterhin neu klassifiziert wird.

## Gravur-Fokusmodus

Bei fokussierter Gravureingabe setzt die Shell zusätzlich zum Layoutmodus:

- `data-soft-keyboard="open"`,
- `data-focused-input="engraving-input"`,
- `.configurator-engraving-focus`.

Dieser Zustand reduziert die Canvas-Höhe kontrolliert über `--engraving-focus-canvas-height`, behält aber die volle Portraitbreite und die horizontale Navigation bei. Der WebGL-Host bleibt gemountet; es werden nur Reflow und `engine.resize()` ausgelöst.

## Input und Composition

Innengravur und Text-Außengravur verwenden das semantische `input`-Ereignis. Die Preview wird ca. 140 ms debounced als Material-Invalidierung angewendet. Während IME/Composition wird kein Zwischenstand committet; nach `compositionend` wird die Preview aktualisiert.

Der vorhandene `Anwenden`-Button bleibt als finaler Commit-/Sync-Pfad erhalten.

## Symbol- und Fontbedienung

Symbolbuttons verhindern beim Pointerdown das Blur des Eingabefelds, fügen an `selectionStart`/`selectionEnd` ein, aktualisieren die Preview und stellen Fokus und Cursorposition wieder her. Die Längenlogik zählt Codepoints statt UTF-16-Codeunits.

Auf Smartphones sind Symbol- und Schriftleisten horizontale einzeilige Swipebars mit mindestens 48 px Touchhöhe. Die Überschrift `Symbol hinzufügen` wird nur im kompakten Gravur-Fokusmodus ausgeblendet; die Symbolbuttons bleiben sichtbar.

## Pixel-8a-Test

Manueller Referenztest:

1. Pixel 8a in Chrome mit Gboard im Portrait öffnen.
2. Gravurtab öffnen.
3. Innengravur fokussieren.
4. Prüfen: Modus bleibt `phone-portrait`, keine linke Landscape-Rail, Canvas bleibt oben sichtbar, Eingabefeld bleibt erreichbar.
5. `Anna & Max` tippen, Autokorrektur/Einfügen testen, Symbol am Anfang und in der Mitte einfügen.
6. Tastatur schließen und echte Rotation Portrait/Landscape testen.
