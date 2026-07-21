export enum RingPresetSlot {
  WeddingFemale = 0,
  WeddingMale = 1,
  Engagement = 2,
  Memoire = 3,
}

export type RingRole =
  | "wedding-female"
  | "wedding-male"
  | "engagement"
  | "memoire";

export type PresetSlotKey = "preset_0" | "preset_1" | "preset_2" | "preset_3";

export interface RingPresetSlotDefinition {
  slot: RingPresetSlot;
  key: PresetSlotKey;
  role: RingRole;
  label: string;
}

export const RING_PRESET_SLOT_DEFINITIONS: readonly RingPresetSlotDefinition[] = [
  {
    slot: RingPresetSlot.WeddingFemale,
    key: "preset_0",
    role: "wedding-female",
    label: "Damen-Trauring",
  },
  {
    slot: RingPresetSlot.WeddingMale,
    key: "preset_1",
    role: "wedding-male",
    label: "Herren-Trauring",
  },
  {
    slot: RingPresetSlot.Engagement,
    key: "preset_2",
    role: "engagement",
    label: "Verlobungsring",
  },
  {
    slot: RingPresetSlot.Memoire,
    key: "preset_3",
    role: "memoire",
    label: "Memoirering",
  },
] as const;

export const REQUIRED_WEDDING_PRESET_SLOTS: readonly RingPresetSlot[] = [
  RingPresetSlot.WeddingFemale,
  RingPresetSlot.WeddingMale,
] as const;

export const OPTIONAL_PRESET_SLOTS: readonly RingPresetSlot[] = [
  RingPresetSlot.Engagement,
  RingPresetSlot.Memoire,
] as const;

export const ALL_PRESET_SLOTS: readonly RingPresetSlot[] = [
  RingPresetSlot.WeddingFemale,
  RingPresetSlot.WeddingMale,
  RingPresetSlot.Engagement,
  RingPresetSlot.Memoire,
] as const;

export function getPresetSlotDefinition(slot: RingPresetSlot): RingPresetSlotDefinition {
  const definition = RING_PRESET_SLOT_DEFINITIONS.find(item => item.slot === slot);
  if (!definition) {
    throw new Error(`Unknown ring preset slot ${slot}`);
  }
  return definition;
}

export function getPresetSlotDefinitionByRole(role: RingRole): RingPresetSlotDefinition {
  const definition = RING_PRESET_SLOT_DEFINITIONS.find(item => item.role === role);
  if (!definition) {
    throw new Error(`Unknown ring role ${role}`);
  }
  return definition;
}

export function getPresetSlotKey(slot: RingPresetSlot): PresetSlotKey {
  return getPresetSlotDefinition(slot).key;
}

export function getPresetSlotFromKey(key: string): RingPresetSlot | null {
  const definition = RING_PRESET_SLOT_DEFINITIONS.find(item => item.key === key);
  return definition ? definition.slot : null;
}

export type SerializedPresetSlots = Partial<Record<PresetSlotKey, string | null>>;

export type SerializedPresetSaveItem = SerializedPresetSlots & {
  id: string;
  preset_0: string;
  preset_1: string;
  img: string;
};

export interface PresetSlotRing {
  clone(other: unknown): void;
}

export function serializeExistingPresetSlots(rings: readonly (PresetSlotRing | undefined)[]): SerializedPresetSlots {
  const result: SerializedPresetSlots = {};
  for (const slot of ALL_PRESET_SLOTS) {
    const ring = rings[slot];
    if (ring) {
      result[getPresetSlotKey(slot)] = JSON.stringify(ring);
    }
  }
  return result;
}

export function serializeOptionalPresetSlots(rings: readonly (PresetSlotRing | undefined)[]): SerializedPresetSlots {
  const result: SerializedPresetSlots = {};
  for (const slot of OPTIONAL_PRESET_SLOTS) {
    const ring = rings[slot];
    if (ring) {
      result[getPresetSlotKey(slot)] = JSON.stringify(ring);
    }
  }
  return result;
}

export function cloneLoadedPresetSlots(rings: readonly (PresetSlotRing | undefined)[], item: SerializedPresetSlots): void {
  for (const slot of ALL_PRESET_SLOTS) {
    const ring = rings[slot];
    const value = item[getPresetSlotKey(slot)];
    if (!ring || typeof value !== "string" || value.length === 0) {
      continue;
    }
    ring.clone(JSON.parse(value));
  }
}

export function createPresetSaveCacheItem(id: string, rings: readonly (PresetSlotRing | undefined)[], img: string): SerializedPresetSaveItem {
  const preset0 = rings[RingPresetSlot.WeddingFemale];
  const preset1 = rings[RingPresetSlot.WeddingMale];
  if (!preset0 || !preset1) {
    throw new Error("Wedding preset slots 0 and 1 are required.");
  }

  return {
    id,
    ...serializeExistingPresetSlots(rings),
    preset_0: JSON.stringify(preset0),
    preset_1: JSON.stringify(preset1),
    img,
  };
}
