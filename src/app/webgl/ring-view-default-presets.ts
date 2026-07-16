import {iRingViewPreset, RingViewFocus} from "../app.interfaces";

const DEFAULT_ORTHO_HEIGHT = 23.5;
const DETAIL_ORTHO_HEIGHT = 15.5;

export const DEFAULT_PAIR_RING_VIEW_PRESETS = [
  preset("pair", "Paar", "all", 0, -Math.PI / 2, Math.PI / 2.6, DEFAULT_ORTHO_HEIGHT, 0.08, 0.1, 0.18, 0.1),
  preset("ring0-outside", "D außen", "ring0", 10, -Math.PI / 2, Math.PI / 2.6, DETAIL_ORTHO_HEIGHT, 0.08, 0.1, 0.24, 0.1),
  preset("ring0-inside", "D innen", "ring0", 20, Math.PI / 2, Math.PI / 2.2, DETAIL_ORTHO_HEIGHT, 0.08, 0.1, 0.24, 0.1),
  preset("ring1-outside", "H außen", "ring1", 30, -Math.PI / 2, Math.PI / 2.6, DETAIL_ORTHO_HEIGHT, 0.08, 0.1, 0.24, 0.1),
  preset("ring1-inside", "H innen", "ring1", 40, Math.PI / 2, Math.PI / 2.2, DETAIL_ORTHO_HEIGHT, 0.08, 0.1, 0.24, 0.1),
] satisfies iRingViewPreset[];

export const DEFAULT_SINGLE_RING_VIEW_PRESETS = [
  preset("single-outside", "Außen", "all", 0, -Math.PI / 2, Math.PI / 2.6, DETAIL_ORTHO_HEIGHT, 0.08, 0.1, 0.24, 0.1),
  preset("single-inside", "Innen", "all", 10, Math.PI / 2, Math.PI / 2.2, DETAIL_ORTHO_HEIGHT, 0.08, 0.1, 0.24, 0.1),
] satisfies iRingViewPreset[];

export function createDefaultRingViewPresets(pairActive: boolean): iRingViewPreset[] {
  return (pairActive ? DEFAULT_PAIR_RING_VIEW_PRESETS : DEFAULT_SINGLE_RING_VIEW_PRESETS).map(preset => ({
    ...preset,
    camera: {
      ...preset.camera,
      target: [...preset.camera.target] as [number, number, number],
      projection: {...preset.camera.projection},
      safety: {...preset.camera.safety},
    },
  }));
}

function preset(
  id: string,
  label: string,
  focus: RingViewFocus,
  sortOrder: number,
  alpha: number,
  beta: number,
  orthoHeight: number,
  paddingTop: number,
  paddingRight: number,
  paddingBottom: number,
  paddingLeft: number,
): iRingViewPreset {
  return {
    id,
    label,
    enabled: true,
    sortOrder,
    availability: focus === "all" ? "all" : "pair",
    focus,
    targetMode: "selection-center",
    camera: {
      alpha,
      beta,
      target: [0, 10, 0],
      projection: {
        mode: "orthographic",
        orthoHeight,
        radius: 60,
        screenOffsetX: 0,
        screenOffsetY: 0,
      },
      safety: {
        fitMode: "zoom-out-only",
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
        includeShadowEnvelope: true,
        shadowExtraBottom: 0.18,
        shadowExtraLeft: 0.05,
        shadowExtraRight: 0.05,
      },
    },
    layoutId: null,
  };
}
