import {existsSync, readFileSync} from "node:fs";
import process from "node:process";

const zipPath = process.argv[2];
const expectedRoot = "asf-ringkonfigurator";

if (!zipPath) {
  fail("Usage: node tools/validate-wordpress-plugin-package.mjs <zip>");
}

if (!existsSync(zipPath)) {
  fail(`ZIP file does not exist: ${zipPath}`);
}

const zip = readFileSync(zipPath);
const entries = readZipEntries(zip);
validateEntries(entries, zip);

console.log(`WordPress plugin ZIP validation passed: ${zipPath}`);
console.log(`ZIP root: ${expectedRoot}/`);
console.log(`ZIP entries: ${entries.length}`);

function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    fail("Could not find ZIP end-of-central-directory record.");
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries <= 0) {
    fail("ZIP file is unexpectedly empty.");
  }
  if (centralOffset <= 0 || centralSize <= 0 || centralOffset + centralSize > buffer.length) {
    fail("ZIP central directory is invalid.");
  }

  const entries = [];
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      fail(`Invalid central directory header at index ${index}.`);
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    entries.push({
      name,
      method,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function validateEntries(entries, buffer) {
  const names = new Set();
  const roots = new Set();

  for (const entry of entries) {
    validateEntryName(entry.name);
    names.add(entry.name);
    roots.add(entry.name.split("/")[0]);

    if (entry.name.startsWith(`${expectedRoot}/${expectedRoot}/`)) {
      fail(`ERROR: ZIP contains a double plugin nesting:\n${entry.name}`);
    }
  }

  if (roots.size !== 1 || !roots.has(expectedRoot)) {
    fail(`ERROR: ZIP must contain exactly one root folder "${expectedRoot}/"; found: ${[...roots].join(", ") || "(none)"}`);
  }

  for (const required of [
    `${expectedRoot}/`,
    `${expectedRoot}/asf-ringkonfigurator.php`,
    `${expectedRoot}/includes/`,
    `${expectedRoot}/assets/`,
    `${expectedRoot}/dist/`,
    `${expectedRoot}/readme.txt`,
  ]) {
    if (!names.has(required)) {
      fail(`ERROR: ZIP is missing required entry:\n${required}`);
    }
  }

  const manifestEntry = `${expectedRoot}/dist/asf-ringconf-manifest.json`;
  if (!names.has(manifestEntry)) {
    fail(`ERROR: ZIP is missing Angular manifest:\n${manifestEntry}`);
  }

  const manifest = JSON.parse(readStoredEntry(buffer, entries.find(entry => entry.name === manifestEntry)).toString("utf8"));
  validateManifest(manifest, names);

  for (const name of names) {
    if (name.endsWith(".map")) {
      fail(`ERROR: ZIP contains a source map:\n${name}`);
    }
    if (/(^|\/)(?:\.env|config\.local\.php)$/i.test(name)) {
      fail(`ERROR: ZIP contains a local secret/config file:\n${name}`);
    }
  }
}

function validateManifest(manifest, names) {
  if (!manifest || typeof manifest !== "object") {
    fail("ERROR: Angular manifest is not a JSON object.");
  }
  if (manifest.schemaVersion !== 2) {
    fail(`ERROR: Angular manifest schemaVersion must be 2; found ${String(manifest.schemaVersion)}.`);
  }

  const moduleEntry = validateManifestPath(manifest.moduleEntry, "moduleEntry");
  const moduleEntryZipPath = `${expectedRoot}/dist/browser/${moduleEntry}`;
  if (!names.has(moduleEntryZipPath)) {
    fail(`ERROR: Manifest moduleEntry references a missing file:\n${moduleEntryZipPath}`);
  }

  for (const file of manifest.moduleImports || []) {
    const manifestAsset = `${expectedRoot}/dist/browser/${validateManifestPath(file, "moduleImports")}`;
    if (!names.has(manifestAsset)) {
      fail(`ERROR: Manifest module import references a missing file:\n${manifestAsset}`);
    }
  }

  if (!Array.isArray(manifest.styles)) {
    fail("ERROR: Angular manifest styles must be an array.");
  }
  for (const file of manifest.styles) {
    const manifestAsset = `${expectedRoot}/dist/browser/${validateManifestPath(file, "styles")}`;
    if (!names.has(manifestAsset)) {
      fail(`ERROR: Manifest references a missing stylesheet:\n${manifestAsset}`);
    }
  }
}

function validateManifestPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`ERROR: Manifest ${field} contains an empty or non-string path.`);
  }
  if (value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.includes("../") || value.includes("//")) {
    fail(`ERROR: Manifest ${field} contains an unsafe path:\n${value}`);
  }
  return value.replace(/^\.\//, "");
}

function validateEntryName(name) {
  if (!name) {
    fail("ERROR: ZIP contains an empty entry name.");
  }
  if (name.includes("\\")) {
    fail(`ERROR: ZIP entry contains a Windows path separator:\n${name}`);
  }
  if (name.startsWith("/")) {
    fail(`ERROR: ZIP entry is absolute:\n${name}`);
  }
  if (/^[A-Za-z]:/.test(name)) {
    fail(`ERROR: ZIP entry contains a drive letter:\n${name}`);
  }
  if (name.includes("../") || name === ".." || name.endsWith("/..")) {
    fail(`ERROR: ZIP entry contains path traversal:\n${name}`);
  }
  if (name.includes("//")) {
    fail(`ERROR: ZIP entry contains an empty path segment:\n${name}`);
  }

  const parts = name.endsWith("/") ? name.slice(0, -1).split("/") : name.split("/");
  if (parts.some(part => part === "" || part === "." || part === "..")) {
    fail(`ERROR: ZIP entry contains an unsafe path segment:\n${name}`);
  }
}

function readStoredEntry(buffer, entry) {
  if (!entry) {
    fail("Internal error: missing ZIP entry.");
  }
  if (entry.method !== 0) {
    fail(`ERROR: ZIP entry uses unsupported compression method ${entry.method}:\n${entry.name}`);
  }
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    fail(`ERROR: ZIP local header is invalid for:\n${entry.name}`);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataOffset = offset + 30 + nameLength + extraLength;
  return buffer.subarray(dataOffset, dataOffset + entry.compressedSize);
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
