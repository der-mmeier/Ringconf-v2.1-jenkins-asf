import {CommonModule} from "@angular/common";
import {ChangeDetectorRef, Component, HostListener, Input} from "@angular/core";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {FormsModule} from "@angular/forms";
import {Matrix} from "@babylonjs/core";
import {iAppData} from "../app.interfaces";
import {RingData} from "../app.ringdata";
import {AppDataAdminDebugInfo, AppDataAdminResponse, AppDataAdminService} from "./appdata-admin.service";
import {AdminHelpEntry, APPDATA_ADMIN_HELP} from "./appdata-admin-help";
import {
  createDefaultPearlingSizes,
  hasPearlingDefinitions,
  normalizePearlingAllowedSizes,
  normalizePearlingAppData,
  normalizePearlingSizeList,
  PEARLING_SPACING_MODES,
} from "../pearling-size";
import {cRing, eRingFlags} from "../webgl/cRing";
import {WebglComponent} from "../webgl/webgl.component";
import {isStoneColorHex, normalizeStoneTaxonomyAppData} from "../stone-taxonomy";
import {layoutPresetFromParsed, ObjMarkerLayoutResult, parseObjMarkerLayout} from "../webgl/ring-layout-obj";
import {normalizeRingViewAppData} from "../webgl/ring-view-presets";
import {normalizeEngravingAppData} from "../exterior-engraving";
import {CalibrationStudioComponent} from "./calibration-studio/calibration-studio.component";

type StatusType = "idle" | "success" | "warning" | "error";
type AdminAction = "importCurrentBaseline" | "saveVersion" | "setCompatibility" | "approveVersion" | "retireVersion" | "assignTarget" | "rollbackTarget";
type BootstrapOptions = {replaceWorking?: boolean};

interface BuildInfo {
  id?: number;
  build_key: string;
  version_label: string;
  git_commit?: string | null;
  angular_version?: string | null;
  babylon_version?: string | null;
  status?: string;
}

interface AppDataVersion {
  id: number;
  version_label: string;
  state: string;
  snapshot_sha256?: string;
  snapshot_hash?: string;
  created_at?: string;
}

interface AppDataTarget {
  id: number;
  target_key: string;
  target_name: string;
  environment: string;
  enabled: number | boolean;
  active_build_id?: number | null;
  active_appdata_version_id?: number | null;
}

interface RingconfAppHost {
  data: iAppData;
  state: {
    build: string;
    appDataVersionLabel: string;
    appDataHash: string;
  };
}

interface CompatibilityInfo {
  appdata_version_id: number;
  build_id: number;
  status: string;
  test_notes?: string | null;
}

interface PlatformRelease {
  id: string;
  version: string;
  buildNumber?: number;
  branch: string;
  shortSha: string;
  createdAt: string;
  url: string;
  status: string;
  compatible: boolean | null;
  appDataContract?: string | null;
  priceContract?: string | null;
}

interface PlatformReleaseIndex {
  current: string | null;
  releases: PlatformRelease[];
}

interface BootstrapData {
  build: BuildInfo;
  appData: iAppData;
  activeVersion: AppDataVersion | null;
  activeHash: string;
  builds: BuildInfo[];
  versions: AppDataVersion[];
  compatibilities: CompatibilityInfo[];
  targets: AppDataTarget[];
  permissions: {
    editor: string[];
    approver: string[];
  };
}

interface DiffEntry {
  path: string;
  before: unknown;
  after: unknown;
  impact: "live" | "reload" | "data";
}

interface ValidationResult {
  errors: string[];
  warnings: string[];
  issues: AdminValidationIssue[];
}

interface AdminValidationIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

interface EditorSection {
  title: string;
  keys: string[];
}

interface WebglField {
  path: string;
  label: string;
  min: number;
  max: number;
  step: number;
  reload: boolean;
}

type JsonRecord = Record<string, unknown>;

interface MilgrainOption {
  id: number | string;
  label: string;
}

@Component({
  selector: "x-development-admin",
  standalone: true,
  imports: [CommonModule, FormsModule, CalibrationStudioComponent],
  templateUrl: "./development-admin.component.html",
  styleUrls: ["./development-admin.component.scss"],
})
export class DevelopmentAdminComponent {
  @Input() app: RingconfAppHost | null = null;

  open = false;
  loading = false;
  previewingBabylon = false;
  dirty = false;
  requiresReload = false;
  statusType: StatusType = "idle";
  statusMessage = "Development-Admin lädt...";
  activeTab: "appdata" | "webgl" | "tools" | "versions" = "appdata";
  selectedJsonPath = "material";
  selectedVersionId = "";
  selectedPlatformReleaseId = "";
  releaseIndexUrl = "/3d-konfigurator/release-index.json";
  releasePreviewUrl = "";
  releasePreviewSafeUrl: SafeResourceUrl | null = null;
  releaseIndex: PlatformReleaseIndex | null = null;
  selectedTargetKey = "local-development";
  selectedCompatibilityStatus: "compatible" | "incompatible" = "compatible";
  authAction: AdminAction | null = null;
  authTitle = "";
  authReasonLabel = "Grund";
  auth = {
    username: "",
    pin: "",
    reason: "",
  };
  helpEntry: AdminHelpEntry | null = null;

  build: BuildInfo = {
    build_key: "2.7.6",
    version_label: "2.7.6",
  };
  activeVersion: AppDataVersion | null = null;
  activeHash = "";
  baseline: iAppData | null = null;
  working: iAppData | null = null;
  versions: AppDataVersion[] = [];
  builds: BuildInfo[] = [];
  compatibilities: CompatibilityInfo[] = [];
  targets: AppDataTarget[] = [];
  validation: ValidationResult = {errors: [], warnings: [], issues: []};
  diff: DiffEntry[] = [];
  private lastPearlingNormalizationNotice = "";
  milgrainModeEditorOptions: JsonRecord[] = [];
  milgrainSizeEditorOptions: JsonRecord[] = [];
  milgrainModeSelectOptions: MilgrainOption[] = [];
  milgrainSizeSelectOptions: MilgrainOption[] = [];
  readonly pearlingSpacingModes = PEARLING_SPACING_MODES;
  layoutObjScale = 1;
  layoutObjPresetId = "presentation-layout";
  layoutObjPresetLabel = "Präsentationsaufstellung";
  layoutObjResult: ObjMarkerLayoutResult | null = null;

  get lastAdminRequest(): AppDataAdminDebugInfo | null
  {
    return this.adminApi.lastDebugInfo;
  }

  get buildLabel(): string
  {
    return this.app?.state.build || this.build.version_label || this.build.build_key || "2.7.6";
  }

  get activeAppDataLabel(): string
  {
    return this.activeVersion?.version_label || this.app?.state.appDataVersionLabel || "unversioned";
  }

  readonly appDataSections: EditorSection[] = [
    {title: "Profile und Ringmaße", keys: ["profile", "ringWidth", "ringHeight", "ringSize"]},
    {title: "Perlierung", keys: ["pearlingSize"]},
    {title: "Regelwerk", keys: ["featureRules"]},
    {title: "Profil-Regeln", keys: ["profile"]},
    {title: "Ringarten und Ansichten", keys: ["ringModes", "viewPresets", "layoutPresets"]},
    {title: "Materialien und Legierungen", keys: ["material"]},
    {title: "Materialkombinationen", keys: ["materialExclude"]},
    {title: "Oberflächen", keys: ["surface"]},
    {title: "Teilungen, Fugen und Stufen", keys: ["gapMode", "stepMode"]},
    {title: "Steinbesatz", keys: ["stoneMode", "stoneType", "stoneQuality", "stoneColor", "stoneCut", "stoneAvailabilityRules", "stoneDistribution", "stonePosition"]},
    {title: "Gravur", keys: ["engraving"]},
    {title: "Verlobungsring-Kopfbibliothek", keys: ["engagementHeadLibrary"]},
  ];

