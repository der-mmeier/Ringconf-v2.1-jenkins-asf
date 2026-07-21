import {
  buildConfiguratorLayoutState,
  classifyLayoutMode,
  sameLayoutState
} from "./configurator-layout.service";

describe("configurator layout classification", () => {
  it("maps viewport matrix examples to adaptive modes", () => {
    expect(mode(390, 844)).toBe("phone-portrait");
    expect(mode(844, 390)).toBe("phone-landscape");
    expect(mode(768, 1024)).toBe("tablet-portrait");
    expect(mode(1024, 768)).toBe("tablet-landscape");
    expect(mode(1366, 768)).toBe("desktop-compact");
    expect(mode(1920, 1080)).toBe("desktop-wide");
  });

  it("covers the required viewport matrix", () => {
    const cases: Array<[number, number, string]> = [
      [320, 568, "phone-portrait"],
      [360, 800, "phone-portrait"],
      [390, 844, "phone-portrait"],
      [568, 320, "phone-landscape"],
      [667, 375, "phone-landscape"],
      [844, 390, "phone-landscape"],
      [768, 1024, "tablet-portrait"],
      [820, 1180, "tablet-portrait"],
      [1024, 768, "tablet-landscape"],
      [1180, 820, "tablet-landscape"],
      [1280, 720, "desktop-compact"],
      [1366, 768, "desktop-compact"],
      [1440, 900, "desktop-wide"],
      [1920, 1080, "desktop-wide"],
    ];
    cases.forEach(([width, height, expected]) => {
      expect(mode(width, height)).withContext(`${width} x ${height}`).toBe(expected);
    });
  });

  it("keeps phone and tablet boundaries stable inside hysteresis", () => {
    const previous = buildConfiguratorLayoutState({width: 760, height: 1024, pointer: "coarse"});
    const next = buildConfiguratorLayoutState({width: 776, height: 1024, pointer: "coarse"}, previous);
    expect(previous.mode).toBe("phone-portrait");
    expect(next.mode).toBe("phone-portrait");
  });

  it("does not report a new state for identical measurements", () => {
    const first = buildConfiguratorLayoutState({width: 1024, height: 768, pointer: "coarse"});
    const second = buildConfiguratorLayoutState({width: 1024, height: 768, pointer: "coarse"}, first);
    expect(sameLayoutState(first, second)).toBeTrue();
  });

  it("classifies by measured container instead of user agent", () => {
    expect(mode(844, 1024)).toBe("tablet-portrait");
    expect(mode(844, 390)).toBe("phone-landscape");
  });

  it("uses pointer capability as state without changing geometry classification", () => {
    const coarse = buildConfiguratorLayoutState({width: 1024, height: 768, pointer: "coarse"});
    const fine = buildConfiguratorLayoutState({width: 1024, height: 768, pointer: "fine"}, coarse);
    expect(coarse.mode).toBe("tablet-landscape");
    expect(fine.mode).toBe("tablet-landscape");
    expect(fine.pointer).toBe("fine");
  });

  it("keeps Pixel-sized portrait stable without keyboard", () => {
    const state = buildConfiguratorLayoutState({
      width: 412,
      height: 915,
      pointer: "coarse",
      layoutViewportWidth: 412,
      layoutViewportHeight: 915,
      visualViewportWidth: 412,
      visualViewportHeight: 915,
      focusedElement: null,
    });
    expect(state.mode).toBe("phone-portrait");
    expect(state.softKeyboard.open).toBeFalse();
  });

  it("does not switch phone portrait to landscape when a soft keyboard shrinks the visual viewport", () => {
    const previous = buildConfiguratorLayoutState({
      width: 412,
      height: 915,
      pointer: "coarse",
      layoutViewportWidth: 412,
      layoutViewportHeight: 915,
      visualViewportWidth: 412,
      visualViewportHeight: 915,
    });
    const next = buildConfiguratorLayoutState({
      width: 412,
      height: 390,
      pointer: "coarse",
      layoutViewportWidth: 412,
      layoutViewportHeight: 915,
      visualViewportWidth: 412,
      visualViewportHeight: 420,
      focusedElement: "engraving-input",
    }, previous);
    expect(next.mode).toBe("phone-portrait");
    expect(next.stableMode).toBe("phone-portrait");
    expect(next.softKeyboard.open).toBeTrue();
    expect(next.softKeyboard.focusedElement).toBe("engraving-input");
  });

  it("does not infer a soft keyboard from the same shrink without text focus", () => {
    const previous = buildConfiguratorLayoutState({
      width: 412,
      height: 915,
      pointer: "coarse",
      layoutViewportWidth: 412,
      layoutViewportHeight: 915,
      visualViewportWidth: 412,
      visualViewportHeight: 915,
    });
    const next = buildConfiguratorLayoutState({
      width: 412,
      height: 390,
      pointer: "coarse",
      layoutViewportWidth: 412,
      layoutViewportHeight: 915,
      visualViewportWidth: 412,
      visualViewportHeight: 420,
      focusedElement: null,
    }, previous);
    expect(next.softKeyboard.open).toBeFalse();
  });

  it("recognizes a real orientation change while a text field is focused", () => {
    const previous = buildConfiguratorLayoutState({
      width: 412,
      height: 915,
      pointer: "coarse",
      layoutViewportWidth: 412,
      layoutViewportHeight: 915,
      visualViewportWidth: 412,
      visualViewportHeight: 915,
    });
    const next = buildConfiguratorLayoutState({
      width: 915,
      height: 412,
      pointer: "coarse",
      layoutViewportWidth: 915,
      layoutViewportHeight: 412,
      visualViewportWidth: 915,
      visualViewportHeight: 260,
      focusedElement: "engraving-input",
    }, previous);
    expect(next.mode).toBe("phone-landscape");
    expect(next.orientation).toBe("landscape");
  });

  it("returns to normal portrait state when the keyboard closes", () => {
    const portrait = buildConfiguratorLayoutState({
      width: 412,
      height: 915,
      pointer: "coarse",
      layoutViewportWidth: 412,
      layoutViewportHeight: 915,
      visualViewportWidth: 412,
      visualViewportHeight: 915,
    });
    const keyboard = buildConfiguratorLayoutState({
      width: 412,
      height: 390,
      pointer: "coarse",
      layoutViewportWidth: 412,
      layoutViewportHeight: 915,
      visualViewportWidth: 412,
      visualViewportHeight: 420,
      focusedElement: "engraving-input",
    }, portrait);
    const closed = buildConfiguratorLayoutState({
      width: 412,
      height: 915,
      pointer: "coarse",
      layoutViewportWidth: 412,
      layoutViewportHeight: 915,
      visualViewportWidth: 412,
      visualViewportHeight: 915,
      focusedElement: null,
    }, keyboard);
    expect(closed.mode).toBe("phone-portrait");
    expect(closed.softKeyboard.open).toBeFalse();
  });

  it("does not carry reflow count into pure classification changes", () => {
    const previous = {...buildConfiguratorLayoutState({width: 1920, height: 1080, pointer: "fine"}), reflowCount: 12};
    const next = buildConfiguratorLayoutState({width: 1366, height: 768, pointer: "fine"}, previous);
    expect(next.mode).toBe("desktop-compact");
    expect(next.reflowCount).toBe(12);
  });
});

function mode(width: number, height: number) {
  return classifyLayoutMode(width, height, width >= height ? "landscape" : "portrait");
}
