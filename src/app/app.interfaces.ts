import {CVertex} from "./webgl/threeD";

export interface iMinMax {
  min: number;
  max: number;
}

export interface iMinMaxStep {
  min: number;
  max: number;
  step: number;
}

export interface iMinMaxCur {
  min: number;
  max: number;
  cur: number;
}

export interface iMinMaxCurSize {
  min: number;
  max: number;
  cur: number;
  size: number;
}

export interface iProfile {
  name: string;
  // json: iProfileResponse | null;
  rw?: iMinMaxStep; // Grenzwerte Profilweite
  rh?: iMinMaxStep; // Grenzwerte Profilhöhe
  rs?: iMinMaxStep; // Grenzwerte Ringgröße
  wa: iMinMaxStep; // Wellenamplitude
  wc: iMinMaxStep; // Wellenanzahl
  sw?: iMinMaxStep; // Grenzwerte für Stufen, wenn Variable undefiniert, dann sind keine Stufen möglich
  sd?: number; // Stufentiefe
  rhMaxFactor: number; // Faktor * Ringweite = max. Ringhöhe
  syncRwRh?: boolean; // sync Ringweite mit Ringhöhe?
  sideGapDistance: number; // Sicherheitsabstand der Fugenflanke zum Profilrand
  gapGapDistance: number; // Sicherheitsabstand Fugenflanke-Fugenflanke
  gapGapDistanceWave: number; // Sicherheitsabstand Fugenflanke-Fugenflanke bei Welle
  stoneModes: number[]; // erlaubte Steinmodi
  // hDivIndex?: number; // Index des zusammengeführten Backprofils für die horizontale Teilung; links und rechts gleich
  maxWaveAmpMultipleWaves: number; // maximale Wellenamplitude bei mehr als 1 Welle
  maxWaveCountMultipleWaves: number; // maximale Wellenanzahl bei mehr als 1 Welle
  useSimpleScaling?: boolean; // einfache XZ-Skalierung des Profiles; es werden keine Segmente einzeln betrachtet
  sideCrossChannelDistance?: number; // Sicherheitsabstand zum Ringrand bei Kanal quer
}

declare function getProfile(name: string): iProfile | undefined;

export interface iProfileResponse {
  xzs: {
    x: number;
    z: number;
    s: number;
  }[][],
  size: {
    cx: number;
    cz: number;
    length: number;
  }[],
}

export interface iDivPreset {
  name?: string; // Name, so wie er im Frontend sichtbar ist; nur bei Elternelmenten
  img: string; // Grafik für das Frontend
  rwMin?: number; // min Ringbreite
  rhMin?: number; // min Ringhöhe
  notProfile?: string[]; // nicht für diese Profile anbieten
  divPreset?: string; // Preset-String: "-:1"...
  items?: iDivPreset[]; // Kindelemente: es muss entweder divPreset oder items definiert sein
}

export interface iMaterial {
  id: number; // Material-ID
  name: string; // Name, so wie er im Frontend sichtbar ist
  symbol: string; // Symbol für die Punzierung
  fineness: number[]; // möglicher Feingehalt
  color3d: string; // Farbe für die 3D Darstellung
  colorHtml: string; // Farbe für die Darstellung in der Auswahlliste

  asfProfileIndex: number[]; // Reihenindex der asfVerwaltungs-DB für den Feingehalt
  processingFee: number[]; // Bearbeitungsgebühr für den Feingehalt
  pricePerGramm: number; // Materialpreis bei Feingehalt 1000
  calcFactor: number;
}

export interface iMaterialExclude {
  // diese Material-ID`s können nicht miteinander kombiniert werden
  id_a:number;
  id_b: number;
}

export interface iSurface {
  id: number; // Surface-ID
  name: string; // Name, so wie er im Frontend sichtbar ist
  img: string; // Grafik für das Frontend
  material: { // Textur / Materialsteuerung WebGL
    metallic: number;
    roughness: number;
    uScale?: number;
    vScale?: number;
    invertX?: boolean;
    invertY?: boolean;
    file?: string; // filename.ext
  };
  minSegmentWidth?: number; // minimale Segmentgröße um diese Oberfläche zu nutzen
  maxDivision?: number; // maximale Anzahl der Teilungen um diese Oberfläche zu nutzen
  forceGap?: boolean, // Trennfuge erzwingen?

