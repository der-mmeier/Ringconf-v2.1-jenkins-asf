import {RingViewCameraPreset} from "../../app.interfaces";
import {sortedCameraPresets, VIEW_CALIBRATION_SCHEMA_VERSION} from "./view-calibration.store";

export interface ViewCalibrationExportDocument {
  schemaVersion: 1;
  generatedAt: string;
  projectVersion: string;
  presets: Record<string, RingViewCameraPreset>;
}

export function createViewCalibrationJson(presets: Record<string, RingViewCameraPreset>, projectVersion: string, now = new Date()): string {
  const document: ViewCalibrationExportDocument = {
    schemaVersion: VIEW_CALIBRATION_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    projectVersion,
    presets: roundPresets(sortedCameraPresets(presets)),
  };
  return JSON.stringify(document, null, 2);
}

export function createViewCalibrationTypeScript(presets: Record<string, RingViewCameraPreset>): string {
  const rounded = roundPresets(sortedCameraPresets(presets));
  const body = JSON.stringify(rounded, null, 2);
  return `import {RingViewCameraPreset} from "../app.interfaces";\n\nexport const CALIBRATED_RING_VIEW_CAMERA_PRESETS = ${body} satisfies Record<string, RingViewCameraPreset>;\n`;
}

function roundPresets(presets: Record<string, RingViewCameraPreset>): Record<string, RingViewCameraPreset> {
  const result: Record<string, RingViewCameraPreset> = {};
  Object.keys(presets).sort().forEach(id => {
    const camera = presets[id];
    result[id] = {
      alpha: round(camera.alpha),
      beta: round(camera.beta),
      target: camera.target.map(round) as [number, number, number],
      projection: {
        mode: camera.projection.mode,
        orthoHeight: optionalRound(camera.projection.orthoHeight),
        radius: optionalRound(camera.projection.radius),
        screenOffsetX: optionalRound(camera.projection.screenOffsetX),
        screenOffsetY: optionalRound(camera.projection.screenOffsetY),
      },
      safety: {
        fitMode: camera.safety.fitMode,
        paddingTop: round(camera.safety.paddingTop),
        paddingRight: round(camera.safety.paddingRight),
        paddingBottom: round(camera.safety.paddingBottom),
        paddingLeft: round(camera.safety.paddingLeft),
        includeShadowEnvelope: camera.safety.includeShadowEnvelope,
        shadowExtraBottom: optionalRound(camera.safety.shadowExtraBottom),
        shadowExtraLeft: optionalRound(camera.safety.shadowExtraLeft),
        shadowExtraRight: optionalRound(camera.safety.shadowExtraRight),
      },
    };
  });
  return result;
}

function round(value: number): number {
  return Number(Number(value).toFixed(6));
}

function optionalRound(value: number | undefined): number | undefined {
  return value === undefined ? undefined : round(value);
}
