import {createRuntimeViewPresets, validateCalibrationRuntimeProfile} from "./calibration-runtime";

describe("calibration runtime", () => {
  it("normalizes active DB views to ring view presets", () => {
    const profile = validateCalibrationRuntimeProfile({
      schemaVersion: 1,
      profileKey: "active",
      name: "Active",
      status: "active",
      revision: 3,
      compositions: [{
        compositionKey: "wedding-pair",
        label: "Trauringpaar",
        activeSlots: [0, 1],
        enabled: true,
        sortOrder: 0,
        revision: 1,
        views: [{
          viewKey: "pair",
          name: "Paar",
          enabled: true,
          isDefault: true,
          sortOrder: 0,
          revision: 1,
          camera: {
            alpha: 1,
            beta: 2,
            target: [0, 10, 0],
            projection: {mode: "orthographic", orthoHeight: 20, radius: 60},
            safety: {fitMode: "zoom-out-only", paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, includeShadowEnvelope: true},
            focus: "all",
            targetMode: "selection-center",
          },
          ringLayout: {rings: [{slot: 0, visible: true, position: [1, 2, 3], rotationQuaternion: [0, 0, 0, 1]}]},
          framing: {},
        }],
      }],
    });

    const presets = createRuntimeViewPresets(profile, "wedding-pair");

    expect(presets.length).toBe(1);
    expect(presets[0].id).toBe("pair");
    expect(presets[0].ringLayout?.ring0?.position).toEqual([1, 2, 3]);
  });

  it("returns no fallback presets when no DB profile is available", () => {
    expect(createRuntimeViewPresets(null, "wedding-pair")).toEqual([]);
  });
});

