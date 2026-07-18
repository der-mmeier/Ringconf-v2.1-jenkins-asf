import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {join} from "node:path";
import process from "node:process";
import {
  GENERATED_ASSET_DIR,
  MANIFEST_PATH,
  manifestReferencedAssets,
  parseManifestObject,
} from "./manifest-writer.mjs";
import {normalizeHex, safeAssetId} from "./color-math.mjs";

const root = process.cwd();
const manifestPath = join(root, MANIFEST_PATH);
const assetDir = join(root, GENERATED_ASSET_DIR);

try {
  verify();
  console.log("Colored stone preview verification passed.");
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

export function verify() {
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest is missing: ${MANIFEST_PATH}`);
  }
  if (!existsSync(assetDir)) {
    throw new Error(`Generated asset directory is missing: ${GENERATED_ASSET_DIR}`);
  }

  const manifestSource = readFileSync(manifestPath, "utf8");
  const manifest = parseManifestObject(manifestSource);
  const referencedAssets = manifestReferencedAssets(manifestSource);
  const seenColorIds = new Set();

  for (const [key, entry] of Object.entries(manifest)) {
    if (key !== entry.colorId) {
      throw new Error(`Manifest key does not match colorId: ${key}`);
    }
    if (seenColorIds.has(entry.colorId)) {
      throw new Error(`Duplicate colorId in manifest: ${entry.colorId}`);
    }
    seenColorIds.add(entry.colorId);
    safeAssetId(entry.colorId);
    normalizeHex(entry.previewHex);
    verifyAssetPath(entry.assetPath);
    verifySvg(entry.assetPath);
  }

  for (const asset of referencedAssets) {
    verifyAssetPath(asset);
    verifySvg(asset);
  }

  const expectedFiles = new Set([...referencedAssets].map((asset) => asset.slice("assets/imgui/stones/generated/".length)));
  for (const file of readdirSync(assetDir)) {
    const fullPath = join(assetDir, file);
    if (!statSync(fullPath).isFile() || !file.endsWith(".svg")) {
      continue;
    }
    if (!expectedFiles.has(file)) {
      throw new Error(`Unreferenced generated SVG: ${file}`);
    }
  }
}

function verifyAssetPath(assetPath) {
  if (typeof assetPath !== "string" || !assetPath.startsWith("assets/imgui/stones/generated/")) {
    throw new Error(`Generated asset path is outside the expected folder: ${assetPath}`);
  }
  const filename = assetPath.slice("assets/imgui/stones/generated/".length);
  if (!/^[a-z0-9-]+\.svg$/.test(filename) || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    throw new Error(`Unsafe generated SVG filename: ${filename}`);
  }
  if (!existsSync(join(root, "src", assetPath))) {
    throw new Error(`Referenced SVG does not exist: ${assetPath}`);
  }
}

function verifySvg(assetPath) {
  const svgPath = join(root, "src", assetPath);
  const svg = readFileSync(svgPath, "utf8");
  if (Buffer.byteLength(svg, "utf8") > 24000) {
    throw new Error(`Generated SVG is unexpectedly large: ${assetPath}`);
  }
  const forbidden = ["<image", "data:image", "base64,", "xlink:href", "href=\"http", "href='http"];
  for (const token of forbidden) {
    if (svg.includes(token)) {
      throw new Error(`Generated SVG contains forbidden content "${token}": ${assetPath}`);
    }
  }
  if (!/<svg\b[^>]*viewBox="0 0 512 384"/.test(svg)) {
    throw new Error(`Generated SVG has no expected viewBox: ${assetPath}`);
  }
  if (/<svg\b[^>]*(?:style|fill)=["'][^"']*(?:white|#fff|#ffffff)/i.test(svg)) {
    throw new Error(`Generated SVG root appears to define an opaque background: ${assetPath}`);
  }
  const pathCount = (svg.match(/<path\b/g) || []).length;
  if (pathCount < 12) {
    throw new Error(`Generated SVG has too few facet paths: ${assetPath}`);
  }
  if (/<circle\b/i.test(svg)) {
    throw new Error(`Generated SVG contains a circle placeholder: ${assetPath}`);
  }
  if (!svg.includes("data-facet=") || !svg.includes("data-role=\"outline\"")) {
    throw new Error(`Generated SVG lacks facet metadata: ${assetPath}`);
  }
}
