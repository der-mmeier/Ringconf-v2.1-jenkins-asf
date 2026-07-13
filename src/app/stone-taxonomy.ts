import {
  iAppData,
  iPresetStone,
  iStoneAvailabilityRule,
  iStoneColor,
  iStoneCut,
  iStoneQuality,
  iStoneType,
} from "./app.interfaces";

type StoneSettingMode = "bezel" | "verschnitt" | "kanal" | "kanal-quer" | "side" | "free" | "other";

export interface StoneSelectionContext {
  ringType?: string;
  settingMode?: StoneSettingMode | string;
  stoneMode?: number;
}

export interface StoneSelection {
  stoneType: string;
  stoneQuality: string | null;
  stoneColor: string | null;
  stoneCut: string;
  stoneSize: number;
}

const COLOR_IDS = ["weiss", "apple-green", "baby-pink", "canary-yellow", "cognac-brown", "orange", "schwarz", "sky-blue"];

export const DEFAULT_STONE_TYPES: iStoneType[] = [
  {id: "natural-diamond", name: "Diamant", defaultQuality: "diamond-g-si1", defaultColor: null, requiresQuality: true, requiresColor: false, sort: 10},
  {id: "lab-diamond", name: "Labordiamant", defaultQuality: "lab-g-vs1", defaultColor: null, requiresQuality: true, requiresColor: false, sort: 20},
  {id: "zirconia", name: "Zirkonia", defaultQuality: "zirconia-standard", defaultColor: "weiss", requiresQuality: false, requiresColor: true, sort: 30},
  {id: "colored-stone", name: "Farbiger Stein", defaultQuality: null, defaultColor: "weiss", requiresQuality: false, requiresColor: true, sort: 40},
];

export const DEFAULT_STONE_QUALITIES: iStoneQuality[] = [
  {id: "diamond-g-si1", stoneType: "natural-diamond", label: "G/SI1", description: "Feines Weiß, kleine Einschlüsse", colorGrade: "G", clarityGrade: "SI1", legacyQuality: 0, sort: 10},
  {id: "diamond-g-vs1", stoneType: "natural-diamond", label: "G/VS1", description: "Feines Weiß, sehr kleine Einschlüsse", colorGrade: "G", clarityGrade: "VS1", legacyQuality: 1, sort: 20},
  {id: "diamond-e-if", stoneType: "natural-diamond", label: "E/IF", description: "Hochfeines Weiß, lupenrein", colorGrade: "E", clarityGrade: "IF", legacyQuality: 2, sort: 30},
  {id: "diamond-d-vs", stoneType: "natural-diamond", label: "D/VS", description: "Sehr feine Farbe und Reinheit", colorGrade: "D", clarityGrade: "VS", legacyQuality: 2, sort: 40},
  {id: "lab-g-vs1", stoneType: "lab-diamond", label: "G/VS1", description: "Labordiamant, feines Weiß, sehr kleine Einschlüsse", colorGrade: "G", clarityGrade: "VS1", legacyQuality: 1, sort: 10},
  {id: "zirconia-standard", stoneType: "zirconia", label: "Standard", description: "Weiß, sehr gut", legacyQuality: 3, sort: 10},
];

export const DEFAULT_STONE_COLORS: iStoneColor[] = [
  {id: "weiss", name: "Weiß", hex: "#ffffff", img: "assets/imgui/stones/colors/weiss.svg", sort: 10, enabled: true},
  {id: "apple-green", name: "Apple Green", hex: "#8cc63f", img: "assets/imgui/stones/colors/apple-green.svg", sort: 20, enabled: true, tintStrength: 0.75, brightness: 1.25},
  {id: "baby-pink", name: "Baby Pink", hex: "#f4a7c6", img: "assets/imgui/stones/colors/baby-pink.svg", sort: 30, enabled: true, tintStrength: 0.72, brightness: 1.22},
  {id: "canary-yellow", name: "Canary Yellow", hex: "#ffdf3a", img: "assets/imgui/stones/colors/canary-yellow.svg", sort: 40, enabled: true, tintStrength: 0.7, brightness: 1.2},
  {id: "cognac-brown", name: "Cognac Brown", hex: "#9a5a2e", img: "assets/imgui/stones/colors/cognac-brown.svg", sort: 50, enabled: true, tintStrength: 0.78, brightness: 1.28},
  {id: "orange", name: "Orange", hex: "#f58220", img: "assets/imgui/stones/colors/orange.svg", sort: 60, enabled: true, tintStrength: 0.74, brightness: 1.22},
  {id: "schwarz", name: "Schwarz", hex: "#111111", img: "assets/imgui/stones/colors/schwarz.svg", sort: 70, enabled: true, tintStrength: 0.85, brightness: 1.4},
  {id: "sky-blue", name: "Sky Blue", hex: "#6ec6ff", img: "assets/imgui/stones/colors/sky-blue.svg", sort: 80, enabled: true, tintStrength: 0.72, brightness: 1.23},
];

