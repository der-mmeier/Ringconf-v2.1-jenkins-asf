export type ConfiguratorLayoutMode =
  | "phone-portrait"
  | "phone-landscape"
  | "tablet-portrait"
  | "tablet-landscape"
  | "desktop-compact"
  | "desktop-wide";

export type ConfiguratorPointer = "coarse" | "fine";
export type ConfiguratorOrientation = "portrait" | "landscape";

export interface ConfiguratorLayoutMeasurement {
  width: number;
  height: number;
  pointer: ConfiguratorPointer;
}

export interface ConfiguratorLayoutState extends ConfiguratorLayoutMeasurement {
  mode: ConfiguratorLayoutMode;
  aspectRatio: number;
  orientation: ConfiguratorOrientation;
  compactHeight: boolean;
  reflowCount: number;
}

export const DEFAULT_CONFIGURATOR_LAYOUT_STATE: ConfiguratorLayoutState = {
  mode: "desktop-compact",
  width: 1024,
  height: 768,
  aspectRatio: 4 / 3,
  pointer: "fine",
  orientation: "landscape",
  compactHeight: false,
  reflowCount: 0,
};

export function isConfiguratorPanelPersistent(mode: ConfiguratorLayoutMode): boolean {
  return mode === "desktop-wide"
    || mode === "desktop-compact"
    || mode === "tablet-landscape";
}

export function isConfiguratorRailMode(mode: ConfiguratorLayoutMode): boolean {
  return mode === "phone-landscape" || mode === "tablet-landscape";
}

export function isConfiguratorDrawerMode(mode: ConfiguratorLayoutMode): boolean {
  return mode === "phone-landscape";
}
