export type ConfiguratorLayoutMode =
  | "phone-portrait"
  | "phone-landscape"
  | "tablet-portrait"
  | "tablet-landscape"
  | "desktop-compact"
  | "desktop-wide";

export type ConfiguratorPointer = "coarse" | "fine";
export type ConfiguratorOrientation = "portrait" | "landscape";
export type ConfiguratorFocusedElement = "engraving-input" | "other-text-input" | null;

export interface ConfiguratorLayoutMeasurement {
  width: number;
  height: number;
  pointer: ConfiguratorPointer;
  layoutViewportWidth?: number;
  layoutViewportHeight?: number;
  visualViewportWidth?: number;
  visualViewportHeight?: number;
  visualViewportOffsetTop?: number;
  focusedElement?: ConfiguratorFocusedElement;
}

export interface ConfiguratorViewportState {
  width: number;
  height: number;
  offsetTop: number;
}

export interface SoftKeyboardState {
  open: boolean;
  occludedHeight: number;
  focusedElement: ConfiguratorFocusedElement;
}

export interface ConfiguratorLayoutState extends ConfiguratorLayoutMeasurement {
  mode: ConfiguratorLayoutMode;
  stableMode: ConfiguratorLayoutMode;
  aspectRatio: number;
  orientation: ConfiguratorOrientation;
  stableOrientation: ConfiguratorOrientation;
  compactHeight: boolean;
  reflowCount: number;
  layoutViewport: ConfiguratorViewportState;
  visualViewport: ConfiguratorViewportState;
  softKeyboard: SoftKeyboardState;
}

export const DEFAULT_CONFIGURATOR_LAYOUT_STATE: ConfiguratorLayoutState = {
  mode: "desktop-compact",
  stableMode: "desktop-compact",
  width: 1024,
  height: 768,
  aspectRatio: 4 / 3,
  pointer: "fine",
  orientation: "landscape",
  stableOrientation: "landscape",
  compactHeight: false,
  reflowCount: 0,
  layoutViewport: {width: 1024, height: 768, offsetTop: 0},
  visualViewport: {width: 1024, height: 768, offsetTop: 0},
  softKeyboard: {open: false, occludedHeight: 0, focusedElement: null},
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
