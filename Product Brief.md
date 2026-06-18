  # Product Brief — Route Zero

  ## Das Problem
  Wenn man einen neuen Pokemon Story Run startet, weiß man oft nicht, welche Pokemon man in sein Team aufnehmen soll. Route Zero stellt dann ein zufälliges Team aus Pokemon zusammen. 

  ## Für wen ist das?
  Jeder der noch ein Team für die Pokemon Story Runs braucht.

  ## Warum interessiert mich das?
  Ich bin auf dieses Problem gestoßen und dachte mir, dass das gut umsetzbar sein könnte.

  ## Was muss es können? (die wichtigsten Funktionen)
  - das exakte Pokemon Game auswählen können
  - Filter einstellbar:
    - Typ (welche Typen man will)
    - nicht vollentwickelte Pokemon ignorieren
    - Event-Pokemon ignorieren
    - trade-only pokemon ignorieren
    - roaming-Pokemon ignorieren
  - Piktogramme der gerollten Pokemon

  ## Was lasse ich (erstmal) weg?
   - Auf Klick auf das Pokemon die Shiny Version des Pokemons anzeigen
   - Infotext ob Shiny-locked oder nicht
   - Roll-Animation

  ## Mockups (optional)
  <img width="1086" height="1448" alt="image" src="https://github.com/user-attachments/assets/578e5c95-589f-476c-9fc3-ebac4da83a98" />

  ## Implementierungsplan

  ### 1. Technische Basis
  - Eine kleine Web-App bauen, damit Route Zero direkt im Browser nutzbar ist.
  - Projekt mit Next.js, React und TypeScript aufsetzen.
  - App Router von Next.js verwenden.
  - Styling mit CSS Modules, normalem CSS oder Tailwind CSS umsetzen.
  - Daten zuerst lokal im Projekt halten, damit die App ohne eigenes Backend funktioniert.
  - Deployment von Anfang an für Vercel vorbereiten.

  ### 2. Pokemon-Daten vorbereiten
  - Eine strukturierte Datenquelle für Pokemon pro Spiel anlegen.
  - Pro Pokemon mindestens speichern:
    - Name
    - Nationaldex- oder Regionaldex-Nummer
    - Typ 1 und optional Typ 2
    - Sprite/Piktogramm-URL
    - verfügbare Spiele
    - Entwicklungsstatus
    - Event-Pokemon ja/nein
    - Trade-only ja/nein
    - Roaming-Pokemon ja/nein
  - Für den ersten Prototyp mit wenigen Spielen starten und die Daten später erweitern.
  - Daten so modellieren, dass neue Spiele leicht ergänzt werden können.

  ### 3. Benutzeroberfläche bauen
  - Spielauswahl als Dropdown oder Select-Komponente.
  - Typfilter als auswählbare Typ-Chips oder Checkboxen.
  - Zusätzliche Filter als Checkboxen:
    - nicht vollentwickelte Pokemon ignorieren
    - Event-Pokemon ignorieren
    - trade-only Pokemon ignorieren
    - roaming-Pokemon ignorieren
  - Button zum Rollen eines Teams.
  - Ergebnisbereich mit sechs Pokemon-Karten.
  - Jede Pokemon-Karte zeigt mindestens Sprite/Piktogramm, Namen und Typen.
  - Leerer Zustand anzeigen, bevor ein Team gerollt wurde.
  - Fehlerzustand anzeigen, wenn durch die Filter nicht genug Pokemon verfügbar sind.
  - Die Hauptansicht als erste sichtbare Seite bauen, keine Landingpage davor.

  ### 4. Team-Generator umsetzen
  - Nach Spielauswahl zuerst alle Pokemon filtern, die in diesem Spiel verfügbar sind.
  - Danach die gewählten Filter anwenden.
  - Aus dem gefilterten Pool zufällig sechs unterschiedliche Pokemon ziehen.
  - Keine Duplikate im Team erlauben.
  - Wenn weniger als sechs Pokemon übrig sind, keine unvollständigen Teams ausgeben, sondern eine klare Meldung anzeigen.
  - Generatorlogik als eigene Funktion schreiben, damit sie einfach getestet werden kann.

  ### 5. Erste Version testen
  - Manuell prüfen:
    - App startet ohne Fehler.
    - Spielauswahl verändert den Pokemon-Pool.
    - Jeder Filter verändert den Pool korrekt.
    - Roll-Button erzeugt sechs Pokemon.
    - Es entstehen keine Duplikate.
    - Fehlerzustand erscheint bei zu strengen Filtern.
  - Unit-Tests für die Generatorlogik ergänzen:
    - zieht genau sechs Pokemon
    - zieht keine Duplikate
    - respektiert Spielauswahl
    - respektiert Filter
    - behandelt zu kleine Pools korrekt

  ### 6. Next.js- und Vercel-Setup
  - Next.js-Projektstruktur anlegen:
    - `app/page.tsx` für die Hauptseite
    - `app/layout.tsx` für Metadaten und Grundlayout
    - `components/` für UI-Komponenten
    - `lib/` für Generatorlogik und Filterfunktionen
    - `data/` für lokale Pokemon- und Spieldaten
    - `tests/` oder nahe Tests neben der Generatorlogik
  - Vercel-kompatible Standards verwenden:
    - kein eigenes Server-Setup nötig
    - Build über `next build`
    - Start lokal über `next dev`
  - Optional `vercel.json` nur ergänzen, wenn spezielle Konfiguration nötig wird.
  - Projekt auf Vercel deployen und GitHub-Repository mit Vercel verbinden.
  - Nach jedem Push auf `main` automatisch ein Production Deployment erstellen lassen.

  ### 7. MVP-Abgrenzung
  - MVP enthält:
    - Spielauswahl
    - Typfilter
    - Filter für Entwicklungsstatus, Event, Trade-only und Roaming
    - zufälliges Team aus sechs Pokemon
    - Pokemon-Piktogramme
  - Nicht im MVP enthalten:
    - Shiny-Ansicht
    - Shiny-locked-Infos
    - Roll-Animation
    - Benutzeraccounts
    - Speichern oder Teilen von Teams

  ### 8. Mögliche Erweiterungen nach dem MVP
  - Shiny-Version per Klick anzeigen.
  - Shiny-locked-Status anzeigen.
  - Roll-Animation ergänzen.
  - Teams speichern oder als Bild exportieren.
  - Weitere Filter ergänzen, zum Beispiel Legendäre Pokemon, Starter oder doppelte Typen vermeiden.
  - Mehr Spiele und Generationen ergänzen.

  ## Task-Liste

  ### Phase 1: Projekt aufsetzen
  - [ ] Next.js-Projekt mit TypeScript erstellen.
  - [ ] App Router aktivieren.
  - [ ] Styling-Entscheidung treffen: CSS Modules, globale CSS-Dateien oder Tailwind CSS.
  - [ ] Basis-Dateien anlegen:
    - [ ] `app/page.tsx`
    - [ ] `app/layout.tsx`
    - [ ] `components/`
    - [ ] `lib/`
    - [ ] `data/`
    - [ ] `scripts/`
  - [ ] Lokalen Dev-Server mit `next dev` starten.
  - [ ] Build mit `next build` prüfen.

  ### Phase 2: Datenstrategie
  - [ ] Entscheiden, mit welchem Spiel oder Spielepaar der MVP startet.
  - [ ] Pokemon-Datentyp definieren.
  - [ ] Game-Datentyp definieren.
  - [ ] Liste aller Pokemon-Typen definieren.
  - [ ] PokéAPI als Quelle für Basisdaten verwenden:
    - [ ] ID
    - [ ] Name
    - [ ] Typen
    - [ ] Sprite/Piktogramm
    - [ ] Evolution Chain
  - [ ] Manuell kuratierte Zusatzdaten ergänzen:
    - [ ] verfügbare Spiele
    - [ ] fully evolved ja/nein
    - [ ] Event-Pokemon ja/nein
    - [ ] Trade-only ja/nein
    - [ ] Roaming ja/nein
  - [ ] Daten lokal im Repo speichern, damit die App nicht bei jedem Seitenaufruf externe APIs braucht.

  ### Phase 3: Daten-Script
  - [ ] Script `scripts/fetch-pokemon-data.ts` anlegen.
  - [ ] PokéAPI-Basisdaten abrufen.
  - [ ] Evolution-Daten auswerten.
  - [ ] Sprite-URLs speichern.
  - [ ] Daten in ein lokales Format schreiben.
  - [ ] Manuelle Overrides ermöglichen, damit Sonderfälle nicht vom Script überschrieben werden.
  - [ ] Script dokumentieren.

  ### Phase 4: Generatorlogik
  - [ ] Funktion zum Filtern nach Spiel bauen.
  - [ ] Funktion zum Filtern nach Typ bauen.
  - [ ] Filter für nicht vollentwickelte Pokemon bauen.
  - [ ] Filter für Event-Pokemon bauen.
  - [ ] Filter für Trade-only Pokemon bauen.
  - [ ] Filter für Roaming-Pokemon bauen.
  - [ ] Funktion zum zufälligen Ziehen von sechs unterschiedlichen Pokemon bauen.
  - [ ] Fehlerfall behandeln, wenn weniger als sechs Pokemon übrig sind.
  - [ ] Generatorlogik in `lib/` isolieren.

  ### Phase 5: UI bauen
  - [ ] Hauptseite ohne Landingpage erstellen.
  - [ ] Spielauswahl bauen.
  - [ ] Typfilter bauen.
  - [ ] Checkboxen für Zusatzfilter bauen.
  - [ ] Roll-Button bauen.
  - [ ] Ergebnisbereich für sechs Pokemon bauen.
  - [ ] Pokemon-Karte bauen:
    - [ ] Sprite/Piktogramm
    - [ ] Name
    - [ ] Typen
  - [ ] Leeren Zustand vor dem ersten Roll anzeigen.
  - [ ] Fehlerzustand bei zu strengen Filtern anzeigen.
  - [ ] Responsive Layout für Desktop und Mobile prüfen.

  ### Phase 6: Tests
  - [ ] Test-Setup einrichten.
  - [ ] Generator-Tests schreiben:
    - [ ] erzeugt genau sechs Pokemon
    - [ ] erzeugt keine Duplikate
    - [ ] respektiert Spielauswahl
    - [ ] respektiert Typfilter
    - [ ] respektiert Zusatzfilter
    - [ ] gibt Fehler bei zu kleinem Pool zurück
  - [ ] Manuelle UI-Tests durchführen.
  - [ ] `next build` vor Deployment ausführen.

  ### Phase 7: Vercel Deployment
  - [ ] GitHub-Repository mit Vercel verbinden.
  - [ ] Vercel-Projekt erstellen.
  - [ ] Framework Preset auf Next.js setzen.
  - [ ] Erstes Preview Deployment prüfen.
  - [ ] Production Deployment für `main` einrichten.
  - [ ] Live-URL im README dokumentieren.

  ### Phase 8: Nach dem MVP
  - [ ] Weitere Spiele ergänzen.
  - [ ] Shiny-Ansicht per Klick bauen.
  - [ ] Shiny-locked-Infos ergänzen.
  - [ ] Roll-Animation bauen.
  - [ ] Team als Bild exportierbar machen.
  - [ ] Team speichern oder teilen.