  surcharge?: number; // Preisaufschlag
}

export interface iStepMode {
  id: number;
  name: string;
  img: string;
}

export interface iPearlingSize {
  id: number;
  name: string;
  img?: string;
  diameter: number;
  rowClearance: number;
  minRowClearance?: number;
  maxRowClearance?: number;
  channelEdgeClearance: number;
  channelWidth: number;
  spacingMode: string;
  pitch?: number;
  beadCount?: number;
}

export interface iFeaturePearlingRule {
  enabled: boolean;
  allowedSizes: number[];
}

export interface iFeatureRules {
  global?: {
    unit?: string;
    defaultAction?: string;
    autoAdjustAllowed?: boolean;
    minFeatureDistance?: number;
    logViolations?: boolean;
  };
  gapPearling?: iFeaturePearlingRule & {
    allowedGapModes: number[];
    minDistanceToStone: number;
    minDistanceToOtherGap: number;
    snapTolerance: number;
  };
  stepPearling?: iFeaturePearlingRule & {
    allowedSides: string[];
    singleRowOnly: boolean;
  };
  freeGap?: {
    minDistanceToOtherGap: number;
    snapTolerance: number;
  };
  combinations?: unknown[];
}

export interface iGapMode {
  id: number;
  name: string;
  img: string;
  width: number[];
  surface: number[],
  depth: number; // Werte kleiner als 1.0 gelten als Faktor zur Weite, größer als 1 ist absolutes Maß
}

export interface iStoneDistances {
  /**
   * @param profile
   * es können mehrere Profile mit gleichen Werten kombiniert werden => ["P1", "P2"],
   * leer lassen, wenn für alle Profile gleich
   * @param stoneToGap_x
   * Abstand zum Ringrand, zur Stufe und zur Fuge
   * @param stoneToBevel_x
   * Abstand von der Steinkante zur Einfassung (kann auch negativ sein),
   * Werte zwischen 0 und 2.0 werden als Faktor mit der Steingröße ermittelt. Dies ist für den Kanal wichtig,
   * da er 12% kleiner als die Steingröße ist. => Faktor 0.88
   */
  profile?: string[];
  stoneToStone_x: number;
  stoneToStone_y: number;
  stoneToGap_x: number;
  stoneToBevel_x: number;
}

declare function getStoneDistances(stoneMode: iStoneMode, profileName: string): iStoneDistances | null;

declare function getRowWidth(stoneSize: number, numRows: number, stoneDistances: iStoneDistances): number;

export interface iStoneMode {
  mode?: number;
  name: string;
  img: string;
  items?: iStoneMode[]; // es muss entweder mode oder items gesetzt sein
  safeDistX: number; // Sicherheitsabstand von Stein zu Stein
  safeDistY: number;
  safeDistXGap?: number; // Sicherheitsabstand Stein zur Fuge
  sideCrossChannelDistance?: number; // Sicherheitsabstand Stein zur Profilkante -> Kanal quer
  maxGapWidth?: number;
  distribution?: number; // wenn gesetzt, dann wird die gewählte Verteilung mit dieser überschrieben

  sideIndex?: number; // 0 oder 1 entsprechend links oder rechts; Wenn nicht gesetzt, dann kein seitlicher Besatz

  bevelDistX?: number; // Abstand der Bevelkante zum Stein (hier mit ? weil iStoneMode auch ein Container für weitere Modes sein kann)
  bevelDistY?: number;

  maxWaveCount?: number; // maximale Anzahl der Wellen: Verschnitt => 3, kann mit iStoneType.maxWaveCount überschrieben werden

  minRingWidth?: number; // mindest Ringbreite
  alternativeMode?: number; // alternativer Steinmodus, wenn Ringbreite zu klein

  // channelDepthFactor?:number; // Kanaltiefe im Verhältniss zur Steingröße ...0.1 o.ä.


  // new
  stoneDistances?: iStoneDistances[]; // (hier mit ? weil iStoneMode auch ein Container für weitere Modes sein kann)

