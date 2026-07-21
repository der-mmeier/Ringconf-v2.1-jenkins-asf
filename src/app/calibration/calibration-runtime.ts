import {iRingViewPreset, RingViewFocus, RingViewTargetMode} from "../app.interfaces";
import {focusToPresetSlot} from "../webgl/ring-presentation";
import {
  CalibrationRingTransforms,
  CalibrationRuntimeComposition,
  CalibrationRuntimeProfile,
  CalibrationRuntimeRingTransform,
  CalibrationRuntimeView
} from "./calibration-runtime.models";

export function validateCalibrationRuntimeProfile(source: unknown): CalibrationRuntimeProfile | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const compositions = record["compositions"];
  if (!Array.isArray(compositions)) return null;
  return {
    schemaVersion: finite(record["schemaVersion"], 1),
    profileKey: stringOr(record["profileKey"], "active"),
    name: stringOr(record["name"], "Active calibration"),
    status: stringOr(record["status"], "active"),
    revision: finite(record["revision"], 1),
    compositions: compositions
      .map(normalizeComposition)
      .filter((item): item is CalibrationRuntimeComposition => !!item),
  };
}

export function createRuntimeViewPresets(profile: CalibrationRuntimeProfile | null, compositionKey: string): iRingViewPreset[] {
  const composition = profile?.compositions.find(item => item.compositionKey === compositionKey && item.enabled !== false);
  if (!composition) return [];
  return composition.views
    .filter(view => view.enabled !== false)
    .map(view => runtimeViewToPreset(view, composition.compositionKey))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

function normalizeComposition(source: unknown): CalibrationRuntimeComposition | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const key = stringOr(record["compositionKey"], "");
  const views = Array.isArray(record["views"]) ? record["views"] : [];
  if (!key) return null;
  return {
    id: optionalFinite(record["id"]),
    compositionKey: key as CalibrationRuntimeComposition["compositionKey"],
    label: stringOr(record["label"], key),
    activeSlots: Array.isArray(record["activeSlots"]) ? record["activeSlots"].map(Number).filter(Number.isFinite) : [],
    startupSequence: record["startupSequence"] ?? null,
    naturalRingLayout: normalizeRingLayout(record["naturalRingLayout"]),
    defaultFraming: record["defaultFraming"] ?? null,
    enabled: record["enabled"] !== false,
    sortOrder: finite(record["sortOrder"], 0),
    revision: finite(record["revision"], 1),
    views: views.map(normalizeView).filter((item): item is CalibrationRuntimeView => !!item),
  };
}

function normalizeView(source: unknown): CalibrationRuntimeView | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const viewKey = sanitizeId(record["viewKey"], "");
  const camera = record["camera"];
  if (!viewKey || !camera || typeof camera !== "object" || Array.isArray(camera)) return null;
  return {
    id: optionalFinite(record["id"]),
    viewKey,
    name: stringOr(record["name"], viewKey),
    enabled: record["enabled"] !== false,
    isDefault: record["isDefault"] === true,
    sortOrder: finite(record["sortOrder"], 0),
    revision: finite(record["revision"], 1),
    camera: camera as CalibrationRuntimeView["camera"],
    ringLayout: normalizeRingLayout(record["ringLayout"]),
    framing: record["framing"] ?? null,
    updatedAt: typeof record["updatedAt"] === "string" ? record["updatedAt"] : undefined,
  };
}

function runtimeViewToPreset(view: CalibrationRuntimeView, compositionKey: string): iRingViewPreset {
  const focus = normalizeFocus(view.camera.focus);
  return {
    id: view.viewKey,
    label: view.name,
    enabled: view.enabled,
    sortOrder: view.sortOrder,
    availability: "all",
    focus,
    targetMode: normalizeTargetMode(view.camera.targetMode),
    camera: view.camera,
    layoutId: null,
    compositionKey,
    ringLayout: ringArrayToTransforms(view.ringLayout.rings || []),
  };
}

function ringArrayToTransforms(rings: CalibrationRuntimeRingTransform[]): CalibrationRingTransforms {
  const result: CalibrationRingTransforms = {};
  rings.forEach(ring => {
    const focusKey = `ring${ring.slot}` as keyof CalibrationRingTransforms;
    if (focusToPresetSlot(focusKey) === null) return;
    result[focusKey] = {
      position: [...ring.position],
      rotationQuaternion: [...ring.rotationQuaternion],
      visible: ring.visible,
    };
  });
  return result;
}

function normalizeRingLayout(source: unknown): {rings: CalibrationRuntimeRingTransform[]} {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {rings: []};
  const rings = (source as Record<string, unknown>)["rings"];
  if (!Array.isArray(rings)) return {rings: []};
  return {
    rings: rings
      .map(normalizeRing)
      .filter((item): item is CalibrationRuntimeRingTransform => !!item),
  };
}

function normalizeRing(source: unknown): CalibrationRuntimeRingTransform | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const slot = Number(record["slot"]);
  const position = vector3(record["position"]);
  const rotationQuaternion = quaternion(record["rotationQuaternion"]);
  if (!Number.isFinite(slot) || !position || !rotationQuaternion) return null;
  return {
    slot,
    role: typeof record["role"] === "string" ? record["role"] : undefined,
    visible: record["visible"] !== false,
    position,
    rotationQuaternion,
  };
}

function normalizeFocus(value: unknown): RingViewFocus {
  return value === "ring0" || value === "ring1" || value === "ring2" || value === "ring3" ? value : "all";
}

function normalizeTargetMode(value: unknown): RingViewTargetMode {
  return value === "fixed" ? "fixed" : "selection-center";
}

function vector3(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const next = value.map(Number);
  return next.every(Number.isFinite) ? next as [number, number, number] : null;
}

function quaternion(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const next = value.map(Number);
  const length = Math.hypot(next[0], next[1], next[2], next[3]);
  return next.every(Number.isFinite) && length > 0
    ? [next[0] / length, next[1] / length, next[2] / length, next[3] / length]
    : null;
}

function sanitizeId(value: unknown, fallback: string): string {
  const id = String(value ?? fallback).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return id || fallback;
}

function stringOr(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function finite(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function optionalFinite(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

