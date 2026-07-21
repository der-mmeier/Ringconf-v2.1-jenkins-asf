import {
  ALL_PRESET_SLOTS,
  cloneLoadedPresetSlots,
  createPresetSaveCacheItem,
  getPresetSlotDefinition,
  getPresetSlotDefinitionByRole,
  getPresetSlotFromKey,
  getPresetSlotKey,
  OPTIONAL_PRESET_SLOTS,
  RingPresetSlot,
  serializeExistingPresetSlots,
  serializeOptionalPresetSlots,
} from "./preset-slots";

describe("preset slots", () => {
  function ring(value: string) {
    return {
      value,
      clone(other: unknown) {
        this.value = String((other as {value: string}).value);
      },
    };
  }

  it("defines the four stable preset roles", () => {
    expect(ALL_PRESET_SLOTS).toEqual([
      RingPresetSlot.WeddingFemale,
      RingPresetSlot.WeddingMale,
      RingPresetSlot.Engagement,
      RingPresetSlot.Memoire,
    ]);
    expect(OPTIONAL_PRESET_SLOTS).toEqual([
      RingPresetSlot.Engagement,
      RingPresetSlot.Memoire,
    ]);
    expect(getPresetSlotDefinition(RingPresetSlot.WeddingFemale).role).toBe("wedding-female");
    expect(getPresetSlotDefinition(RingPresetSlot.WeddingMale).role).toBe("wedding-male");
    expect(getPresetSlotDefinitionByRole("engagement").slot).toBe(RingPresetSlot.Engagement);
    expect(getPresetSlotDefinitionByRole("memoire").slot).toBe(RingPresetSlot.Memoire);
  });

  it("maps stable slot keys without scattered numeric literals", () => {
    expect(getPresetSlotKey(RingPresetSlot.WeddingFemale)).toBe("preset_0");
    expect(getPresetSlotKey(RingPresetSlot.WeddingMale)).toBe("preset_1");
    expect(getPresetSlotKey(RingPresetSlot.Engagement)).toBe("preset_2");
    expect(getPresetSlotKey(RingPresetSlot.Memoire)).toBe("preset_3");
    expect(getPresetSlotFromKey("preset_2")).toBe(RingPresetSlot.Engagement);
    expect(getPresetSlotFromKey("unknown")).toBeNull();
  });

  it("serializes existing rings deterministically", () => {
    const slots = [ring("female"), ring("male"), ring("engagement"), ring("memoire")];
    expect(Object.keys(serializeExistingPresetSlots(slots))).toEqual([
      "preset_0",
      "preset_1",
      "preset_2",
      "preset_3",
    ]);
    expect(serializeExistingPresetSlots(slots).preset_3).toBe(JSON.stringify({value: "memoire"}));
  });

  it("does not invent optional slots when an old two-ring client saves", () => {
    const slots = [ring("female"), ring("male")];
    expect(serializeOptionalPresetSlots(slots)).toEqual({});
    expect(createPresetSaveCacheItem("ABCD-EFGH", slots, "image")).toEqual({
      id: "ABCD-EFGH",
      preset_0: JSON.stringify({value: "female"}),
      preset_1: JSON.stringify({value: "male"}),
      img: "image",
    });
  });

  it("clones only delivered preset slots", () => {
    const slots = [ring("female"), ring("male"), ring("engagement"), ring("memoire")];
    cloneLoadedPresetSlots(slots, {
      preset_0: JSON.stringify({value: "new female"}),
      preset_1: JSON.stringify({value: "new male"}),
      preset_2: null,
      preset_3: JSON.stringify({value: "new memoire"}),
    });

    expect(slots[0].value).toBe("new female");
    expect(slots[1].value).toBe("new male");
    expect(slots[2].value).toBe("engagement");
    expect(slots[3].value).toBe("new memoire");
  });
});
