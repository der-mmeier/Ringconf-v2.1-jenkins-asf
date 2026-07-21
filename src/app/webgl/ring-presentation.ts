import {AbstractMesh, TransformNode} from "@babylonjs/core";
import {RingPresetSlot, RingRole, getPresetSlotDefinition} from "../preset-slots";
import {RingData} from "../app.ringdata";
import {cRing} from "./cRing";

export type CompositionProfileId =
  | "wedding-pair"
  | "wedding-plus-engagement"
  | "wedding-plus-memoire"
  | "wedding-plus-both"
  | "engagement-only"
  | "memoire-only";

export interface RingPresentationHandle {
  slot: RingPresetSlot;
  role: RingRole;
  root: TransformNode;
  shadowRoot?: TransformNode;
  getVisualMeshes(): AbstractMesh[];
}

export interface CompositionProfile {
  id: CompositionProfileId;
  slots: readonly RingPresetSlot[];
  label: string;
}

export const COMPOSITION_PROFILES: readonly CompositionProfile[] = [
  {
    id: "wedding-pair",
    slots: [RingPresetSlot.WeddingFemale, RingPresetSlot.WeddingMale],
    label: "Trauringpaar",
  },
  {
    id: "wedding-plus-engagement",
    slots: [RingPresetSlot.WeddingFemale, RingPresetSlot.WeddingMale, RingPresetSlot.Engagement],
    label: "Trauringpaar mit Verlobungsring",
  },
  {
    id: "wedding-plus-memoire",
    slots: [RingPresetSlot.WeddingFemale, RingPresetSlot.WeddingMale, RingPresetSlot.Memoire],
    label: "Trauringpaar mit Memoirering",
  },
  {
    id: "wedding-plus-both",
    slots: [RingPresetSlot.WeddingFemale, RingPresetSlot.WeddingMale, RingPresetSlot.Engagement, RingPresetSlot.Memoire],
    label: "Trauringpaar mit Verlobungsring und Memoirering",
  },
  {
    id: "engagement-only",
    slots: [RingPresetSlot.Engagement],
    label: "Verlobungsring",
  },
  {
    id: "memoire-only",
    slots: [RingPresetSlot.Memoire],
    label: "Memoirering",
  },
] as const;

export class RingPresentationRegistry {
  constructor(
    private readonly rings: readonly cRing[],
    private readonly ringData: readonly RingData[],
  ) {}

  getHandle(slot: RingPresetSlot): RingPresentationHandle | null {
    const ring = this.rings.find(item => item.ringData.index === slot);
    if (!ring?.pivot) {
      return null;
    }

    const definition = getPresetSlotDefinition(slot);
    return {
      slot,
      role: definition.role,
      root: ring.pivot,
      getVisualMeshes: () => this.getVisualMeshes(ring),
    };
  }

  getAvailableHandles(): RingPresentationHandle[] {
    return this.rings
      .map(ring => this.getHandle(ring.ringData.index as RingPresetSlot))
      .filter((handle): handle is RingPresentationHandle => !!handle);
  }

  getActiveHandles(): RingPresentationHandle[] {
    return this.getAvailableHandles().filter(handle => this.isActive(handle.slot));
  }

  getCompositionProfile(): CompositionProfile {
    const active = new Set(this.getActiveHandles().map(handle => handle.slot));
    const exact = COMPOSITION_PROFILES.find(profile =>
      profile.slots.length === active.size && profile.slots.every(slot => active.has(slot))
    );
    if (exact) {
      return exact;
    }

    const first = COMPOSITION_PROFILES.find(profile => profile.slots.every(slot => active.has(slot)));
    return first || COMPOSITION_PROFILES[0];
  }

  private isActive(slot: RingPresetSlot): boolean {
    const ring = this.ringData.find(item => item.index === slot);
    return !!ring?.cartActive;
  }

  private getVisualMeshes(ring: cRing): AbstractMesh[] {
    const meshes: AbstractMesh[] = [];
    if (ring.pivot) {
      meshes.push(...ring.pivot.getChildMeshes(false));
    }
    if (Array.isArray(ring.mesh)) {
      meshes.push(...ring.mesh);
    }
    return Array.from(new Set(meshes));
  }
}

export function focusToPresetSlot(focus: string): RingPresetSlot | null {
  switch (focus) {
    case "ring0":
      return RingPresetSlot.WeddingFemale;
    case "ring1":
      return RingPresetSlot.WeddingMale;
    case "ring2":
      return RingPresetSlot.Engagement;
    case "ring3":
      return RingPresetSlot.Memoire;
    default:
      return null;
  }
}