  readonly webglGroups: {title: string; fields: WebglField[]}[] = [
    {
      title: "Texturen und Geometrie",
      fields: [
        {path: "webglSettings.maxTextureSize", label: "Max. Texturgröße", min: 512, max: 8192, step: 512, reload: true},
        {path: "webglSettings.maxAlphaTextureSize", label: "Max. Alpha-Texturgröße", min: 512, max: 8192, step: 512, reload: true},
        {path: "webglSettings.tesselation.0", label: "Tessellation Desktop", min: 20, max: 300, step: 5, reload: true},
        {path: "webglSettings.tesselation.1", label: "Tessellation Mobil", min: 20, max: 300, step: 5, reload: true},
        {path: "webglSettings.tesselation.2", label: "Tessellation Profil", min: 4, max: 100, step: 1, reload: true},
        {path: "webglSettings.ringRotationX", label: "Ringrotation X", min: -180, max: 180, step: 1, reload: true},
        {path: "webglSettings.ringRotationY.0", label: "Ringrotation Y Ring 1", min: -180, max: 180, step: 1, reload: true},
        {path: "webglSettings.ringRotationY.1", label: "Ringrotation Y Ring 2", min: -180, max: 180, step: 1, reload: true},
        {path: "webglSettings.ringOffsetZ.0", label: "Ringversatz Z Ring 1", min: -20, max: 20, step: 0.1, reload: true},
        {path: "webglSettings.ringOffsetZ.1", label: "Ringversatz Z Ring 2", min: -20, max: 20, step: 0.1, reload: true},
      ],
    },
    {
      title: "Kamera und Rendering",
      fields: [
        {path: "webglSettings.camera.0", label: "Kamera Alpha", min: -3.141593, max: 3.141593, step: 0.001, reload: false},
        {path: "webglSettings.camera.1", label: "Kamera Beta", min: 0.1, max: 1.470797, step: 0.001, reload: false},
        {path: "webglSettings.camera.2", label: "Kameraabstand", min: 5, max: 250, step: 0.5, reload: false},
        {path: "webglSettings.cameraMinOrthoSize", label: "Orthografischer Ausschnitt", min: 5, max: 100, step: 0.5, reload: false},
        {path: "webglSettings.forceFrames", label: "Erzwungene Frames", min: 0, max: 120, step: 1, reload: false},
        {path: "webglSettings.maxFps", label: "Maximale FPS", min: 10, max: 60, step: 1, reload: false},
      ],
    },
    {
      title: "Szene und Environment",
      fields: [
        {path: "webglSettings.environmentPreset.scene_exposure", label: "Belichtung", min: 0, max: 4, step: 0.001, reload: false},
        {path: "webglSettings.environmentPreset.scene_contrast", label: "Kontrast", min: 0, max: 4, step: 0.001, reload: false},
        {path: "webglSettings.environmentPreset.envTexture_yaw", label: "Environment Yaw", min: 0, max: 1, step: 0.001, reload: false},
        {path: "webglSettings.environmentPreset.envTexture_pitch", label: "Environment Pitch", min: 0, max: 1, step: 0.001, reload: false},
        {path: "webglSettings.environmentPreset.envTexture_roll", label: "Environment Roll", min: 0, max: 1, step: 0.001, reload: false},
      ],
    },
    {title: "Diamant – Referenz", fields: this.diamondFields("refSampler", "RefSampler")},
    {title: "Diamant – Tri 1", fields: this.diamondFields("tri1", "Tri 1")},
    {title: "Diamant – Tri 2", fields: this.diamondFields("tri2", "Tri 2")},
    {title: "Diamant – Highlight", fields: this.diamondFields("high", "Highlight")},
    {title: "Diamant – Sparkle", fields: this.diamondFields("sparkle", "Sparkle")},
    {title: "Diamant – Fire", fields: this.diamondFields("fire", "Fire")},
  ];

  constructor(
    private adminApi: AppDataAdminService,
    private sanitizer: DomSanitizer,
    private changeDetector: ChangeDetectorRef,
  )
  {
  }

  @HostListener("document:keydown.escape")
  closeHelpOnEscape(): void
  {
    this.closeHelp();
  }

  async toggle(): Promise<void>
  {
    if (this.open) {
      this.open = false;
      return;
    }

    await this.openAdmin();
  }

  async openAdmin(): Promise<void>
  {
    this.open = true;
    this.hydrateFromRuntime();
    await this.loadBootstrap({replaceWorking: false});
  }

  async loadBootstrap(options: BootstrapOptions = {}): Promise<void>
  {
    this.loading = true;
    if (!this.working) {
      this.setStatus("Development-Admin lädt...", "idle");
    }
    let response: AppDataAdminResponse<BootstrapData>;
    try {
      response = await this.adminApi.request<BootstrapData>("bootstrap", {
        build: this.localBuildInfo(),
      });
    } finally {
      this.loading = false;
    }

    if (!response.ok || !response.data) {
      if (!this.working) {
        this.hydrateFromRuntime();
      }
      this.setStatus(response.error?.message ?? "Server-Metadaten konnten nicht geladen werden. Runtime-AppData wird angezeigt.", this.working ? "warning" : "error");
      return;
    }

    this.build = response.data.build ?? this.localBuildInfo();
    this.versions = response.data.versions;
    this.builds = response.data.builds;
    this.compatibilities = response.data.compatibilities;
    this.targets = response.data.targets;

    const mayReplaceEditorState = options.replaceWorking === true || this.working === null;
    let pearlingNormalized = false;
    if (mayReplaceEditorState) {
      this.activeVersion = response.data.activeVersion;
      this.activeHash = response.data.activeHash;
      this.baseline = this.clone(response.data.appData);
      this.working = this.clone(response.data.appData);
      pearlingNormalized = this.normalizeWorkingPearlingLegacy();
      this.applyVersionLabel();
      this.refreshMilgrainEditorOptions();
    } else {
      if (!this.activeHash) {
        this.activeHash = this.app?.state.appDataHash || response.data.activeHash || "";
      }
      this.ensureActiveVersionResolved();
    }

    pearlingNormalized = this.normalizeWorkingPearlingLegacy() || pearlingNormalized;
    this.recalculate();
    this.setStatus(
      pearlingNormalized
        ? "AppData geladen. Alte Perlgröße 0,3 mm wurde aus allowedSizes entfernt."
        : "AppData geladen.",
      pearlingNormalized ? "warning" : "success",
    );
  }

  getSectionCount(key: string): string
  {
    return this.describeAppDataKey(key, this.getPath(this.working, key));
  }

  getJsonValue(path: string): string
  {
    return JSON.stringify(this.getPath(this.working, path) ?? null, null, 2);
  }

  formatJson(value: unknown): string
  {
    return JSON.stringify(value ?? null, null, 2);
  }

  getRecordId(record: JsonRecord): string | number
  {
    const id = record["id"];
    return typeof id === "string" || typeof id === "number" ? id : this.formatJson(record);
  }

  updateJsonValue(path: string, value: string): void
  {
    try {
      this.setPath(this.working, path, JSON.parse(value));
      this.markChanged(false);
    } catch {
      this.validation = {
        ...this.validation,
        errors: [`${path}: ungültiges JSON im Editor.`],
      };
    }
  }

  getMilgrainModes(): JsonRecord[]
  {
    return this.milgrainModeEditorOptions;
  }

  getMilgrainModeState(): string
  {
    return "nicht mehr verwendet";
  }

  getMilgrainModeOptions(): MilgrainOption[]
  {
    return this.milgrainModeSelectOptions;
  }

  getMilgrainSizes(): JsonRecord[]
  {
    return this.milgrainSizeEditorOptions;
  }

  getMilgrainSizeState(): string
  {
    return this.describeCollectionState("pearlingSize");
  }

  getMilgrainSizeOptions(): MilgrainOption[]
  {
    return this.milgrainSizeSelectOptions;
  }

  getProfiles(): JsonRecord[]
  {
    return this.getRecordArray("profile");
  }

  getFeatureGlobal(): JsonRecord | null
  {
    const value = this.getPath(this.working, "featureRules.global");
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
  }

  getFeatureCombinations(): JsonRecord[]
  {
    return this.getRecordArray("featureRules.combinations");
  }

  getProfileMilgrain(profile: JsonRecord): JsonRecord | null
  {
    const value = profile["milgrain"];
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
  }

