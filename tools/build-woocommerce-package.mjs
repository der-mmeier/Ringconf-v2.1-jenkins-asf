import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {basename, dirname, extname, join, relative, resolve} from "node:path";
import process from "node:process";

const root = process.cwd();
const packageJson = readJson("package.json");
const version = packageJson.version;
const pluginSource = join(root, "_shop", "woocommerce", "OneRingconf");
const distRoot = join(pluginSource, "dist");
const browserDist = findBrowserDist();
const manifestPath = join(distRoot, "asf-ringconf-manifest.json");
const packageRoot = join(root, ".deploy", "woocommerce");
const packageSlug = "asf-ringkonfigurator";
const packageDir = join(packageRoot, packageSlug);
const zipPath = join(packageRoot, `${packageSlug}-${version}.zip`);
let crcTable = null;

const manifest = createManifest(browserDist);
mkdirSync(dirname(manifestPath), {recursive: true});
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

rmSync(packageDir, {recursive: true, force: true});
mkdirSync(packageDir, {recursive: true});

copyPluginSource(pluginSource, packageDir);
rmSync(zipPath, {force: true});
createZip(packageDir, zipPath);

console.log(`WooCommerce manifest: ${relativePath(manifestPath)}`);
console.log(`WooCommerce package: ${relativePath(zipPath)}`);

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function findBrowserDist() {
  for (const candidate of [join(distRoot, "browser"), distRoot]) {
    if (existsSync(join(candidate, "index.html")) || existsSync(join(candidate, "index2.html"))) {
      return candidate;
    }
  }
  throw new Error(`Could not find Angular browser output under ${relativePath(distRoot)}.`);
}

function createManifest(dir) {
  const indexFile = existsSync(join(dir, "index.html")) ? join(dir, "index.html") : join(dir, "index2.html");
  const html = readFileSync(indexFile, "utf8");
  const scripts = [];
  const styles = [];

  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/gi)) {
    pushUnique(scripts, cleanAssetPath(match[1]));
  }

  for (const match of html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+\.css)["'][^>]*>/gi)) {
    pushUnique(styles, cleanAssetPath(match[1]));
  }

  if (scripts.length === 0) {
    throw new Error("Angular index did not contain any script tags.");
  }

  const moduleImports = resolveModuleImports(scripts);
  const moduleEntry = "asf-ringconf-entry.js";
  writeModuleEntry(dir, moduleEntry, moduleImports);

  assertFilesExist(dir, [...moduleImports, moduleEntry]);
  assertFilesExist(dir, styles);
  assertNoForbiddenBuildFiles(dir);

  return {
    schemaVersion: 2,
    pluginVersion: version,
    generatedAt: new Date().toISOString(),
    moduleEntry,
    moduleImports,
    styles,
  };
}

function resolveModuleImports(scripts) {
  const polyfills = scripts.filter((script) => basename(script).startsWith("polyfills-") || basename(script).startsWith("polyfills."));
  const main = scripts.filter((script) => basename(script).startsWith("main-") || basename(script).startsWith("main."));

  if (polyfills.length !== 1) {
    throw new Error(`Expected exactly one Angular polyfills bundle, found ${polyfills.length}: ${polyfills.join(", ") || "(none)"}`);
  }
  if (main.length !== 1) {
    throw new Error(`Expected exactly one Angular main bundle, found ${main.length}: ${main.join(", ") || "(none)"}`);
  }

  return [polyfills[0], main[0]];
}

function writeModuleEntry(dir, moduleEntry, imports) {
  const lines = imports.map((asset) => {
    const importPath = cleanAssetPath(asset);
    if (importPath.includes("\\") || importPath.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(importPath) || importPath.includes("../")) {
      throw new Error(`Unsafe module import path: ${asset}`);
    }
    return `import './${importPath}';`;
  });

  writeFileSync(join(dir, moduleEntry), `${lines.join("\n")}\n`, "utf8");
}

function cleanAssetPath(value) {
  return value.replace(/^\.\//, "").replace(/^\/+/, "");
}

function pushUnique(list, value) {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function assertFilesExist(dir, files) {
  for (const file of files) {
    if (!existsSync(join(dir, file))) {
      throw new Error(`Manifest asset is missing from build output: ${file}`);
    }
  }
}

function assertNoForbiddenBuildFiles(dir) {
  const forbiddenNames = new Set([
    "api.php",
    "config.php",
    "database.php",
    "index.php",
    "appdata-admin.php",
    "user-verification.php",
  ]);

  for (const file of walkFiles(dir)) {
    const name = basename(file).toLowerCase();
    if (forbiddenNames.has(name) || extname(file).toLowerCase() === ".php") {
      throw new Error(`WooCommerce build contains PHP file: ${relativePath(file)}`);
    }
    if (extname(file).toLowerCase() === ".map") {
      throw new Error(`WooCommerce build contains source map: ${relativePath(file)}`);
    }
  }
}

function copyPluginSource(source, target) {
  const ignored = new Set([".DS_Store"]);
  for (const entry of readdirSync(source)) {
    if (ignored.has(entry)) {
      continue;
    }

    const sourcePath = join(source, entry);
    const targetPath = join(target, entry);
    if (entry === "dist") {
      cpSync(sourcePath, targetPath, {recursive: true});
      continue;
    }

    if (statSync(sourcePath).isDirectory()) {
      cpSync(sourcePath, targetPath, {recursive: true});
    } else {
      mkdirSync(dirname(targetPath), {recursive: true});
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function createZip(sourceDir, targetZip) {
  mkdirSync(dirname(targetZip), {recursive: true});
  const entries = collectZipEntries(sourceDir, basename(sourceDir));
  writeFileSync(targetZip, buildZip(entries));
}

function collectZipEntries(sourceDir, archiveRoot) {
  const entries = [{
    name: `${archiveRoot}/`,
    data: Buffer.alloc(0),
    isDirectory: true,
  }];

  for (const entryPath of walkPaths(sourceDir).sort((a, b) => a.localeCompare(b))) {
    const stat = statSync(entryPath);
    const relativeEntry = relative(sourceDir, entryPath).replace(/\\/g, "/");
    const archiveName = normalizeZipEntryName(`${archiveRoot}/${relativeEntry}${stat.isDirectory() ? "/" : ""}`);
    entries.push({
      name: archiveName,
      data: stat.isDirectory() ? Buffer.alloc(0) : readFileSync(entryPath),
      isDirectory: stat.isDirectory(),
    });
  }

  return entries;
}

function normalizeZipEntryName(name) {
  const normalized = name.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || normalized.includes("../")) {
    throw new Error(`Unsafe ZIP entry name: ${name}`);
  }
  return normalized;
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    if (entry.name.includes("\\")) {
      throw new Error(`ZIP entry contains a Windows path separator: ${entry.name}`);
    }

    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    const externalAttributes = entry.isDirectory ? 0x10 : 0;

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(externalAttributes, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function crc32(buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function walkPaths(dir) {
  const entries = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    entries.push(fullPath);
    if (statSync(fullPath).isDirectory()) {
      entries.push(...walkPaths(fullPath));
    }
  }
  return entries;
}

function relativePath(path) {
  return relative(root, resolve(path)).replace(/\\/g, "/");
}

function getCrcTable() {
  if (crcTable) {
    return crcTable;
  }

  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return crcTable;
}
