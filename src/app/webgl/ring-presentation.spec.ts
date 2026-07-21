import {normalizeLayoutPresets, normalizeViewPresets} from "./ring-view-presets";
import {COMPOSITION_PROFILES, focusToPresetSlot} from "./ring-presentation";
import {RingPresetSlot} from "../preset-slots";

describe("ring presentation foundation", () => {
  it("defines the required composition profiles", () => {
    expect(COMPOSITION_PROFILES.map(profile => profile.id)).toEqual([
      "wedding-pair",
      "wedding-plus-engagement",
      "wedding-plus-memoire",
      "wedding-plus-both",
      "engagement-only",
      "memoire-only",
    ]);
    expect(COMPOSITION_PROFILES.find(profile => profile.id === "wedding-plus-both")?.slots).toEqual([
      RingPresetSlot.WeddingFemale,
      RingPresetSlot.WeddingMale,
      RingPresetSlot.Engagement,
      RingPresetSlot.Memoire,
    ]);
  });

  it("maps view focus ids to stable preset slots", () => {
    expect(focusToPresetSlot("all")).toBeNull();
    expect(focusToPresetSlot("ring0")).toBe(RingPresetSlot.WeddingFemale);
    expect(focusToPresetSlot("ring1")).toBe(RingPresetSlot.WeddingMale);
    expect(focusToPresetSlot("ring2")).toBe(RingPresetSlot.Engagement);
    expect(focusToPresetSlot("ring3")).toBe(RingPresetSlot.Memoire);
  });

  it("normalizes view presets for slots 2 and 3", () => {
    const presets = normalizeViewPresets([
      {
        id: "engagement-outside",
        label: "Engagement außen",
        focus: "ring2",
        camera: {alpha: 1, beta: 1, target: [0, 0, 0], projection: {}, safety: {}},
      },
      {
        id: "memoire-outside",
        label: "Memoire außen",
        focus: "ring3",
        camera: {alpha: 1, beta: 1, target: [0, 0, 0], projection: {}, safety: {}},
      },
    ]);

    expect(presets.map(preset => preset.focus)).toEqual(["ring2", "ring3"]);
  });

  it("normalizes layout transforms for all four rings", () => {
    const layouts = normalizeLayoutPresets([
      {
        id: "four-rings",
        label: "Vier Ringe",
        source: "manual",
        ringTransforms: {
          ring0: transform([0, 0, 0], true),
          ring1: transform([1, 0, 0], true),
          ring2: transform([2, 0, 0], false),
          ring3: transform([3, 0, 0], true),
        },
      },
    ]);

    expect(layouts.length).toBe(1);
    expect(layouts[0].ringTransforms.ring2?.position).toEqual([2, 0, 0]);
    expect(layouts[0].ringTransforms.ring2?.visible).toBeFalse();
    expect(layouts[0].ringTransforms.ring3?.rotationQuaternion).toEqual([0, 0, 0, 1]);
  });
});

function transform(position: [number, number, number], visible: boolean) {
  return {
    position,
    rotationQuaternion: [0, 0, 0, 1],
    visible,
  };
}
