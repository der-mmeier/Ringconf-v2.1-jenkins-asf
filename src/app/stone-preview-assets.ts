import {iStoneColor} from "./app.interfaces";
import {
  COLORED_STONE_PREVIEW_MANIFEST,
  FALLBACK_STONE_PREVIEW_ASSET,
} from "./generated/colored-stone-preview-manifest";

const LEGACY_COLOR_PLACEHOLDER_PREFIX = "assets/imgui/stones/colors/";

export function resolveStonePreviewAsset(color: iStoneColor | null | undefined): string {
  if (!color) {
    return FALLBACK_STONE_PREVIEW_ASSET;
  }

  const explicit = sanitizeExplicitPreviewAsset(color.imageUrl || color.img);
  if (explicit) {
    return explicit;
  }

  const generatedManifest = COLORED_STONE_PREVIEW_MANIFEST as Record<string, {assetPath: string}>;
  const generated = generatedManifest[color.id];
  return generated?.assetPath || FALLBACK_STONE_PREVIEW_ASSET;
}

export function hasGeneratedStonePreview(color: iStoneColor | null | undefined): boolean {
  if (!color) {
    return false;
  }
  const generatedManifest = COLORED_STONE_PREVIEW_MANIFEST as Record<string, {assetPath: string}>;
  return !!generatedManifest[color.id];
}

export function usesFallbackStonePreview(color: iStoneColor | null | undefined): boolean {
  return resolveStonePreviewAsset(color) === FALLBACK_STONE_PREVIEW_ASSET;
}

export function stonePreviewAlt(color: iStoneColor | null | undefined): string {
  return color?.name ? `${color.name} Edelstein` : "Edelstein";
}

function sanitizeExplicitPreviewAsset(value: string | undefined): string | null {
  if (!value || value.startsWith(LEGACY_COLOR_PLACEHOLDER_PREFIX)) {
    return null;
  }
  if (!value.startsWith("assets/") || value.includes("..") || value.includes("\\") || value.includes("//")) {
    return null;
  }
  if (!/\.(svg|png|jpe?g|webp)$/i.test(value)) {
    return null;
  }
  return value;
}
