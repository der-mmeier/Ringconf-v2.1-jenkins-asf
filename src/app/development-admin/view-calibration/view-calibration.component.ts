import {CommonModule} from "@angular/common";
import {Component, HostListener} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {iRingViewPreset, RingViewCameraPreset} from "../../app.interfaces";
import {AppComponent} from "../../app.component";
import {WebglComponent} from "../../webgl/webgl.component";
import {RingViewDiagnostics} from "../../webgl/ring-view.service";
import {
  clearViewCalibrationOverrides,
  loadViewCalibrationOverrides,
  saveViewCalibrationOverrides,
  sortedCameraPresets
} from "./view-calibration.store";
import {createViewCalibrationJson, createViewCalibrationTypeScript} from "./view-calibration-export";

@Component({
  selector: "x-view-calibration",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./view-calibration.component.html",
  styleUrls: ["./view-calibration.component.scss"],
})
export class ViewCalibrationComponent {
  open = false;
  calibrationActive = false;
  selectedViewId = "";
  draft: RingViewCameraPreset | null = null;
  status = "Bereit.";
  overrides: Record<string, RingViewCameraPreset> = {};
  private wheelHandler: ((event: WheelEvent) => void) | null = null;

  constructor() {
    this.loadOverrides();
  }

  get viewOptions(): iRingViewPreset[] {
    return this.service()?.getCalibrationPresets() || [];
  }

  get selectedView(): iRingViewPreset | null {
    return this.viewOptions.find(view => view.id === this.selectedViewId) || null;
  }

  get diagnostics(): RingViewDiagnostics | null {
    return this.service()?.getLastDiagnostics() || null;
  }

  get aspect(): number {
    const canvas = WebglComponent.WEBGL?.canvas as HTMLCanvasElement | undefined;
    return canvas && canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1;
  }

  get projectionMode(): string {
    return WebglComponent.WEBGL?.camera?.mode === 1 ? "orthographic" : "perspective";
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.loadOverrides();
      const current = this.service()?.getSelectedPresetId();
      if (current && !this.selectedViewId) this.selectView(current);
    } else {
      this.disableCalibration();
    }
  }

  selectView(id: string): void {
    this.selectedViewId = id;
    const preset = this.viewOptions.find(view => view.id === id);
    this.draft = preset ? cloneCamera(preset.camera) : null;
  }

  activateCalibration(): void {
    if (!this.selectedViewId) {
      const current = this.service()?.getSelectedPresetId();
      if (current) this.selectView(current);
    }
    if (!this.selectedViewId) {
      this.status = "Bitte zuerst eine Ziel-View wählen.";
      return;
    }
    this.calibrationActive = true;
    const canvas = WebglComponent.WEBGL?.canvas as HTMLCanvasElement | undefined;
    if (canvas && !this.wheelHandler) {
      this.wheelHandler = (event: WheelEvent) => {
        if (!this.calibrationActive) return;
        event.preventDefault();
        this.captureFromCamera();
        if (!this.draft) return;
        const current = this.draft.projection.orthoHeight || 1;
        const factor = Math.exp(event.deltaY * 0.001);
        this.draft.projection.orthoHeight = clamp(current * factor, 2, 80);
        this.applyDraft();
      };
      canvas.addEventListener("wheel", this.wheelHandler, {passive: false});
    }
    this.status = "Kalibrierungsmodus aktiv.";
  }

  disableCalibration(): void {
    const canvas = WebglComponent.WEBGL?.canvas as HTMLCanvasElement | undefined;
    if (canvas && this.wheelHandler) {
      canvas.removeEventListener("wheel", this.wheelHandler);
    }
    this.wheelHandler = null;
    this.calibrationActive = false;
  }

  captureFromCamera(): void {
    const captured = this.service()?.captureCurrentCameraPreset(this.selectedViewId);
    if (captured) {
      this.draft = captured;
      this.status = "Werte aus Kamera übernommen.";
    }
  }

  applyDraft(): void {
    if (!this.selectedViewId || !this.draft) {
      this.status = "Keine Ziel-View ausgewählt.";
      return;
    }
    this.service()?.applyCameraPresetPreview(this.selectedViewId, this.draft);
  }

  saveDraft(): void {
    if (!this.selectedViewId || !this.draft) {
      this.status = "Keine Ziel-View ausgewählt.";
      return;
    }
    this.overrides = {...this.overrides, [this.selectedViewId]: cloneCamera(this.draft)};
    saveViewCalibrationOverrides(this.overrides);
    this.service()?.setDevelopmentOverrides(this.overrides);
    this.status = "Kalibrierung gespeichert.";
  }

  discardDraft(): void {
    if (!this.selectedViewId) return;
    const next = {...this.overrides};
    delete next[this.selectedViewId];
    this.overrides = next;
    saveViewCalibrationOverrides(this.overrides);
    this.service()?.setDevelopmentOverrides(this.overrides);
    this.selectView(this.selectedViewId);
    this.status = "Kalibrierung für diese View verworfen.";
  }

  loadHardcoded(): void {
    this.discardDraft();
    this.status = "Hardcoded-Werte geladen.";
  }

  resetNatural(): void {
    void this.service()?.resetPresentation();
  }

  nudge(axis: "x" | "y" | "z", direction: number): void {
    if (!this.draft) return;
    const step = (this.draft.projection.orthoHeight || 10) * 0.02 * direction;
    const index = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    this.draft.target[index] = Number((this.draft.target[index] + step).toFixed(6));
    this.applyDraft();
  }

  clearAllOverrides(): void {
    clearViewCalibrationOverrides();
    this.overrides = {};
    this.service()?.setDevelopmentOverrides({});
    this.status = "Alle Overrides gelöscht.";
  }

  async copyJson(): Promise<void> {
    await this.copyText(this.exportJson(), "JSON kopiert.");
  }

  downloadJson(): void {
    const blob = new Blob([this.exportJson()], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ringconf-view-calibration.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async copyTypeScript(): Promise<void> {
    await this.copyText(createViewCalibrationTypeScript(this.overrides), "TypeScript kopiert.");
  }

  updateNumber(path: string, value: unknown): void {
    if (!this.draft) return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    const parts = path.split(".");
    let target: any = this.draft;
    while (parts.length > 1) target = target[parts.shift()!];
    target[parts[0]] = n;
    this.applyDraft();
  }

  updateFitMode(value: string): void {
    if (!this.draft || !["fixed", "zoom-out-only", "auto"].includes(value)) return;
    this.draft.safety.fitMode = value as RingViewCameraPreset["safety"]["fitMode"];
    this.applyDraft();
  }

  @HostListener("document:keydown.escape")
  closeOnEscape(): void {
    if (this.open) this.toggle();
  }

  private loadOverrides(): void {
    this.overrides = sortedCameraPresets(loadViewCalibrationOverrides());
    this.service()?.setDevelopmentOverrides(this.overrides);
  }

  private exportJson(): string {
    return createViewCalibrationJson(this.overrides, AppComponent.app?.state?.build || "2.7.6");
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
}

function cloneCamera(camera: RingViewCameraPreset): RingViewCameraPreset {
  return {
    alpha: camera.alpha,
    beta: camera.beta,
    target: [...camera.target] as [number, number, number],
    projection: {...camera.projection},
    safety: {...camera.safety},
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
