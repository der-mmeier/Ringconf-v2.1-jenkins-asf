import {deriveFacetPalette, normalizeHex, safeAssetId} from "./color-math.mjs";

export const FALLBACK_PREVIEW_ID = "fallback-neutral";

export function createStonePreviewSvg(color) {
  const id = safeAssetId(color.id);
  const label = escapeXml(color.label || color.id);
  const base = normalizeHex(color.sourceColor?.previewHex || color.previewHex);
  const palette = deriveFacetPalette(base);
  return renderSvg(id, label, palette);
}

export function createFallbackStonePreviewSvg() {
  return renderSvg(FALLBACK_PREVIEW_ID, "Neutraler Edelstein", deriveFacetPalette("#D8E2EA"));
}

function renderSvg(id, label, palette) {
  const prefix = `gem-${id}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 384" role="img" aria-labelledby="${prefix}-title">`,
    `  <title id="${prefix}-title">${label}</title>`,
    "  <defs>",
    `    <linearGradient id="${prefix}-crown" x1="76" y1="88" x2="436" y2="196" gradientUnits="userSpaceOnUse">`,
    `      <stop offset="0" stop-color="${palette.light}"/>`,
    `      <stop offset="0.48" stop-color="${palette.base}"/>`,
    `      <stop offset="1" stop-color="${palette.shadow}"/>`,
    "    </linearGradient>",
    `    <linearGradient id="${prefix}-pavilion" x1="112" y1="180" x2="400" y2="342" gradientUnits="userSpaceOnUse">`,
    `      <stop offset="0" stop-color="${palette.midLight}"/>`,
    `      <stop offset="0.5" stop-color="${palette.base}"/>`,
    `      <stop offset="1" stop-color="${palette.deepShadow}"/>`,
    "    </linearGradient>",
    `    <radialGradient id="${prefix}-spark" cx="35%" cy="23%" r="58%">`,
    `      <stop offset="0" stop-color="${palette.specularTint}" stop-opacity=".95"/>`,
    `      <stop offset=".42" stop-color="${palette.light}" stop-opacity=".48"/>`,
    `      <stop offset="1" stop-color="${palette.base}" stop-opacity="0"/>`,
    "    </radialGradient>",
    `    <clipPath id="${prefix}-silhouette">`,
    "      <path d=\"M52 150 116 76 256 42 396 76 460 150 364 304 256 352 148 304Z\"/>",
    "    </clipPath>",
    "  </defs>",
    `  <g clip-path="url(#${prefix}-silhouette)">`,
    `    <path data-facet="crown-base" d="M52 150 116 76 256 42 396 76 460 150 256 190Z" fill="url(#${prefix}-crown)"/>`,
    `    <path data-facet="table-light" d="M150 106 256 72 362 106 320 154 192 154Z" fill="${palette.light}"/>`,
    `    <path data-facet="table-highlight" d="M190 112 256 88 322 112 294 135 214 137Z" fill="${palette.specularTint}" opacity=".78"/>`,
    `    <path data-facet="crown-left-light" d="M52 150 116 76 150 106 108 160Z" fill="${palette.midLight}"/>`,
    `    <path data-facet="crown-left-mid" d="M108 160 150 106 192 154 166 190Z" fill="${palette.base}"/>`,
    `    <path data-facet="crown-center-light" d="M192 154 256 72 320 154 256 190Z" fill="${palette.midLight}" opacity=".92"/>`,
    `    <path data-facet="crown-right-mid" d="M320 154 362 106 404 160 346 190Z" fill="${palette.shadow}" opacity=".88"/>`,
    `    <path data-facet="crown-right-dark" d="M362 106 396 76 460 150 404 160Z" fill="${palette.deepShadow}" opacity=".78"/>`,
    `    <path data-facet="girdle-light" d="M52 150 108 160 166 190 256 190 346 190 404 160 460 150 430 178 256 214 82 178Z" fill="${palette.light}" opacity=".38"/>`,
    `    <path data-facet="pavilion-base" d="M82 178 256 214 430 178 364 304 256 352 148 304Z" fill="url(#${prefix}-pavilion)"/>`,
    `    <path data-facet="pavilion-left-dark" d="M82 178 166 190 256 352 148 304Z" fill="${palette.shadow}"/>`,
    `    <path data-facet="pavilion-left-light" d="M166 190 256 214 256 352Z" fill="${palette.midLight}" opacity=".72"/>`,
    `    <path data-facet="pavilion-center-dark" d="M256 214 346 190 256 352Z" fill="${palette.deepShadow}" opacity=".64"/>`,
    `    <path data-facet="pavilion-right-mid" d="M346 190 430 178 364 304 256 352Z" fill="${palette.base}" opacity=".72"/>`,
    `    <path data-facet="pavilion-keel" d="M218 236 256 352 294 236 256 214Z" fill="${palette.deepShadow}" opacity=".55"/>`,
    `    <path data-facet="sparkle-wash" d="M76 76H436V226H76Z" fill="url(#${prefix}-spark)" opacity=".62"/>`,
    `    <path data-facet="specular-1" d="M136 104 168 88 188 104 156 122Z" fill="#FFFFFF" opacity=".76"/>`,
    `    <path data-facet="specular-2" d="M238 82 258 74 280 86 254 96Z" fill="#FFFFFF" opacity=".58"/>`,
    `    <path data-facet="specular-3" d="M300 148 324 128 348 138 318 166Z" fill="#FFFFFF" opacity=".42"/>`,
    "  </g>",
    `  <path data-role="outline" d="M52 150 116 76 256 42 396 76 460 150 364 304 256 352 148 304Z" fill="none" stroke="${palette.outline}" stroke-width="11" stroke-linejoin="round"/>`,
    `  <path data-role="girdle-outline" d="M54 150C120 182 196 198 256 198S392 182 458 150" fill="none" stroke="${palette.outline}" stroke-width="5" stroke-linecap="round" opacity=".42"/>`,
    "</svg>",
    "",
  ].join("\n");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