  initializeFeatureRules(): void
  {
    if (!this.working) {
      return;
    }
    const current = this.getPath(this.working, "featureRules");
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      this.setPath(this.working, "featureRules", {
        global: {
          unit: "micrometer",
          defaultAction: "block",
          autoAdjustAllowed: false,
          minFeatureDistance: 0,
          minMilgrainToRingEdge: 0,
          logViolations: false,
        },
        combinations: [],
      });
    } else {
      const rules = current as JsonRecord;
      if (!rules["global"] || typeof rules["global"] !== "object" || Array.isArray(rules["global"])) {
        rules["global"] = {
          unit: "micrometer",
          defaultAction: "block",
          autoAdjustAllowed: false,
          minFeatureDistance: 0,
          minMilgrainToRingEdge: 0,
          logViolations: false,
        };
      }
      if (!Array.isArray(rules["combinations"])) {
        rules["combinations"] = [];
      }
    }
    this.markChanged(false);
  }

  initializeMilgrainDefaults(force = false): void
  {
    if (!this.working) {
      return;
    }
    const record = this.working as unknown as JsonRecord;
    if (force || !Array.isArray(record["pearlingSize"])) {
      record["pearlingSize"] = createDefaultPearlingSizes();
    }
    this.ensureFeatureRulesDefaults();
    this.markChanged(false);
  }

  initializeMilgrainModeDefaults(force = false): void
  {
    if (!this.working) {
      return;
    }
    const record = this.working as unknown as JsonRecord;
    if (force || !Array.isArray(record["pearlingSize"])) {
      record["pearlingSize"] = createDefaultPearlingSizes();
      this.markChanged(false);
    }
  }

  initializeMilgrainSizeDefaults(force = false): void
  {
    if (!this.working) {
      return;
    }
    const record = this.working as unknown as JsonRecord;
    if (force || !Array.isArray(record["pearlingSize"])) {
      record["pearlingSize"] = createDefaultPearlingSizes();
      this.markChanged(false);
    }
  }

  initializeProfileMilgrain(profile: JsonRecord): void
  {
    if (this.getProfileMilgrain(profile)) {
      return;
    }

    const allowedSizes = this.getMilgrainSizeIds();
    const minRingWidth = this.defaultProfileMinRingWidth(profile);
    const minEdgeDistance = this.defaultProfileEdgeDistance(profile);
    const minFeatureDistance = this.defaultProfileFeatureDistance(profile);

    profile["milgrain"] = {
      enabled: true,
      allowedSizes: allowedSizes.length ? allowedSizes : normalizePearlingAllowedSizes([]),
      minRingWidth,
      minEdgeDistance,
      minFeatureDistance,
      minStoneDistanceMode: "beadDiameter",
      stopBeforeStoneByBeads: 1,
      autoAdjustAllowed: false,
      conflictAction: "block",
    };
    this.markChanged(false);
  }

  updateRecordText(record: JsonRecord | null, field: string, value: string): void
  {
    if (!record) {
      return;
    }
    record[field] = value;
    this.markChanged(false);
  }

  updateRecordBoolean(record: JsonRecord | null, field: string, value: boolean): void
  {
    if (!record) {
      return;
    }
    record[field] = value;
    this.markChanged(false);
  }

  updateRecordNumber(record: JsonRecord | null, field: string, value: string | number): void
  {
    if (!record) {
      return;
    }
    const next = Number(value);
    record[field] = Number.isFinite(next) ? next : value;
    this.markChanged(false);
  }

  updateRecordMicrometer(record: JsonRecord | null, field: string, value: string | number): void
  {
    if (!record) {
      return;
    }
    const next = Number(value);
    if (Number.isFinite(next)) {
      record[field] = this.fromMmValue(next);
      this.markChanged(false);
    }
  }

  updateRecordCsv(record: JsonRecord | null, field: string, value: string): void
  {
    if (!record) {
      return;
    }
    record[field] = value
      .split(",")
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => /^-?\d+(\.\d+)?$/.test(item) ? Number(item) : item);
    this.markChanged(false);
  }

  csvValue(value: unknown): string
  {
    return Array.isArray(value) ? value.join(", ") : "";
  }

  micrometerToMm(value: unknown): number
  {
    return this.toMmValue(value);
  }

  toMmValue(value: unknown): number
  {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue / 1000 : 0;
  }

  fromMmValue(value: string | number): number
  {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.round(numberValue * 1000) : 0;
  }

  formatMm(value: unknown): string
  {
    const mm = this.toMmValue(value);
    return `${new Intl.NumberFormat("de-DE", {minimumFractionDigits: 1, maximumFractionDigits: 3}).format(mm)} mm`;
  }

  isOptionSelected(record: JsonRecord, field: string, id: number | string): boolean
  {
    const values = record[field];
    return Array.isArray(values) && values.some(value => String(value) === String(id));
  }

  toggleOption(record: JsonRecord, field: string, id: number | string, checked: boolean): void
  {
    const current = Array.isArray(record[field]) ? [...record[field] as unknown[]] : [];
    const filtered = current.filter(value => String(value) !== String(id));
    const normalizedId = this.normalizeId(id);
    record[field] = checked ? [...filtered, normalizedId] : filtered;
    this.markChanged(false);
  }

  describeSelectedOptions(record: JsonRecord, field: string, options: MilgrainOption[]): string
  {
    const labels = options
      .filter(option => this.isOptionSelected(record, field, option.id))
      .map(option => option.label);
    return labels.length ? labels.join(", ") : "Keine Auswahl";
  }

  openHelp(key: string): void
  {
    this.helpEntry = APPDATA_ADMIN_HELP[key] ?? null;
  }

  closeHelp(): void
  {
    this.helpEntry = null;
  }

  getArray(path: string): unknown[]
  {
    const value = this.getPath(this.working, path);
    return Array.isArray(value) ? value : [];
  }

  identify(item: unknown): string
  {
    if (!item || typeof item !== "object") {
      return String(item);
    }
    const data = item as Record<string, unknown>;
    return String(data["id"] ?? data["mode"] ?? data["name"] ?? data["size"] ?? "Eintrag");
  }

  getField(path: string): number
  {
    const value = this.getPath(this.working, path);
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  updateWebglField(field: WebglField, value: string | number): void
  {
    const next = Number(value);
    if (!Number.isFinite(next)) {
      return;
    }
    const clamped = Math.min(field.max, Math.max(field.min, next));
    this.setPath(this.working, field.path, clamped);
    this.markChanged(field.reload);
    this.applyWebglLive();
  }

  reset(): void
  {
    if (!this.baseline) {
      return;
    }
    this.working = this.clone(this.baseline);
    this.requiresReload = false;
    this.applyWorkingToRuntime();
    this.applyWebglLive();
    this.forceBabylonRerender();
    this.refreshMilgrainEditorOptions();
    this.recalculate();
    this.setStatus("Änderungen zurückgesetzt.", "success");
  }

  previewWorkingAppDataInBabylon(): void
  {
    if (!this.working) {
      this.setStatus("Keine Working-AppData geladen.", "warning");
      return;
    }

    this.previewingBabylon = true;
    try {
      const next = this.clone(this.working);
      const pearlingNormalized = normalizePearlingAppData(next).changed;
      normalizeStoneTaxonomyAppData(next);
      normalizeEngravingAppData(next);
      normalizeRingViewAppData(next);
      this.applyAppDataToRuntime(next, {
        versionLabel: this.activeVersion?.version_label ?? "unsaved-preview",
        hash: this.activeHash || "unsaved-preview",
      });
      this.normalizeRingDataForCurrentAppData();
      this.forceBabylonRerender();
      this.setStatus(
        pearlingNormalized
          ? "Working-AppData wurde normalisiert und in Babylon getestet."
          : "Working-AppData wurde in Babylon getestet.",
        "success",
      );
    } catch (error) {
      console.error("[DevelopmentAdmin] Babylon preview failed", error);
      this.setStatus(error instanceof Error ? error.message : "Babylon konnte nicht neu gerendert werden.", "error");
    } finally {
      this.previewingBabylon = false;
      this.changeDetector.detectChanges();
    }
  }

  openAuth(action: AdminAction): void
  {
    this.authAction = action;
    this.auth = {username: "", pin: "", reason: ""};
    const titles: Record<AdminAction, string> = {
      importCurrentBaseline: "Aktuelle AppData als Baseline importieren",
      saveVersion: "Neue AppData-Version speichern",
      setCompatibility: "Build-Kompatibilität speichern",
      approveVersion: "Für Produktion freigeben",
      retireVersion: "AppData-Version stilllegen",
      assignTarget: "Ziel-/Kundenzuordnung speichern",
      rollbackTarget: "Rollback-Zuordnung speichern",
    };
    this.authTitle = titles[action];
    this.authReasonLabel = action === "setCompatibility" ? "Prüfnotiz" : "Grund";
  }

  cancelAuth(): void
  {
    this.auth = {username: "", pin: "", reason: ""};
    this.authAction = null;
  }

  async confirmAuth(): Promise<void>
  {
    if (this.loading) {
      return;
    }
    if (!this.authAction || !this.auth.username || !this.auth.pin || !this.auth.reason.trim()) {
      this.setStatus("Login, PIN und Grund sind erforderlich.", "warning");
      return;
    }

    const credentials = {
      username: this.auth.username,
      pin: this.auth.pin,
    };
    const reason = this.auth.reason.trim();
    const action = this.authAction;
    this.auth = {username: "", pin: "", reason: ""};
    this.authAction = null;

    let response: AppDataAdminResponse<unknown>;
    this.loading = true;
    switch (action) {
      case "importCurrentBaseline":
        response = await this.adminApi.request("importCurrentBaseline", {
          ...credentials,
          changeReason: reason,
          baselineVersionLabel: "3.0.216.4",
          build: this.localBuildInfo(),
        });
        break;
      case "saveVersion": {
        this.normalizeWorkingPearlingLegacy();
        this.recalculate();
        const baseVersion = this.resolveCurrentBaseVersion();
        if (!baseVersion || baseVersion.id <= 0) {
          this.setStatus("Keine gültige Basisversion geladen. Bitte AppData neu laden und dann erneut speichern.", "error");
          this.loading = false;
          return;
        }
        if (!this.activeHash) {
          this.setStatus("Kein gültiger Basis-Hash geladen. Bitte AppData neu laden und dann erneut speichern.", "error");
          this.loading = false;
          return;
        }
        response = await this.adminApi.request("saveVersion", {
          ...credentials,
          changeReason: reason,
          baseVersionId: baseVersion.id,
          baseVersionLabel: baseVersion.version_label,
          baseHash: this.activeHash,
          bump: "revision",
          build: this.localBuildInfo(),
          appData: this.working,
        });
        break;
      }
      case "setCompatibility": {
        const versionId = this.requireActiveVersionIdForAction();
        if (versionId === null) {
          this.loading = false;
          return;
        }
        response = await this.adminApi.request("setCompatibility", {
          ...credentials,
          versionId,
          build: this.localBuildInfo(),
          status: this.selectedCompatibilityStatus,
          note: reason,
        });
        break;
      }
      case "approveVersion": {
        const versionId = this.requireActiveVersionIdForAction();
        if (versionId === null) {
          this.loading = false;
          return;
        }
        response = await this.adminApi.request("approveVersion", {
          ...credentials,
          versionId,
          changeReason: reason,
        });
        break;
      }
      case "retireVersion": {
        const versionId = this.requireActiveVersionIdForAction();
        if (versionId === null) {
          this.loading = false;
          return;
        }
        response = await this.adminApi.request("retireVersion", {
          ...credentials,
          versionId,
          changeReason: reason,
        });
        break;
      }
      case "assignTarget":
      case "rollbackTarget": {
        const versionId = this.requireActiveVersionIdForAction();
        if (versionId === null) {
          this.loading = false;
          return;
        }
        response = await this.adminApi.request(action, {
          ...credentials,
          targetKey: this.selectedTargetKey,
          build: this.localBuildInfo(),
          versionId,
          changeReason: reason,
        });
        break;
      }
    }
    this.loading = false;

    if (!response.ok) {
      this.setStatus(response.error?.message ?? "Aktion fehlgeschlagen.", "error");
      return;
    }

    if (action === "saveVersion") {
      const saved = response.data as {versionId?: number; versionLabel?: string; hash?: string} | undefined;
      if (saved?.versionId) {
        await this.refreshAdminListsWithoutReplacingWorkingAppData();
        this.selectedVersionId = String(saved.versionId);
        await this.loadVersion(saved.versionId);
        this.setStatus(`AppData-Version ${saved.versionLabel ?? saved.versionId} als Draft gespeichert und geladen.`, "success");
        return;
      }
    }

    this.setStatus("Aktion erfolgreich gespeichert.", "success");
    await this.loadBootstrap();
  }

  async loadVersion(versionIdInput?: string | number): Promise<void>
  {
    if (this.loading) {
      console.info("[DevelopmentAdmin] loadVersion ignored because another admin action is still loading", {
        selectedVersionId: this.selectedVersionId,
        requestedVersionId: versionIdInput,
      });
      return;
    }
    const versionId = Number(versionIdInput ?? this.selectedVersionId);
    if (!Number.isFinite(versionId) || versionId <= 0) {
      this.setStatus("Keine gueltige AppData-Version ausgewaehlt.", "warning");
      return;
    }

    this.loading = true;
    console.info("[DevelopmentAdmin] loadVersion start", {versionId});
    try {
      const response = await this.adminApi.request<{version: AppDataVersion; appData: iAppData; hash: string}>("getVersion", {
        versionId,
      });

      if (!response.ok || !response.data) {
        this.setStatus(response.error?.message ?? "Version konnte nicht geladen werden.", "error");
        return;
      }

      this.activeVersion = response.data.version;
      this.activeHash = response.data.hash;
      this.baseline = this.clone(response.data.appData);
      this.working = this.clone(response.data.appData);
      const pearlingNormalized = this.normalizeWorkingPearlingLegacy();
      this.selectedVersionId = String(response.data.version.id);
      this.applyVersionLabel();
      this.applyWorkingToRuntime();
      this.refreshMilgrainEditorOptions();
      this.applyWebglLive(true);
      this.forceBabylonRerender();
      this.recalculate();
      this.setStatus(
        pearlingNormalized
          ? `Version ${response.data.version.version_label} geladen. Alte Perlgröße 0,3 mm wurde aus allowedSizes entfernt.`
          : `Version ${response.data.version.version_label} geladen.`,
        pearlingNormalized ? "warning" : "success",
      );
      console.info("[DevelopmentAdmin] loadVersion applied", {
        versionId: response.data.version.id,
        versionLabel: response.data.version.version_label,
        hash: response.data.hash,
      });
    } catch (error) {
      console.error("[DevelopmentAdmin] loadVersion failed", error);
      this.setStatus(error instanceof Error ? error.message : "Version konnte nicht geladen werden.", "error");
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
      console.info("[DevelopmentAdmin] loadVersion finished", {versionId, loading: this.loading});
    }
  }

  async loadReleaseIndex(): Promise<void>
  {
    try {
      const response = await fetch(this.releaseIndexUrl, {cache: "no-store"});
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      this.releaseIndex = await response.json() as PlatformReleaseIndex;
      this.selectedPlatformReleaseId = this.releaseIndex.current || this.releaseIndex.releases[0]?.id || "";
      this.selectPlatformRelease(this.selectedPlatformReleaseId);
      this.setStatus("Release-Index geladen.", "success");
    } catch (error) {
      this.releaseIndex = null;
      this.releasePreviewUrl = "";
      this.releasePreviewSafeUrl = null;
      this.setStatus(`Release-Index konnte nicht geladen werden: ${error instanceof Error ? error.message : "unbekannter Fehler"}`, "warning");
    }
  }

  selectPlatformRelease(releaseId: string): void
  {
    this.selectedPlatformReleaseId = releaseId;
    this.releasePreviewUrl = this.selectedPlatformRelease?.url || "";
    this.releasePreviewSafeUrl = this.releasePreviewUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(this.releasePreviewUrl) : null;
  }

  get selectedPlatformRelease(): PlatformRelease | null
  {
    return this.releaseIndex?.releases.find(release => release.id === this.selectedPlatformReleaseId) || null;
  }

  private diamondFields(prefix: string, label: string): WebglField[]
  {
    return [
      {path: `webglSettings.environmentPreset.${prefix}_reflect`, label: `${label} Reflexion`, min: 0, max: 4, step: 0.001, reload: false},
      {path: `webglSettings.environmentPreset.${prefix}_camRad`, label: `${label} Kameraradius`, min: 0, max: 4, step: 0.001, reload: false},
      {path: `webglSettings.environmentPreset.${prefix}_factor`, label: `${label} Faktor`, min: 0, max: 4, step: 0.001, reload: false},
    ];
  }

  private markChanged(reload: boolean): void
  {
    this.dirty = true;
    this.requiresReload = this.requiresReload || reload;
    this.refreshMilgrainEditorOptions();
    this.recalculate();
  }

  private normalizeWorkingPearlingLegacy(): boolean
  {
    if (!this.working) {
      this.lastPearlingNormalizationNotice = "";
      return false;
    }

    const result = normalizePearlingAppData(this.working);
    this.lastPearlingNormalizationNotice = result.removedLegacy300
      ? "Alte Perlgröße 0,3 mm wurde aus allowedSizes entfernt."
      : "";
    return result.changed;
  }

  private refreshMilgrainEditorOptions(): void
  {
    this.milgrainModeEditorOptions = [];
    this.milgrainSizeEditorOptions = hasPearlingDefinitions(this.working)
      ? normalizePearlingSizeList(this.getPath(this.working, "pearlingSize")) as JsonRecord[]
      : [];
    this.milgrainModeSelectOptions = this.milgrainModeEditorOptions.map(mode => {
      const id = mode["id"] as number | string;
      const name = String(mode["name"] ?? id);
      return {
        id,
        label: `${name} (${id})`,
      };
    });
    this.milgrainSizeSelectOptions = this.milgrainSizeEditorOptions.map(size => {
      const id = size["id"] as number | string;
      const diameter = size["diameter"] !== undefined ? this.formatMm(size["diameter"]) : String(size["name"] ?? id);
      const name = size["name"] ? ` - ${String(size["name"])}` : "";
      return {
        id,
        label: `${diameter} (${id})${name}`,
      };
    });
  }

  private async refreshAdminListsWithoutReplacingWorkingAppData(): Promise<void>
  {
    const versions = await this.adminApi.request<{versions: AppDataVersion[]}>("listVersions");
    if (versions.ok && versions.data?.versions) {
      this.versions = versions.data.versions;
    }

    const builds = await this.adminApi.request<{builds: BuildInfo[]}>("listBuilds");
    if (builds.ok && builds.data?.builds) {
      this.builds = builds.data.builds;
    }

    const targets = await this.adminApi.request<{targets: AppDataTarget[]}>("listTargets");
    if (targets.ok && targets.data?.targets) {
      this.targets = targets.data.targets;
    }
  }

  private recalculate(): void
  {
    this.normalizeWorkingPearlingLegacy();
    if (this.working) {
      normalizeStoneTaxonomyAppData(this.working);
      normalizeEngravingAppData(this.working);
      normalizeRingViewAppData(this.working);
    }
    this.validation = this.validate(this.working);
    this.diff = this.createDiff(this.baseline, this.working).slice(0, 500);
    this.dirty = this.diff.length > 0;
  }

  private validate(value: iAppData | null): ValidationResult
  {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!value || typeof value !== "object") {
      return this.toValidationResult([{severity: "error", path: "$", message: "AppData ist kein JSON-Objekt."}]);
    }

    this.requireUnique(value.material, "material.id", errors);
    this.requireUnique(value.stoneType, "stoneType.id", errors);
    this.requireUnique(value.stoneCut, "stoneCut.id", errors);
    this.requireUnique(value.stoneQuality, "stoneQuality.id", errors);
    this.requireUnique(value.stoneColor, "stoneColor.id", errors);
    this.requireUnique(value.surface, "surface.id", errors);

    this.checkMinMax(value.ringWidth, "ringWidth", errors);
    this.checkMinMax(value.ringHeight, "ringHeight", errors);
    this.checkMinMax(value.ringSize, "ringSize", errors);
    value.profile?.forEach((profile, index) => {
      this.checkMinMax(profile.rw, `profile[${index}].rw`, errors);
      this.checkMinMax(profile.rh, `profile[${index}].rh`, errors);
      this.checkMinMax(profile.rs, `profile[${index}].rs`, errors);
    });

    const materialIds = new Set((value.material ?? []).map(item => Number(item.id)));
    value.materialExclude?.forEach((exclude, index) => {
      if (!materialIds.has(Number(exclude.id_a)) || !materialIds.has(Number(exclude.id_b))) {
        errors.push(`materialExclude[${index}] referenziert unbekannte Material-ID.`);
      }
    });

    if (!Array.isArray(value.stoneType) || value.stoneType.length === 0) {
      errors.push("Mindestens eine Steinart ist erforderlich.");
    }
    if (!Array.isArray(value.stoneCut) || value.stoneCut.length === 0) {
      errors.push("Mindestens eine Schliffform ist erforderlich.");
    }

    const json = JSON.stringify(value);
    if (/Ã|Â|â€|â€“|â†/.test(json)) {
      warnings.push("Möglicher Mojibake in AppData erkannt. Bitte manuell prüfen, nicht automatisch korrigieren.");
    }

    return this.toValidationResult([
      ...errors.map(message => ({severity: "error" as const, path: "$", message})),
      ...warnings.map(message => ({severity: "warning" as const, path: "$", message})),
      ...this.validateMilgrainModes(value),
      ...this.validateMilgrainSizes(value),
      ...this.validateProfileMilgrainRules(value),
      ...this.validateFeatureRules(value),
      ...this.validateStoneTaxonomy(value),
      ...this.validateRingViews(value),
    ]);
  }

  private validateRingViews(appData: iAppData): AdminValidationIssue[]
  {
    const issues: AdminValidationIssue[] = [];
    const layoutIds = new Set<string>();
    this.validateUniqueRecordIds(this.recordArray(appData, "layoutPresets"), "layoutPresets", issues);
    this.recordArray(appData, "layoutPresets").forEach((layout, index) => {
      const id = String(layout["id"] ?? "");
      if (id) layoutIds.add(id);
      const transforms = layout["ringTransforms"] && typeof layout["ringTransforms"] === "object" && !Array.isArray(layout["ringTransforms"])
        ? layout["ringTransforms"] as JsonRecord
        : null;
      if (!transforms || (!transforms["ring0"] && !transforms["ring1"])) {
        issues.push({severity: "error", path: `layoutPresets[${index}].ringTransforms`, message: "Mindestens ein Ring-Transform ist erforderlich."});
      }
    });
    this.validateUniqueRecordIds(this.recordArray(appData, "viewPresets"), "viewPresets", issues);
    this.recordArray(appData, "viewPresets").forEach((view, index) => {
      const layoutId = view["layoutId"];
      if (layoutId !== undefined && layoutId !== null && String(layoutId).trim() && !layoutIds.has(String(layoutId))) {
        issues.push({severity: "error", path: `viewPresets[${index}].layoutId`, message: "View-Preset referenziert ein nicht vorhandenes Layout."});
      }
    });
    return issues;
  }

  private validateStoneTaxonomy(appData: iAppData): AdminValidationIssue[]
  {
    const issues: AdminValidationIssue[] = [];
    const stoneTypeIds = new Set(this.recordArray(appData, "stoneType").map(item => String(item["id"])));
    const stoneCutIds = new Set(this.recordArray(appData, "stoneCut").map(item => String(item["id"])));
    const qualityRecords = this.recordArray(appData, "stoneQuality");
    const qualityIds = new Set(qualityRecords.map(item => String(item["id"])));
    const colorRecords = this.recordArray(appData, "stoneColor");
    const colorIds = new Set(colorRecords.map(item => String(item["id"])));

    this.validateUniqueRecordIds(this.recordArray(appData, "stoneType"), "stoneType", issues);
    this.validateUniqueRecordIds(this.recordArray(appData, "stoneCut"), "stoneCut", issues);
    this.validateUniqueRecordIds(qualityRecords, "stoneQuality", issues);
    this.validateUniqueRecordIds(colorRecords, "stoneColor", issues);
    this.validateUniqueRecordIds(this.recordArray(appData, "stoneAvailabilityRules"), "stoneAvailabilityRules", issues);

    this.recordArray(appData, "stoneType").forEach((type, index) => {
      const defaultQuality = type["defaultQuality"];
      const defaultColor = type["defaultColor"];
      if (defaultQuality !== undefined && defaultQuality !== null && !qualityIds.has(String(defaultQuality))) {
        issues.push({severity: "error", path: `stoneType[${index}].defaultQuality`, message: "referenziert unbekannte Qualitaet."});
      }
      if (defaultColor !== undefined && defaultColor !== null && !colorIds.has(String(defaultColor))) {
        issues.push({severity: "error", path: `stoneType[${index}].defaultColor`, message: "referenziert unbekannte Farbe."});
      }
    });

    qualityRecords.forEach((quality, index) => {
      const stoneType = String(quality["stoneType"] ?? "");
      if (stoneType && !stoneTypeIds.has(stoneType)) {
        issues.push({severity: "error", path: `stoneQuality[${index}].stoneType`, message: "referenziert unbekannte Steinart."});
      }
    });

    colorRecords.forEach((color, index) => {
      if (!isStoneColorHex(color["hex"])) {
        issues.push({severity: "warning", path: `stoneColor[${index}].hex`, message: "Hexwert sollte im Format #RRGGBB vorliegen; Runtime verwendet sonst den Fallback."});
      }
      if (color["enabled"] !== undefined && typeof color["enabled"] !== "boolean") {
        issues.push({severity: "warning", path: `stoneColor[${index}].enabled`, message: "enabled sollte boolean sein."});
      }
    });

    this.recordArray(appData, "stoneAvailabilityRules").forEach((rule, index) => {
      const path = `stoneAvailabilityRules[${index}]`;
      this.validateReferenceList(rule["stoneTypes"], stoneTypeIds, `${path}.stoneTypes`, "unbekannte Steinart", issues);
      this.validateReferenceList(rule["stoneCuts"], stoneCutIds, `${path}.stoneCuts`, "unbekannte Schliffform", issues);
      this.validateReferenceList(rule["qualities"], qualityIds, `${path}.qualities`, "unbekannte Qualitaet", issues);
      this.validateReferenceList(rule["colors"], colorIds, `${path}.colors`, "unbekannte Farbe", issues);
      const sizeMin = Number(rule["sizeMin"]);
      const sizeMax = Number(rule["sizeMax"]);
      const sizeStep = Number(rule["sizeStep"]);
      if (rule["sizes"] !== undefined && (!Array.isArray(rule["sizes"]) || !rule["sizes"].every(size => Number(size) > 0))) {
        issues.push({severity: "error", path: `${path}.sizes`, message: "sizes muss positive Zahlen enthalten."});
      }
      if (rule["sizeMin"] !== undefined && rule["sizeMax"] !== undefined && (!Number.isFinite(sizeMin) || !Number.isFinite(sizeMax) || sizeMin > sizeMax)) {
        issues.push({severity: "error", path: `${path}.sizeMin`, message: "sizeMin muss <= sizeMax sein."});
      }
      if (rule["sizeStep"] !== undefined && (!Number.isFinite(sizeStep) || sizeStep <= 0)) {
        issues.push({severity: "error", path: `${path}.sizeStep`, message: "sizeStep muss > 0 sein."});
      }
    });

    return issues;
  }

  private validateMilgrainModes(appData: iAppData): AdminValidationIssue[]
  {
    return [];
  }

  private validateMilgrainSizes(appData: iAppData): AdminValidationIssue[]
  {
    const issues: AdminValidationIssue[] = [];
    const sizes = this.recordArray(appData, "pearlingSize");
    this.validateUniqueRecordIds(sizes, "pearlingSize", issues);
    sizes.forEach((size, index) => {
      const path = `pearlingSize[${index}]`;
      const diameter = Number(size["diameter"]);
      const rowClearance = Number(size["rowClearance"]);
      const minRowClearance = Number(size["minRowClearance"]);
      const maxRowClearance = Number(size["maxRowClearance"]);
      const channelEdgeClearance = Number(size["channelEdgeClearance"]);
      const channelWidth = Number(size["channelWidth"]);
      const spacingMode = String(size["spacingMode"] ?? "auto-fit");
      const pitch = Number(size["pitch"]);
      const beadCount = Number(size["beadCount"]);
      if (size["id"] === undefined || size["id"] === null || String(size["id"]).trim() === "") {
        issues.push({severity: "error", path: `${path}.id`, message: "Perlengroesse benoetigt eine ID."});
      }
      if (![500, 1000].includes(Number(size["id"]))) {
        issues.push({severity: "error", path: `${path}.id`, message: "Nur 500 und 1000 sind als Perlengroessen zulaessig."});
      }
      if (!Number.isFinite(diameter) || diameter <= 0) {
        issues.push({severity: "error", path: `${path}.diameter`, message: "diameter muss > 0 sein."});
      }
      if (!Number.isFinite(rowClearance) || rowClearance < 0) {
        issues.push({severity: "error", path: `${path}.rowClearance`, message: "rowClearance muss >= 0 sein."});
      }
      if (size["minRowClearance"] !== undefined && (!Number.isFinite(minRowClearance) || minRowClearance < 0)) {
        issues.push({severity: "error", path: `${path}.minRowClearance`, message: "minRowClearance muss >= 0 sein."});
      }
      if (size["maxRowClearance"] !== undefined && (!Number.isFinite(maxRowClearance) || maxRowClearance < 0)) {
        issues.push({severity: "error", path: `${path}.maxRowClearance`, message: "maxRowClearance muss >= 0 sein."});
      }
      if (Number.isFinite(minRowClearance) && Number.isFinite(maxRowClearance) && maxRowClearance < minRowClearance) {
        issues.push({severity: "error", path: `${path}.maxRowClearance`, message: "maxRowClearance muss >= minRowClearance sein."});
      }
      if (!Number.isFinite(channelEdgeClearance) || channelEdgeClearance < 0) {
        issues.push({severity: "error", path: `${path}.channelEdgeClearance`, message: "channelEdgeClearance muss >= 0 sein."});
      }
      if (!Number.isFinite(channelWidth) || channelWidth < diameter) {
        issues.push({severity: "error", path: `${path}.channelWidth`, message: "channelWidth muss >= diameter sein."});
      }
      if (!this.pearlingSpacingModes.includes(spacingMode as any)) {
        issues.push({severity: "error", path: `${path}.spacingMode`, message: "spacingMode ist unbekannt."});
      }
      if (spacingMode === "exact-pitch" && (!Number.isFinite(pitch) || pitch <= 0)) {
        issues.push({severity: "error", path: `${path}.pitch`, message: "pitch muss fuer exact-pitch > 0 sein."});
      }
      if (spacingMode === "fixed-count" && (!Number.isInteger(beadCount) || beadCount <= 0)) {
        issues.push({severity: "error", path: `${path}.beadCount`, message: "beadCount muss fuer fixed-count eine Ganzzahl > 0 sein."});
      }
    });
    return issues;
  }

  private validateProfileMilgrainRules(appData: iAppData): AdminValidationIssue[]
  {
    const issues: AdminValidationIssue[] = [];
    const sizeIds = new Set(this.recordArray(appData, "pearlingSize").map(size => String(size["id"])));
    this.recordArray(appData, "profile").forEach((profile, index) => {
      const profileName = String(profile["name"] ?? index);
      this.validateProfilePearlingRule(profile["milgrain"], sizeIds, `profile[${profileName}].milgrain`, issues);
      this.validateProfilePearlingRule(profile["pearling"], sizeIds, `profile[${profileName}].pearling`, issues);
    });
    return issues;
  }

  private validateProfilePearlingRule(value: unknown, sizeIds: Set<string>, path: string, issues: AdminValidationIssue[]): void
  {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }
    const rule = value as JsonRecord;
    this.validateReferenceList(rule["allowedSizes"], sizeIds, `${path}.allowedSizes`, "unbekannte Groesse", issues);
    this.requireNonNegative(rule["minRingWidth"], `${path}.minRingWidth`, issues);
    this.requireNonNegative(rule["minEdgeDistance"], `${path}.minEdgeDistance`, issues);
    this.requireNonNegative(rule["minFeatureDistance"], `${path}.minFeatureDistance`, issues);
    this.requireNonNegative(rule["stopBeforeStoneByBeads"], `${path}.stopBeforeStoneByBeads`, issues);
    const minStoneDistanceMode = rule["minStoneDistanceMode"];
    if (minStoneDistanceMode !== undefined && !["beadDiameter", "fixed"].includes(String(minStoneDistanceMode))) {
      issues.push({severity: "error", path: `${path}.minStoneDistanceMode`, message: "minStoneDistanceMode muss beadDiameter oder fixed sein."});
    }
    const conflictAction = rule["conflictAction"];
    if (conflictAction !== undefined && !["block", "warn", "autoAdjust"].includes(String(conflictAction))) {
      issues.push({severity: "error", path: `${path}.conflictAction`, message: "conflictAction muss block, warn oder autoAdjust sein."});
    }
  }

  private validateFeatureRules(appData: iAppData): AdminValidationIssue[]
  {
    const issues: AdminValidationIssue[] = [];
    const featureRules = this.recordValue(appData, "featureRules");
    if (!featureRules) {
      return issues;
    }
    const sizeIds = new Set(this.recordArray(appData, "pearlingSize").map(size => String(size["id"])));
    const global = featureRules["global"];
    if (global && typeof global === "object" && !Array.isArray(global)) {
      const globalRules = global as JsonRecord;
      if (globalRules["unit"] !== undefined && globalRules["unit"] !== "micrometer") {
        issues.push({severity: "error", path: "featureRules.global.unit", message: "unit muss micrometer sein."});
      }
      if (globalRules["defaultAction"] !== undefined && !["block", "warn", "autoAdjust"].includes(String(globalRules["defaultAction"]))) {
        issues.push({severity: "error", path: "featureRules.global.defaultAction", message: "defaultAction muss block, warn oder autoAdjust sein."});
      }
      this.requireNonNegative(globalRules["minFeatureDistance"], "featureRules.global.minFeatureDistance", issues);
      this.requireNonNegative(globalRules["minMilgrainToRingEdge"], "featureRules.global.minMilgrainToRingEdge", issues);
    }

    const featureTypes = new Set(["materialGap", "freeGap", "step", "stone", "milgrain"]);
    const combinations = featureRules["combinations"];
    if (combinations !== undefined && !Array.isArray(combinations)) {
      issues.push({severity: "error", path: "featureRules.combinations", message: "combinations muss eine Liste sein."});
    }
    (Array.isArray(combinations) ? combinations : []).forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        issues.push({severity: "error", path: `featureRules.combinations[${index}]`, message: "Regel muss ein Objekt sein."});
        return;
      }
      const rule = entry as JsonRecord;
      ["a", "b"].forEach(field => {
        if (!featureTypes.has(String(rule[field]))) {
          issues.push({severity: "error", path: `featureRules.combinations[${index}].${field}`, message: "Feature-Typ ist unbekannt."});
        }
      });
      this.requireNonNegative(rule["minDistance"], `featureRules.combinations[${index}].minDistance`, issues);
      if (rule["action"] !== undefined && !["block", "warn", "autoAdjust"].includes(String(rule["action"]))) {
        issues.push({severity: "error", path: `featureRules.combinations[${index}].action`, message: "action muss block, warn oder autoAdjust sein."});
      }
    });
    this.validateFeaturePearlingRule(featureRules["gapPearling"], sizeIds, "featureRules.gapPearling", issues);
    this.validateFeaturePearlingRule(featureRules["stepPearling"], sizeIds, "featureRules.stepPearling", issues);
    return issues;
  }

  private validateFeaturePearlingRule(value: unknown, sizeIds: Set<string>, path: string, issues: AdminValidationIssue[]): void
  {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }
    this.validateReferenceList((value as JsonRecord)["allowedSizes"], sizeIds, `${path}.allowedSizes`, "unbekannte Groesse", issues);
  }

  private toValidationResult(issues: AdminValidationIssue[]): ValidationResult
  {
    return {
      errors: issues.filter(issue => issue.severity === "error").map(issue => `${issue.path}: ${issue.message}`),
      warnings: issues.filter(issue => issue.severity === "warning").map(issue => `${issue.path}: ${issue.message}`),
      issues,
    };
  }

  private requireUnique(items: unknown[] | undefined, field: string, errors: string[]): void
  {
    const seen = new Set<string>();
    (items ?? []).forEach((item, index) => {
      const id = String((item as Record<string, unknown>)?.[field.split(".").pop() ?? "id"]);
      if (seen.has(id)) {
        errors.push(`${field}: doppelter Wert ${id} bei Index ${index}.`);
      }
      seen.add(id);
    });
  }

  private checkMinMax(value: {min: number; max: number; step?: number} | undefined, path: string, errors: string[]): void
  {
    if (!value) {
      return;
    }
    if (Number(value.min) > Number(value.max)) {
      errors.push(`${path}: min ist größer als max.`);
    }
    if (value.step !== undefined && Number(value.step) <= 0) {
      errors.push(`${path}: Schrittweite muss größer 0 sein.`);
    }
  }

  private getRecordArray(path: string): JsonRecord[]
  {
    const value = this.getPath(this.working, path);
    return Array.isArray(value) ? value.filter(item => item && typeof item === "object" && !Array.isArray(item)) as JsonRecord[] : [];
  }

  private recordArray(source: unknown, path: string): JsonRecord[]
  {
    const value = this.getPath(source, path);
    return Array.isArray(value) ? value.filter(item => item && typeof item === "object" && !Array.isArray(item)) as JsonRecord[] : [];
  }

  private recordValue(source: unknown, path: string): JsonRecord | null
  {
    const value = this.getPath(source, path);
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
  }

  private validateUniqueRecordIds(items: JsonRecord[], path: string, issues: AdminValidationIssue[]): void
  {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const id = String(item["id"] ?? "");
      if (!id) {
        return;
      }
      if (seen.has(id)) {
        issues.push({severity: "error", path: `${path}[${index}].id`, message: `doppelte ID ${id}.`});
      }
      seen.add(id);
    });
  }

  private validateReferenceList(value: unknown, knownIds: Set<string>, path: string, label: string, issues: AdminValidationIssue[]): void
  {
    if (value === undefined) {
      return;
    }
    if (!Array.isArray(value)) {
      issues.push({severity: "error", path, message: "muss eine Liste sein."});
      return;
    }
    value.forEach(id => {
      if (!knownIds.has(String(id))) {
        issues.push({severity: "error", path, message: `referenziert ${label} ${id}.`});
      }
    });
  }

  private requireNonNegative(value: unknown, path: string, issues: AdminValidationIssue[]): void
  {
    if (value === undefined) {
      return;
    }
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
      issues.push({severity: "error", path, message: "muss >= 0 sein."});
    }
  }

  private describeAppDataKey(key: string, value: unknown): string
  {
    if (value === undefined || value === null) {
      return "fehlt";
    }

    if (Array.isArray(value)) {
      return String(value.length);
    }

    const expectedArrays = new Set([
      "profile",
      "material",
      "surface",
      "gapMode",
      "stepMode",
      "pearlingSize",
      "ringModes",
      "materialExclude",
      "stoneMode",
      "stoneType",
      "stoneQuality",
      "stoneColor",
      "stoneCut",
      "stoneAvailabilityRules",
      "stoneDistribution",
      "stonePosition",
      "engagementHeadLibrary",
    ]);

    if (typeof value !== "object") {
      return expectedArrays.has(key) ? `ungueltiger Typ (${typeof value})` : String(value);
    }

    const record = value as JsonRecord;
    if (key === "featureRules") {
      const combinations = Array.isArray(record["combinations"]) ? record["combinations"].length : 0;
      return `${record["global"] && typeof record["global"] === "object" ? "global" : "global fehlt"} + ${combinations} Kombination(en)`;
    }

    if (key === "engraving") {
      return this.describeEngraving(record);
    }

    if (this.isRangeRecord(record)) {
      return this.describeRangeRecord(key, record);
    }

    return expectedArrays.has(key) ? "ungueltiger Typ (object)" : "Objekt";
  }

  private describeRangeRecord(key: string, record: JsonRecord): string
  {
    const min = Number(record["min"]);
    const max = Number(record["max"]);
    const step = Number(record["step"]);
    if (![min, max, step].every(Number.isFinite)) {
      return "Objekt";
    }

    if (key === "ringWidth" || key === "ringHeight") {
      return `${this.formatMmCompact(min)}-${this.formatMmCompact(max)} / ${this.formatMmCompact(step)}`;
    }

    if (key === "ringSize") {
      const divisor = Math.max(Math.abs(min), Math.abs(max), Math.abs(step)) > 1000 ? 1000 : 1;
      return `${this.formatNumber(min / divisor)}-${this.formatNumber(max / divisor)} / ${this.formatNumber(step / divisor)}`;
    }

    return `${this.formatNumber(min)}-${this.formatNumber(max)} / ${this.formatNumber(step)}`;
  }

  private describeEngraving(record: JsonRecord): string
  {
    const enabled = record["enabled"] === false || record["active"] === false ? "inaktiv" : "aktiv";
    const maxLength = Number(record["maxLength"] ?? record["maxChars"] ?? record["max"]);
    const symbolValues = record["symbols"] ?? record["symbol"] ?? record["icons"];
    const symbolCount = Array.isArray(symbolValues) ? symbolValues.length : undefined;
    const parts = [enabled];

    if (Number.isFinite(maxLength) && maxLength > 0) {
      parts.push(`max ${maxLength} Zeichen`);
    }
    if (symbolCount !== undefined) {
      parts.push(`${symbolCount} Symbole`);
    }

    return parts.join(" / ");
  }

  private isRangeRecord(record: JsonRecord): boolean
  {
    return ["min", "max", "step"].every(key => record[key] !== undefined);
  }

  private formatMmCompact(value: number): string
  {
    return `${this.formatNumber(value / 1000)} mm`;
  }

  private formatNumber(value: number): string
  {
    return new Intl.NumberFormat("de-DE", {minimumFractionDigits: 0, maximumFractionDigits: 3}).format(value);
  }

  private describeCollectionState(path: string): string
  {
    const value = this.getPath(this.working, path);
    if (Array.isArray(value)) {
      return `${value.length} Eintrag(e)`;
    }
    if (value === undefined) {
      return "fehlt";
    }
    if (value && typeof value === "object") {
      return "ungueltiger Typ (object)";
    }
    return "ungültiger Typ";
  }

  private ensureFeatureRulesDefaults(): void
  {
    const current = this.getPath(this.working, "featureRules");
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      this.setPath(this.working, "featureRules", {
        global: {
          unit: "micrometer",
          defaultAction: "block",
          autoAdjustAllowed: false,
          minFeatureDistance: 300,
          minMilgrainToRingEdge: 500,
          logViolations: false,
        },
        gapPearling: {
          enabled: true,
          allowedGapModes: [1, 2, 3],
          allowedSizes: [500, 1000],
          minDistanceToStone: 500,
          minDistanceToOtherGap: 300,
          snapTolerance: 200,
        },
        stepPearling: {
          enabled: true,
          allowedSides: ["left", "right", "both"],
          allowedSizes: [500, 1000],
          singleRowOnly: true,
        },
        combinations: [],
      });
      return;
    }

    const rules = current as JsonRecord;
    if (!rules["global"] || typeof rules["global"] !== "object" || Array.isArray(rules["global"])) {
      rules["global"] = {
        unit: "micrometer",
        defaultAction: "block",
        autoAdjustAllowed: false,
        minFeatureDistance: 300,
        minMilgrainToRingEdge: 500,
        logViolations: false,
      };
    }
    if (!Array.isArray(rules["combinations"])) {
      rules["combinations"] = [];
    }
    if (!rules["gapPearling"] || typeof rules["gapPearling"] !== "object" || Array.isArray(rules["gapPearling"])) {
      rules["gapPearling"] = {
        enabled: true,
        allowedGapModes: [1, 2, 3],
        allowedSizes: [500, 1000],
        minDistanceToStone: 500,
        minDistanceToOtherGap: 300,
        snapTolerance: 200,
      };
    }
    if (!rules["stepPearling"] || typeof rules["stepPearling"] !== "object" || Array.isArray(rules["stepPearling"])) {
      rules["stepPearling"] = {
        enabled: true,
        allowedSides: ["left", "right", "both"],
        allowedSizes: [500, 1000],
        singleRowOnly: true,
      };
    }
  }

  private normalizeId(id: number | string): number | string
  {
    return typeof id === "number" ? id : (/^-?\d+(\.\d+)?$/.test(id) ? Number(id) : id);
  }

  private getMilgrainModeIds(): Array<number | string>
  {
    return this.getMilgrainModeOptions().map(option => this.normalizeId(option.id));
  }

  private getMilgrainSizeIds(): Array<number | string>
  {
    return this.getMilgrainSizeOptions().map(option => this.normalizeId(option.id));
  }

  private defaultProfileMinRingWidth(profile: JsonRecord): number
  {
    const profileRange = profile["rw"];
    if (profileRange && typeof profileRange === "object" && !Array.isArray(profileRange)) {
      const value = Number((profileRange as JsonRecord)["min"]);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    const globalMin = Number(this.getPath(this.working, "ringWidth.min"));
    return Number.isFinite(globalMin) && globalMin > 0 ? globalMin : 3000;
  }

  private defaultProfileEdgeDistance(profile: JsonRecord): number
  {
    const value = Number(profile["sideGapDistance"]);
    return Number.isFinite(value) && value >= 0 ? value : 500;
  }

  private defaultProfileFeatureDistance(profile: JsonRecord): number
  {
    const value = Number(profile["gapGapDistance"]);
    return Number.isFinite(value) && value >= 0 ? value : 300;
  }

  private versionHash(version: AppDataVersion | null | undefined): string
  {
    return String(version?.snapshot_sha256 ?? version?.snapshot_hash ?? "");
  }

  private ensureActiveVersionResolved(): void
  {
    if (this.activeVersion?.id) {
      return;
    }

    const resolved = this.findVersionByHash(this.activeHash);
    if (resolved) {
      this.activeVersion = resolved;
    }
  }

  private resolveCurrentBaseVersion(): AppDataVersion | null
  {
    if (this.activeVersion?.id) {
      return this.activeVersion;
    }

    const byHash = this.findVersionByHash(this.activeHash);
    if (byHash) {
      this.activeVersion = byHash;
      return byHash;
    }

    const byLabel = this.versions.find(version => version.version_label === this.app?.state.appDataVersionLabel);
    if (byLabel) {
      this.activeVersion = byLabel;
      return byLabel;
    }

    return null;
  }

  private findVersionByHash(hash: string): AppDataVersion | null
  {
    if (!hash) {
      return null;
    }

    return this.versions.find(version => this.versionHash(version) === hash) ?? null;
  }

  private requireActiveVersionIdForAction(): number | null
  {
    const version = this.resolveCurrentBaseVersion();
    if (!version?.id) {
      this.setStatus("Keine gültige AppData-Version geladen. Bitte Version neu laden und Aktion erneut ausführen.", "error");
      return null;
    }

    return version.id;
  }

  private createDiff(before: unknown, after: unknown, path = ""): DiffEntry[]
  {
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return [];
    }
    if (!before || !after || typeof before !== "object" || typeof after !== "object") {
      return [{path: path || "$", before, after, impact: this.diffImpact(path)}];
    }

    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
    return Array.from(keys).flatMap(key => this.createDiff(beforeRecord[key], afterRecord[key], path ? `${path}.${key}` : key));
  }

  private diffImpact(path: string): "live" | "reload" | "data"
  {
    if (!path.startsWith("webglSettings.")) {
      return "data";
    }
    return /maxTextureSize|tesselation|ringRotation|ringOffset|refSampler_image/.test(path) ? "reload" : "live";
  }

  private applyWebglLive(silentWhenUnavailable = false): void
  {
    this.applyWorkingToRuntime();
    this.normalizeRingDataForCurrentAppData();
    const webgl = (window as any).__oneRingconfWebgl;
    const settings = this.working?.webglSettings;
    if (!webgl || !settings) {
      if (silentWhenUnavailable) {
        return;
      }
      this.setStatus("3D-Laufzeit ist noch nicht bereit.", "warning");
      return;
    }

    if (webgl.scene?.imageProcessingConfiguration) {
      webgl.scene.imageProcessingConfiguration.exposure = settings.environmentPreset.scene_exposure;
      webgl.scene.imageProcessingConfiguration.contrast = settings.environmentPreset.scene_contrast;
    }
    if (webgl.envTexture?.setReflectionTextureMatrix) {
      webgl.envTexture.setReflectionTextureMatrix(Matrix.RotationYawPitchRoll(
        settings.environmentPreset.envTexture_yaw * 2 * Math.PI,
        settings.environmentPreset.envTexture_pitch * 2 * Math.PI,
        settings.environmentPreset.envTexture_roll * 2 * Math.PI
      ));
    }
    if (webgl.camera) {
      webgl.camera.alpha = settings.camera[0];
      webgl.camera.beta = settings.camera[1];
      webgl.camera.radius = settings.camera[2];
    }
    if (typeof webgl.renderFrame === "function") {
      webgl.renderFrame(settings.forceFrames ?? 1);
    }

    this.setStatus(this.requiresReload ? "Live angewendet; einzelne Werte benötigen nach dem Speichern ein Neuladen." : "Live angewendet.", this.requiresReload ? "warning" : "success");
  }

  private applyWorkingToRuntime(): void
  {
    if (this.working && this.app) {
      const next = this.clone(this.working);
      normalizePearlingAppData(next);
      normalizeStoneTaxonomyAppData(next);
      normalizeEngravingAppData(next);
      normalizeRingViewAppData(next);
      this.applyAppDataToRuntime(next);
    }
  }

  private applyAppDataToRuntime(appData: iAppData, meta: {versionLabel?: string; hash?: string} = {}): void
  {
    if (!this.app) {
      return;
    }

    this.app.data = this.clone(appData);
    if (meta.versionLabel) {
      this.app.state.appDataVersionLabel = meta.versionLabel;
    }
    if (meta.hash) {
      this.app.state.appDataHash = meta.hash;
    }
  }

  private normalizeRingDataForCurrentAppData(): void
  {
    if (!this.app?.data) {
      return;
    }

    const pearlingAvailable = hasPearlingDefinitions(this.app.data);
    const sizes = pearlingAvailable ? normalizePearlingSizeList((this.app.data as unknown as JsonRecord)["pearlingSize"]) : [];
    const validSizeIds = new Set(sizes.map(size => Number(size.id)));
    const fallbackSize = sizes.find(size => Number(size.id) === 500)?.id ?? sizes[0]?.id ?? 500;
    const featureRules = (this.app.data as unknown as JsonRecord)["featureRules"];
    const gapRule = featureRules && typeof featureRules === "object" && !Array.isArray(featureRules)
      ? (featureRules as JsonRecord)["gapPearling"]
      : null;
    const stepRule = featureRules && typeof featureRules === "object" && !Array.isArray(featureRules)
      ? (featureRules as JsonRecord)["stepPearling"]
      : null;

    RingData.list.forEach(ringData => {
      const mutable = ringData as unknown as JsonRecord;
      delete mutable["_milgrainMode"];
      delete mutable["_milgrainSize"];
      delete mutable["milgrainMode"];
      delete mutable["milgrainSize"];

      if (!pearlingAvailable || sizes.length === 0) {
        ringData.gapPearlingEnabled = false;
        ringData.stepPearlingEnabled = false;
        return;
      }

      if (!validSizeIds.has(Number(ringData.gapPearlingSize))) {
        ringData.gapPearlingSize = Number(fallbackSize);
      }
      if (!validSizeIds.has(Number(ringData.stepPearlingSize))) {
        ringData.stepPearlingSize = Number(fallbackSize);
      }

      if (!gapRule || typeof gapRule !== "object" || Array.isArray(gapRule) || (gapRule as JsonRecord)["enabled"] === false) {
        ringData.gapPearlingEnabled = false;
      }
      if (!stepRule || typeof stepRule !== "object" || Array.isArray(stepRule) || (stepRule as JsonRecord)["enabled"] === false) {
        ringData.stepPearlingEnabled = false;
      }
    });

    if (!pearlingAvailable) {
      console.info("[PearlingChannel]", {
        pearlingAvailable: false,
        disabledReason: "AppData has no pearling definitions",
      });
    }
  }

  onLayoutObjFileSelected(event: Event): void
  {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".obj")) {
      this.layoutObjResult = {ok: false, errors: ["Bitte eine OBJ-Datei auswählen."], warnings: []};
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.layoutObjResult = {ok: false, errors: ["Die OBJ-Datei ist größer als 5 MB."], warnings: []};
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.layoutObjResult = parseObjMarkerLayout(String(reader.result || ""), this.layoutObjScale);
      this.setStatus(
        this.layoutObjResult.ok ? "Marker-OBJ wurde analysiert." : "Marker-OBJ enthält Validierungsfehler.",
        this.layoutObjResult.ok ? "success" : "warning"
      );
    };
    reader.onerror = () => {
      this.layoutObjResult = {ok: false, errors: ["Die OBJ-Datei konnte nicht gelesen werden."], warnings: []};
    };
    reader.readAsText(file);
  }

  previewLayoutObjResult(): void
  {
    if (!this.layoutObjResult?.ok || !this.layoutObjResult.layout) return;
    const webgl = WebglComponent.WEBGL ?? (window as any).__oneRingconfWebgl;
    void webgl?.ringViewService?.previewLayoutTransforms(this.layoutObjResult.layout);
  }

  resetLayoutObjPreview(): void
  {
    const webgl = WebglComponent.WEBGL ?? (window as any).__oneRingconfWebgl;
    void webgl?.ringViewService?.resetPresentation();
  }

  saveLayoutObjResultToWorking(): void
  {
    if (!this.working || !this.layoutObjResult?.ok || !this.layoutObjResult.layout) return;
    const preset = layoutPresetFromParsed(this.layoutObjPresetId, this.layoutObjPresetLabel, this.layoutObjResult.layout);
    const layouts = Array.isArray(this.working.layoutPresets) ? [...this.working.layoutPresets] : [];
    const index = layouts.findIndex(item => item.id === preset.id);
    if (index >= 0) layouts[index] = preset;
    else layouts.push(preset);
    this.working.layoutPresets = layouts;
    normalizeEngravingAppData(this.working);
    normalizeRingViewAppData(this.working);
    this.markChanged(false);
    this.setStatus("Layout wurde in den aktuellen AppData-Draft übernommen.", "success");
  }

  private forceBabylonRerender(): void
  {
    cRing.list.forEach(ring => {
      ring.milgrain?.dispose();
      ring.flags &= ~eRingFlags.IsValid;
      ring.ringData.isDirty = true;
    });

    const webgl = WebglComponent.WEBGL ?? (window as any).__oneRingconfWebgl;
    if (webgl?.renderFrame) {
      webgl.renderFrame(this.app?.data?.webglSettings?.forceFrames ?? 15);
    }
  }

  private hydrateFromRuntime(): void
  {
    this.build = this.localBuildInfo();
    if (!this.app?.data) {
      this.setStatus("Development-Admin lädt...", "idle");
      return;
    }

    this.activeHash = this.app.state.appDataHash || this.activeHash;
    this.baseline = this.clone(this.app.data);
    this.working = this.clone(this.app.data);
    this.ensureActiveVersionResolved();
    this.refreshMilgrainEditorOptions();
    this.recalculate();
    this.setStatus("Runtime-AppData übernommen, Server-Metadaten werden geladen...", "idle");
  }

  private setLocalSnapshot(): void
  {
    if (!this.app?.data) {
      return;
    }
    this.baseline = this.clone(this.app.data);
    this.working = this.clone(this.app.data);
    this.recalculate();
  }

  private applyVersionLabel(): void
  {
    if (this.app) {
      const label = this.activeVersion?.version_label || this.app.state.appDataVersionLabel || "unversioned";
      this.app.state.appDataVersionLabel = label;
      this.app.state.appDataHash = this.activeHash || this.app.state.appDataHash || "";
    }
  }

  private setStatus(message: string, type: StatusType): void
  {
    this.statusMessage = message;
    this.statusType = type;
  }

  private localBuildInfo(): BuildInfo
  {
    const buildLabel = this.app?.state.build || this.build.version_label || this.build.build_key || "2.7.6";
    return {
      build_key: buildLabel,
      version_label: buildLabel,
      angular_version: "22.0.5",
      babylon_version: "5.25.0",
    };
  }

  private clone<T>(value: T): T
  {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private getPath(source: unknown, path: string): unknown
  {
    return path.split(".").reduce<unknown>((current, part) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return (current as Record<string, unknown>)[part];
    }, source);
  }

  private setPath(target: unknown, path: string, value: unknown): void
  {
    if (!target || typeof target !== "object") {
      return;
    }
    const parts = path.split(".");
    let current = target as Record<string, unknown>;
    for (let index = 0; index < parts.length - 1; index++) {
      const part = parts[index];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
}
