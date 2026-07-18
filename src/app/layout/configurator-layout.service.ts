import {Injectable, NgZone} from "@angular/core";
import {
  CONFIGURATOR_LAYOUT_BREAKPOINTS,
  ConfiguratorLayoutBreakpoints
} from "./configurator-layout.breakpoints";
import {
  ConfiguratorLayoutMeasurement,
  ConfiguratorLayoutMode,
  ConfiguratorLayoutState,
  ConfiguratorPointer,
  DEFAULT_CONFIGURATOR_LAYOUT_STATE
} from "./configurator-layout.models";

type LayoutListener = (state: ConfiguratorLayoutState, previous: ConfiguratorLayoutState | null) => void;

@Injectable({providedIn: "root"})
export class ConfiguratorLayoutService {
  private observer: ResizeObserver | null = null;
  private visualViewport: VisualViewport | null = null;
  private pointerMedia: MediaQueryList | null = null;
  private host: HTMLElement | null = null;
  private listener: LayoutListener | null = null;
  private animationFrame = 0;
  private state: ConfiguratorLayoutState = DEFAULT_CONFIGURATOR_LAYOUT_STATE;

  constructor(private readonly zone: NgZone) {}

  get current(): ConfiguratorLayoutState {
    return this.state;
  }

  observe(host: HTMLElement, listener: LayoutListener): void {
    this.dispose();
    this.host = host;
    this.listener = listener;

    this.zone.runOutsideAngular(() => {
      this.pointerMedia = window.matchMedia?.("(pointer: coarse)") ?? null;
      this.pointerMedia?.addEventListener("change", this.scheduleMeasure);

      if ("ResizeObserver" in window) {
        this.observer = new ResizeObserver(this.scheduleMeasure);
        this.observer.observe(host);
      }

      this.visualViewport = window.visualViewport ?? null;
      this.visualViewport?.addEventListener("resize", this.scheduleMeasure, {passive: true});
      window.addEventListener("orientationchange", this.scheduleMeasure, {passive: true});
      this.scheduleMeasure();
    });
  }

  dispose(): void {
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
    this.observer?.disconnect();
    this.observer = null;
    this.visualViewport?.removeEventListener("resize", this.scheduleMeasure);
    this.visualViewport = null;
    this.pointerMedia?.removeEventListener("change", this.scheduleMeasure);
    this.pointerMedia = null;
    window.removeEventListener("orientationchange", this.scheduleMeasure);
    this.host = null;
    this.listener = null;
  }

  private readonly scheduleMeasure = (): void => {
    if (this.animationFrame) return;
    this.animationFrame = window.requestAnimationFrame(() => {
      this.animationFrame = 0;
      this.measureAndEmit();
    });
  };

  private measureAndEmit(): void {
    if (!this.host || !this.listener) return;
    const rect = this.host.getBoundingClientRect();
    const viewportHeight = Math.round(this.visualViewport?.height || window.innerHeight || rect.height || 1);
    const measuredHeight = rect.height ? Math.min(rect.height, viewportHeight) : viewportHeight;
    const measurement: ConfiguratorLayoutMeasurement = {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(measuredHeight)),
      pointer: this.pointerMedia?.matches ? "coarse" : "fine",
    };
    const next = buildConfiguratorLayoutState(measurement, this.state);
    if (sameLayoutState(this.state, next)) return;
    const previous = this.state;
    this.state = {...next, reflowCount: previous.reflowCount + 1};
    this.zone.run(() => this.listener?.(this.state, previous));
  }
}

export function buildConfiguratorLayoutState(
  measurement: ConfiguratorLayoutMeasurement,
  previous: ConfiguratorLayoutState | null = null,
  breakpoints: ConfiguratorLayoutBreakpoints = CONFIGURATOR_LAYOUT_BREAKPOINTS
): ConfiguratorLayoutState {
  const width = Math.max(1, Math.round(measurement.width));
  const height = Math.max(1, Math.round(measurement.height));
  const aspectRatio = width / height;
  const orientation = width >= height ? "landscape" : "portrait";
  const compactHeight = height <= breakpoints.compactLandscapeMaxHeight;
  const rawMode = classifyLayoutMode(width, height, orientation, breakpoints);
  const mode = applyHysteresis(rawMode, previous, width, height, breakpoints);

  return {
    mode,
    width,
    height,
    aspectRatio,
    pointer: measurement.pointer,
    orientation,
    compactHeight,
    reflowCount: previous?.reflowCount ?? 0,
  };
}

export function classifyLayoutMode(
  width: number,
  height: number,
  orientation: "portrait" | "landscape",
  breakpoints: ConfiguratorLayoutBreakpoints = CONFIGURATOR_LAYOUT_BREAKPOINTS
): ConfiguratorLayoutMode {
  if (orientation === "portrait") {
    if (width <= breakpoints.phoneMaxWidth) return "phone-portrait";
    if (width <= breakpoints.tabletMaxWidth) return "tablet-portrait";
    if (width >= breakpoints.desktopWideMinWidth) return "desktop-wide";
    return "desktop-compact";
  }

  if (height <= breakpoints.compactLandscapeMaxHeight && width <= breakpoints.tabletMaxWidth) {
    return "phone-landscape";
  }
  if (width <= breakpoints.tabletMaxWidth) {
    return "tablet-landscape";
  }
  if (width >= breakpoints.desktopWideMinWidth) {
    return "desktop-wide";
  }
  return "desktop-compact";
}

export function sameLayoutState(a: ConfiguratorLayoutState, b: ConfiguratorLayoutState): boolean {
  return a.mode === b.mode
    && a.width === b.width
    && a.height === b.height
    && a.pointer === b.pointer
    && a.orientation === b.orientation
    && a.compactHeight === b.compactHeight;
}

function applyHysteresis(
  rawMode: ConfiguratorLayoutMode,
  previous: ConfiguratorLayoutState | null,
  width: number,
  height: number,
  breakpoints: ConfiguratorLayoutBreakpoints
): ConfiguratorLayoutMode {
  if (!previous || previous.mode === rawMode) return rawMode;
  if (near(width, breakpoints.phoneMaxWidth, breakpoints.hysteresis)) return previous.mode;
  if (near(width, breakpoints.tabletMaxWidth, breakpoints.hysteresis)) return previous.mode;
  if (near(width, breakpoints.desktopWideMinWidth, breakpoints.hysteresis)) return previous.mode;
  if (near(height, breakpoints.compactLandscapeMaxHeight, breakpoints.hysteresis)) return previous.mode;
  return rawMode;
}

function near(value: number, target: number, tolerance: number): boolean {
  return Math.abs(value - target) <= tolerance;
}

export function pointerFromMatch(matches: boolean): ConfiguratorPointer {
  return matches ? "coarse" : "fine";
}
