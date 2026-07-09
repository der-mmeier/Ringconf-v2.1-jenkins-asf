import {CommonModule} from "@angular/common";
import {Component, HostListener, Input} from "@angular/core";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {FormsModule} from "@angular/forms";
import {Matrix} from "@babylonjs/core";
import {iAppData} from "../app.interfaces";
import {AppDataAdminResponse, AppDataAdminService} from "./appdata-admin.service";
import {AdminHelpEntry, APPDATA_ADMIN_HELP} from "./appdata-admin-help";

type StatusType = "idle" | "success" | "warning" | "error";
type AdminAction = "importCurrentBaseline" | "saveVersion" | "setCompatibility" | "approveVersion" | "retireVersion" | "assignTarget" | "rollbackTarget";

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
  imports: [CommonModule, FormsModule],
  templateUrl: "./development-admin.component.html",
  styleUrls: ["./development-admin.component.scss"],
})
export class DevelopmentAdminComponent {
  @Input() app: RingconfAppHost | null = null;

  open = false;
  loading = false;
  dirty = false;
  requiresReload = false;
  statusType: StatusType = "idle";
  statusMessage = "Development-Admin bereit.";
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
    build_key: "2.6.6",
    version_label: "2.6.6",
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

  readonly appDataSections: EditorSection[] = [
    {title: "Profile und Ringmaße", keys: ["profile", "ringWidth", "ringHeight", "ringSize"]},
    {title: "Perlfugen", keys: ["milgrainMode", "milgrainSize"]},
    {title: "Regelwerk", keys: ["featureRules"]},
    {title: "Profil-Regeln", keys: ["profile"]},
    {title: "Ringarten und Ansichten", keys: ["ringModes"]},
    {title: "Materialien und Legierungen", keys: ["material"]},
    {title: "Materialkombinationen", keys: ["materialExclude"]},
    {title: "Oberflächen", keys: ["surface"]},
    {title: "Teilungen, Fugen und Stufen", keys: ["gapMode", "stepMode"]},
    {title: "Steinbesatz", keys: ["stoneMode", "stoneType", "stoneQuality", "stoneDistribution", "stonePosition"]},
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

  constructor(private adminApi: AppDataAdminService, private sanitizer: DomSanitizer)
  {
  }

  @HostListener("document:keydown.escape")
  closeHelpOnEscape(): void
  {
    this.closeHelp();
  }

  async toggle(): Promise<void>
  {
    this.open = !this.open;
    if (this.open && this.working === null) {
      await this.loadBootstrap();
    }
  }

  async loadBootstrap(): Promise<void>
  {
    this.loading = true;
    const response = await this.adminApi.request<BootstrapData>("bootstrap", {
      build: this.localBuildInfo(),
    });
    this.loading = false;

    if (!response.ok || !response.data) {
      this.setStatus(response.error?.message ?? "Admin-Bootstrap fehlgeschlagen.", "error");
      this.setLocalSnapshot();
      return;
    }

    this.build = response.data.build;
    this.activeVersion = response.data.activeVersion;
    this.activeHash = response.data.activeHash;
    this.versions = response.data.versions;
    this.builds = response.data.builds;
    this.compatibilities = response.data.compatibilities;
    this.targets = response.data.targets;
    this.ensureActiveVersionResolved();
    this.baseline = this.clone(response.data.appData);
    this.working = this.clone(response.data.appData);
    this.applyVersionLabel();
    this.recalculate();
    this.setStatus("AppData geladen.", "success");
  }

  getSectionCount(key: string): string
  {
    const value = this.getPath(this.working, key);
    if (Array.isArray(value)) {
      return String(value.length);
    }
    if (value && typeof value === "object") {
      return String(Object.keys(value as Record<string, unknown>).length);
    }
    return value === undefined ? "0" : "1";
  }

  getJsonValue(path: string): string
  {
    return JSON.stringify(this.getPath(this.working, path) ?? null, null, 2);
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
    return this.getRecordArray("milgrainMode");
  }

  getMilgrainModeOptions(): MilgrainOption[]
  {
    return this.getMilgrainModes().map(mode => {
      const id = mode["id"] as number | string;
      const name = String(mode["name"] ?? id);
      return {
        id,
        label: `${name} (${id})`,
      };
    });
  }

  getMilgrainSizes(): JsonRecord[]
  {
    return this.getRecordArray("milgrainSize");
  }

  getMilgrainSizeOptions(): MilgrainOption[]
  {
    return this.getMilgrainSizes().map(size => {
      const id = size["id"] as number | string;
      const diameter = size["diameter"] !== undefined ? this.formatMm(size["diameter"]) : String(size["name"] ?? id);
      const name = size["name"] ? ` - ${String(size["name"])}` : "";
      return {
        id,
        label: `${diameter} (${id})${name}`,
      };
    });
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

  initializeProfileMilgrain(profile: JsonRecord): void
  {
    if (this.getProfileMilgrain(profile)) {
      return;
    }

    const allowedModes = this.getMilgrainModeIds();
    const allowedSizes = this.getMilgrainSizeIds();
    const minRingWidth = this.defaultProfileMinRingWidth(profile);
    const minEdgeDistance = this.defaultProfileEdgeDistance(profile);
    const minFeatureDistance = this.defaultProfileFeatureDistance(profile);

    profile["milgrain"] = {
      enabled: true,
      allowedModes: allowedModes.length ? allowedModes : [0],
      allowedSizes: allowedSizes.length ? allowedSizes : [500],
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
    this.recalculate();
    this.setStatus("Änderungen zurückgesetzt.", "success");
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
        const baseVersion = this.resolveCurrentBaseVersion();
        if (!baseVersion || baseVersion.id <= 0) {
          this.setStatus("Keine gültige Basisversion geladen. Bitte AppData neu laden und dann erneut speichern.", "error");
          return;
        }
        if (!this.activeHash) {
          this.setStatus("Kein gültiger Basis-Hash geladen. Bitte AppData neu laden und dann erneut speichern.", "error");
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

    if (!response.ok) {
      this.setStatus(response.error?.message ?? "Aktion fehlgeschlagen.", "error");
      return;
    }

    this.setStatus("Aktion erfolgreich gespeichert.", "success");
    await this.loadBootstrap();
  }

  async loadVersion(): Promise<void>
  {
    const versionId = Number(this.selectedVersionId);
    if (!Number.isFinite(versionId) || versionId <= 0) {
      return;
    }

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
    this.applyVersionLabel();
    this.applyWorkingToRuntime();
    this.applyWebglLive();
    this.recalculate();
    this.setStatus("Version geladen.", "success");
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
    this.recalculate();
  }

  private recalculate(): void
  {
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
    this.requireUnique(value.stoneQuality, "stoneQuality.id", errors);
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
      errors.push("Mindestens eine aktive Schliffform ist erforderlich.");
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
    ]);
  }

  private validateMilgrainModes(appData: iAppData): AdminValidationIssue[]
  {
    const issues: AdminValidationIssue[] = [];
    const modes = this.recordArray(appData, "milgrainMode");
    this.validateUniqueRecordIds(modes, "milgrainMode", issues);
    modes.forEach((mode, index) => {
      if (mode["id"] === undefined || mode["id"] === null || String(mode["id"]).trim() === "") {
        issues.push({severity: "error", path: `milgrainMode[${index}].id`, message: "Perlfugen-Modus benoetigt eine ID."});
      }
    });
    return issues;
  }

  private validateMilgrainSizes(appData: iAppData): AdminValidationIssue[]
  {
    const issues: AdminValidationIssue[] = [];
    const sizes = this.recordArray(appData, "milgrainSize");
    this.validateUniqueRecordIds(sizes, "milgrainSize", issues);
    sizes.forEach((size, index) => {
      const path = `milgrainSize[${index}]`;
      const diameter = Number(size["diameter"]);
      const radius = Number(size["radius"]);
      const borderLeft = Number(size["borderLeft"]);
      const borderRight = Number(size["borderRight"]);
      const spacing = Number(size["spacing"]);
      if (size["id"] === undefined || size["id"] === null || String(size["id"]).trim() === "") {
        issues.push({severity: "error", path: `${path}.id`, message: "Perlengroesse benoetigt eine ID."});
      }
      if (!Number.isFinite(diameter) || diameter <= 0) {
        issues.push({severity: "error", path: `${path}.diameter`, message: "diameter muss > 0 sein."});
      }
      if (Number.isFinite(radius) && Number.isFinite(diameter) && radius !== diameter / 2) {
        issues.push({severity: "warning", path: `${path}.radius`, message: "radius weicht von diameter / 2 ab."});
      }
      if (!Number.isFinite(borderLeft) || borderLeft < 0) {
        issues.push({severity: "error", path: `${path}.borderLeft`, message: "borderLeft muss >= 0 sein."});
      }
      if (!Number.isFinite(borderRight) || borderRight < 0) {
        issues.push({severity: "error", path: `${path}.borderRight`, message: "borderRight muss >= 0 sein."});
      }
      if (!Number.isFinite(spacing) || spacing < diameter) {
        issues.push({severity: "error", path: `${path}.spacing`, message: "spacing muss >= diameter sein."});
      }
    });
    return issues;
  }

  private validateProfileMilgrainRules(appData: iAppData): AdminValidationIssue[]
  {
    const issues: AdminValidationIssue[] = [];
    const modeIds = new Set(this.recordArray(appData, "milgrainMode").map(mode => String(mode["id"])));
    const sizeIds = new Set(this.recordArray(appData, "milgrainSize").map(size => String(size["id"])));
    this.recordArray(appData, "profile").forEach((profile, index) => {
      const profileName = String(profile["name"] ?? index);
      const milgrain = profile["milgrain"];
      if (!milgrain || typeof milgrain !== "object" || Array.isArray(milgrain)) {
        return;
      }
      const rule = milgrain as JsonRecord;
      this.validateReferenceList(rule["allowedModes"], modeIds, `profile[${profileName}].milgrain.allowedModes`, "unbekannten Modus", issues);
      this.validateReferenceList(rule["allowedSizes"], sizeIds, `profile[${profileName}].milgrain.allowedSizes`, "unbekannte Groesse", issues);
      this.requireNonNegative(rule["minRingWidth"], `profile[${profileName}].milgrain.minRingWidth`, issues);
      this.requireNonNegative(rule["minEdgeDistance"], `profile[${profileName}].milgrain.minEdgeDistance`, issues);
      this.requireNonNegative(rule["minFeatureDistance"], `profile[${profileName}].milgrain.minFeatureDistance`, issues);
      this.requireNonNegative(rule["stopBeforeStoneByBeads"], `profile[${profileName}].milgrain.stopBeforeStoneByBeads`, issues);
      const minStoneDistanceMode = rule["minStoneDistanceMode"];
      if (minStoneDistanceMode !== undefined && !["beadDiameter", "fixed"].includes(String(minStoneDistanceMode))) {
        issues.push({severity: "error", path: `profile[${profileName}].milgrain.minStoneDistanceMode`, message: "minStoneDistanceMode muss beadDiameter oder fixed sein."});
      }
      const conflictAction = rule["conflictAction"];
      if (conflictAction !== undefined && !["block", "warn", "autoAdjust"].includes(String(conflictAction))) {
        issues.push({severity: "error", path: `profile[${profileName}].milgrain.conflictAction`, message: "conflictAction muss block, warn oder autoAdjust sein."});
      }
    });
    return issues;
  }

  private validateFeatureRules(appData: iAppData): AdminValidationIssue[]
  {
    const issues: AdminValidationIssue[] = [];
    const featureRules = this.recordValue(appData, "featureRules");
    if (!featureRules) {
      return issues;
    }
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
    return issues;
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

  private applyWebglLive(): void
  {
    this.applyWorkingToRuntime();
    const webgl = (window as any).__oneRingconfWebgl;
    const settings = this.working?.webglSettings;
    if (!webgl || !settings) {
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
      this.app.data = this.clone(this.working);
    }
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
      this.app.state.appDataVersionLabel = this.activeVersion?.version_label ?? "unversioned";
      this.app.state.appDataHash = this.activeHash;
    }
  }

  private setStatus(message: string, type: StatusType): void
  {
    this.statusMessage = message;
    this.statusType = type;
  }

  private localBuildInfo(): BuildInfo
  {
    return {
      build_key: this.app?.state.build ?? "2.6.6",
      version_label: this.app?.state.build ?? "2.6.6",
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