  defaultStoneSize?: number; // Steingröße, welche gewählt werden soll, wenn dieser Modus getriggert wird

}

declare function getStoneMode(mode: number): iStoneMode | undefined;

export interface iStoneSize {
  size: number;
  carat: number;
  minRingWidth: number;
  minRingHeight: number;
  lengthFactor?: number; // wird bei Baguette benötigt: gibt die Steinlänge (y) im Verhältniss zur Steinbreite (x) an
  calcSize?: number; // Größe für die Berechnungen: Bei Princess45 ist der Stein un 45 Grad gedreht und ist somit breiter für die Berechnung

  safeDistX?: number; // Sicherheitsabstand von Stein zu Stein; Diese Werte überschreiben die iStoneMode-Werte
  safeDistY?: number;

  priceFactor: number;
  surcharge: number;
  price: number[]; // für jede Qualitätsstufe
}

export interface iStoneCut {
  id: number | string;
  legacyId?: number;
  name: string;
  img: string;
  obj: string;
  allowedStoneMode: number[],
  size: iStoneSize[];
  sizeDepthFactor: number; // Verhältniss der Steingröße zur Steintiefe

  maxWaveCount?: number; // maximale Anzahl der Wellen, überschreibt iStoneMode.maxWaveCount

  /* distributionFactor:
  wird hauptsächlich für den Princess 45 benötigt, da der Abstand von Stein zu Stein nicht der Größe des Steines entspricht.
  distributionFactor * size = Größe des Steines in X/Y

   */
  // distributionFactor?:number;
}

export interface iStoneType {
  id: string;
  name: string;
  defaultQuality: string | null;
  defaultColor: string | null;
  requiresQuality: boolean;
  requiresColor: boolean;
  sort?: number;
}

export interface iStoneQuality {
  id: number | string;
  name?: string;
  label?: string;
  description?: string;
  helpText?: string;
  stoneType?: string;
  colorGrade?: string;
  clarityGrade?: string;
  legacyQuality?: number;
  sort?: number;
}

export interface iStoneColor {
  id: string;
  name: string;
  hex: string;
  imageUrl?: string;
  img?: string;
  sort?: number;
  enabled?: boolean;
  tintStrength?: number;
  brightness?: number;
}

export interface iStoneAvailabilityRule {
  id: string;
  stoneTypes: string[];
  stoneCuts: string[];
  sizes?: number[];
  sizeMin?: number;
  sizeMax?: number;
  sizeStep?: number;
  qualities?: string[];
  colors?: string[];
  ringTypes?: string[];
  settingModes?: string[];
  enabled?: boolean;
  sort?: number;
}

export interface iStoneDistribution {
  id: number;
  name: string;
}

export interface iStonePosition {
  id: number;
  name: string;
  img: string;
}

export interface iStonePositionSegment {
  min: number;
  max: number;
  middle: number;
  size: number;
  onGap: boolean; // Segment ist auf Fuge
}

export interface iStoneCount {
  id: number;
  name: string;
}

export interface iStoneCalc {
  minSizeOnGap: number;
  maxSize: number;
  maxCount: number;
  maxRow: number;
  rowSizeXSafe: number;
}

export interface iOutlineDataMeasurement {
  minX: number; // linker Grenzwert ohne Sicherheitsabstand
  maxX: number; // rechter Grenzwert ohne Sicherheitsabstand
  distX: number; // der Abstand von minX zu maxX
  // minHorzSafeDist: number; // TODO: wird das noch genutzt?
  // index?: number, //  TODO: wird das noch genutzt?
  onGap: boolean, // ist dieses Segment ein Fugensegment?
  middlePosition: number, // mittlere Position zwischen minX und maxX zur Berechnung der Profiltiefe
  middleDepth: number; // Profiltiefe an der Position 'middlePosition'
  // minStoneSize?:number; // TODO: wird das noch genutzt?
  // maxStoneSize?:number; // TODO: wird das noch genutzt?
  outline?: CVertex[];
  midline?: CVertex[]; // die Mittellinie der Fugen für die freien Steine


