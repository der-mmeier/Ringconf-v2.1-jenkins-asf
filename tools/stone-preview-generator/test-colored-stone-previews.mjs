import assert from "node:assert/strict";
import {mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {
  assertNoFilenameCollisions,
  deriveFacetPalette,
  normalizeColorValue,
  normalizeHex,
  safeAssetId,
  sortColors,
} from "./color-math.mjs";
import {buildManifestSource, manifestReferencedAssets, parseManifestObject} from "./manifest-writer.mjs";
import {createFallbackStonePreviewSvg, createStonePreviewSvg} from "./svg-template.mjs";

const tests = [];
function test(name, fn) {
  tests.push({name, fn});
}

test("normalizes #RGB and #RRGGBB", () => {
  assert.equal(normalizeHex("#abc"), "#AABBCC");
  assert.equal(normalizeHex("8cc63f"), "#8CC63F");
});

test("normalizes RGB arrays and Color3 objects", () => {
  assert.deepEqual(normalizeColorValue([255, 128, 0]), {format: "rgb", previewHex: "#FF8000"});
  assert.deepEqual(normalizeColorValue({r: 0.5, g: 0.25, b: 1}), {format: "color3", previewHex: "#8040FF"});
});

test("rejects invalid color values", () => {
  assert.throws(() => normalizeHex("#12"));
  assert.throws(() => normalizeColorValue({r: 400, g: 0, b: 0}));
});

test("derives deterministic palettes for light, black, and saturated colors", () => {
  assert.equal(deriveFacetPalette("#FFFFFF").outline, "#788894");
  assert.equal(deriveFacetPalette("#000000").base, "#242A32");
  assert.deepEqual(deriveFacetPalette("#FF0000"), deriveFacetPalette("#FF0000"));
});

test("creates safe filenames and rejects path traversal", () => {
  assert.equal(safeAssetId("Äpfel Grün"), "apfel-grun");
  assert.throws(() => safeAssetId("../secret"));
});

test("detects filename collisions", () => {
  assert.throws(() => assertNoFilenameCollisions([{id: "ä"}, {id: "a"}]));
});

test("sorts deterministically and ignores disabled entries by caller", () => {
  const sorted = sortColors([{id: "b", sortOrder: 20}, {id: "a", sortOrder: 10}, {id: "c", sortOrder: 10}]);
  assert.deepEqual(sorted.map((item) => item.id), ["a", "c", "b"]);
});

test("creates byte-identical SVG output with facets and no raster content", () => {
  const color = {id: "apple-green", label: "Apple Green", sourceColor: {previewHex: "#8CC63F"}};
  const svgA = createStonePreviewSvg(color);
  const svgB = createStonePreviewSvg(color);
  assert.equal(svgA, svgB);
  assert.match(svgA, /viewBox="0 0 512 384"/);
  assert.match(svgA, /data-facet="crown/);
  assert.doesNotMatch(svgA, /<image|data:image|base64,|<circle/i);
});

test("creates neutral fallback as real SVG", () => {
  const svg = createFallbackStonePreviewSvg();
  assert.match(svg, /Neutraler Edelstein/);
  assert.doesNotMatch(svg, /<image|data:image|<circle/i);
});

test("writes parseable deterministic manifest references", () => {
  const palette = {appDataVersionLabel: "2.7.8.0", appDataHash: "hash"};
  const source = buildManifestSource(palette, [
    {id: "green", label: "Green", sourceColor: {previewHex: "#00AA00"}, sortOrder: 20},
    {id: "pink", label: "Pink", sourceColor: {previewHex: "#FF99CC"}, sortOrder: 10},
  ]);
  const manifest = parseManifestObject(source);
  assert.deepEqual(Object.keys(manifest), ["pink", "green"]);
  assert.equal(manifest.green.assetPath, "assets/imgui/stones/generated/green.svg");
  assert.ok(manifestReferencedAssets(source).has("assets/imgui/stones/generated/fallback-neutral.svg"));
});

test("manifest assets can exist without database config", () => {
  const dir = mkdtempSync(join(tmpdir(), "stone-preview-test-"));
  try {
    mkdirSync(join(dir, "generated"));
    writeFileSync(join(dir, "generated", "green.svg"), createStonePreviewSvg({id: "green", label: "Green", sourceColor: {previewHex: "#00AA00"}}));
    assert.ok(readFileSync(join(dir, "generated", "green.svg"), "utf8").includes("<path"));
    assert.deepEqual(readdirSync(join(dir, "generated")), ["green.svg"]);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

let passed = 0;
for (const {name, fn} of tests) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

console.log(`Colored stone preview unit tests passed: ${passed}`);
