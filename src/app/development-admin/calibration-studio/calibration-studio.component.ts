import {CommonModule} from "@angular/common";
import {Component, HostListener} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {ArcRotateCamera, Camera, Quaternion, TransformNode, Vector3} from "@babylonjs/core";
import packageInfo from "../../../../package.json";
import {RingPresetSlot} from "../../preset-slots";
import {WebglComponent} from "../../webgl/webgl.component";
import {frustumFromOrthoHeight, shortestAngleDelta} from "../../webgl/ring-view-fit";
import {RingPresentationHandle} from "../../webgl/ring-presentation";
import {CALIBRATION_FIELD_DEFINITIONS, getCalibrationFieldDefinition} from "./calibration-field-definitions";
import {createCalibrationJson, createCalibrationTypeScript} from "./calibration-export";
import {AppDataAdminService, type AppDataAdminAction} from "../appdata-admin.service";
import {CalibrationNumberControlComponent} from "./calibration-number-control.component";
import {CalibrationRuntimeComposition, CalibrationRuntimeProfile, CalibrationRuntimeRingTransform, CalibrationRuntimeView} from "../../calibration/calibration-runtime.models";
import {
  CalibrationEasing,
  CalibrationFieldDefinition,
  CalibrationModalGeometry,
  CalibrationStudioState,
  CameraPose,
  RingPresentationCalibration,
  StartupCameraSequence,
} from "./calibration-studio.models";

type ResizeEdge = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
type PointerAction = "drag" | "resize";
type Axis3 = 0 | 1 | 2;
type Axis4 = 0 | 1 | 2 | 3;

interface PointerSession {
  action: PointerAction;
  edge?: ResizeEdge;
  pointerId: number;
  startX: number;
  startY: number;
  start: CalibrationModalGeometry;
}

interface StudioSnapshot {
  camera: CameraPose;
  rings: RingPresentationCalibration[];
}

interface CalibrationViewDraft extends CalibrationRuntimeView {
  id?: number;
  compositionId: number;
}

interface CalibrationAdminErrorState {
  code: string;
  message: string;
  requestId: string;
  endpoint: string;
  details?: unknown;
}

const STORAGE_KEY = "ringconf.calibrationStudio.v2.modal";
const LEGACY_VIEW_CALIBRATION_STORAGE_KEY = "ringconf.dev.view-calibration.v1";

@Component({
  selector: "x-calibration-studio",
  standalone: true,
  imports: [CommonModule, FormsModule, CalibrationNumberControlComponent],
  templateUrl: "./calibration-studio.component.html",
  styleUrls: ["./calibration-studio.component.scss"],
})
export class CalibrationStudioComponent {
  open = false;
  activeTab: "status" | "rings" | "camera" | "sequence" | "views" | "export" | "debug" = "status";
  status = "Bereit.";
  state: CalibrationStudioState | null = null;
  modal = this.loadModalGeometry();
  fields = CALIBRATION_FIELD_DEFINITIONS;
  easingOptions: CalibrationEasing[] = ["linear", "ease-in", "ease-out", "ease-in-out", "legacy-exponential"];
  calibrationProfile: CalibrationRuntimeProfile & {id?: number; isActive?: boolean} | null = null;
  calibrationLoadState: "idle" | "loading" | "ready" | "empty" | "error" = "idle";
  calibrationError: CalibrationAdminErrorState | null = null;
  showCalibrationErrorDetails = false;
  selectedCompositionKey = "wedding-pair";
  selectedViewId = 0;
  viewDraft: CalibrationViewDraft | null = null;
  stepMode: "coarse" | "fine" = "coarse";
  auth = {username: "", pin: "", reason: "Kalibrierungsansicht aktualisieren"};
  private pointerSession: PointerSession | null = null;
  private snapshot: StudioSnapshot | null = null;
  private animationFrame = 0;
  private animationStart = 0;
  private animationDelayTimer = 0;

  constructor(private adminApi: AppDataAdminService) {
    try {
      localStorage.removeItem(LEGACY_VIEW_CALIBRATION_STORAGE_KEY);
    } catch {
      // Development-only cleanup must never block the studio.
    }
  }

  get activeCompositionLabel(): string {
    return this.service()?.getPresentationRegistry().getCompositionProfile().label || "Keine Szene";
  }