export function normalizeStoneTaxonomyAppData(appData: iAppData): iAppData {
  const record = appData as unknown as Record<string, unknown>;
  const legacyCuts = getLegacyStoneCuts(record);

  if (!Array.isArray(record["stoneCut"]) || !(record["stoneCut"] as unknown[]).length) {
    record["stoneCut"] = legacyCuts.map(value => normalizeStoneCut(value as Record<string, unknown>));
  } else {
    record["stoneCut"] = (record["stoneCut"] as unknown[])
      .filter(isRecord)
      .map(item => normalizeStoneCut(item as Record<string, unknown>));
  }

  if (!Array.isArray(record["stoneType"]) || isLegacyStoneCutArray(record["stoneType"] as unknown[])) {
    record["stoneType"] = DEFAULT_STONE_TYPES.map(item => ({...item}));
  }

  if (!Array.isArray(record["stoneQuality"]) || !(record["stoneQuality"] as unknown[]).length) {
    record["stoneQuality"] = DEFAULT_STONE_QUALITIES.map(item => ({...item}));
  } else if (isLegacyStoneQualityArray(record["stoneQuality"] as unknown[])) {
    record["stoneQuality"] = DEFAULT_STONE_QUALITIES.map(item => ({...item}));
  } else {
    record["stoneQuality"] = (record["stoneQuality"] as unknown[])
      .filter(isRecord)
      .map(item => normalizeStoneQuality(item as Record<string, unknown>));
  }

  if (!Array.isArray(record["stoneColor"]) || !(record["stoneColor"] as unknown[]).length) {
    record["stoneColor"] = DEFAULT_STONE_COLORS.map(item => ({...item}));
  } else {
    record["stoneColor"] = (record["stoneColor"] as unknown[])
      .filter(isRecord)
      .map(item => normalizeStoneColor(item as Record<string, unknown>));
  }

  if (!Array.isArray(record["stoneAvailabilityRules"]) || !(record["stoneAvailabilityRules"] as unknown[]).length) {
    record["stoneAvailabilityRules"] = createDefaultStoneAvailabilityRules(getStoneCuts(appData));
  }

  return appData;
}

