import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {dirname, join, relative} from "node:path";
import process from "node:process";
import {readPalette} from "./appdata-palette-reader.mjs";
import {assertNoFilenameCollisions, normalizeHex, safeAssetId, sortColors} from "./color-math.mjs";
import {buildManifestSource, GENERATED_ASSET_DIR, MANIFEST_PATH} from "./manifest-writer.mjs";
import {createFallbackStonePreviewSvg, createStonePreviewSvg, FALLBACK_PREVIEW_ID} from "./svg-template.mjs";

const root = process.cwd();

const options = parseCli(process.argv.slice(2));
const palette = readPalette(options);
const colors = sortColors(palette.colors.filter((color) => color.enabled !== false));

assertNoFilenameCollisions(colors);
validateColors(colors);

const outputs = new Map();
for (const color of colors) {
  const safeId = safeAssetId(color.id);
  outputs.set(`${safeId}.svg`, createStonePreviewSvg(color));
}
outputs.set(`${FALLBACK_PREVIEW_ID}.svg`, createFallbackStonePreviewSvg());

const manifestSource = buildManifestSource(palette, colors);
validateGeneratedSet(outputs, manifestSource);

if (options.dryRun) {
  console.log(`Dry run: ${outputs.size} SVG files and ${MANIFEST_PATH} would be written.`);
  console.log(`AppData version: ${palette.appDataVersionLabel || palette.appDataVersionId || "unknown"}`);
  console.log(`Colors: ${colors.map((color) => color.id).join(", ") || "(none)"}`);
  process.exit(0);
}

writeAtomically(outputs, manifestSource);

console.log(`Generated ${colors.length} colored stone previews.`);
console.log(`AppData version: ${palette.appDataVersionLabel || palette.appDataVersionId || "unknown"}`);
console.log(`Assets: ${GENERATED_ASSET_DIR}`);
console.log(`Manifest: ${MANIFEST_PATH}`);

function parseCli(args) {
  const result = {
    dryRun: false,
    verbose: false,
  };
  for (const arg of args) {
    if (arg === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (arg === "--verbose") {
      result.verbose = true;
      continue;
    }
    const match = /^--([a-zA-Z0-9_-]+)=(.*)$/.exec(arg);
    if (!match) {
      throw new Error(`Unsupported argument: ${arg}`);
    }
    const key = match[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (!["target", "build", "version", "state"].includes(key)) {
      throw new Error(`Unsupported option: --${match[1]}`);
    }
    result[key] = match[2];
  }
  return result;
}

function validateColors(colors) {
  if (colors.length === 0) {
    throw new Error("No active stone colors were returned by the AppData adapter.");
  }
  for (const color of colors) {
    normalizeHex(color.sourceColor.previewHex);
    safeAssetId(color.id);
  }
}

function validateGeneratedSet(outputs, manifestSource) {
  if (!manifestSource.includes("generated - do not edit manually")) {
    throw new Error("Generated manifest header is missing.");
  }
  for (const [name, svg] of outputs) {
    if (!/^[a-z0-9-]+\.svg$/.test(name)) {
      throw new Error(`Unsafe output filename: ${name}`);
    }
    if (svg.includes("<image") || svg.includes("data:image") || svg.includes("base64,") || svg.includes("xlink:href")) {
      throw new Error(`Generated SVG contains forbidden raster content: ${name}`);
    }
    if (!svg.includes("<path") || svg.includes("<circle")) {
      throw new Error(`Generated SVG does not look like a faceted path-based preview: ${name}`);
    }
  }
}

function writeAtomically(outputs, manifestSource) {
  const assetDir = join(root, GENERATED_ASSET_DIR);
  const manifestPath = join(root, MANIFEST_PATH);
  const tempDir = join(root, GENERATED_ASSET_DIR + `.tmp-${process.pid}`);

  rmSync(tempDir, {recursive: true, force: true});
  mkdirSync(tempDir, {recursive: true});

  try {
    for (const [name, svg] of outputs) {
      writeFileSync(join(tempDir, name), svg, "utf8");
    }

    mkdirSync(assetDir, {recursive: true});
    for (const [name] of outputs) {
      cpSync(join(tempDir, name), join(assetDir, name));
    }

    for (const file of readdirSync(assetDir)) {
      const path = join(assetDir, file);
      if (statSync(path).isFile() && file.endsWith(".svg") && !outputs.has(file)) {
        rmSync(path);
      }
    }

    mkdirSync(dirname(manifestPath), {recursive: true});
    const current = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
    if (current !== manifestSource) {
      writeFileSync(manifestPath, manifestSource, "utf8");
    }
  } finally {
    rmSync(tempDir, {recursive: true, force: true});
  }
}
