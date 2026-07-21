import {CompositionProfileId} from "../webgl/ring-presentation";
import {iRingLayoutPreset, RingViewCameraPreset} from "../app.interfaces";

export interface CalibrationRuntimeProfile {
  schemaVersion: number;
  profileKey: string;
  name: string;
  status: "draft" | "active" | "retired" | string;
  revision: number;
  compositions: CalibrationRuntimeComposition[];
}

export interface CalibrationRuntimeComposition {
  id?: number;
  compositionKey: CompositionProfileId;
  label: string;
  activeSlots: number[];
  startupSequence: unknown;
  naturalRingLayout: {
    rings?: CalibrationRuntimeRingTransform[];
  };
  defaultFraming: unknown;
  enabled: boolean;
  sortOrder: number;
  revision: number;
  views: CalibrationRuntimeView[];
}

export interface CalibrationRuntimeView {
  id?: number;
  viewKey: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
  revision: number;
  camera: RingViewCameraPreset & {
    focus?: string;
    targetMode?: string;
  };
  ringLayout: {
    rings?: CalibrationRuntimeRingTransform[];
  };
  framing: unknown;
  updatedAt?: string;
}

export interface CalibrationRuntimeRingTransform {
  slot: number;
  role?: string;
  visible: boolean;
  position: [number, number, number];
  rotationQuaternion: [number, number, number, number];
}

export type CalibrationRingTransforms = iRingLayoutPreset["ringTransforms"];

