import {Injectable, NgZone} from "@angular/core";
import {
  CONFIGURATOR_LAYOUT_BREAKPOINTS,
  ConfiguratorLayoutBreakpoints
} from "./configurator-layout.breakpoints";
import {
  ConfiguratorLayoutMeasurement,
  ConfiguratorLayoutMode,
  ConfiguratorLayoutState,
  ConfiguratorFocusedElement,
  ConfiguratorOrientation,
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
      this.visualViewport?.addEventListener("scroll", this.scheduleMeasure, {passive: true});
      window.addEventListener("orientationchange", this.scheduleMeasure, {passive: true});
      window.addEventListener("focusin", this.scheduleMeasure, {passive: true});
      window.addEventListener("focusout", this.scheduleMeasure, {passive: true});
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
    this.visualViewport?.removeEventListener("scroll", this.scheduleMeasure);
    this.visualViewport = null;
    this.pointerMedia?.removeEventListener("change", this.scheduleMeasure);
    this.pointerMedia = null;
    window.removeEventListener("orientationchange", this.scheduleMeasure);
    window.removeEventListener("focusin", this.scheduleMeasure);
    window.removeEventListener("focusout", this.scheduleMeasure);
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
    const layoutViewportWidth = Math.round(window.innerWidth || document.documentElement.clientWidth || rect.width || 1);
    const layoutViewportHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || rect.height || 1);
    const visualViewportWidth = Math.round(this.visualViewport?.width || layoutViewportWidth);
    const visualViewportHeight = Math.round(this.visualViewport?.height || layoutViewportHeight);
    const visualViewportOffsetTop = Math.round(this.visualViewport?.offsetTop || 0);
    const measurement: ConfiguratorLayoutMeasurement = {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height || layoutViewportHeight)),
      pointer: this.pointerMedia?.matches ? "coarse" : "fine",
      layoutViewportWidth,
      layoutViewportHeight,
      visualViewportWidth,
      visualViewportHeight,
      visualViewportOffsetTop,
      focusedElement: getFocusedTextElement(),
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
  const layoutViewport = {
    width: Math.max(1, Math.round(measurement.layoutViewportWidth ?? width)),
    height: Math.max(1, Math.round(measurement.layoutViewportHeight ?? height)),
    offsetTop: 0,
  };
  const visualViewport = {
    width: Math.max(1, Math.round(measurement.visualViewportWidth ?? layoutViewport.width)),
    height: Math.max(1, Math.round(measurement.visualViewportHeight ?? layoutViewport.height)),
    offsetTop: Math.max(0, Math.round(measurement.visualViewportOffsetTop ?? 0)),
  };
  const softKeyboard = detectSoftKeyboard(measurement, layoutViewport, visualViewport, breakpoints);
  const keyboardFreezesPortrait = softKeyboard.open
    && previous?.stableMode === "phone-portrait"
    && previous?.stableOrientation === "portrait"
    && layoutViewport.height > layoutViewport.width;
  const classificationHeight = keyboardFreezesPortrait
    ? Math.max(height, previous?.height ?? 0, layoutViewport.height)
    : (softKeyboard.open && layoutViewport.height > height ? layoutViewport.height : height);
  const classificationOrientation = keyboardFreezesPortrait
    ? "portrait"
    : getMeasuredOrientation(width, classificationHeight);
  const aspectRatio = width / height;
  const compactHeight = height <= breakpoints.compactLandscapeMaxHeight;
  const rawMode = keyboardFreezesPortrait
    ? "phone-portrait"
    : classifyLayoutMode(width, classificationHeight, classificationOrientation, breakpoints);
  const mode = applyHysteresis(rawMode, previous, width, classificationHeight, breakpoints);
  const stableMode = softKeyboard.open && previous ? previous.stableMode : mode;
  const stableOrientation = softKeyboard.open && previous ? previous.stableOrientation : classificationOrientation;

  return {
    mode,
    stableMode,
    width,
    height,
    aspectRatio,
    pointer: measurement.pointer,
    orientation: classificationOrientation,
    stableOrientation,
    compactHeight,
    reflowCount: previous?.reflowCount ?? 0,
    layoutViewport,
    visualViewport,
    softKeyboard,
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
    && a.stableMode === b.stableMode
    && a.width === b.width
    && a.height === b.height
    && a.pointer === b.pointer
    && a.orientation === b.orientation
    && a.stableOrientation === b.stableOrientation
    && a.compactHeight === b.compactHeight
    && a.layoutViewport.width === b.layoutViewport.width
    && a.layoutViewport.height === b.layoutViewport.height
    && a.visualViewport.width === b.visualViewport.width
    && a.visualViewport.height === b.visualViewport.height
    && a.visualViewport.offsetTop === b.visualViewport.offsetTop
    && a.softKeyboard.open === b.softKeyboard.open
    && a.softKeyboard.occludedHeight === b.softKeyboard.occludedHeight
    && a.softKeyboard.focusedElement === b.softKeyboard.focusedElement;
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

function detectSoftKeyboard(
  measurement: ConfiguratorLayoutMeasurement,
  layoutViewport: {width: number; height: number},
  visualViewport: {width: number; height: number},
  breakpoints: ConfiguratorLayoutBreakpoints
) {
  const focusedElement = measurement.focusedElement ?? null;
  const occludedHeight = Math.max(0, layoutViewport.height - visualViewport.height);
  const widthDelta = Math.abs(layoutViewport.width - visualViewport.width);
  const focusedText = focusedElement !== null;
  const enoughHeightLoss = occludedHeight >= breakpoints.softKeyboardMinOccludedHeight
    && occludedHeight / layoutViewport.height >= breakpoints.softKeyboardMinOccludedRatio;
  const widthStable = widthDelta <= breakpoints.softKeyboardWidthTolerance;
  const open = measurement.pointer === "coarse" && focusedText && enoughHeightLoss && widthStable;
  return {
    open,
    occludedHeight: open ? occludedHeight : 0,
    focusedElement,
  };
}

function getMeasuredOrientation(width: number, height: number): ConfiguratorOrientation {
  return width >= height ? "landscape" : "portrait";
}

function getFocusedTextElement(): ConfiguratorFocusedElement {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return null;
  if (!isTextEditingElement(active)) return null;
  return active.closest("[data-asf-engraving-input='true'], x-config-engraving")
    ? "engraving-input"
    : "other-text-input";
}

function isTextEditingElement(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    const type = (element.type || "text").toLowerCase();
    return ["text", "search", "email", "tel", "url", "password", "number", "decimal"].includes(type)
      || element.inputMode !== "";
  }
  return element.isContentEditable;
}

export function pointerFromMatch(matches: boolean): ConfiguratorPointer {
  return matches ? "coarse" : "fine";
}
