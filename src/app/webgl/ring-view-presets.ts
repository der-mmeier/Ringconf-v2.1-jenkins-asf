import {iAppData, iRingLayoutPreset, iRingViewPreset, RingViewCameraPreset, RingViewFocus} from "../app.interfaces";

export function normalizeRingViewAppData(appData: iAppData): iAppData {
  if (appData.viewPresets !== undefined) {
    appData.viewPresets = normalizeViewPresets(appData.viewPresets);
  }
  if (appData.layoutPresets !== undefined) {
    appData.layoutPresets = normalizeLayoutPresets(appData.layoutPresets);
  }
  return appData;
}

export function normalizeViewPresets(source: unknown): iRingViewPreset[] {
  if (!Array.isArray(source)) return [];
  const seen = new Set<string>();
  return source
    .map((item, index) => normalizeViewPreset(item, index))
    .filter((item): item is iRingViewPreset => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

export function normalizeLayoutPresets(source: unknown): iRingLayoutPreset[] {
  if (!Array.isArray(source)) return [];
  const seen = new Set<string>();
  return source
    .map(normalizeLayoutPreset)
    .filter((item): item is iRingLayoutPreset => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

export function createFallbackViewPresets(pairActive: boolean): iRingViewPreset[] {
  return [];
}

export function normalizeCameraPreset(source: unknown, focus: RingViewFocus = "all"): RingViewCameraPreset {
  const record = source && typeof source === "object" && !Array.isArray(source) ? source as Record<string, unknown> : {};
  const projection = record["projection"] && typeof record["projection"] === "object" && !Array.isArray(record["projection"])
    ? record["projection"] as Record<string, unknown>
    : {};
  const safety = record["safety"] && typeof record["safety"] === "object" && !Array.isArray(record["safety"])
    ? record["safety"] as Record<string, unknown>
    : {};
  const legacyPadding = Math.max(0, finiteNumber(record["padding"], focus === "all" ? 0.16 : 0.18));
  const fitMode = safety["fitMode"] === "fixed" || record["fitMode"] === "fixed"
    ? "fixed"
    : safety["fitMode"] === "auto" || record["fitMode"] === "auto"
      ? "auto"
      : "zoom-out-only";
  return {
    alpha: finiteNumber(record["alpha"], -Math.PI / 2),
    beta: finiteNumber(record["beta"], Math.PI / 2.6),
    target: normalizeVector3(record["target"]) || [0, 10, 0],
    projection: {
      mode: projection["mode"] === "perspective" ? "perspective" : "orthographic",
      orthoHeight: positiveOptional(projection["orthoHeight"]) ?? positiveOptional(record["fixedOrthoHeight"]) ?? (focus === "all" ? 23.5 : 15.5),
      radius: positiveOptional(projection["radius"]) ?? positiveOptional(record["fixedRadius"]) ?? 60,
      screenOffsetX: finiteNumber(projection["screenOffsetX"], 0),
      screenOffsetY: finiteNumber(projection["screenOffsetY"], 0),
    },
    safety: {
      fitMode,
      paddingTop: Math.max(0, finiteNumber(safety["paddingTop"], legacyPadding)),
      paddingRight: Math.max(0, finiteNumber(safety["paddingRight"], legacyPadding)),
      paddingBottom: Math.max(0, finiteNumber(safety["paddingBottom"], Math.max(legacyPadding, 0.22))),
      paddingLeft: Math.max(0, finiteNumber(safety["paddingLeft"], legacyPadding)),
      includeShadowEnvelope: safety["includeShadowEnvelope"] !== false,
      shadowExtraBottom: Math.max(0, finiteNumber(safety["shadowExtraBottom"], 0.18)),
      shadowExtraLeft: Math.max(0, finiteNumber(safety["shadowExtraLeft"], 0.05)),
      shadowExtraRight: Math.max(0, finiteNumber(safety["shadowExtraRight"], 0.05)),
    },
  };
}

function normalizeViewPreset(source: unknown, index: number): iRingViewPreset | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const id = sanitizeId(record["id"], `view-${index + 1}`);
  const focus: RingViewFocus = record["focus"] === "ring0"
    || record["focus"] === "ring1"
    || record["focus"] === "ring2"
    || record["focus"] === "ring3"
    ? record["focus"]
    : "all";
  const cameraRecord = record["camera"] && typeof record["camera"] === "object" && !Array.isArray(record["camera"])
    ? record["camera"] as Record<string, unknown>
    : {};
  return {
    id,
    label: stringOr(record["label"], id),
    enabled: record["enabled"] !== false,
    sortOrder: finiteNumber(record["sortOrder"], index * 10),
    availability: record["availability"] === "single" || record["availability"] === "pair" ? record["availability"] : "all",
    focus,
    targetMode: record["targetMode"] === "fixed" || cameraRecord["targetMode"] === "fixed" ? "fixed" : "selection-center",
    camera: normalizeCameraPreset(cameraRecord, focus),
    layoutId: typeof record["layoutId"] === "string" && record["layoutId"].trim() ? record["layoutId"].trim() : null,
    compositionKey: typeof record["compositionKey"] === "string" && record["compositionKey"].trim() ? record["compositionKey"].trim() : undefined,
    ringLayout: normalizeInlineRingLayout(record["ringLayout"]),
  };
}

function normalizeInlineRingLayout(source: unknown): iRingLayoutPreset["ringTransforms"] | undefined {
  if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;
  const record = source as Record<string, unknown>;
  const ring0 = normalizeTransform(record["ring0"]);
  const ring1 = normalizeTransform(record["ring1"]);
  const ring2 = normalizeTransform(record["ring2"]);
  const ring3 = normalizeTransform(record["ring3"]);
  if (!ring0 && !ring1 && !ring2 && !ring3) return undefined;
  return {ring0, ring1, ring2, ring3};
}

function normalizeLayoutPreset(source: unknown): iRingLayoutPreset | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const id = sanitizeId(record["id"], "");
  if (!id) return null;
  const transforms = record["ringTransforms"] && typeof record["ringTransforms"] === "object" && !Array.isArray(record["ringTransforms"])
    ? record["ringTransforms"] as Record<string, unknown>
    : {};
  const ring0 = normalizeTransform(transforms["ring0"]);
  const ring1 = normalizeTransform(transforms["ring1"]);
  const ring2 = normalizeTransform(transforms["ring2"]);
  const ring3 = normalizeTransform(transforms["ring3"]);
  if (!ring0 && !ring1 && !ring2 && !ring3) return null;
  return {
    id,
    label: stringOr(record["label"], id),
    enabled: record["enabled"] !== false,
    source: record["source"] === "manual" ? "manual" : "obj-markers",
    ringTransforms: {ring0, ring1, ring2, ring3},
  };
}

function normalizeTransform(source: unknown) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;
  const record = source as Record<string, unknown>;
  const position = normalizeVector3(record["position"]);
  const quat = normalizeQuaternion(record["rotationQuaternion"]);
  if (!position || !quat) return undefined;
  return {
    position,
    rotationQuaternion: quat,
    visible: typeof record["visible"] === "boolean" ? record["visible"] : undefined,
  };
}

function sanitizeId(value: unknown, fallback: string): string {
  const id = String(value ?? fallback).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return id || fallback;
}

function stringOr(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positiveOptional(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function normalizeVector3(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const next = value.map(Number);
  return next.every(Number.isFinite) ? next as [number, number, number] : undefined;
}

function normalizeQuaternion(value: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const next = value.map(Number);
  const len = Math.hypot(next[0], next[1], next[2], next[3]);
  return next.every(Number.isFinite) && len > 0
    ? [next[0] / len, next[1] / len, next[2] / len, next[3] / len]
    : undefined;
}
