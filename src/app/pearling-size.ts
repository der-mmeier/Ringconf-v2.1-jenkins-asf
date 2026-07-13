export type JsonPearlingRecord = Record<string, unknown>;

export interface PearlingSizeRecord extends JsonPearlingRecord {
  id: number;
  name: string;
  img?: string;
  diameter: number;
  rowClearance: number;
  minRowClearance?: number;
  maxRowClearance?: number;
  channelEdgeClearance: number;
  channelWidth: number;
  spacingMode: string;
  pitch?: number;
  beadCount?: number;
}

export const VALID_PEARLING_SIZE_IDS = [500, 1000] as const;
export type ValidPearlingSizeId = typeof VALID_PEARLING_SIZE_IDS[number];
export const PEARLING_SPACING_MODES = ["auto-fit", "fixed-gap", "stretch-gap", "exact-pitch", "max-count", "fixed-count"] as const;
export type PearlingSpacingMode = typeof PEARLING_SPACING_MODES[number];

export const DEFAULT_PEARLING_SIZES: PearlingSizeRecord[] = [
  {id: 500, name: "0,5 mm", img: "icon-milgrain-size-0-5.svg", diameter: 500, rowClearance: 100, minRowClearance: 50, maxRowClearance: 120, channelEdgeClearance: 100, channelWidth: 700, spacingMode: "stretch-gap", pitch: 600},
  {id: 1000, name: "1,0 mm", img: "icon-milgrain-size-1-0.svg", diameter: 1000, rowClearance: 100, minRowClearance: 80, maxRowClearance: 150, channelEdgeClearance: 100, channelWidth: 1200, spacingMode: "stretch-gap", pitch: 1100},
];

export interface PearlingNormalizationResult {
  changed: boolean;
  removedLegacy300: boolean;
}

export function isValidPearlingSizeId(value: unknown): value is ValidPearlingSizeId {
  const numberValue = Number(value);
  return VALID_PEARLING_SIZE_IDS.some(id => id === numberValue);
}

export function createDefaultPearlingSizes(): PearlingSizeRecord[] {
  return DEFAULT_PEARLING_SIZES.map(size => ({...size}));
}

export function isPearlingSpacingMode(value: unknown): value is PearlingSpacingMode {
  return PEARLING_SPACING_MODES.some(mode => mode === value);
}

export function normalizePearlingSpacingMode(value: unknown): PearlingSpacingMode {
  return isPearlingSpacingMode(value) ? value : "auto-fit";
}

export function hasPearlingDefinitions(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const appData = value as JsonPearlingRecord;
  if (Array.isArray(appData["pearlingSize"]) || Array.isArray(appData["milgrainSize"])) {
    return true;
  }

  const featureRules = appData["featureRules"];
  if (featureRules && typeof featureRules === "object" && !Array.isArray(featureRules)) {
    const rules = featureRules as JsonPearlingRecord;
    if (rules["gapPearling"] && typeof rules["gapPearling"] === "object" && !Array.isArray(rules["gapPearling"])) {
      return true;
    }
    if (rules["stepPearling"] && typeof rules["stepPearling"] === "object" && !Array.isArray(rules["stepPearling"])) {
      return true;
    }
  }

  return Array.isArray(appData["profile"]) && appData["profile"].some(profile => {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      return false;
    }
    const record = profile as JsonPearlingRecord;
    return Boolean(
      record["milgrain"] && typeof record["milgrain"] === "object" && !Array.isArray(record["milgrain"])
      || record["pearling"] && typeof record["pearling"] === "object" && !Array.isArray(record["pearling"]),
    );
  });
}

export function normalizePearlingAllowedSizes(value: unknown): number[] {
  const normalized = Array.isArray(value)
    ? value
      .map(entry => Number(entry))
      .filter(entry => isValidPearlingSizeId(entry))
      .filter((entry, index, items) => items.indexOf(entry) === index)
    : [];

  return normalized.length > 0 ? normalized : [...VALID_PEARLING_SIZE_IDS];
}

export function normalizePearlingSizeList(value: unknown): PearlingSizeRecord[] {
  const normalized = Array.isArray(value)
    ? value
      .filter(entry => entry && typeof entry === "object" && !Array.isArray(entry))
      .filter(entry => isValidPearlingSizeId((entry as PearlingSizeRecord)["id"]))
      .map(entry => {
        const source = entry as JsonPearlingRecord;
        const id = Number(source["id"]);
        const fallback = DEFAULT_PEARLING_SIZES.find(size => size.id === id) ?? DEFAULT_PEARLING_SIZES[0];
        return {
          ...fallback,
          ...source,
          id,
          name: String(source["name"] ?? fallback.name),
          diameter: normalizePositiveNumber(source["diameter"], id),
          rowClearance: normalizePositiveNumber(source["rowClearance"], fallback.rowClearance),
          minRowClearance: normalizeNonNegativeOptional(source["minRowClearance"], fallback.minRowClearance),
          maxRowClearance: normalizeNonNegativeOptional(source["maxRowClearance"], fallback.maxRowClearance),
          channelEdgeClearance: normalizePositiveNumber(source["channelEdgeClearance"], fallback.channelEdgeClearance),
          channelWidth: normalizePositiveNumber(source["channelWidth"], fallback.channelWidth),
          spacingMode: normalizePearlingSpacingMode(source["spacingMode"] ?? fallback.spacingMode),
          pitch: normalizePositiveOptional(source["pitch"], fallback.pitch),
          beadCount: normalizeIntegerOptional(source["beadCount"], fallback.beadCount),
        };
      })
    : [];

  return normalized.length > 0 ? normalized : createDefaultPearlingSizes();
}

