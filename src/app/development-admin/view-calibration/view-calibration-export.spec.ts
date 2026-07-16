import {RingViewCameraPreset} from "../../app.interfaces";
import {createViewCalibrationJson, createViewCalibrationTypeScript} from "./view-calibration-export";
import {loadViewCalibrationOverrides, saveViewCalibrationOverrides} from "./view-calibration.store";

const camera: RingViewCameraPreset = {
  alpha: -1.23456789,
  beta: 1.11111111,
  target: [1.1234567, 2, 3],
  projection: {
    mode: "orthographic",
    orthoHeight: 12.3456789,
    radius: 60,
    screenOffsetX: 0.01,
    screenOffsetY: -0.02,
  },
  safety: {
    fitMode: "zoom-out-only",
    paddingTop: 0.08,
    paddingRight: 0.1,
    paddingBottom: 0.2,
    paddingLeft: 0.1,
    includeShadowEnvelope: true,
    shadowExtraBottom: 0.18,
  },
};

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("view calibration export", () => {
  it("stores and loads valid overrides", () => {
    const storage = new MemoryStorage();
    saveViewCalibrationOverrides({b: camera}, storage);
    const loaded = loadViewCalibrationOverrides(storage);
    expect(loaded["b"].projection.orthoHeight).toBeCloseTo(camera.projection.orthoHeight!);
  });

  it("ignores invalid storage data", () => {
    const storage = new MemoryStorage();
    storage.setItem("ringconf.dev.view-calibration.v1", "{invalid");
    expect(loadViewCalibrationOverrides(storage)).toEqual({});
  });

  it("exports deterministic JSON", () => {
    const json = createViewCalibrationJson({z: camera, a: camera}, "2.7.6", new Date("2026-01-01T00:00:00.000Z"));
    expect(json.indexOf("\"a\"")).toBeLessThan(json.indexOf("\"z\""));
    expect(json).toContain("\"projectVersion\": \"2.7.6\"");
  });

  it("exports deterministic TypeScript with rounded numbers", () => {
    const ts = createViewCalibrationTypeScript({view: camera});
    expect(ts).toContain("satisfies Record<string, RingViewCameraPreset>");
    expect(ts).toContain("12.345679");
  });
});
