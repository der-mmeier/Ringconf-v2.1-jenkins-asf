import {CommonModule} from "@angular/common";
import {Component, Input} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {Matrix} from "@babylonjs/core";
import {iAppData} from "../app.interfaces";
import {AppDataAdminResponse, AppDataAdminService} from "./appdata-admin.service";

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
  snapshot_sha256: string;
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
  validation: ValidationResult = {errors: [], warnings: []};
  diff: DiffEntry[] = [];

  readonly appDataSections: EditorSection[] = [
    {title: "Profile und Ringmaße", keys: ["profile", "ringWidth", "ringHeight", "ringSize"]},
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

  constructor(private adminApi: AppDataAdminService)
  {
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
      case "saveVersion":
        response = await this.adminApi.request("saveVersion", {
          ...credentials,
          changeReason: reason,
          baseVersionId: this.activeVersion?.id ?? null,
          baseVersionLabel: this.activeVersion?.version_label ?? "3.0.216.4",
          baseHash: this.activeHash,
          bump: "revision",
          build: this.localBuildInfo(),
          appData: this.working,
        });
        break;
      case "setCompatibility":
        response = await this.adminApi.request("setCompatibility", {
          ...credentials,
          versionId: this.activeVersion?.id,
          build: this.localBuildInfo(),
          status: this.selectedCompatibilityStatus,
          note: reason,
        });
        break;
      case "approveVersion":
        response = await this.adminApi.request("approveVersion", {
          ...credentials,
          versionId: this.activeVersion?.id,
          changeReason: reason,
        });
        break;
      case "retireVersion":
        response = await this.adminApi.request("retireVersion", {
          ...credentials,
          versionId: this.activeVersion?.id,
          changeReason: reason,
        });
        break;
      case "assignTarget":
      case "rollbackTarget":
        response = await this.adminApi.request(action, {
          ...credentials,
          targetKey: this.selectedTargetKey,
          build: this.localBuildInfo(),
          versionId: this.activeVersion?.id,
          changeReason: reason,
        });
        break;
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
      return {errors: ["AppData ist kein JSON-Objekt."], warnings};
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

    return {errors, warnings};
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
