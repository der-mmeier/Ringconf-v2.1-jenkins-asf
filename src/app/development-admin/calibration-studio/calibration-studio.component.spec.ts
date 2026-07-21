import {CALIBRATION_FIELD_DEFINITIONS, getCalibrationFieldDefinition} from "./calibration-field-definitions";
import {easing, normalizeQuaternion} from "./calibration-studio.component";

describe("Calibration Studio 2.0", () => {
  it("has help metadata for every exportable field", () => {
    const exportable = CALIBRATION_FIELD_DEFINITIONS.filter(field => field.exportable);
    expect(exportable.length).toBeGreaterThan(0);
    for (const field of exportable) {
      expect(field.key).toBeTruthy();
      expect(field.label).toBeTruthy();
      expect(field.help.length).toBeGreaterThan(20);
      expect(getCalibrationFieldDefinition(field.key)).toBe(field);
    }
  });

  it("keeps ringRotationX out of presentation field metadata", () => {
    expect(CALIBRATION_FIELD_DEFINITIONS.some(field => field.key === "ringRotationX")).toBeFalse();
    expect(CALIBRATION_FIELD_DEFINITIONS.some(field => field.legacyShopwareKey === "ringRotationX")).toBeFalse();
  });

  it("normalizes quaternions deterministically", () => {
    expect(normalizeQuaternion([0, 0, 0, 2])).toEqual([0, 0, 0, 1]);
    expect(normalizeQuaternion([0, 0, 0, 0])).toEqual([0, 0, 0, 1]);
  });

  it("uses deterministic easing functions", () => {
    expect(easing(0, "linear")).toBe(0);
    expect(easing(1, "linear")).toBe(1);
    expect(easing(0.5, "ease-in")).toBeCloseTo(0.25, 6);
    expect(easing(0.5, "ease-out")).toBeCloseTo(0.75, 6);
    expect(easing(0.5, "ease-in-out")).toBeCloseTo(0.5, 6);
    expect(easing(1, "legacy-exponential")).toBeGreaterThan(0.99);
  });
});