  minXSafe?: number; // wird innerhalb der Anpassung berechnet und berücksichtigt die Abstände zum Profilrand und Fugen
  maxXSafe?: number; // -"-
  distXSafe?: number; // -"-
}

export interface iFreeStone {
  size: number;
  xDiv: number;
  yRad: number;
  x: number;
  y: number;
  r: number;
}

export interface iPresetStone {
  /* mode
  ====
10: eingerieben
20: Verschnitt
30: Kanal
31: Kanal quer
40: seitlich eingerieben links
41: seitlich eingerieben rechts
42: seitlich Kanal links
43: seitlich Kanal rechts
44: seitlich Verschnitt links
45: seitlich Verschnitt rechts
50: Spannring
*/
  mode: number,
  /* count
  -33.339 = drittel Ring
  -50 = halber Ring
  -100 = ganzer Ring
  1...n = tatsächliche Anzahl
   */
  count: number,
  /* countReal
  Tatsächliche Steinanzahl in dieser Gruppe. Wenn 'count' < 0 ist, dann gab es Fehler beider Preisberechnung.
  Dieser Wert wird nach dem Berechnen und vor der Preisanfrage in der aktuellen WebGL-Ringberechnung gesetzt.
   */
  countReal: number,

  rows: number,
  /* type
    ====
  0 = kein
  1 = Brillant
  2 = Princess
  3 = Princess 45°
  4 = Baguette quer (max 3.0mm)
  5 = Baguette längs
  */
  type: number,
  stoneCut?: string;
  stoneType?: string;
  size: number,
  /* distribution
    ============
  0.0 = aneinander
  0.5 = halber Steinabstand
  1.0 = ganzer Steinabstand
  2.0 = doppelter Steinabstand
  33.0 = drittel Ring
  50.0 = halber Ring
  100.0 = ganzer Ring
 */
  distribution: number,
  quality: number,
  stoneQuality?: string | null;
  stoneColor?: string | null;
  colorId?: string | null;
  color?: string | null;
  colorName?: string | null;
  colorHex?: string | null;

  /* positionDiv
     ===========
     NEU: 20230128
     Die Positionierung der Steine erfolgt ab der Version 2.1 durch die Angabe eines Verhältnisses wie bei der Materialteilung.
     Somit folgt die Steinposition den Ringmaßen. Die Summe der Teilung muss ebenfalls 10000 betragen.

     [5000,5000] = mittig

     Die möglichen Positionen werden in der aktuellen WebGL-Ringberechnung ermittelt.
   */

  positionDiv: number[];
  positionValue: number;

  odm?: iOutlineDataMeasurement[];
  freeStones?: iFreeStone[];

  lastSetting?: "distribution" | "count";
}

export type ExteriorEngravingType = "none" | "text" | "coordinates" | "waveform" | "fingerprint";
export type ExteriorEngravingPlacement = "single-ring" | "both-identical" | "split-pair";

export interface iExteriorEngravingConfig {
  enabled: boolean;
  type: ExteriorEngravingType;
  placement: ExteriorEngravingPlacement;
  text?: string;
  fontId?: number | string;
  latitudeInput?: string;
  longitudeInput?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordinateFormat?: "decimal" | "dms";
  showShipWheel?: boolean;
  previewAssetId?: "waveform-sample" | "fingerprint-sample" | null;
  customerAssetRequiredAfterOrder?: boolean;
}

export interface iEngravingSymbol {
  unicode: string;
  img: string;
}

export interface iEngravingOffer {
  id: "inner-text" | "exterior-text" | "exterior-coordinates" | "exterior-waveform" | "exterior-fingerprint";
  enabled?: boolean;
  price?: number | string | null;
  priceKey?: string;
}

export interface iExteriorEngravingAppData {
  maxTextLength?: number;
  edgeClearance?: number;
  offers?: iEngravingOffer[];
}

export interface iEnvironmentPreset {
  refSampler_image?:string;
  refSampler_reflect: number;
  refSampler_camRad: number;
  refSampler_factor: number;

  tri1_reflect: number;
  tri1_camRad: number;
  tri1_factor: number;

  tri2_reflect: number;
  tri2_camRad: number;
  tri2_factor: number;

  high_reflect: number;
  high_camRad: number;
  high_factor: number;

