import {
  ExteriorEngravingPlacement,
  ExteriorEngravingType,
  iAppData,
  iEngravingOffer,
  iEngravingSymbol,
  iExteriorEngravingConfig,
  iPresetStone
} from "./app.interfaces";

export const EXTERIOR_ENGRAVING_TYPES: ExteriorEngravingType[] = ["text", "coordinates", "waveform", "fingerprint"];
export const EXTERIOR_ENGRAVING_PLACEMENTS: ExteriorEngravingPlacement[] = ["single-ring", "both-identical", "split-pair"];
export const DEFAULT_ENGRAVING_OFFERS: iEngravingOffer[] = [
  {id: "inner-text", enabled: true, price: 29, priceKey: "engravingInnerText"},
  {id: "exterior-text", enabled: true, price: 49, priceKey: "engravingExteriorText"},
  {id: "exterior-coordinates", enabled: true, price: 59, priceKey: "engravingExteriorCoordinates"},
  {id: "exterior-waveform", enabled: true, price: 69, priceKey: "engravingExteriorWaveform"},
  {id: "exterior-fingerprint", enabled: true, price: 69, priceKey: "engravingExteriorFingerprint"},
];

export const DEFAULT_EXTERIOR_ENGRAVING: iExteriorEngravingConfig = {
  enabled: false,
  type: "none",
  placement: "single-ring",
  text: "",
  fontId: 0,
  latitudeInput: "",
  longitudeInput: "",
  latitude: null,
  longitude: null,
  coordinateFormat: "decimal",
  showShipWheel: true,
  previewAssetId: null,
  customerAssetRequiredAfterOrder: false,
};

export function cloneExteriorEngravingConfig(config?: Partial<iExteriorEngravingConfig> | null): iExteriorEngravingConfig {
  return normalizeExteriorEngravingConfig(config);
}

export function normalizeExteriorEngravingConfig(config?: Partial<iExteriorEngravingConfig> | null): iExteriorEngravingConfig {
  const source = config && typeof config === "object" ? config : {};
  const type = EXTERIOR_ENGRAVING_TYPES.includes(source.type as ExteriorEngravingType)
    ? source.type as ExteriorEngravingType
    : "none";
  const placement = EXTERIOR_ENGRAVING_PLACEMENTS.includes(source.placement as ExteriorEngravingPlacement)
    ? source.placement as ExteriorEngravingPlacement
    : "single-ring";

  const normalized: iExteriorEngravingConfig = {
    ...DEFAULT_EXTERIOR_ENGRAVING,
    ...source,
    enabled: source.enabled === true && type !== "none",
    type,
    placement: type === "text" || type === "coordinates"
      ? (placement === "split-pair" ? "single-ring" : placement)
      : placement,
    text: typeof source.text === "string" ? source.text : "",
    fontId: source.fontId ?? 0,
    latitudeInput: typeof source.latitudeInput === "string" ? source.latitudeInput : "",
    longitudeInput: typeof source.longitudeInput === "string" ? source.longitudeInput : "",
    latitude: Number.isFinite(source.latitude as number) ? Number(source.latitude) : null,
    longitude: Number.isFinite(source.longitude as number) ? Number(source.longitude) : null,
    coordinateFormat: source.coordinateFormat === "dms" ? "dms" : "decimal",
    showShipWheel: source.showShipWheel !== false,
    previewAssetId: source.previewAssetId === "fingerprint-sample" || source.previewAssetId === "waveform-sample"
      ? source.previewAssetId
      : null,
    customerAssetRequiredAfterOrder: source.type === "waveform" || source.type === "fingerprint"
      ? true
      : source.customerAssetRequiredAfterOrder === true,
  };

  if (!normalized.enabled) {
    normalized.type = "none";
    normalized.customerAssetRequiredAfterOrder = false;
  }

  if (normalized.type === "waveform") normalized.previewAssetId = "waveform-sample";
  if (normalized.type === "fingerprint") normalized.previewAssetId = "fingerprint-sample";

  return normalized;
}

export function normalizeEngravingAppData(appData: iAppData): iAppData {
  const engraving: Record<string, unknown> = isRecord(appData.engraving)
    ? appData.engraving as unknown as Record<string, unknown>
    : {};
  const exterior: Record<string, unknown> = isRecord(engraving["exterior"])
    ? engraving["exterior"]
    : {};
  const offers = offerArray(exterior["offers"])
    ?? offerArray(engraving["offers"])
    ?? undefined;
  const priceOverrides = isRecord(exterior["prices"])
    ? exterior["prices"]
    : (isRecord(engraving["prices"]) ? engraving["prices"] : {});

  appData.engraving = {
    ...engraving,
    maxLength: positiveNumber(engraving["maxLength"], 30),
    symbols: Array.isArray(engraving["symbols"]) ? engraving["symbols"] as iEngravingSymbol[] : [],
    color: typeof engraving["color"] === "string" && engraving["color"].trim() !== ""
      ? engraving["color"]
      : "#333333",
    alpha: Number.isFinite(Number(engraving["alpha"])) ? Number(engraving["alpha"]) : 0.6,
    exterior: {
      ...exterior,
      maxTextLength: positiveNumber(exterior["maxTextLength"], 34),
      edgeClearance: positiveNumber(exterior["edgeClearance"], 500),
      offers: normalizeEngravingOffers(offers, priceOverrides),
    },
  };

  return appData;
}

