import {
  computeOrthographicFit,
  effectiveOrthoHeight,
  frustumFromOrthoHeight,
  requiredOrthoHeight,
  shortestAngleDelta
} from "./ring-view-fit";
import {normalizeLayoutPresets, normalizeViewPresets} from "./ring-view-presets";

describe("ring view fit", () => {
  it("fits landscape aspect without clipping", () => {
    const fit = computeOrthographicFit({points: [[-1, -1], [1, 1]], aspect: 2, padding: 0});
    expect(fit?.width).toBeCloseTo(4);
    expect(fit?.height).toBeCloseTo(2);
  });

  it("fits portrait aspect without clipping", () => {
    const fit = computeOrthographicFit({points: [[-2, -1], [2, 1]], aspect: 0.5, padding: 0});
    expect(fit?.width).toBeCloseTo(4);
    expect(fit?.height).toBeCloseTo(8);
  });

  it("keeps off-center bounds off-center", () => {
    const fit = computeOrthographicFit({points: [[10, 2], [14, 4]], aspect: 1, padding: 0});
    expect(fit?.centerX).toBeCloseTo(12);
    expect(fit?.centerY).toBeCloseTo(3);
  });

  it("interpolates alpha over the shortest cyclic path", () => {
    const delta = shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1);
    expect(delta).toBeCloseTo(0.2);
  });

  it("normalizes legacy AppData without view or layout fields", () => {
    expect(normalizeViewPresets(undefined)).toEqual([]);
    expect(normalizeLayoutPresets(undefined)).toEqual([]);
  });

  it("drops invalid layout references during layout normalization", () => {
    const layouts = normalizeLayoutPresets([{id: "a", ringTransforms: {ring0: {position: [1, 2, 3], rotationQuaternion: [0, 0, 0, 2]}}}]);
    expect(layouts.length).toBe(1);
    expect(layouts[0].ringTransforms.ring0?.rotationQuaternion[3]).toBeCloseTo(1);
  });

  it("converts orthoHeight to landscape frustum", () => {
    const frustum = frustumFromOrthoHeight(10, 2);
    expect(frustum.width).toBeCloseTo(20);
    expect(frustum.height).toBeCloseTo(10);
  });

  it("converts orthoHeight to portrait frustum", () => {
    const frustum = frustumFromOrthoHeight(10, 0.5);
    expect(frustum.width).toBeCloseTo(5);
    expect(frustum.height).toBeCloseTo(10);
  });

  it("applies screen offsets", () => {
    const frustum = frustumFromOrthoHeight(10, 1, 0.1, -0.2);
    expect((frustum.left + frustum.right) / 2).toBeCloseTo(1);
    expect((frustum.top + frustum.bottom) / 2).toBeCloseTo(-2);
  });

  it("zoom-out-only never zooms in from authored height", () => {
    expect(effectiveOrthoHeight(20, 10, "zoom-out-only")).toBe(20);
    expect(effectiveOrthoHeight(20, 30, "zoom-out-only")).toBe(30);
  });

  it("uses side paddings and shadow envelope for required height", () => {
    const required = requiredOrthoHeight(
      {minX: -5, maxX: 5, minY: -2, maxY: 2},
      1,
      {
        fitMode: "auto",
        paddingTop: 0.1,
        paddingRight: 0.1,
        paddingBottom: 0.2,
        paddingLeft: 0.1,
        includeShadowEnvelope: true,
        shadowExtraBottom: 0.5,
      }
    );
    expect(required).toBeGreaterThan(10);
  });
});
