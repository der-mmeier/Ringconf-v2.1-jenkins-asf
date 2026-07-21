import {
  AbstractMesh,
  ArcRotateCamera,
  Camera,
  Matrix,
  Mesh,
  Quaternion,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import {AppComponent} from "../app.component";
import {iRingLayoutPreset, iRingPresentationTransform, iRingViewPreset, RingViewCameraPreset, RingViewFocus} from "../app.interfaces";
import {RingData} from "../app.ringdata";
import {cRing} from "./cRing";
import {
  cameraSpaceBounds,
  computeOrthographicFit,
  effectiveOrthoHeight,
  frustumFromOrthoHeight,
  requiredOrthoHeight,
  shortestAngleDelta
} from "./ring-view-fit";
import {createFallbackViewPresets, normalizeLayoutPresets, normalizeViewPresets} from "./ring-view-presets";
import {focusToPresetSlot, RingPresentationRegistry} from "./ring-presentation";
import {ALL_PRESET_SLOTS, RingPresetSlot} from "../preset-slots";
import {createRuntimeViewPresets} from "../calibration/calibration-runtime";

interface CameraSnapshot {
  alpha: number;
  beta: number;
  radius: number;
  target: Vector3;
  orthoLeft?: number | null;
  orthoRight?: number | null;
  orthoTop?: number | null;
  orthoBottom?: number | null;
}

interface PivotSnapshot {
  position: Vector3;
  rotation: Vector3;
  rotationQuaternion: Quaternion | null;
  enabled: boolean;
}

type RingSnapshotMap = Record<number, PivotSnapshot>;

export interface RingViewButton {
  id: string;
  label: string;
  active: boolean;
}

export interface RingViewDiagnostics {
  orthoLeft: number | null;
  orthoRight: number | null;
  orthoTop: number | null;
  orthoBottom: number | null;
  aspect: number;
  effectiveOrthoHeight: number;
  requiredSafeOrthoHeight: number;
  activeFitMode: string;
}

export class RingViewService {
  private naturalCamera: CameraSnapshot | null = null;
  private naturalPivots: RingSnapshotMap = {};
  private animationFrame = 0;
  private activePresetId: string | null = null;
  private selectedPresetId: string | null = null;
  private activeLayoutId: string | null = null;
  private naturalCaptured = false;
  private developmentOverrides: Record<string, RingViewCameraPreset> = {};
  private lastDiagnostics: RingViewDiagnostics | null = null;
  suspendNaturalTarget = false;

  constructor(private readonly webgl: any) {}

  getPresentationRegistry(): RingPresentationRegistry {
    return new RingPresentationRegistry(cRing.list, RingData.list);
  }

  getButtons(): RingViewButton[] {
    return this.getAvailablePresets().map(preset => ({
      id: preset.id,
      label: preset.label,
      active: this.activePresetId === preset.id,
    }));
  }

  getCalibrationPresets(): iRingViewPreset[] {
    return this.getAvailablePresets();
  }

  getSelectedPresetId(): string | null {
    return this.selectedPresetId || this.activePresetId;
  }

  getLastDiagnostics(): RingViewDiagnostics | null {
    return this.lastDiagnostics;
  }

  setDevelopmentOverrides(overrides: Record<string, RingViewCameraPreset>): void {
    this.developmentOverrides = {...overrides};
  }

  captureCurrentCameraPreset(viewId: string | null = this.getSelectedPresetId()): RingViewCameraPreset | null {
    const camera = this.webgl.camera as ArcRotateCamera;
    if (!camera || !viewId) return null;
    const base = this.getAvailablePresets().find(preset => preset.id === viewId)?.camera;
    const aspect = this.canvasAspect();
    const orthoHeight = camera.mode === Camera.ORTHOGRAPHIC_CAMERA
      ? Math.abs((camera.orthoTop ?? 0) - (camera.orthoBottom ?? 0)) || base?.projection.orthoHeight || 1
      : base?.projection.orthoHeight;
    return {
      alpha: camera.alpha,
      beta: camera.beta,
      target: [camera.target.x, camera.target.y, camera.target.z],
      projection: {
        mode: camera.mode === Camera.ORTHOGRAPHIC_CAMERA ? "orthographic" : "perspective",
        orthoHeight,
        radius: camera.radius,
        screenOffsetX: camera.mode === Camera.ORTHOGRAPHIC_CAMERA && orthoHeight
          ? (((camera.orthoLeft ?? 0) + (camera.orthoRight ?? 0)) / 2) / (orthoHeight * aspect)
          : base?.projection.screenOffsetX ?? 0,
        screenOffsetY: camera.mode === Camera.ORTHOGRAPHIC_CAMERA && orthoHeight
          ? (((camera.orthoTop ?? 0) + (camera.orthoBottom ?? 0)) / 2) / orthoHeight
          : base?.projection.screenOffsetY ?? 0,
      },
      safety: {...(base?.safety ?? defaultSafety())},
    };
  }

  applyCameraPresetPreview(viewId: string, cameraPreset: RingViewCameraPreset): void {
    const preset = this.getAvailablePresets().find(item => item.id === viewId);
    if (!preset) return;
    this.cancelActiveAnimation();
    this.selectedPresetId = viewId;
    this.activePresetId = viewId;
    this.suspendNaturalTarget = true;
    this.applyCameraPreset(cameraPreset, preset.focus);
    this.requestRender(4);
  }

  hasPresentationOverride(): boolean {
    return this.suspendNaturalTarget || !!this.activePresetId || !!this.activeLayoutId;
  }

  refreshNaturalSceneState(): void {
    if (this.activeLayoutId || this.activePresetId) return;
    this.captureNaturalSceneState(true);
  }

  captureNaturalSceneState(force = false): void {
    if (this.naturalCaptured && !force) return;
    const camera = this.webgl.camera as ArcRotateCamera;
    if (!camera) return;
    this.naturalCamera = this.captureCamera(camera);
    this.naturalPivots = {};
    this.getPresentationRegistry().getAvailableHandles().forEach(handle => {
      this.naturalPivots[handle.slot] = this.capturePivot(handle.root);
    });
    this.naturalCaptured = true;
  }

  async applyViewPreset(presetId: string): Promise<void> {
    const preset = this.getAvailablePresets().find(item => item.id === presetId);
    if (!preset) return;
    this.cancelActiveAnimation();
    this.captureNaturalSceneState();
    this.suspendNaturalTarget = true;
    this.activePresetId = preset.id;
    this.selectedPresetId = preset.id;

    const inlineLayout: iRingLayoutPreset | null = preset.ringLayout
      ? {
        id: `${preset.id}__inline`,
        label: preset.label,
        enabled: true,
        source: "manual",
        ringTransforms: preset.ringLayout,
      }
      : null;
    const layout = inlineLayout || (preset.layoutId ? this.getLayouts().find(item => item.id === preset.layoutId && item.enabled !== false) : null);
    if (preset.layoutId && !layout) {
      console.warn(`[RingView] View-Preset ${preset.id} referenziert ein nicht vorhandenes Layout ${preset.layoutId}.`);
    }
    if (layout) {
      this.activeLayoutId = layout.id;
    }

    const startCamera = this.captureCamera(this.webgl.camera);
    const startPivots = this.captureCurrentPivots();
    const targetCamera = this.buildTargetCamera(preset);
    const targetPivots = layout ? this.buildLayoutPivots(layout, startPivots) : startPivots;
    await this.animateTo(startCamera, targetCamera, startPivots, targetPivots, 500);
    this.fitCameraToPreset(preset);
    this.requestRender(4);
  }

  async applyLayoutPreset(layoutId: string | null): Promise<void> {
    if (!layoutId) {
      await this.resetPresentation();
      return;
    }
    const layout = this.getLayouts().find(item => item.id === layoutId && item.enabled !== false);
    if (!layout) return;
    this.cancelActiveAnimation();
    this.captureNaturalSceneState();
    this.suspendNaturalTarget = true;
    this.activeLayoutId = layout.id;
    const start = this.captureCurrentPivots();
    const target = this.buildLayoutPivots(layout, start);
    await this.animatePivots(start, target, 450);
    this.refitActiveView();
  }

  async previewLayoutTransforms(transforms: iRingLayoutPreset["ringTransforms"]): Promise<void> {
    const layout: iRingLayoutPreset = {
      id: "__preview__",
      label: "Preview",
      enabled: true,
      source: "obj-markers",
      ringTransforms: transforms,
    };
    this.cancelActiveAnimation();
    this.captureNaturalSceneState();
    this.suspendNaturalTarget = true;
    this.activeLayoutId = layout.id;
    const start = this.captureCurrentPivots();
    const target = this.buildLayoutPivots(layout, start);
    await this.animatePivots(start, target, 350);
    this.refitActiveView();
  }

  async resetPresentation(): Promise<void> {
    this.cancelActiveAnimation();
    if (!this.naturalCamera) this.captureNaturalSceneState(true);
    const camera = this.webgl.camera as ArcRotateCamera;
    if (this.naturalPivots) {
      Object.keys(this.naturalPivots).forEach(index => {
        const ring = this.getRing(Number(index));
        const snapshot = this.naturalPivots[Number(index)];
        if (ring?.pivot && snapshot) {
          this.applyPivotSnapshot(ring.pivot, snapshot);
          this.stabilizeRingShadows(ring);
        }
      });
    }
    if (camera && this.naturalCamera) {
      this.applyCameraSnapshot(camera, this.naturalCamera);
    }
    this.activeLayoutId = null;
    this.activePresetId = null;
    this.suspendNaturalTarget = false;
    this.naturalCaptured = false;
    this.requestRender(4);
  }

  refitActiveView(): void {
    const preset = this.activePresetId
      ? this.getAvailablePresets().find(item => item.id === this.activePresetId)
      : null;
    if (preset) this.fitCameraToPreset(preset);
    else if (this.suspendNaturalTarget) {
      this.requestRender(3);
      return;
    }
    else this.fitCameraToFocus("all", 0.16);
    this.requestRender(3);
  }

  handleManualCameraInput(): void {
    this.cancelActiveAnimation();
    if (this.activePresetId) this.activePresetId = null;
    this.suspendNaturalTarget = true;
  }

  cancelActiveAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  dispose(): void {
    this.cancelActiveAnimation();
  }

  private getAvailablePresets(): iRingViewPreset[] {
    const activeCount = RingData.list.filter(ring => ring.cartActive).length;
    const composition = this.getPresentationRegistry().getCompositionProfile();
    const runtimePresets = createRuntimeViewPresets(AppComponent.app.state.calibrationProfile, composition.id);
    const configured = runtimePresets.length ? runtimePresets : normalizeViewPresets(AppComponent.app.data.viewPresets);
    const presets = configured.length ? configured : createFallbackViewPresets(activeCount > 1);
    return presets
      .map(preset => this.applyDevelopmentOverride(preset))
      .filter(preset => preset.enabled !== false)
      .filter(preset => preset.availability === "all" || (preset.availability === "pair" ? activeCount > 1 : activeCount === 1))
      .filter(preset => {
        const focusSlot = focusToPresetSlot(preset.focus);
        return focusSlot === null || this.isRingActive(focusSlot);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  }

  private getLayouts(): iRingLayoutPreset[] {
    return normalizeLayoutPresets(AppComponent.app.data.layoutPresets);
  }

  private buildTargetCamera(preset: iRingViewPreset): CameraSnapshot {
    const camera = this.webgl.camera as ArcRotateCamera;
    const snapshot = this.captureCamera(camera);
    snapshot.alpha = preset.camera.alpha;
    snapshot.beta = this.clampBeta(preset.camera.beta);
    if (preset.camera.projection.radius) snapshot.radius = preset.camera.projection.radius;
    if (preset.targetMode === "fixed") {
      snapshot.target = Vector3.FromArray(preset.camera.target);
    } else {
      snapshot.target = this.selectionWorldCenter(preset.focus) || snapshot.target;
    }
    if (preset.camera.projection.mode === "orthographic" && preset.camera.projection.orthoHeight) {
      const frustum = frustumFromOrthoHeight(
        preset.camera.projection.orthoHeight,
        this.canvasAspect(),
        preset.camera.projection.screenOffsetX,
        preset.camera.projection.screenOffsetY
      );
      snapshot.orthoTop = frustum.top;
      snapshot.orthoBottom = frustum.bottom;
      snapshot.orthoLeft = frustum.left;
      snapshot.orthoRight = frustum.right;
    }
    return snapshot;
  }

  private fitCameraToPreset(preset: iRingViewPreset): void {
    if (preset.camera.safety.fitMode === "fixed") {
      this.applyCameraPreset(preset.camera, preset.focus);
      return;
    }
    this.applyCameraPreset(preset.camera, preset.focus);
    this.fitCameraToFocus(preset.focus, preset.camera);
  }

  private fitCameraToFocus(focus: RingViewFocus, cameraPresetOrPadding: RingViewCameraPreset | number): void {
    const camera = this.webgl.camera as ArcRotateCamera;
    if (!camera) return;
    const cameraPreset = typeof cameraPresetOrPadding === "number" ? null : cameraPresetOrPadding;
    const legacyPadding = typeof cameraPresetOrPadding === "number" ? cameraPresetOrPadding : 0.16;
    const safety = cameraPreset?.safety ?? {
      fitMode: "auto" as const,
      paddingTop: legacyPadding,
      paddingRight: legacyPadding,
      paddingBottom: legacyPadding,
      paddingLeft: legacyPadding,
      includeShadowEnvelope: true,
      shadowExtraBottom: 0.18,
      shadowExtraLeft: 0.05,
      shadowExtraRight: 0.05,
    };
    const meshes = this.meshesForFocus(focus, safety.includeShadowEnvelope);
    if (!meshes.length) return;
    const corners = this.meshBoundingCorners(meshes);
    if (!cameraPreset || this.activePresetId === null) {
      const center = centerOf(corners);
      camera.target.copyFrom(center);
    }
    camera.getViewMatrix(true);
    if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA) {
      const view = camera.getViewMatrix();
      const points = corners.map(corner => {
        const transformed = Vector3.TransformCoordinates(corner, view);
        return [transformed.x, transformed.y] as [number, number];
      });
      if (cameraPreset) {
        const bounds = cameraSpaceBounds(points);
        if (!bounds) return;
        const required = requiredOrthoHeight(bounds, this.canvasAspect(), safety);
        const authored = cameraPreset.projection.orthoHeight || Math.abs((camera.orthoTop ?? 1) - (camera.orthoBottom ?? -1));
        const height = effectiveOrthoHeight(authored, required, safety.fitMode);
        const frustum = frustumFromOrthoHeight(height, this.canvasAspect(), cameraPreset.projection.screenOffsetX, cameraPreset.projection.screenOffsetY);
        camera.orthoLeft = frustum.left;
        camera.orthoRight = frustum.right;
        camera.orthoTop = frustum.top;
        camera.orthoBottom = frustum.bottom;
        this.lastDiagnostics = {
          orthoLeft: camera.orthoLeft,
          orthoRight: camera.orthoRight,
          orthoTop: camera.orthoTop,
          orthoBottom: camera.orthoBottom,
          aspect: this.canvasAspect(),
          effectiveOrthoHeight: height,
          requiredSafeOrthoHeight: required,
          activeFitMode: safety.fitMode,
        };
        return;
      }
      const fit = computeOrthographicFit({
        points,
        aspect: this.canvasAspect(),
        padding: legacyPadding,
        minHeight: AppComponent.app.data.webglSettings.cameraMinOrthoSize || 0,
      });
      if (fit) {
        camera.orthoLeft = fit.left;
        camera.orthoRight = fit.right;
        camera.orthoTop = fit.top;
        camera.orthoBottom = fit.bottom;
      }
    } else {
      const center = centerOf(corners);
      const radius = Math.max(...corners.map(corner => Vector3.Distance(corner, center))) * (1 + legacyPadding);
      camera.radius = Math.max(camera.lowerRadiusLimit || 0, Math.min(camera.upperRadiusLimit || radius, radius));
    }
  }

  private applyCameraPreset(cameraPreset: RingViewCameraPreset, focus: RingViewFocus): void {
    const camera = this.webgl.camera as ArcRotateCamera;
    camera.alpha = cameraPreset.alpha;
    camera.beta = this.clampBeta(cameraPreset.beta);
    camera.target.copyFrom(cameraPreset.target ? Vector3.FromArray(cameraPreset.target) : this.selectionWorldCenter(focus) || camera.target);
    if (cameraPreset.projection.radius) camera.radius = cameraPreset.projection.radius;
    if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA && cameraPreset.projection.orthoHeight) {
      const frustum = frustumFromOrthoHeight(
        cameraPreset.projection.orthoHeight,
        this.canvasAspect(),
        cameraPreset.projection.screenOffsetX,
        cameraPreset.projection.screenOffsetY
      );
      camera.orthoLeft = frustum.left;
      camera.orthoRight = frustum.right;
      camera.orthoTop = frustum.top;
      camera.orthoBottom = frustum.bottom;
    }
  }

  private captureCamera(camera: ArcRotateCamera): CameraSnapshot {
    return {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.target.clone(),
      orthoLeft: camera.orthoLeft,
      orthoRight: camera.orthoRight,
      orthoTop: camera.orthoTop,
      orthoBottom: camera.orthoBottom,
    };
  }

  private applyCameraSnapshot(camera: ArcRotateCamera, snapshot: CameraSnapshot): void {
    camera.alpha = snapshot.alpha;
    camera.beta = this.clampBeta(snapshot.beta);
    camera.radius = snapshot.radius;
    camera.target.copyFrom(snapshot.target);
    camera.orthoLeft = snapshot.orthoLeft ?? null;
    camera.orthoRight = snapshot.orthoRight ?? null;
    camera.orthoTop = snapshot.orthoTop ?? null;
    camera.orthoBottom = snapshot.orthoBottom ?? null;
  }

  private capturePivot(pivot: TransformNode): PivotSnapshot {
    return {
      position: pivot.position.clone(),
      rotation: pivot.rotation.clone(),
      rotationQuaternion: pivot.rotationQuaternion ? pivot.rotationQuaternion.clone() : null,
      enabled: pivot.isEnabled(),
    };
  }

  private captureCurrentPivots(): RingSnapshotMap {
    const result: RingSnapshotMap = {};
    cRing.list.forEach(ring => {
      if (ring?.pivot) result[ring.ringData.index] = this.capturePivot(ring.pivot);
    });
    return result;
  }

  private buildLayoutPivots(layout: iRingLayoutPreset, base: RingSnapshotMap): RingSnapshotMap {
    const next: RingSnapshotMap = {...base};
    ALL_PRESET_SLOTS.forEach(index => {
      const transform = layout.ringTransforms[`ring${index}` as keyof iRingLayoutPreset["ringTransforms"]];
      if (!transform || !base[index]) return;
      next[index] = this.snapshotFromTransform(transform, transform.visible ?? base[index].enabled);
    });
    return next;
  }

  private snapshotFromTransform(transform: iRingPresentationTransform, enabled: boolean): PivotSnapshot {
    return {
      position: Vector3.FromArray(transform.position),
      rotation: Vector3.Zero(),
      rotationQuaternion: Quaternion.FromArray(transform.rotationQuaternion).normalize(),
      enabled,
    };
  }

  private applyPivotSnapshot(pivot: TransformNode, snapshot: PivotSnapshot): void {
    pivot.position.copyFrom(snapshot.position);
    if (snapshot.rotationQuaternion) {
      pivot.rotationQuaternion = snapshot.rotationQuaternion.clone();
      pivot.rotation.set(0, 0, 0);
    } else {
      pivot.rotationQuaternion = null;
      pivot.rotation.copyFrom(snapshot.rotation);
    }
    pivot.setEnabled(snapshot.enabled);
  }

  private async animateTo(startCamera: CameraSnapshot, targetCamera: CameraSnapshot, startPivots: RingSnapshotMap, targetPivots: RingSnapshotMap, ms: number): Promise<void> {
    await new Promise<void>(resolve => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.interpolateCamera(startCamera, targetCamera, eased);
        this.interpolatePivots(startPivots, targetPivots, eased);
        this.requestRender(2);
        if (t < 1) this.animationFrame = requestAnimationFrame(step);
        else {
          this.animationFrame = 0;
          resolve();
        }
      };
      this.animationFrame = requestAnimationFrame(step);
    });
  }

  private async animatePivots(startPivots: RingSnapshotMap, targetPivots: RingSnapshotMap, ms: number): Promise<void> {
    await new Promise<void>(resolve => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.interpolatePivots(startPivots, targetPivots, eased);
        this.requestRender(2);
        if (t < 1) this.animationFrame = requestAnimationFrame(step);
        else {
          this.animationFrame = 0;
          resolve();
        }
      };
      this.animationFrame = requestAnimationFrame(step);
    });
  }

  private interpolateCamera(start: CameraSnapshot, target: CameraSnapshot, t: number): void {
    const camera = this.webgl.camera as ArcRotateCamera;
    camera.alpha = start.alpha + shortestAngleDelta(start.alpha, target.alpha) * t;
    camera.beta = this.clampBeta(start.beta + (target.beta - start.beta) * t);
    camera.radius = start.radius + (target.radius - start.radius) * t;
    camera.target = Vector3.Lerp(start.target, target.target, t);
    camera.orthoLeft = lerpOptional(start.orthoLeft, target.orthoLeft, t);
    camera.orthoRight = lerpOptional(start.orthoRight, target.orthoRight, t);
    camera.orthoTop = lerpOptional(start.orthoTop, target.orthoTop, t);
    camera.orthoBottom = lerpOptional(start.orthoBottom, target.orthoBottom, t);
  }

  private interpolatePivots(start: RingSnapshotMap, target: RingSnapshotMap, t: number): void {
    Object.keys(target).forEach(key => {
      const index = Number(key);
      const ring = this.getRing(index);
      const a = start[index];
      const b = target[index];
      if (!ring?.pivot || !a || !b) return;
      ring.pivot.position.copyFrom(Vector3.Lerp(a.position, b.position, t));
      const qa = a.rotationQuaternion || Quaternion.FromEulerAngles(a.rotation.x, a.rotation.y, a.rotation.z);
      const qb = b.rotationQuaternion || Quaternion.FromEulerAngles(b.rotation.x, b.rotation.y, b.rotation.z);
      ring.pivot.rotationQuaternion = Quaternion.Slerp(qa, qb, t).normalize();
      ring.pivot.rotation.set(0, 0, 0);
      ring.pivot.setEnabled(b.enabled);
      if (this.activeLayoutId) this.stabilizeRingShadows(ring);
    });
  }

  private meshesForFocus(focus: RingViewFocus, includeShadow = false): AbstractMesh[] {
    const focusSlot = focusToPresetSlot(focus);
    const indices = focusSlot === null
      ? this.getPresentationRegistry().getActiveHandles().map(handle => handle.slot)
      : [focusSlot];
    const meshes: AbstractMesh[] = [];
    const seen = new Set<AbstractMesh>();
    indices.forEach(index => {
      if (!this.isRingActive(index)) return;
      const ring = this.getRing(index);
      if (!ring?.pivot) return;
      this.ringMeshes(ring).forEach((mesh: AbstractMesh) => {
        if (!seen.has(mesh) && this.isFitMesh(mesh, includeShadow)) {
          seen.add(mesh);
          meshes.push(mesh);
        }
      });
    });
    return meshes;
  }

  private meshBoundingCorners(meshes: AbstractMesh[]): Vector3[] {
    const corners: Vector3[] = [];
    meshes.forEach(mesh => {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      corners.push(...bounds.vectorsWorld.map(v => v.clone()));
    });
    return corners;
  }

  private selectionWorldCenter(focus: RingViewFocus): Vector3 | null {
    const corners = this.meshBoundingCorners(this.meshesForFocus(focus));
    return corners.length ? centerOf(corners) : null;
  }

  private isFitMesh(mesh: AbstractMesh, includeShadow: boolean): boolean {
    if (!mesh.isEnabled() || !mesh.isVisible) return false;
    if (this.isRingShadow(mesh)) return includeShadow;
    const name = (mesh.name || "").toLowerCase();
    return !name.includes("helper") && !name.includes("debug") && !name.includes("axis");
  }

  private ringMeshes(ring: cRing): AbstractMesh[] {
    const handle = this.getPresentationRegistry().getHandle(ring.ringData.index as RingPresetSlot);
    return handle ? handle.getVisualMeshes() : [];
  }

  private isRingShadow(mesh: AbstractMesh): boolean {
    return mesh instanceof Mesh && !!mesh.material && mesh.material === this.webgl.matShadow;
  }

  private stabilizeRingShadows(ring: cRing): void {
    if (!ring?.pivot || !Array.isArray(ring.mesh)) return;
    ring.pivot.computeWorldMatrix(true);
    const pivotPosition = ring.pivot.getAbsolutePosition();
    ring.mesh.forEach(mesh => {
      if (!this.isRingShadow(mesh)) return;
      if (mesh.parent) mesh.setParent(null);
      mesh.position.set(pivotPosition.x, 0, pivotPosition.z);
      mesh.rotationQuaternion = null;
      mesh.rotation.set(Math.PI / 2, 0, 0);
      mesh.computeWorldMatrix(true);
    });
  }

  private getRing(index: number): cRing | undefined {
    return cRing.list.find(ring => ring.ringData.index === index);
  }

  private isRingActive(index: number): boolean {
    return !!RingData.list.find(ring => ring.index === index && ring.cartActive);
  }

  private canvasAspect(): number {
    const canvas = this.webgl.canvas as HTMLCanvasElement;
    return canvas && canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1;
  }

  private clampBeta(beta: number): number {
    const camera = this.webgl.camera as ArcRotateCamera;
    const lower = typeof camera.lowerBetaLimit === "number" && Number.isFinite(camera.lowerBetaLimit) ? camera.lowerBetaLimit : 0.01;
    const upper = typeof camera.upperBetaLimit === "number" && Number.isFinite(camera.upperBetaLimit) ? camera.upperBetaLimit : Math.PI - 0.01;
    return Math.min(upper, Math.max(lower, beta));
  }

  private requestRender(forceFrames: number): void {
    this.webgl.cameraChanged = true;
    if (this.webgl.forceFrames < forceFrames) this.webgl.forceFrames = forceFrames;
  }

  private applyDevelopmentOverride(preset: iRingViewPreset): iRingViewPreset {
    const camera = this.developmentOverrides[preset.id];
    return camera ? {...preset, camera: cloneCameraPreset(camera)} : preset;
  }
}

function cloneCameraPreset(camera: RingViewCameraPreset): RingViewCameraPreset {
  return {
    alpha: camera.alpha,
    beta: camera.beta,
    target: [...camera.target] as [number, number, number],
    projection: {...camera.projection},
    safety: {...camera.safety},
  };
}

function defaultSafety(): RingViewCameraPreset["safety"] {
  return {
    fitMode: "zoom-out-only",
    paddingTop: 0.08,
    paddingRight: 0.1,
    paddingBottom: 0.22,
    paddingLeft: 0.1,
    includeShadowEnvelope: true,
    shadowExtraBottom: 0.18,
    shadowExtraLeft: 0.05,
    shadowExtraRight: 0.05,
  };
}

function centerOf(points: Vector3[]): Vector3 {
  if (!points.length) return Vector3.Zero();
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  points.forEach(point => {
    min.minimizeInPlace(point);
    max.maximizeInPlace(point);
  });
  return min.add(max).scale(0.5);
}

function lerpOptional(a: number | null | undefined, b: number | null | undefined, t: number): number | null {
  if (a === undefined || a === null || b === undefined || b === null) return b ?? a ?? null;
  return a + (b - a) * t;
}