  get engineSceneLabel(): string {
    const webgl = WebglComponent.WEBGL;
    return webgl ? `Engine ${webgl.engineInstanceId ?? "?"} / Scene ${webgl.sceneInstanceId ?? "?"}` : "WebGL nicht bereit";
  }

  get exportableFields(): readonly CalibrationFieldDefinition[] {
    return this.fields.filter(field => field.exportable);
  }

  toggle(): void {
    if (this.open) {
      this.close();
      return;
    }
    this.open = true;
    this.clampModalGeometry();
    this.persistModalGeometry();
    this.captureSession();
    void this.loadCalibrationProfile();
  }

  close(): void {
    this.stopIntro();
    this.open = false;
    this.persistModalGeometry();
  }

  minimize(): void {
    this.modal.minimized = !this.modal.minimized;
    this.persistModalGeometry();
  }

  captureSession(): void {
    const webgl = WebglComponent.WEBGL;
    const service = this.service();
    const camera = webgl?.camera as ArcRotateCamera | undefined;
    if (!webgl || !service || !camera) {
      this.status = "WebGL ist noch nicht bereit.";
      return;
    }

    const registry = service.getPresentationRegistry();
    const rings = registry.getAvailableHandles().map((handle: RingPresentationHandle) => this.captureRing(handle.slot, handle.role, handle.root));
    const cameraPose = this.captureCamera(camera);
    const sequence: StartupCameraSequence = {
      enabled: true,
      delayMs: 0,
      durationMs: 1200,
      easing: "ease-in-out",
      start: {
        ...cameraPose,
        alpha: cameraPose.alpha - Math.PI / 2,
      },
      end: cloneCameraPose(cameraPose),
      interruptOnUserInput: true,
    };
    this.state = {
      schemaVersion: 2,
      projectVersion: packageInfo.version,
      composition: registry.getCompositionProfile().id,
      rings,
      startup: sequence,
      dirty: false,
    };
    this.snapshot = {
      camera: cloneCameraPose(cameraPose),
      rings: rings.map(cloneRingCalibration),
    };
    this.status = "Session-Snapshot erfasst.";
  }

  async loadCalibrationProfile(): Promise<void> {
    this.calibrationLoadState = "loading";
    this.calibrationError = null;
    this.showCalibrationErrorDetails = false;
    const response = await this.adminApi.request<{profile: CalibrationRuntimeProfile & {id?: number; isActive?: boolean}}>("calibrationBootstrap");
    if (!response.ok || !response.data?.profile) {
      this.calibrationProfile = null;
      this.calibrationLoadState = "error";
      this.calibrationError = {
        code: response.error?.code ?? "CALIBRATION_PROFILE_LOAD_FAILED",
        message: response.error?.message ?? "Kalibrierungsprofil konnte nicht geladen werden.",
        requestId: response.requestId || this.adminApi.lastDebugInfo?.requestId || "",
        endpoint: this.adminApi.lastDebugInfo?.endpoint || this.adminApi.getEndpointForDebug("calibrationBootstrap"),
        details: response.error?.details,
      };
      this.status = "Kalibrierungsdaten konnten nicht geladen werden.";
      return;
    }
    this.calibrationProfile = response.data.profile;
    this.selectedCompositionKey = this.selectedComposition?.compositionKey || this.calibrationProfile.compositions[0]?.compositionKey || this.selectedCompositionKey;
    this.calibrationLoadState = this.calibrationProfile.compositions.length ? "ready" : "empty";
    this.status = this.calibrationLoadState === "ready" ? "Kalibrierungsprofil geladen." : "Keine Kalibrierungskompositionen vorhanden.";
  }

  get selectedComposition(): CalibrationRuntimeComposition | null {
    return this.calibrationProfile?.compositions.find(item => item.compositionKey === this.selectedCompositionKey) || null;
  }

