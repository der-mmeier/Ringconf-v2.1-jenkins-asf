export type RenderQualityMode = "low" | "medium" | "high";

export interface RenderQualitySettings {
  devicePixelRatio: number;
  cappedDevicePixelRatio: number;
  hardwareScalingLevel: number;
  qualityMode: RenderQualityMode;
  isMobile: boolean;
}

const MOBILE_BREAKPOINT = 768;
const LOW_CAP = 1;
const MEDIUM_CAP = 1.5;
const HIGH_CAP = 2;

function clampDpr(value: number) {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, HIGH_CAP);
}

function readQualityOverride(): RenderQualityMode | null {
  try {
    const value = new URLSearchParams(window.location.search).get("quality");
    if (value === "low" || value === "medium" || value === "high") return value;
  } catch {
  }
  return null;
}

export function computeRenderQuality(isMobile?: boolean): RenderQualitySettings {
  const devicePixelRatio = clampDpr(window.devicePixelRatio || 1);
  const mobile = isMobile ?? window.matchMedia("(max-width: " + MOBILE_BREAKPOINT + "px)").matches;
  const qualityMode = readQualityOverride() || "high";

  let cap = HIGH_CAP;
  if (qualityMode === "low") cap = LOW_CAP;
  if (qualityMode === "medium") cap = MEDIUM_CAP;

  const cappedDevicePixelRatio = Math.min(devicePixelRatio, cap);
  return {
    devicePixelRatio,
    cappedDevicePixelRatio,
    hardwareScalingLevel: 1 / cappedDevicePixelRatio,
    qualityMode,
    isMobile: mobile
  };
}