export function getStoneTypes(appData: iAppData): iStoneType[] {
  normalizeStoneTaxonomyAppData(appData);
  return ((appData as unknown as Record<string, unknown>)["stoneType"] as iStoneType[])
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

export function getStoneCuts(appData: iAppData): iStoneCut[] {
  const record = appData as unknown as Record<string, unknown>;
  const raw = Array.isArray(record["stoneCut"]) ? record["stoneCut"] as unknown[] : getLegacyStoneCuts(record);
  return raw
    .filter(isRecord)
    .map(item => normalizeStoneCut(item as Record<string, unknown>))
    .sort((a, b) => getCutSortValue(a) - getCutSortValue(b));
}

export function getStoneQualities(appData: iAppData): iStoneQuality[] {
  normalizeStoneTaxonomyAppData(appData);
  return ((appData as unknown as Record<string, unknown>)["stoneQuality"] as iStoneQuality[])
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

export function getStoneColors(appData: iAppData): iStoneColor[] {
  normalizeStoneTaxonomyAppData(appData);
  return ((appData as unknown as Record<string, unknown>)["stoneColor"] as iStoneColor[])
    .slice()
    .filter(color => color.enabled !== false)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

export function getStoneColorById(appData: iAppData, id: string | null | undefined): iStoneColor | null {
  if (!id) {
    return null;
  }
  return getStoneColors(appData).find(color => color.id === id) ?? null;
}

export function getStoneColorHex(appData: iAppData, id: string | null | undefined): string | null {
  const color = getStoneColorById(appData, id);
  return color && isStoneColorHex(color.hex) ? color.hex : null;
}

export function isStoneColorHex(value: unknown): boolean {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function getStoneAvailabilityRules(appData: iAppData): iStoneAvailabilityRule[] {
  normalizeStoneTaxonomyAppData(appData);
  return ((appData as unknown as Record<string, unknown>)["stoneAvailabilityRules"] as iStoneAvailabilityRule[])
    .filter(rule => rule.enabled !== false)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

export function getAllowedStoneTypes(appData: iAppData, context: StoneSelectionContext = {}): iStoneType[] {
  const rules = getMatchingRules(appData, context);
  const allowedIds = new Set(rules.flatMap(rule => rule.stoneTypes ?? []));
  return getStoneTypes(appData).filter(type => !allowedIds.size || allowedIds.has(type.id));
}

export function getAllowedStoneCuts(appData: iAppData, stoneTypeId: string, context: StoneSelectionContext = {}): iStoneCut[] {
  const rules = getMatchingRules(appData, context).filter(rule => includesOrEmpty(rule.stoneTypes, stoneTypeId));
  const allowedIds = new Set(rules.flatMap(rule => rule.stoneCuts ?? []));
  return getStoneCuts(appData).filter(cut => {
    const cutId = getStoneCutId(cut);
    return (!allowedIds.size || allowedIds.has(cutId)) && isCutAllowedForStoneMode(cut, context.stoneMode);
  });
}

export function getAllowedStoneSizes(appData: iAppData, stoneTypeId: string, cutId: string, context: StoneSelectionContext = {}): number[] {
  const cut = findStoneCut(appData, cutId);
  if (!cut) {
    return [];
  }
  const rules = getMatchingRules(appData, context)
    .filter(rule => includesOrEmpty(rule.stoneTypes, stoneTypeId) && includesOrEmpty(rule.stoneCuts, cutId));
  const allowed = new Set<number>();
  rules.forEach(rule => {
    resolveRuleSizes(rule).forEach(size => allowed.add(size));
  });
  return cut.size
    .map(size => size.size)
    .filter(size => !allowed.size || allowed.has(size))
    .sort((a, b) => a - b);
}

export function getAllowedStoneQualities(appData: iAppData, stoneTypeId: string, cutId: string, size: number, context: StoneSelectionContext = {}): iStoneQuality[] {
  const rules = getRulesForSelection(appData, stoneTypeId, cutId, size, context);
  const allowedIds = new Set(rules.flatMap(rule => rule.qualities ?? []));
  return getStoneQualities(appData).filter(quality => quality.stoneType === stoneTypeId && (!allowedIds.size || allowedIds.has(String(quality.id))));
}

export function getAllowedStoneColors(appData: iAppData, stoneTypeId: string, cutId: string, size: number, context: StoneSelectionContext = {}): iStoneColor[] {
  const rules = getRulesForSelection(appData, stoneTypeId, cutId, size, context);
  const allowedIds = new Set(rules.flatMap(rule => rule.colors ?? []));
  return getStoneColors(appData).filter(color => !allowedIds.size ? COLOR_IDS.includes(color.id) : allowedIds.has(color.id));
}

export function normalizeStoneSelection(stoneGroup: iPresetStone, appData: iAppData, context: StoneSelectionContext = {}): StoneSelection {
  normalizeStoneTaxonomyAppData(appData);
  const types = getAllowedStoneTypes(appData, context);
  const currentType = String(stoneGroup.stoneType ?? "natural-diamond");
  const stoneType = types.find(item => item.id === currentType)?.id ?? types[0]?.id ?? "natural-diamond";

  const legacyCut = findStoneCutByLegacyId(appData, stoneGroup.type);
  const currentCut = String(stoneGroup.stoneCut ?? (legacyCut ? getStoneCutId(legacyCut) : "brilliant"));
  const cuts = getAllowedStoneCuts(appData, stoneType, context);
  const cut = cuts.find(item => getStoneCutId(item) === currentCut) ?? cuts[0] ?? findStoneCut(appData, "brilliant") ?? getStoneCuts(appData)[0];
  const stoneCut = cut ? getStoneCutId(cut) : "brilliant";
  if (cut?.legacyId !== undefined) {
    stoneGroup.type = cut.legacyId;
  } else if (typeof cut?.id === "number") {
    stoneGroup.type = cut.id;
  }

  const sizes = getAllowedStoneSizes(appData, stoneType, stoneCut, context);
  if (!sizes.includes(stoneGroup.size)) {
    stoneGroup.size = sizes.find(size => size >= stoneGroup.size) ?? sizes[0] ?? stoneGroup.size;
  }

  const typeDef = getStoneTypes(appData).find(item => item.id === stoneType) ?? DEFAULT_STONE_TYPES[0];
  const qualities = getAllowedStoneQualities(appData, stoneType, stoneCut, stoneGroup.size, context);
  let stoneQuality = stoneGroup.stoneQuality ?? mapLegacyQualityToId(stoneGroup.quality, stoneType);
  if (typeDef.requiresQuality && !qualities.some(item => String(item.id) === stoneQuality)) {
    stoneQuality = qualities[0] ? String(qualities[0].id) : typeDef.defaultQuality;
  }
  if (!typeDef.requiresQuality) {
    stoneQuality = qualities.some(item => String(item.id) === stoneQuality) ? stoneQuality : typeDef.defaultQuality;
  }

  const colors = getAllowedStoneColors(appData, stoneType, stoneCut, stoneGroup.size, context);
  let stoneColor = stoneGroup.stoneColor ?? typeDef.defaultColor;
  if (typeDef.requiresColor && !colors.some(item => item.id === stoneColor)) {
    stoneColor = colors[0]?.id ?? typeDef.defaultColor ?? "weiss";
  }
  if (!typeDef.requiresColor) {
    stoneColor = null;
  }

  stoneGroup.stoneType = stoneType;
  stoneGroup.stoneCut = stoneCut;
  stoneGroup.stoneQuality = stoneQuality;
  stoneGroup.stoneColor = stoneColor;
  stoneGroup.quality = mapQualityToLegacyIndex(appData, stoneQuality, stoneGroup.quality);

  return {
    stoneType,
    stoneQuality,
    stoneColor,
    stoneCut,
    stoneSize: stoneGroup.size,
  };
}

export function findStoneCut(appData: iAppData, cutId: string): iStoneCut | null {
  return getStoneCuts(appData).find(cut => getStoneCutId(cut) === cutId) ?? null;
}

export function findStoneCutByLegacyId(appData: iAppData, legacyId: number): iStoneCut | null {
  return getStoneCuts(appData).find(cut => (cut.legacyId ?? cut.id) === legacyId) ?? null;
}

export function getStoneCutId(cut: iStoneCut): string {
  const id = typeof cut.id === "string" ? cut.id : legacyCutIdToString(cut.id);
  return id || legacyCutIdToString(cut.legacyId ?? 1);
}

export function getStoneSettingMode(stoneMode?: number): StoneSettingMode {
  if (stoneMode === 10) return "bezel";
  if (stoneMode === 11) return "free";
  if (stoneMode === 20) return "verschnitt";
  if (stoneMode === 30) return "kanal";
  if (stoneMode === 31) return "kanal-quer";
  if (stoneMode !== undefined && stoneMode >= 40 && stoneMode <= 45) return "side";
  return "other";
}

export function mapQualityToLegacyIndex(appData: iAppData, qualityId: string | null | undefined, fallback = 0): number {
  const quality = getStoneQualities(appData).find(item => String(item.id) === String(qualityId));
  const legacy = Number(quality?.legacyQuality);
  return Number.isFinite(legacy) ? legacy : fallback;
}

function createDefaultStoneAvailabilityRules(cuts: iStoneCut[]): iStoneAvailabilityRule[] {
  const cutIds = cuts.map(getStoneCutId);
  const brilliantOnly = cutIds.includes("brilliant") ? ["brilliant"] : cutIds.slice(0, 1);
  return [
    {
      id: "diamond-cuts-default",
      stoneTypes: ["natural-diamond", "lab-diamond", "zirconia"],
      stoneCuts: cutIds,
      qualities: DEFAULT_STONE_QUALITIES.map(item => String(item.id)),
      colors: ["weiss"],
      settingModes: ["bezel", "free", "verschnitt", "kanal", "kanal-quer", "side", "other"],
      enabled: true,
      sort: 10,
    },
    {
      id: "colored-brilliant-default",
      stoneTypes: ["colored-stone"],
      stoneCuts: brilliantOnly,
      colors: COLOR_IDS,
      settingModes: ["bezel", "free", "verschnitt", "kanal", "kanal-quer", "side", "other"],
      enabled: true,
      sort: 20,
    },
  ];
}

function getMatchingRules(appData: iAppData, context: StoneSelectionContext): iStoneAvailabilityRule[] {
  const settingMode = context.settingMode ?? getStoneSettingMode(context.stoneMode);
  return getStoneAvailabilityRules(appData).filter(rule => {
    return includesOrEmpty(rule.ringTypes, context.ringType)
      && includesOrEmpty(rule.settingModes, settingMode);
  });
}

function getRulesForSelection(appData: iAppData, stoneTypeId: string, cutId: string, size: number, context: StoneSelectionContext): iStoneAvailabilityRule[] {
  return getMatchingRules(appData, context).filter(rule => {
    return includesOrEmpty(rule.stoneTypes, stoneTypeId)
      && includesOrEmpty(rule.stoneCuts, cutId)
      && isSizeAllowedByRule(rule, size);
  });
}

function resolveRuleSizes(rule: iStoneAvailabilityRule): number[] {
  if (Array.isArray(rule.sizes) && rule.sizes.length) {
    return rule.sizes.filter(size => Number.isFinite(size) && size > 0);
  }
  const min = Number(rule.sizeMin);
  const max = Number(rule.sizeMax);
  const step = Number(rule.sizeStep);
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0 || min > max) {
    return [];
  }
  const result: number[] = [];
  for (let size = min; size <= max; size += step) {
    result.push(size);
  }
  return result;
}

function isSizeAllowedByRule(rule: iStoneAvailabilityRule, size: number): boolean {
  const sizes = resolveRuleSizes(rule);
  if (sizes.length) {
    return sizes.includes(size);
  }
  return true;
}

function includesOrEmpty(values: string[] | undefined, value: string | undefined): boolean {
  return !values || values.length === 0 || value === undefined || values.includes(value);
}

function isCutAllowedForStoneMode(cut: iStoneCut, stoneMode?: number): boolean {
  return stoneMode === undefined || !cut.allowedStoneMode?.length || cut.allowedStoneMode.includes(stoneMode);
}

function normalizeStoneCut(record: Record<string, unknown>): iStoneCut {
  const legacy = Number(record["legacyId"] ?? record["id"]);
  const id = typeof record["id"] === "string" ? String(record["id"]) : legacyCutIdToString(legacy);
  return {
    ...(record as unknown as iStoneCut),
    id,
    legacyId: Number.isFinite(legacy) ? legacy : legacyCutStringToId(id),
  };
}

function normalizeStoneColor(record: Record<string, unknown>): iStoneColor {
  const id = String(record["id"] ?? "");
  const fallback = DEFAULT_STONE_COLORS.find(color => color.id === id);
  const hex = isStoneColorHex(record["hex"]) ? String(record["hex"]) : fallback?.hex ?? "#ffffff";
  const tintStrength = clampNumber(record["tintStrength"], fallback?.tintStrength ?? (id === "weiss" ? 0 : 0.75), 0, 1);
  const brightness = clampNumber(record["brightness"], fallback?.brightness ?? 1, 0.1, 3);
  return {
    id,
    name: String(record["name"] ?? fallback?.name ?? id),
    hex,
    imageUrl: typeof record["imageUrl"] === "string" ? String(record["imageUrl"]) : fallback?.imageUrl,
    img: typeof record["img"] === "string" ? String(record["img"]) : fallback?.img,
    sort: Number.isFinite(Number(record["sort"])) ? Number(record["sort"]) : fallback?.sort,
    enabled: record["enabled"] === undefined ? fallback?.enabled ?? true : record["enabled"] !== false,
    tintStrength,
    brightness,
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, num));
}

function normalizeStoneQuality(record: Record<string, unknown>): iStoneQuality {
  const id = record["id"] !== undefined ? String(record["id"]) : "";
  const legacyQuality = Number(record["legacyQuality"]);
  const fallback = DEFAULT_STONE_QUALITIES.find(quality => String(quality.id) === id)
    ?? DEFAULT_STONE_QUALITIES.find(quality => Number.isFinite(legacyQuality) && quality.legacyQuality === legacyQuality);
  const rawName = typeof record["name"] === "string" ? String(record["name"]) : undefined;
  const parsed = parseQualityName(rawName);
  const label = String(record["label"] ?? parsed.label ?? fallback?.label ?? rawName ?? id);
  const description = String(record["description"] ?? record["helpText"] ?? parsed.description ?? fallback?.description ?? "");
  const stoneType = normalizeStoneQualityType(record, fallback, label, rawName);

  return {
    ...(record as unknown as iStoneQuality),
    id: id || fallback?.id || "diamond-g-si1",
    name: rawName ?? fallback?.name,
    label,
    description: description || undefined,
    stoneType,
    colorGrade: typeof record["colorGrade"] === "string" ? String(record["colorGrade"]) : fallback?.colorGrade,
    clarityGrade: typeof record["clarityGrade"] === "string" ? String(record["clarityGrade"]) : fallback?.clarityGrade,
    legacyQuality: Number.isFinite(legacyQuality) ? legacyQuality : fallback?.legacyQuality,
    sort: Number.isFinite(Number(record["sort"])) ? Number(record["sort"]) : fallback?.sort,
  };
}

function parseQualityName(name: string | undefined): {label?: string; description?: string} {
  if (!name) {
    return {};
  }
  const match = name.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (!match) {
    return {label: name};
  }
  return {
    label: match[1].trim().replace("-", "/"),
    description: match[2].trim(),
  };
}

function normalizeStoneQualityType(
  record: Record<string, unknown>,
  fallback: iStoneQuality | undefined,
  label: string,
  name: string | undefined,
): string {
  const explicit = typeof record["stoneType"] === "string" ? String(record["stoneType"]) : "";
  if (DEFAULT_STONE_TYPES.some(type => type.id === explicit)) {
    return explicit;
  }

  const haystack = `${record["id"] ?? ""} ${label} ${name ?? ""}`.toLowerCase();
  if (haystack.includes("lab")) {
    return "lab-diamond";
  }
  if (haystack.includes("zirkonia") || haystack.includes("zirconia")) {
    return "zirconia";
  }
  return fallback?.stoneType ?? "natural-diamond";
}

function getLegacyStoneCuts(record: Record<string, unknown>): unknown[] {
  const raw = Array.isArray(record["stoneCut"]) ? record["stoneCut"] as unknown[] : record["stoneType"] as unknown[];
  return Array.isArray(raw) ? raw.filter(isRecord).filter(item => isLegacyStoneCut(item as Record<string, unknown>)) : [];
}

function isLegacyStoneCutArray(raw: unknown[]): boolean {
  return raw.some(item => isRecord(item) && isLegacyStoneCut(item as Record<string, unknown>));
}

function isLegacyStoneQualityArray(raw: unknown[]): boolean {
  return raw.some(item => isRecord(item) && typeof (item as Record<string, unknown>)["id"] === "number");
}

function isLegacyStoneCut(record: Record<string, unknown>): boolean {
  return Array.isArray(record["size"]) || typeof record["obj"] === "string" || typeof record["id"] === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function legacyCutIdToString(id: number): string {
  switch (id) {
    case 1: return "brilliant";
    case 2: return "princess";
    case 3: return "princess-45";
    case 4: return "baguette-cross";
    case 5: return "baguette";
    default: return id ? `legacy-cut-${id}` : "brilliant";
  }
}

function legacyCutStringToId(id: string): number {
  switch (id) {
    case "brilliant": return 1;
    case "princess": return 2;
    case "princess-45": return 3;
    case "baguette-cross": return 4;
    case "baguette": return 5;
    default: return 1;
  }
}

function getCutSortValue(cut: iStoneCut): number {
  return Number(cut.legacyId ?? cut.id ?? 999);
}

function mapLegacyQualityToId(legacyQuality: number, stoneType: string): string | null {
  const legacy = Number(legacyQuality);
  if (stoneType === "zirconia") return "zirconia-standard";
  if (stoneType === "lab-diamond") return "lab-g-vs1";
  if (stoneType === "colored-stone") return null;
  switch (legacy) {
    case 1: return "diamond-g-vs1";
    case 2: return "diamond-e-if";
    case 3: return "zirconia-standard";
    case 0:
    default:
      return "diamond-g-si1";
  }
}