  get selectedViews(): CalibrationRuntimeView[] {
    return [...(this.selectedComposition?.views || [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  get calibrationStep(): number {
    return this.stepMode === "fine" ? 0.5 : 1.0;
  }

  numericMin(key: string): number {
    return getCalibrationFieldDefinition(key).safeRange?.min ?? -100;
  }

  numericMax(key: string): number {
    return getCalibrationFieldDefinition(key).safeRange?.max ?? 100;
  }

  fieldUnit(key: string): string {
    return getCalibrationFieldDefinition(key).unit || "";
  }

  ringEuler(ring: RingPresentationCalibration, axis: Axis3): number {
    const euler = Quaternion.FromArray(ring.rotationQuaternion).toEulerAngles();
    return axis === 0 ? euler.x : axis === 1 ? euler.y : euler.z;
  }

  updateRingEuler(ring: RingPresentationCalibration, axis: Axis3, value: unknown): void {
    const euler = Quaternion.FromArray(ring.rotationQuaternion).toEulerAngles();
    const next = [euler.x, euler.y, euler.z] as [number, number, number];
    next[axis] = this.clampCalibrationValue("camera.alpha", value, next[axis]);
    const quaternion = Quaternion.FromEulerAngles(next[0], next[1], next[2]).normalize();
    ring.rotationQuaternion = normalizeQuaternion([quaternion.x, quaternion.y, quaternion.z, quaternion.w]);
    this.applyLive();
  }

  createNewView(): void {
    const composition = this.selectedComposition;
    if (!composition) return;
    const name = "Neue Ansicht";
    const viewKey = this.uniqueViewKey(slugify(name), composition.views);
    const camera = this.captureCurrentCameraPoseForView();
    this.viewDraft = {
      compositionId: composition.id || 0,
      viewKey,
      name,
      enabled: true,
      isDefault: composition.views.length === 0,
      sortOrder: composition.views.length * 10,
      revision: 1,
      camera,
      ringLayout: {rings: this.captureCurrentRingLayout()},
      framing: camera.safety,
    };
    this.selectedViewId = 0;
    this.activeTab = "views";
    this.previewDraft();
  }

  editView(view: CalibrationRuntimeView): void {
    const composition = this.selectedComposition;
    if (!composition) return;
    this.selectedViewId = view.id || 0;
    this.viewDraft = clone({...view, compositionId: composition.id || 0});
  }

  duplicateView(view: CalibrationRuntimeView): void {
    const composition = this.selectedComposition;
    if (!composition) return;
    const name = `${view.name} Kopie`;
    this.viewDraft = {
      ...clone(view),
      id: undefined,
      compositionId: composition.id || 0,
      name,
      viewKey: this.uniqueViewKey(`${view.viewKey}-copy`, composition.views),
      isDefault: false,
      sortOrder: view.sortOrder + 1,
      revision: 1,
    };
    this.selectedViewId = 0;
  }

  previewView(view: CalibrationRuntimeView): void {
    this.editView(view);
    this.previewDraft();
  }

  async saveDraft(): Promise<void> {
    if (!this.viewDraft) return;
    const payload = this.authPayload({
      compositionId: this.viewDraft.compositionId,
      viewId: this.viewDraft.id,
      revision: this.viewDraft.revision,
      view: this.viewDraft,
    });
    const action = this.viewDraft.id ? "calibrationUpdateView" : "calibrationCreateView";
    const response = await this.adminApi.request<{profile: CalibrationRuntimeProfile & {id?: number; isActive?: boolean}}>(action, payload);
    this.applyCalibrationResponse(response);
  }

  async deleteView(view: CalibrationRuntimeView): Promise<void> {
    if (!view.id) return;
    const response = await this.adminApi.request<{profile: CalibrationRuntimeProfile & {id?: number; isActive?: boolean}}>("calibrationDeleteView", this.authPayload({
      viewId: view.id,
      revision: view.revision,
    }));
    this.applyCalibrationResponse(response);
  }

  async setDefaultView(view: CalibrationRuntimeView): Promise<void> {
    if (!view.id) return;
    const response = await this.adminApi.request<{profile: CalibrationRuntimeProfile & {id?: number; isActive?: boolean}}>("calibrationSetDefaultView", this.authPayload({viewId: view.id}));
    this.applyCalibrationResponse(response);
  }

  async setViewEnabled(view: CalibrationRuntimeView, enabled: boolean): Promise<void> {
    if (!view.id) return;
    const response = await this.adminApi.request<{profile: CalibrationRuntimeProfile & {id?: number; isActive?: boolean}}>("calibrationSetViewEnabled", this.authPayload({
      viewId: view.id,
      revision: view.revision,
      enabled,
    }));
    this.applyCalibrationResponse(response);
  }

  async moveView(view: CalibrationRuntimeView, delta: -1 | 1): Promise<void> {
    const composition = this.selectedComposition;
    if (!composition) return;
    const views = this.selectedViews;
    const index = views.findIndex(item => item.id === view.id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= views.length) return;
    [views[index], views[next]] = [views[next], views[index]];
    const response = await this.adminApi.request<{profile: CalibrationRuntimeProfile & {id?: number; isActive?: boolean}}>("calibrationSortViews", this.authPayload({
      compositionId: composition.id,
      viewIds: views.map(item => item.id),
    }));
    this.applyCalibrationResponse(response);
  }

  captureDraftCamera(): void {
    if (!this.viewDraft) return;
    this.viewDraft.camera = this.captureCurrentCameraPoseForView();
    this.viewDraft.framing = this.viewDraft.camera.safety;
    this.previewDraft();
  }

  captureDraftRings(): void {
    if (!this.viewDraft) return;
    this.viewDraft.ringLayout = {rings: this.captureCurrentRingLayout()};
    this.previewDraft();
  }

  captureDraftCameraAndRings(): void {
    this.captureDraftCamera();
    this.captureDraftRings();
  }

  previewDraft(): void {
    if (!this.viewDraft || !this.state) return;
    this.applyRings(this.viewDraft.ringLayout.rings?.map(ring => ({
      slot: ring.slot as RingPresetSlot,
      role: (ring.role || `ring-${ring.slot}`) as RingPresentationCalibration["role"],
      position: ring.position,
      rotationQuaternion: ring.rotationQuaternion,
      visible: ring.visible,
    })) || []);
    this.applyCamera(this.viewDraft.camera);
    this.requestRender(4);
    this.status = "Ansichtsvorschau angewendet.";
  }

  discardDraft(): void {
    this.viewDraft = null;
    this.discard();
  }

  applyLive(): void {
    if (!this.state) return;
    this.applyRings(this.state.rings);
    this.applyCamera(this.state.startup.end);
    this.state.dirty = true;
    this.requestRender(4);
    this.status = "Live angewendet.";
  }

  discard(): void {
    if (!this.snapshot || !this.state) return;
    this.stopIntro();
    this.applyRings(this.snapshot.rings);
    this.applyCamera(this.snapshot.camera);
    this.state.rings = this.snapshot.rings.map(cloneRingCalibration);
    this.state.startup.end = cloneCameraPose(this.snapshot.camera);
    this.state.dirty = false;
    this.requestRender(4);
    this.status = "Session verworfen.";
  }

  resetNatural(): void {
    void this.service()?.resetPresentation();
    this.status = "Natural State angefordert.";
  }

  captureStartFromCamera(): void {
    const camera = WebglComponent.WEBGL?.camera as ArcRotateCamera | undefined;
    if (!camera || !this.state) return;
    this.state.startup.start = this.captureCamera(camera);
    this.state.dirty = true;
  }

  captureEndFromCamera(): void {
    const camera = WebglComponent.WEBGL?.camera as ArcRotateCamera | undefined;
    if (!camera || !this.state) return;
    this.state.startup.end = this.captureCamera(camera);
    this.state.dirty = true;
  }

  applyStart(): void {
    if (!this.state) return;
    this.applyCamera(this.state.startup.start);
    this.requestRender(4);
  }

  applyEnd(): void {
    if (!this.state) return;
    this.applyCamera(this.state.startup.end);
    this.requestRender(4);
  }

  playIntro(): void {
    if (!this.state) return;
    this.stopIntro();
    this.applyCamera(this.state.startup.start);
    this.requestRender(2);
    const delay = Math.max(0, this.state.startup.delayMs);
    this.animationDelayTimer = window.setTimeout(() => {
      this.animationStart = performance.now();
      this.animationFrame = requestAnimationFrame(now => this.animateIntro(now));
    }, delay);
    this.status = "Kamerafahrt laeuft.";
  }

  pauseIntro(): void {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.status = "Kamerafahrt pausiert.";
  }

  stopIntro(): void {
    if (this.animationDelayTimer) window.clearTimeout(this.animationDelayTimer);
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationDelayTimer = 0;
    this.animationFrame = 0;
  }

  jumpToEnd(): void {
    this.stopIntro();
    this.applyEnd();
    this.status = "Endkamera angewendet.";
  }

  async copyJson(): Promise<void> {
    if (!this.state) return;
    await this.copyText(createCalibrationJson(this.state), "JSON kopiert.");
  }

  downloadJson(): void {
    if (!this.state) return;
    const blob = new Blob([createCalibrationJson(this.state)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ringconf-calibration-v2.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async copyTypeScript(): Promise<void> {
    if (!this.state) return;
    await this.copyText(createCalibrationTypeScript(this.state), "TypeScript kopiert.");
  }

  applyLegacyIntro(): void {
    if (!this.state) return;
    const end = this.state.startup.end;
    this.state.startup = {
      ...this.state.startup,
      enabled: true,
      delayMs: 0,
      durationMs: 3600,
      easing: "legacy-exponential",
      start: {
        ...cloneCameraPose(end),
        alpha: end.alpha - Math.PI / 2,
      },
      end: cloneCameraPose(end),
      interruptOnUserInput: true,
    };
    this.state.dirty = true;
    this.status = "Legacy-Shopware-Kamerafahrt uebernommen.";
  }

  updateRingPosition(ring: RingPresentationCalibration, axis: Axis3, value: unknown): void {
    const n = this.clampCalibrationValue("ring.position", value, ring.position[axis]);
    ring.position[axis] = n;
    this.applyLive();
  }

  updateRingQuaternion(ring: RingPresentationCalibration, axis: Axis4, value: unknown): void {
    const next = [...ring.rotationQuaternion] as [number, number, number, number];
    next[axis] = Math.max(-1, Math.min(1, this.finite(value, next[axis])));
    ring.rotationQuaternion = normalizeQuaternion(next);
    this.applyLive();
  }

  updateCameraNumber(pose: CameraPose, path: string, value: unknown): void {
    const key = cameraFieldKey(path);
    const n = this.clampCalibrationValue(key, value, 0);
    if (path === "alpha" || path === "beta") pose[path] = n;
    else if (path === "radius") pose.projection.radius = n;
    else if (path === "orthoHeight") pose.projection.orthoHeight = n;
    else if (path === "screenOffsetX") pose.projection.screenOffsetX = n;
    else if (path === "screenOffsetY") pose.projection.screenOffsetY = n;
    this.state!.dirty = true;
  }

  updateCameraTarget(pose: CameraPose, axis: Axis3, value: unknown): void {
    pose.target[axis] = this.clampCalibrationValue("camera.target", value, pose.target[axis]);
    this.state!.dirty = true;
  }

  updateSequenceNumber(path: "delayMs" | "durationMs", value: unknown): void {
    if (!this.state) return;
    this.state.startup[path] = this.clampCalibrationValue(`startup.${path}`, value, this.state.startup[path]);
    this.state.dirty = true;
  }

  getHelp(key: string): string {
    return getCalibrationFieldDefinition(key).help;
  }

  beginPointer(event: PointerEvent, action: PointerAction, edge?: ResizeEdge): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.pointerSession = {
      action,
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: {...this.modal},
    };
  }

  @HostListener("document:pointermove", ["$event"])
  movePointer(event: PointerEvent): void {
    if (!this.pointerSession || event.pointerId !== this.pointerSession.pointerId) return;
    const dx = event.clientX - this.pointerSession.startX;
    const dy = event.clientY - this.pointerSession.startY;
    if (this.pointerSession.action === "drag") {
      this.modal.left = this.pointerSession.start.left + dx;
      this.modal.top = this.pointerSession.start.top + dy;
    } else {
      this.applyResizePointer(dx, dy, this.pointerSession.edge || "se", this.pointerSession.start);
    }
    this.clampModalGeometry();
  }

  @HostListener("document:pointerup", ["$event"])
  endPointer(event: PointerEvent): void {
    if (!this.pointerSession || event.pointerId !== this.pointerSession.pointerId) return;
    this.pointerSession = null;
    this.persistModalGeometry();
  }

  @HostListener("document:keydown", ["$event"])
  handleKeydown(event: KeyboardEvent): void {
    if (!this.open) return;
    if (event.key === "Escape") {
      this.stopIntro();
      this.status = "Tooltip/Fahrt geschlossen.";
    }
  }

  private animateIntro(now: number): void {
    if (!this.state) return;
    const duration = Math.max(1, this.state.startup.durationMs);
    const progress = Math.min(1, (now - this.animationStart) / duration);
    const eased = easing(progress, this.state.startup.easing);
    this.applyCamera(interpolateCameraPose(this.state.startup.start, this.state.startup.end, eased));
    this.requestRender(2);
    if (progress < 1) {
      this.animationFrame = requestAnimationFrame(next => this.animateIntro(next));
    } else {
      this.animationFrame = 0;
      this.status = "Kamerafahrt beendet.";
    }
  }

  private applyResizePointer(dx: number, dy: number, edge: ResizeEdge, start: CalibrationModalGeometry): void {
    const minWidth = 420;
    const minHeight = 260;
    const movesWest = edge.includes("w");
    const movesEast = edge.includes("e");
    const movesNorth = edge.includes("n");
    const movesSouth = edge.includes("s");

    if (movesEast) {
      this.modal.width = start.width + dx;
    }
    if (movesSouth) {
      this.modal.height = start.height + dy;
    }
    if (movesWest) {
      const width = Math.max(minWidth, start.width - dx);
      this.modal.left = start.left + start.width - width;
      this.modal.width = width;
    }
    if (movesNorth) {
      const height = Math.max(minHeight, start.height - dy);
      this.modal.top = start.top + start.height - height;
      this.modal.height = height;
    }
  }

  private applyRings(rings: RingPresentationCalibration[]): void {
    const registry = this.service()?.getPresentationRegistry();
    if (!registry) return;
    rings.forEach(ring => {
      const handle = registry.getHandle(ring.slot);
      if (!handle) return;
      handle.root.position.copyFrom(Vector3.FromArray(ring.position));
      handle.root.rotationQuaternion = Quaternion.FromArray(ring.rotationQuaternion).normalize();
      handle.root.rotation.set(0, 0, 0);
      handle.root.setEnabled(ring.visible);
      handle.root.computeWorldMatrix(true);
    });
  }

  private applyCamera(pose: CameraPose): void {
    const webgl = WebglComponent.WEBGL;
    const camera = webgl?.camera as ArcRotateCamera | undefined;
    if (!camera || !webgl?.canvas) return;
    camera.alpha = pose.alpha;
    camera.beta = pose.beta;
    camera.target.copyFrom(Vector3.FromArray(pose.target));
    if (pose.projection.radius) camera.radius = pose.projection.radius;
    camera.mode = pose.projection.mode === "orthographic" ? Camera.ORTHOGRAPHIC_CAMERA : Camera.PERSPECTIVE_CAMERA;
    if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA && pose.projection.orthoHeight) {
      const aspect = webgl.canvas.clientHeight > 0 ? webgl.canvas.clientWidth / webgl.canvas.clientHeight : 1;
      const frustum = frustumFromOrthoHeight(
        pose.projection.orthoHeight,
        aspect,
        pose.projection.screenOffsetX,
        pose.projection.screenOffsetY,
      );
      camera.orthoLeft = frustum.left;
      camera.orthoRight = frustum.right;
      camera.orthoTop = frustum.top;
      camera.orthoBottom = frustum.bottom;
    }
  }

  private captureCamera(camera: ArcRotateCamera): CameraPose {
    const orthoHeight = camera.mode === Camera.ORTHOGRAPHIC_CAMERA
      ? Math.abs((camera.orthoTop ?? 0) - (camera.orthoBottom ?? 0)) || undefined
      : undefined;
    return {
      alpha: camera.alpha,
      beta: camera.beta,
      target: [camera.target.x, camera.target.y, camera.target.z],
      projection: {
        mode: camera.mode === Camera.ORTHOGRAPHIC_CAMERA ? "orthographic" : "perspective",
        orthoHeight,
        radius: camera.radius,
        screenOffsetX: 0,
        screenOffsetY: 0,
      },
    };
  }

  private captureRing(slot: RingPresetSlot, role: RingPresentationCalibration["role"], root: TransformNode): RingPresentationCalibration {
    const quat = root.rotationQuaternion || Quaternion.FromEulerAngles(root.rotation.x, root.rotation.y, root.rotation.z);
    return {
      slot,
      role,
      position: [root.position.x, root.position.y, root.position.z],
      rotationQuaternion: normalizeQuaternion([quat.x, quat.y, quat.z, quat.w]),
      visible: root.isEnabled(),
    };
  }

  private requestRender(forceFrames: number): void {
    const webgl = WebglComponent.WEBGL;
    if (!webgl) return;
    webgl.cameraChanged = true;
    if (webgl.forceFrames < forceFrames) webgl.forceFrames = forceFrames;
  }

  private async copyText(text: string, successMessage: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.status = successMessage;
    } catch {
      this.status = "Clipboard konnte nicht beschrieben werden.";
    }
  }

  private applyCalibrationResponse(response: {ok: boolean; action: AppDataAdminAction; requestId?: string; data?: {profile: CalibrationRuntimeProfile & {id?: number; isActive?: boolean}}; error?: {code?: string; message: string; details?: unknown}}): void {
    if (!response.ok || !response.data?.profile) {
      this.calibrationLoadState = "error";
      this.calibrationError = {
        code: response.error?.code ?? "CALIBRATION_SAVE_FAILED",
        message: response.error?.message ?? "Kalibrierungsdaten konnten nicht gespeichert werden.",
        requestId: response.requestId || this.adminApi.lastDebugInfo?.requestId || "",
        endpoint: this.adminApi.lastDebugInfo?.endpoint || this.adminApi.getEndpointForDebug(response.action),
        details: response.error?.details,
      };
      this.status = response.error?.message ?? "Kalibrierungsdaten konnten nicht gespeichert werden.";
      return;
    }
    this.calibrationProfile = response.data.profile;
    this.calibrationLoadState = "ready";
    this.calibrationError = null;
    this.viewDraft = null;
    this.status = "Kalibrierungsdaten gespeichert.";
  }

  private authPayload(payload: Record<string, unknown>): Record<string, unknown> {
    return {
      ...payload,
      username: this.auth.username,
      pin: this.auth.pin,
      changeReason: this.auth.reason || "Kalibrierungsansicht aktualisieren",
    };
  }

  private captureCurrentCameraPoseForView(): CalibrationRuntimeView["camera"] {
    const camera = WebglComponent.WEBGL?.camera as ArcRotateCamera | undefined;
    const captured = camera ? this.captureCamera(camera) : this.state?.startup.end;
    const pose = captured ? cloneCameraPose(captured) : {
      alpha: -Math.PI / 2,
      beta: Math.PI / 2.6,
      target: [0, 10, 0] as [number, number, number],
      projection: {mode: "orthographic" as const, orthoHeight: 23.5, radius: 60, screenOffsetX: 0, screenOffsetY: 0},
    };
    return {
      ...pose,
      safety: {
        fitMode: "zoom-out-only",
        paddingTop: 0.08,
        paddingRight: 0.1,
        paddingBottom: 0.18,
        paddingLeft: 0.1,
        includeShadowEnvelope: true,
        shadowExtraBottom: 0.18,
        shadowExtraLeft: 0.05,
        shadowExtraRight: 0.05,
      },
      focus: "all",
      targetMode: "selection-center",
    };
  }

  private captureCurrentRingLayout(): CalibrationRuntimeRingTransform[] {
    const registry = this.service()?.getPresentationRegistry();
    if (!registry) return [];
    return registry.getAvailableHandles().map((handle: RingPresentationHandle) => this.captureRing(handle.slot, handle.role, handle.root));
  }

  private uniqueViewKey(base: string, views: readonly CalibrationRuntimeView[]): string {
    const used = new Set(views.map(view => view.viewKey));
    let key = base || "view";
    let suffix = 2;
    while (used.has(key)) {
      key = `${base}-${suffix}`;
      suffix++;
    }
    return key;
  }

  private service() {
    return WebglComponent.WEBGL?.ringViewService || null;
  }

  private finite(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private clampCalibrationValue(key: string, value: unknown, fallback: number): number {
    const n = this.finite(value, fallback);
    const range = getCalibrationFieldDefinition(key).safeRange;
    if (!range) return n;
    return Math.max(range.min ?? -Infinity, Math.min(range.max ?? Infinity, n));
  }

  private loadModalGeometry(): CalibrationModalGeometry {
    const fallback = this.defaultModalGeometry();
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
      if (parsed && typeof parsed === "object") {
        return this.clampedModalGeometry({
          left: this.finite(parsed.left, fallback.left),
          top: this.finite(parsed.top, fallback.top),
          width: this.finite(parsed.width, fallback.width),
          height: this.finite(parsed.height, fallback.height),
          minimized: parsed.minimized === true,
        });
      }
    } catch {
      // Ignore invalid development-only geometry.
    }
    return fallback;
  }

  private persistModalGeometry(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.modal));
  }

  private clampModalGeometry(): void {
    this.modal = this.clampedModalGeometry(this.modal);
  }

  private clampedModalGeometry(geometry: CalibrationModalGeometry): CalibrationModalGeometry {
    const minWidth = this.modalMinWidth();
    const minHeight = this.modalMinHeight();
    const maxWidth = Math.max(minWidth, window.innerWidth - 16);
    const maxHeight = Math.max(minHeight, window.innerHeight - 16);
    const width = Math.min(Math.max(geometry.width, minWidth), maxWidth);
    const height = Math.min(Math.max(geometry.height, minHeight), maxHeight);
    return {
      ...geometry,
      width,
      height,
      left: Math.min(Math.max(geometry.left, 0), Math.max(0, window.innerWidth - width)),
      top: Math.min(Math.max(geometry.top, 0), Math.max(0, window.innerHeight - 48)),
    };
  }

  private defaultModalGeometry(): CalibrationModalGeometry {
    const width = Math.min(1100, Math.max(this.modalMinWidth(), window.innerWidth - 48));
    const height = Math.min(820, Math.max(this.modalMinHeight(), window.innerHeight - 48));
    return {
      left: Math.max(8, Math.round((window.innerWidth - width) / 2)),
      top: Math.max(8, Math.round((window.innerHeight - height) / 2)),
      width,
      height,
      minimized: false,
    };
  }

  private modalMinWidth(): number {
    return Math.min(560, Math.max(320, window.innerWidth - 16));
  }

  private modalMinHeight(): number {
    return Math.min(420, Math.max(260, window.innerHeight - 16));
  }
}

export function normalizeQuaternion(value: [number, number, number, number]): [number, number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (!Number.isFinite(length) || length <= 0) return [0, 0, 0, 1];
  return [value[0] / length, value[1] / length, value[2] / length, value[3] / length];
}

export function easing(t: number, mode: CalibrationEasing): number {
  const x = Math.min(1, Math.max(0, t));
  switch (mode) {
    case "ease-in":
      return x * x;
    case "ease-out":
      return 1 - Math.pow(1 - x, 2);
    case "ease-in-out":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case "legacy-exponential":
      return 1 - Math.pow(1 - 0.05, x * 144);
    default:
      return x;
  }
}

function interpolateCameraPose(start: CameraPose, end: CameraPose, t: number): CameraPose {
  return {
    alpha: start.alpha + shortestAngleDelta(start.alpha, end.alpha) * t,
    beta: lerp(start.beta, end.beta, t),
    target: [
      lerp(start.target[0], end.target[0], t),
      lerp(start.target[1], end.target[1], t),
      lerp(start.target[2], end.target[2], t),
    ],
    projection: {
      mode: end.projection.mode,
      orthoHeight: lerpOptional(start.projection.orthoHeight, end.projection.orthoHeight, t),
      radius: lerpOptional(start.projection.radius, end.projection.radius, t),
      screenOffsetX: lerpOptional(start.projection.screenOffsetX, end.projection.screenOffsetX, t),
      screenOffsetY: lerpOptional(start.projection.screenOffsetY, end.projection.screenOffsetY, t),
    },
  };
}

function cloneCameraPose(pose: CameraPose): CameraPose {
  return {
    alpha: pose.alpha,
    beta: pose.beta,
    target: [...pose.target],
    projection: {...pose.projection},
  };
}

function cloneRingCalibration(ring: RingPresentationCalibration): RingPresentationCalibration {
  return {
    slot: ring.slot,
    role: ring.role,
    position: [...ring.position],
    rotationQuaternion: [...ring.rotationQuaternion],
    visible: ring.visible,
  };
}

function cameraFieldKey(path: string): string {
  switch (path) {
    case "alpha":
      return "camera.alpha";
    case "beta":
      return "camera.beta";
    case "radius":
      return "camera.radius";
    case "orthoHeight":
      return "camera.orthoHeight";
    case "screenOffsetX":
      return "camera.screenOffsetX";
    case "screenOffsetY":
      return "camera.screenOffsetY";
    default:
      return "camera.radius";
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "view";
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpOptional(a: number | undefined, b: number | undefined, t: number): number | undefined {
  if (a === undefined || b === undefined) return b ?? a;
  return lerp(a, b, t);
}