function normalizeEngravingOffers(offers: iEngravingOffer[] | undefined, priceOverrides: Record<string, unknown>): iEngravingOffer[] {
  const normalizedOverrides = new Map<iEngravingOffer["id"], iEngravingOffer>();
  offers?.forEach(offer => {
    if (!isRecord(offer)) return;
    const id = normalizeOfferId(offer["id"]);
    if (!id) return;
    normalizedOverrides.set(id, offer as iEngravingOffer);
  });

  return DEFAULT_ENGRAVING_OFFERS.map(defaultOffer => {
    const override = normalizedOverrides.get(defaultOffer.id);
    const explicitPrice = override && Object.prototype.hasOwnProperty.call(override, "price");
    const priceOverride = defaultOffer.priceKey && Object.prototype.hasOwnProperty.call(priceOverrides, defaultOffer.priceKey)
      ? priceOverrides[defaultOffer.priceKey]
      : undefined;
    const rawPrice = explicitPrice
      ? override?.price
      : (priceOverride !== undefined ? priceOverride : defaultOffer.price);
    return {
      ...defaultOffer,
      ...override,
      id: defaultOffer.id,
      enabled: booleanValue(override?.enabled, defaultOffer.enabled !== false),
      price: normalizePrice(rawPrice),
    };
  });
}

export function getEngravingOffer(appData: iAppData, id: iEngravingOffer["id"]): iEngravingOffer | null {
  return normalizeEngravingAppData(appData).engraving?.exterior?.offers?.find(offer => offer.id === id) ?? null;
}

export function isEngravingOfferVisible(appData: iAppData, id: iEngravingOffer["id"]): boolean {
  const offer = getEngravingOffer(appData, id);
  if (!offer || offer.enabled === false) return false;
  const price = Number(offer.price);
  return Number.isFinite(price) && price > 0;
}

export function getEngravingOfferPrice(appData: iAppData, id: iEngravingOffer["id"]): number | null {
  if (!isEngravingOfferVisible(appData, id)) return null;
  return Number(getEngravingOffer(appData, id)?.price);
}

export function exteriorTypeToOfferId(type: ExteriorEngravingType): iEngravingOffer["id"] | null {
  switch (type) {
    case "text": return "exterior-text";
    case "coordinates": return "exterior-coordinates";
    case "waveform": return "exterior-waveform";
    case "fingerprint": return "exterior-fingerprint";
    default: return null;
  }
}

export function hasActiveStoneGroups(stoneGroups: iPresetStone[] | undefined | null): boolean {
  if (!Array.isArray(stoneGroups)) return false;
  return stoneGroups.some(group => isActiveStoneGroup(group));
}

export function isActiveStoneGroup(group: iPresetStone | undefined | null): boolean {
  if (!group || !Number.isFinite(group.mode) || group.mode === 0) return false;
  if (group.mode === 11) return Array.isArray(group.freeStones) && group.freeStones.length > 0;
  const rows = Number(group.rows) > 0 ? Number(group.rows) : 1;
  const countReal = Number(group.countReal);
  const count = Number(group.count);
  if (Number.isFinite(countReal) && countReal > 0) return true;
  return Number.isFinite(count) && count !== 0 && rows > 0;
}

export function parseCoordinateInput(value: string, min: number, max: number): number | null {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export function formatCoordinates(config: iExteriorEngravingConfig): string {
  const lat = Number.isFinite(config.latitude as number) ? Number(config.latitude) : null;
  const lon = Number.isFinite(config.longitude as number) ? Number(config.longitude) : null;
  if (lat === null || lon === null) return "";
  const prefix = config.showShipWheel === false ? "" : "⚙ ";
  return `${prefix}${formatCoordinate(lat, "N", "S")} ${formatCoordinate(lon, "E", "W")}`;
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  const direction = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(5)}° ${direction}`;
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizePrice(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "nein", "off"].includes(normalized)) return false;
    if (["true", "1", "yes", "ja", "on"].includes(normalized)) return true;
  }
  return fallback;
}

function offerArray(value: unknown): iEngravingOffer[] | null {
  return Array.isArray(value) ? value.filter(isRecord) as unknown as iEngravingOffer[] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeOfferId(value: unknown): iEngravingOffer["id"] | null {
  const id = String(value ?? "").trim();
  switch (id) {
    case "inner":
    case "inside":
    case "interior":
    case "interior-text":
    case "inner-text":
      return "inner-text";
    case "outer":
    case "outside":
    case "exterior":
    case "outer-text":
    case "outside-text":
    case "exterior-text":
      return "exterior-text";
    case "coordinates":
    case "exterior-coordinates":
      return "exterior-coordinates";
    case "waveform":
    case "exterior-waveform":
      return "exterior-waveform";
    case "fingerprint":
    case "exterior-fingerprint":
      return "exterior-fingerprint";
    default:
      return null;
  }
}
