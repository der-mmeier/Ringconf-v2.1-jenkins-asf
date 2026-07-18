import {safeAssetId, sortColors} from "./color-math.mjs";
import {FALLBACK_PREVIEW_ID} from "./svg-template.mjs";

export const MANIFEST_PATH = "src/app/generated/colored-stone-preview-manifest.ts";
export const GENERATED_ASSET_DIR = "src/assets/imgui/stones/generated";
export const ASSET_PUBLIC_PREFIX = "assets/imgui/stones/generated";

export function buildManifestSource(palette, colors) {
  const entries = {};
  for (const color of sortColors(colors)) {
    const safeId = safeAssetId(color.id);
    entries[color.id] = {
      colorId: color.id,
      label: color.label,
      assetPath: `${ASSET_PUBLIC_PREFIX}/${safeId}.svg`,
      previewHex: color.sourceColor.previewHex,
      sourceAppDataVersion: palette.appDataVersionLabel || palette.appDataVersionId || "unknown",
      sourceAppDataHash: palette.appDataHash || "",
    };
  }

  return [
    "/* generated - do not edit manually */",
    "",
    "export interface GeneratedStonePreview {",
    "  colorId: string;",
    "  label: string;",
    "  assetPath: string;",
    "  previewHex: string;",
    "  sourceAppDataVersion: string;",
    "  sourceAppDataHash: string;",
    "}",
    "",
    `export const FALLBACK_STONE_PREVIEW_ASSET = "${ASSET_PUBLIC_PREFIX}/${FALLBACK_PREVIEW_ID}.svg" as const;`,
    "",
    "export const COLORED_STONE_PREVIEW_MANIFEST = ",
    `${JSON.stringify(entries, null, 2)} as const satisfies Record<string, GeneratedStonePreview>;`,
    "",
  ].join("\n");
}

export function manifestReferencedAssets(manifestSource) {
  const object = parseManifestObject(manifestSource);
  const assets = new Set(Object.values(object).map((entry) => entry.assetPath));
  const fallbackMatch = /FALLBACK_STONE_PREVIEW_ASSET\s*=\s*"([^"]+)"/.exec(manifestSource);
  if (fallbackMatch) {
    assets.add(fallbackMatch[1]);
  }
  return assets;
}

export function parseManifestObject(manifestSource) {
  const startMarker = "export const COLORED_STONE_PREVIEW_MANIFEST = ";
  const endMarker = " as const satisfies Record<string, GeneratedStonePreview>;";
  const start = manifestSource.indexOf(startMarker);
  const end = manifestSource.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error("Could not find COLORED_STONE_PREVIEW_MANIFEST object.");
  }
  return JSON.parse(manifestSource.slice(start + startMarker.length, end));
}
