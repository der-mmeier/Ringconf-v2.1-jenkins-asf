import {existsSync, readFileSync} from "node:fs";
import {basename, join} from "node:path";
import process from "node:process";

const root = process.cwd();
const dist = join(root, "_shop", "woocommerce", "OneRingconf", "dist");
const browserDist = join(dist, "browser");
const manifestPath = join(dist, "asf-ringconf-manifest.json");

if (!existsSync(manifestPath)) {
  fail(`Manifest is missing: ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.schemaVersion !== 2) {
  fail(`Manifest schemaVersion must be 2; found ${String(manifest.schemaVersion)}.`);
}

const moduleEntry = validatePath(manifest.moduleEntry, "moduleEntry");
const entryPath = join(browserDist, moduleEntry);
if (!existsSync(entryPath)) {
  fail(`Module entry is missing: ${entryPath}`);
}

const source = readFileSync(entryPath, "utf8");
if (source.includes("window.__ASF_RINGCONF_RUNTIME__")) {
  fail("Module entry references the removed global runtime variable.");
}
if (source.includes("api.php")) {
  fail("Module entry contains an api.php fallback.");
}

const imports = parseImports(source);
if (imports.length !== 2) {
  fail(`Module entry must import exactly polyfills and main; found ${imports.length}.`);
}

const expectedImports = Array.isArray(manifest.moduleImports) ? manifest.moduleImports.map((value) => validatePath(value, "moduleImports")) : [];
if (expectedImports.length !== 2) {
  fail("Manifest moduleImports must contain exactly two entries.");
}

for (let index = 0; index < imports.length; index++) {
  const importPath = validateImport(imports[index]);
  const relativePath = importPath.slice(2);
  if (relativePath !== expectedImports[index]) {
    fail(`Module import order does not match manifest at index ${index}: ${relativePath} !== ${expectedImports[index]}`);
  }
  if (!existsSync(join(browserDist, relativePath))) {
    fail(`Module import target is missing: ${relativePath}`);
  }
}

if (!basename(imports[0]).startsWith("polyfills-") && !basename(imports[0]).startsWith("polyfills.")) {
  fail(`First module import must be polyfills; found ${imports[0]}`);
}
if (!basename(imports[1]).startsWith("main-") && !basename(imports[1]).startsWith("main.")) {
  fail(`Second module import must be main; found ${imports[1]}`);
}

if (!Array.isArray(manifest.styles)) {
  fail("Manifest styles must be an array.");
}
for (const style of manifest.styles) {
  const stylePath = validatePath(style, "styles");
  if (!existsSync(join(browserDist, stylePath))) {
    fail(`Manifest stylesheet is missing: ${stylePath}`);
  }
}

console.log(`WooCommerce module entry validation passed: ${moduleEntry}`);

function parseImports(source) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const imports = [];
  for (const line of lines) {
    const match = /^import\s+['"]([^'"]+)['"];?$/.exec(line);
    if (!match) {
      fail(`Module entry contains a non-import statement:\n${line}`);
    }
    imports.push(match[1]);
  }
  return imports;
}

function validateImport(value) {
  if (!value.startsWith("./")) {
    fail(`Module import must be relative: ${value}`);
  }
  validatePath(value.slice(2), "module import");
  return value;
}

function validatePath(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${field} must be a non-empty string.`);
  }
  if (value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.includes("../") || value.includes("//")) {
    fail(`${field} contains an unsafe path: ${value}`);
  }
  return value.replace(/^\.\//, "");
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
