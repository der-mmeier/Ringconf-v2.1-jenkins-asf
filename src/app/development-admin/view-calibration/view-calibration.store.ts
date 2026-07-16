import {RingViewCameraPreset} from "../../app.interfaces";
import {normalizeCameraPreset} from "../../webgl/ring-view-presets";

export const VIEW_CALIBRATION_STORAGE_KEY = "ringconf.dev.view-calibration.v1";
export const VIEW_CALIBRATION_SCHEMA_VERSION = 1;

export interface ViewCalibrationStoreDocument {
  schemaVersion: 1;
  presets: Record<string, RingViewCameraPreset>;
}

export function loadViewCalibrationOverrides(storage: Storage = localStorage): Record<string, RingViewCameraPreset> {
  try {
    const raw = storage.getItem(VIEW_CALIBRATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    if (record["schemaVersion"] !== VIEW_CALIBRATION_SCHEMA_VERSION) return {};
    const presets = record["presets"];
    if (!presets || typeof presets !== "object" || Array.isArray(presets)) return {};
    const result: Record<string, RingViewCameraPreset> = {};
    Object.keys(presets as Record<string, unknown>).sort().forEach(id => {
      if (!isSafeViewId(id)) return;
      result[id] = normalizeCameraPreset((presets as Record<string, unknown>)[id]);
    });
    return result;
  } catch {
    return {};
  }
}

export function saveViewCalibrationOverrides(presets: Record<string, RingViewCameraPreset>, storage: Storage = localStorage): void {
  const document: ViewCalibrationStoreDocument = {
    schemaVersion: VIEW_CALIBRATION_SCHEMA_VERSION,
    presets: sortedCameraPresets(presets),
  };
  storage.setItem(VIEW_CALIBRATION_STORAGE_KEY, JSON.stringify(document));
}

export function clearViewCalibrationOverrides(storage: Storage = localStorage): void {
  storage.removeItem(VIEW_CALIBRATION_STORAGE_KEY);
}

export function sortedCameraPresets(presets: Record<string, RingViewCameraPreset>): Record<string, RingViewCameraPreset> {
  const result: Record<string, RingViewCameraPreset> = {};
  Object.keys(presets).filter(isSafeViewId).sort().forEach(id => {
    result[id] = normalizeCameraPreset(presets[id]);
  });
  return result;
}

function isSafeViewId(id: string): boolean {
  return /^[a-z0-9_-]+$/i.test(id);
}