  sparkle_reflect: number;
  sparkle_camRad: number;
  sparkle_factor: number;

  fire_reflect: number;
  fire_camRad: number;
  fire_factor: number;

  envTexture_yaw:number; // 0..1 -> wird bei zuweisen in rad umgerechnet
  envTexture_pitch:number; // 0..1
  envTexture_roll:number; // 0..1

  scene_exposure:number;
  scene_contrast:number;
}

export interface iWebGLSettings {
  maxTextureSize: number;
  maxAlphaTextureSize: number;
  tesselation: number[]; // [desktop, mobile, bevels]
  ringRotationX: number;
  ringRotationY: number[]; // [Damenring, Herrenring]
  ringOffsetZ: number[];// [Damenring, Herrenring],
  camera: number[]; // [Alpha, Beta, Radius]
  cameraMinOrthoSize?: number;
  // sceneExposure: number;
  // sceneContrast: number;
  // envRotationRad_yaw: number,
  // envRotationRad_pitch: number,
  forceFrames: number; // Anzahl der zu rendernden Frames für eine Aktualisierung
  maxFps: number;

  environmentPreset: iEnvironmentPreset;
  environmentPresetId: string | undefined;
}

export type RingViewAvailability = "all" | "single" | "pair";
export type RingViewFocus = "all" | "ring0" | "ring1";
export type RingViewTargetMode = "selection-center" | "fixed";
export type RingViewFitMode = "auto" | "fixed" | "zoom-out-only";
export type RingViewProjectionMode = "orthographic" | "perspective";

export interface iRingPresentationTransform {
  position: [number, number, number];
  rotationQuaternion: [number, number, number, number];
}

export interface iRingViewPreset {
  id: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
  availability: RingViewAvailability;
  focus: RingViewFocus;
  targetMode?: RingViewTargetMode;
  camera: RingViewCameraPreset;
  layoutId?: string | null;
}

export interface RingViewCameraPreset {
  alpha: number;
  beta: number;
  target: [number, number, number];
  projection: {
    mode: RingViewProjectionMode;
    orthoHeight?: number;
    radius?: number;
    screenOffsetX?: number;
    screenOffsetY?: number;
  };
  safety: {
    fitMode: RingViewFitMode;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    includeShadowEnvelope: boolean;
    shadowExtraBottom?: number;
    shadowExtraLeft?: number;
    shadowExtraRight?: number;
  };
}

export interface iRingLayoutPreset {
  id: string;
  label: string;
  enabled: boolean;
  source: "obj-markers" | "manual";
  ringTransforms: {
    ring0?: iRingPresentationTransform;
    ring1?: iRingPresentationTransform;
  };
}

export interface iAppData {
  profile: iProfile[];

  ringWidth: iMinMaxStep;
  ringHeight: iMinMaxStep;
  ringSize: iMinMaxStep;

  divPreset: iDivPreset[];
  material: iMaterial[],
  materialExclude:iMaterialExclude[]|null,
  surface: iSurface[],

  gapMode: iGapMode[],
  stepMode: iStepMode[],
  pearlingSize?: iPearlingSize[],
  featureRules?: iFeatureRules,
  stepDepthOptions?: number[],

  stoneMode: iStoneMode[],
  stoneType: Array<iStoneType | iStoneCut>,
  stoneCut?: iStoneCut[],
  stoneQuality: iStoneQuality[],
  stoneColor?: iStoneColor[],
  stoneAvailabilityRules?: iStoneAvailabilityRule[],
  stoneDistribution: iStoneDistribution[];
  stonePosition: iStonePosition[];
  stoneRowsMax: number,
  stoneCount: iStoneCount[],

  engraving: {
    maxLength: number,
    symbols: iEngravingSymbol[],
    color: string,
    alpha?: number;
    exterior?: iExteriorEngravingAppData;
  },

  webglSettings: iWebGLSettings;
  viewPresets?: iRingViewPreset[];
  layoutPresets?: iRingLayoutPreset[];
}

export interface iDBSaveItem {
  id: string;
  preset_0: string;
  preset_1: string;
  preset_2?: string | null;
  preset_3?: string | null;
  img: string;
  error?: string;
}
