export interface AdminHelpEntry {
  title: string;
  description: string;
  example?: string;
  technical?: string;
}

export const APPDATA_ADMIN_HELP: Record<string, AdminHelpEntry> = {
  "profile.milgrain.enabled": {
    title: "Perlierung erlaubt",
    description: "Aktiviert Perlierung als Zusatzveredelung fuer Fugen und Stufen. Wenn deaktiviert, bleiben Fugen und Stufen ohne Perlenreihe.",
    example: "P3 erlaubt Perlierung, P12 kann deaktiviert bleiben.",
    technical: "Gespeichert als profile[].milgrain.enabled.",
  },
  "profile.milgrain.allowedModes": {
    title: "Nicht mehr verwendet",
    description: "Perlierung ist kein eigener Modus mehr. Die Anordnung folgt der gewaehlten Fuge oder Stufe.",
    technical: "Alte profile[].milgrain.allowedModes werden von der Runtime ignoriert.",
  },
  "profile.milgrain.allowedSizes": {
    title: "Erlaubte Perlengroessen",
    description: "Legt fest, welche Perlendurchmesser fuer dieses Profil erlaubt sind. Die Optionen werden aus appData.pearlingSize abgeleitet.",
    example: "500 = 0,5 mm, 1000 = 1,0 mm.",
    technical: "Gespeichert als profile[].milgrain.allowedSizes mit Perlengroessen-IDs.",
  },
  "profile.milgrain.minRingWidth": {
    title: "Mindest-Ringbreite",
    description: "Mindestbreite des Rings, ab der Perlierung fuer dieses Profil erlaubt ist.",
    example: "3,0 mm bedeutet: Ringe unter 3,0 mm Breite duerfen keine Perlierung verwenden.",
    technical: "Gespeichert als profile[].milgrain.minRingWidth in Tausendstel Millimeter.",
  },
  "profile.milgrain.minEdgeDistance": {
    title: "Mindest-Randabstand",
    description: "Mindestabstand der Perlierung zur Aussenkante des Rings.",
    example: "0,5 mm bedeutet: Die Perlierung muss mindestens 0,5 mm vom Rand entfernt bleiben.",
    technical: "Gespeichert als profile[].milgrain.minEdgeDistance in Tausendstel Millimeter.",
  },
  "profile.milgrain.minFeatureDistance": {
    title: "Mindest-Feature-Abstand",
    description: "Allgemeiner Mindestabstand zu anderen Features wie freien Fugen, normalen Fugen, Stufen oder spaeter weiteren Dekoren.",
    example: "0,5 mm bedeutet: Zwischen Perlierung und anderem Feature muss mindestens 0,5 mm Platz bleiben.",
    technical: "Gespeichert als profile[].milgrain.minFeatureDistance in Tausendstel Millimeter.",
  },
  "profile.milgrain.minStoneDistanceMode": {
    title: "Steinabstand-Modus",
    description: "Legt fest, wie der Abstand zwischen Perlierung und Stein berechnet wird.",
    example: "beadDiameter = Abstand entspricht mindestens einem Perlendurchmesser. fixed = fester Abstand in mm, falls spaeter ergaenzt.",
    technical: "Gespeichert als profile[].milgrain.minStoneDistanceMode.",
  },
  "profile.milgrain.stopBeforeStoneByBeads": {
    title: "Stop vor Stein",
    description: "Gibt an, wie viele ganze Perlen Abstand vor einem Stein freibleiben muessen.",
    example: "1 bedeutet: Die Perlierung endet mindestens eine ganze Perle vor dem Stein.",
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
