export interface ConfiguratorLayoutBreakpoints {
  phoneMaxWidth: number;
  tabletMaxWidth: number;
  compactLandscapeMaxHeight: number;
  desktopWideMinWidth: number;
  hysteresis: number;
}

export const CONFIGURATOR_LAYOUT_BREAKPOINTS: ConfiguratorLayoutBreakpoints = {
  phoneMaxWidth: 767,
  tabletMaxWidth: 1199,
  compactLandscapeMaxHeight: 540,
  desktopWideMinWidth: 1440,
  hysteresis: 24,
};
