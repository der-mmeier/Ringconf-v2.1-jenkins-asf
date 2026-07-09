export interface AdminHelpEntry {
  title: string;
  description: string;
  example?: string;
  technical?: string;
}

export const APPDATA_ADMIN_HELP: Record<string, AdminHelpEntry> = {
  "profile.milgrain.enabled": {
    title: "Perlfugen erlaubt",
    description: "Aktiviert Perlfugen fuer dieses Profil. Wenn deaktiviert, sind nur Konfigurationen ohne Perlfuge zulaessig.",
    example: "P3 erlaubt Perlfugen, P12 kann deaktiviert bleiben.",
    technical: "Gespeichert als profile[].milgrain.enabled.",
  },
  "profile.milgrain.allowedModes": {
    title: "Erlaubte Perlfugen-Modi",
    description: "Legt fest, welche Perlfugen-Anordnungen fuer dieses Profil erlaubt sind. Die Optionen werden aus appData.milgrainMode abgeleitet.",
    example: "Ohne, 1 Reihe mittig, Aussen links/rechts, Doppelt links/rechts.",
    technical: "Gespeichert als profile[].milgrain.allowedModes mit Milgrain-Modus-IDs.",
  },
  "profile.milgrain.allowedSizes": {
    title: "Erlaubte Perlengroessen",
    description: "Legt fest, welche Perlendurchmesser fuer dieses Profil erlaubt sind. Die Optionen werden aus appData.milgrainSize abgeleitet.",
    example: "300 = 0,3 mm, 500 = 0,5 mm, 1000 = 1,0 mm.",
    technical: "Gespeichert als profile[].milgrain.allowedSizes mit Perlengroessen-IDs.",
  },
  "profile.milgrain.minRingWidth": {
    title: "Mindest-Ringbreite",
    description: "Mindestbreite des Rings, ab der Perlfugen fuer dieses Profil erlaubt sind.",
    example: "3,0 mm bedeutet: Ringe unter 3,0 mm Breite duerfen keine Perlfuge verwenden.",
    technical: "Gespeichert als profile[].milgrain.minRingWidth in Tausendstel Millimeter.",
  },
  "profile.milgrain.minEdgeDistance": {
    title: "Mindest-Randabstand",
    description: "Mindestabstand der Perlfuge zur Aussenkante des Rings.",
    example: "0,5 mm bedeutet: Die Perlfuge muss mindestens 0,5 mm vom Rand entfernt bleiben.",
    technical: "Gespeichert als profile[].milgrain.minEdgeDistance in Tausendstel Millimeter.",
  },
  "profile.milgrain.minFeatureDistance": {
    title: "Mindest-Feature-Abstand",
    description: "Allgemeiner Mindestabstand zu anderen Features wie freien Fugen, normalen Fugen, Stufen oder spaeter weiteren Dekoren.",
    example: "0,3 mm bedeutet: Zwischen Perlfuge und anderem Feature muss mindestens 0,3 mm Platz bleiben.",
    technical: "Gespeichert als profile[].milgrain.minFeatureDistance in Tausendstel Millimeter.",
  },
  "profile.milgrain.minStoneDistanceMode": {
    title: "Steinabstand-Modus",
    description: "Legt fest, wie der Abstand zwischen Perlfuge und Stein berechnet wird.",
    example: "beadDiameter = Abstand entspricht mindestens einem Perlendurchmesser. fixed = fester Abstand in mm, falls spaeter ergaenzt.",
    technical: "Gespeichert als profile[].milgrain.minStoneDistanceMode.",
  },
  "profile.milgrain.stopBeforeStoneByBeads": {
    title: "Stop vor Stein",
    description: "Gibt an, wie viele ganze Perlen Abstand vor einem Stein freibleiben muessen.",
    example: "1 bedeutet: Die Perlfuge endet mindestens eine ganze Perle vor dem Stein.",
    technical: "Gespeichert als profile[].milgrain.stopBeforeStoneByBeads.",
  },
  "profile.milgrain.autoAdjustAllowed": {
    title: "Auto Adjust",
    description: "Erlaubt dem Konfigurator, eine ungueltige Auswahl automatisch auf eine gueltige Auswahl anzupassen.",
    example: "Wenn 1,0 mm zu gross ist, kann auf 0,5 mm reduziert werden.",
    technical: "Gespeichert als profile[].milgrain.autoAdjustAllowed.",
  },
  "profile.milgrain.conflictAction": {
    title: "Konfliktverhalten",
    description: "Legt fest, was passiert, wenn eine Regel verletzt wird.",
    example: "block = Auswahl verhindern, warn = warnen, autoAdjust = automatisch korrigieren, falls moeglich.",
    technical: "Gespeichert als profile[].milgrain.conflictAction.",
  },
};
