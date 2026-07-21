import {RingPresetSlot, RingRole} from "../../preset-slots";
import {CompositionProfileId} from "../../webgl/ring-presentation";

export type CalibrationEasing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "legacy-exponential";

export interface CameraPose {
  alpha: number;
  beta: number;
  target: [number, number, number];
  projection: {
    mode: "orthographic" | "perspective";
    orthoHeight?: number;
    radius?: number;
    screenOffsetX?: number;
    screenOffsetY?: number;
  };
}

export interface StartupCameraSequence {
  enabled: boolean;
  delayMs: number;
  durationMs: number;
  easing: CalibrationEasing;
  start: CameraPose;
  end: CameraPose;
  interruptOnUserInput: boolean;
}

export interface RingPresentationCalibration {
  slot: RingPresetSlot;
  role: RingRole;
  position: [number, number, number];
  rotationQuaternion: [number, number, number, number];
  visible: boolean;
}

export interface CalibrationStudioState {
  schemaVersion: 2;
  projectVersion: string;
  composition: CompositionProfileId;
  rings: RingPresentationCalibration[];
  startup: StartupCameraSequence;
  dirty: boolean;
}

export interface CalibrationFieldDefinition {
  key: string;
  label: string;
  category: string;
  type: "number" | "boolean" | "enum" | "vector3" | "quaternion";
  unit?: "rad" | "deg" | "world" | "ms" | "ratio";
  help: string;
  babylonProperty?: string;
  safeRange?: {
    min?: number;
    max?: number;
  };
  legacyShopwareKey?: string;
  exportable: boolean;
}

export interface CalibrationModalGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  minimized: boolean;
}
