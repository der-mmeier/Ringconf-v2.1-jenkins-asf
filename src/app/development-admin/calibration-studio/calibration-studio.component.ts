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
import {
  CalibrationEasing,
  CalibrationFieldDefinition,
  CalibrationModalGeometry,
  CalibrationStudioState,
  CameraPose,
  RingPresentationCalibration,
  StartupCameraSequence,
} from "./calibration-studio.models";

type PointerAction = "drag" | "resize";

interface PointerSession {
  action: PointerAction;
  pointerId: number;
  startX: number;
  startY: number;
  start: CalibrationModalGeometry;
}

interface StudioSnapshot {
  camera: CameraPose;
  rings: RingPresentationCalibration[];
}

const STORAGE_KEY = "ringconf.calibrationStudio.v2.modal";
const LEGACY_VIEW_CALIBRATION_STORAGE_KEY = "ringconf.dev.view-calibration.v1";

@Component({
  selector: "x-calibration-studio",
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  private pointerSession: PointerSession | null = null;
  private snapshot: StudioSnapshot | null = null;
  private animationFrame = 0;
  private animationStart = 0;
  private animationDelayTimer = 0;

  constructor() {
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
    this.captureSession();
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

  updateRingPosition(ring: RingPresentationCalibration, axis: 0 | 1 | 2, value: unknown): void {
    const n = this.finite(value, ring.position[axis]);
    ring.position[axis] = n;
    this.applyLive();
  }

  updateRingQuaternion(ring: RingPresentationCalibration, axis: 0 | 1 | 2 | 3, value: unknown): void {
    const next = [...ring.rotationQuaternion] as [number, number, number, number];
    next[axis] = this.finite(value, next[axis]);
    ring.rotationQuaternion = normalizeQuaternion(next);
    this.applyLive();
  }

  updateCameraNumber(pose: CameraPose, path: string, value: unknown): void {
    const n = this.finite(value, 0);
    if (path === "alpha" || path === "beta") pose[path] = n;
    else if (path === "radius") pose.projection.radius = n;
    else if (path === "orthoHeight") pose.projection.orthoHeight = n;
    else if (path === "screenOffsetX") pose.projection.screenOffsetX = n;
    else if (path === "screenOffsetY") pose.projection.screenOffsetY = n;
    this.state!.dirty = true;
  }

  updateCameraTarget(pose: CameraPose, axis: 0 | 1 | 2, value: unknown): void {
    pose.target[axis] = this.finite(value, pose.target[axis]);
    this.state!.dirty = true;
  }

  updateSequenceNumber(path: "delayMs" | "durationMs", value: unknown): void {
    if (!this.state) return;
    this.state.startup[path] = Math.max(0, this.finite(value, this.state.startup[path]));
    this.state.dirty = true;
  }

  getHelp(key: string): string {
    return getCalibrationFieldDefinition(key).help;
  }

  beginPointer(event: PointerEvent, action: PointerAction): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.pointerSession = {
      action,
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
      this.modal.width = this.pointerSession.start.width + dx;
      this.modal.height = this.pointerSession.start.height + dy;
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

  private service() {
    return WebglComponent.WEBGL?.ringViewService || null;
  }

  private finite(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private loadModalGeometry(): CalibrationModalGeometry {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
      if (parsed && typeof parsed === "object") {
        return {
          left: this.finite(parsed.left, 80),
          top: this.finite(parsed.top, 80),
          width: this.finite(parsed.width, 620),
          height: this.finite(parsed.height, 560),
          minimized: parsed.minimized === true,
        };
      }
    } catch {
      // Ignore invalid development-only geometry.
    }
    return {left: 80, top: 80, width: 620, height: 560, minimized: false};
  }

  private persistModalGeometry(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.modal));
  }

  private clampModalGeometry(): void {
    this.modal.width = Math.min(Math.max(this.modal.width, 420), Math.max(420, window.innerWidth - 24));
    this.modal.height = Math.min(Math.max(this.modal.height, 260), Math.max(260, window.innerHeight - 24));
    this.modal.left = Math.min(Math.max(this.modal.left, 0), Math.max(0, window.innerWidth - this.modal.width));
    this.modal.top = Math.min(Math.max(this.modal.top, 0), Math.max(0, window.innerHeight - 48));
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpOptional(a: number | undefined, b: number | undefined, t: number): number | undefined {
  if (a === undefined || b === undefined) return b ?? a;
  return lerp(a, b, t);
}