export function normalizePearlingAppData(value: unknown): PearlingNormalizationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {changed: false, removedLegacy300: false};
  }

  const appData = value as JsonPearlingRecord;
  if (!hasPearlingDefinitions(appData)) {
    return {changed: false, removedLegacy300: false};
  }

  const before = JSON.stringify({
    pearlingSize: appData["pearlingSize"],
    milgrainSize: appData["milgrainSize"],
    profiles: Array.isArray(appData["profile"]) ? appData["profile"].map(readProfilePearlingSizes) : [],
    featureRules: readFeaturePearlingSizes(appData["featureRules"]),
  });
  const hadLegacy300 = before.includes("300");

  if (Array.isArray(appData["pearlingSize"]) || !Array.isArray(appData["milgrainSize"])) {
    appData["pearlingSize"] = normalizePearlingSizeList(appData["pearlingSize"]);
  }
  if (Array.isArray(appData["milgrainSize"])) {
    appData["milgrainSize"] = normalizePearlingSizeList(appData["milgrainSize"]);
    if (!Array.isArray(appData["pearlingSize"])) {
      appData["pearlingSize"] = normalizePearlingSizeList(appData["milgrainSize"]);
    }
  }

  if (Array.isArray(appData["profile"])) {
    appData["profile"].forEach(profile => {
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        return;
      }
      normalizeProfilePearlingRule((profile as JsonPearlingRecord)["milgrain"]);
      normalizeProfilePearlingRule((profile as JsonPearlingRecord)["pearling"]);
    });
  }

  const featureRules = appData["featureRules"];
  if (featureRules && typeof featureRules === "object" && !Array.isArray(featureRules)) {
    normalizeFeaturePearlingRule((featureRules as JsonPearlingRecord)["gapPearling"]);
    normalizeFeaturePearlingRule((featureRules as JsonPearlingRecord)["stepPearling"]);
  }

  const after = JSON.stringify({
    pearlingSize: appData["pearlingSize"],
    milgrainSize: appData["milgrainSize"],
    profiles: Array.isArray(appData["profile"]) ? appData["profile"].map(readProfilePearlingSizes) : [],
    featureRules: readFeaturePearlingSizes(appData["featureRules"]),
  });

  return {changed: before !== after, removedLegacy300: hadLegacy300 && !after.includes("300")};
}

function normalizeProfilePearlingRule(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  (value as JsonPearlingRecord)["allowedSizes"] = normalizePearlingAllowedSizes((value as JsonPearlingRecord)["allowedSizes"]);
}

function normalizeFeaturePearlingRule(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  (value as JsonPearlingRecord)["allowedSizes"] = normalizePearlingAllowedSizes((value as JsonPearlingRecord)["allowedSizes"]);
}

function readProfilePearlingSizes(profile: unknown): unknown {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return null;
  }
  const record = profile as JsonPearlingRecord;
  return {
    milgrain: readAllowedSizes(record["milgrain"]),
    pearling: readAllowedSizes(record["pearling"]),
  };
}

function readFeaturePearlingSizes(featureRules: unknown): unknown {
  if (!featureRules || typeof featureRules !== "object" || Array.isArray(featureRules)) {
    return null;
  }
  const record = featureRules as JsonPearlingRecord;
  return {
    gapPearling: readAllowedSizes(record["gapPearling"]),
    stepPearling: readAllowedSizes(record["stepPearling"]),
  };
}

function readAllowedSizes(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return (value as JsonPearlingRecord)["allowedSizes"];
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizePositiveOptional(value: unknown, fallback: number | undefined): number | undefined {
  const normalized = Number(value);
  if (Number.isFinite(normalized) && normalized > 0) {
    return normalized;
  }
  return fallback;
}

function normalizeNonNegativeOptional(value: unknown, fallback: number | undefined): number | undefined {
  const normalized = Number(value);
  if (Number.isFinite(normalized) && normalized >= 0) {
    return normalized;
  }
  return fallback;
}

function normalizeIntegerOptional(value: unknown, fallback: number | undefined): number | undefined {
  const normalized = Math.floor(Number(value));
  if (Number.isFinite(normalized) && normalized > 0) {
    return normalized;
  }
  return fallback;
}
