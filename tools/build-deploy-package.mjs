import {copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {execFileSync} from "node:child_process";

const root = process.cwd();
const packageJson = readJson("package.json");
const angularJson = readJson("angular.json");
const deployConfig = readOptionalJson(".deployrc.json") || readOptionalJson(".deployrc.local.json") || {};

const version = packageJson.version;
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
const shortSha = git(["rev-parse", "--short", "HEAD"]);
const buildTime = new Date().toISOString();
const channel = process.env.RINGCONF_CHANNEL || deployConfig.channel || "staging";
const appDataContract = process.env.RINGCONF_APPDATA_CONTRACT || deployConfig.release?.appDataContract || "2.6";
const priceContract = process.env.RINGCONF_PRICE_CONTRACT || deployConfig.release?.priceContract || "1.0";
const buildNumber = Number(process.env.RINGCONF_BUILD_NUMBER || process.env.BUILD_NUMBER || nextBuildNumber(version));
const releaseId = sanitizeReleaseId(applyTemplate(deployConfig.release?.nameTemplate || "{version}-build.{buildNumber}", {
  version,
  buildNumber,
  branch,
  shortSha,
}));
const publicBaseUrl = (process.env.RINGCONF_PUBLIC_BASE_URL || deployConfig.publicBaseUrl || "https://toolbox.asf.gmbh/3d-konfigurator/builds").replace(/\/$/, "");
const publicUrl = `${publicBaseUrl}/releases/${releaseId}/`;
const deployRoot = join(root, ".deploy");
const deployDir = join(deployRoot, releaseId);
const distDir = findAngularOutputDir();

rmSync(deployDir, {recursive: true, force: true});
mkdirSync(deployDir, {recursive: true});
cpSync(distDir, deployDir, {recursive: true});
ensureServerIndex(deployDir);
ensureRelativeBaseHref(deployDir);
ensureRelativeAssetUrls(deployDir);

const copiedPhpFiles = copyPhpRuntimeFiles(deployDir);
const release = {
  id: releaseId,
  version,
  buildNumber,
  releaseId,
  branch,
  shortSha,
  buildTime,
  createdAt: buildTime,
  channel,
  url: publicUrl,
  status: deployConfig.release?.status || "testing",
  compatible: deployConfig.release?.compatible ?? null,
  appDataContract,
  priceContract,
  deploymentType: "standalone-php",
  woocommerceBound: false,
  sourceDist: relativePath(distDir),
  copiedPhpFiles,
};

writeFileSync(join(deployDir, "release.json"), JSON.stringify(release, null, 2) + "\n", "utf8");
writeFileSync(join(deployRoot, "latest.json"), JSON.stringify({
  id: releaseId,
  path: relativePath(deployDir),
  release: relativePath(join(deployDir, "release.json")),
}, null, 2) + "\n", "utf8");
writeFileSync(join(deployRoot, "release-index.json"), JSON.stringify(upsertRelease(readLocalReleaseIndex(), release), null, 2) + "\n", "utf8");

console.log(`Created release package: ${relativePath(deployDir)}`);
console.log(`Release ID: ${releaseId}`);
console.log(`Release metadata: ${relativePath(join(deployDir, "release.json"))}`);

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function readOptionalJson(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    return null;
  }
  return JSON.parse(readFileSync(fullPath, "utf8"));
}

function git(args) {
  return execFileSync("git", args, {cwd: root, encoding: "utf8"}).trim();
}

function nextBuildNumber(versionValue) {
  const index = readLocalReleaseIndex();
  const max = (index.releases || [])
    .filter(release => release.version === versionValue)
    .map(release => Number(release.buildNumber) || 0)
    .reduce((highest, value) => Math.max(highest, value), 0);
  return max + 1;
}

function readLocalReleaseIndex() {
  return readOptionalJson(join(".deploy", "release-index.json")) || {current: null, releases: []};
}

function upsertRelease(index, release) {
  const releases = (index.releases || []).filter(item => item.id !== release.id);
  releases.unshift(toIndexEntry(release));
  releases.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    current: release.id,
    releases,
  };
}

function toIndexEntry(release) {
  return {
    id: release.id,
    version: release.version,
    buildNumber: release.buildNumber,
    branch: release.branch,
    shortSha: release.shortSha,
    createdAt: release.createdAt,
    url: release.url,
    status: release.status,
    compatible: release.compatible,
    appDataContract: release.appDataContract,
    priceContract: release.priceContract,
  };
}

function applyTemplate(template, values) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)}/g, (_match, key) => String(values[key] ?? ""));
}

function sanitizeReleaseId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "release";
}

function findAngularOutputDir() {
  const project = angularJson.projects?.["Ringconf-v2.1"] || Object.values(angularJson.projects || {})[0];
  const outputPath = project?.architect?.build?.options?.outputPath;
  const base = typeof outputPath === "string" ? outputPath : outputPath?.base;
  if (!base) {
    throw new Error("Could not determine Angular outputPath from angular.json.");
  }

  const basePath = resolve(root, base);
  for (const candidate of [join(basePath, "browser"), basePath]) {
    if (existsSync(join(candidate, "index.html")) || existsSync(join(candidate, "index2.html"))) {
      return candidate;
    }
  }
  throw new Error(`Could not find built Angular index.html/index2.html under ${relativePath(basePath)}.`);
}

function ensureServerIndex(targetDir) {
  const indexPath = join(targetDir, "index.html");
  const index2Path = join(targetDir, "index2.html");
  if (!existsSync(indexPath) && existsSync(index2Path)) {
    copyFileSync(index2Path, indexPath);
  }
}

function ensureRelativeBaseHref(targetDir) {
  for (const file of ["index.html", "index2.html"]) {
    const indexPath = join(targetDir, file);
    if (!existsSync(indexPath)) {
      continue;
    }
    const html = readFileSync(indexPath, "utf8");
    const patched = html.replace(/<base\s+href=["'][^"']*["']\s*>/i, '<base href="./">');
    writeFileSync(indexPath, patched, "utf8");
  }
}

function ensureRelativeAssetUrls(targetDir) {
  for (const file of walkFiles(targetDir)) {
    if (!/\.(html|js|css)$/.test(file)) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    const patched = content
      .replace(/url\(\s*\/assets\//g, "url(assets/")
      .replace(/url\(\s*"\/assets\//g, 'url("assets/')
      .replace(/url\(\s*'\/assets\//g, "url('assets/");
    if (patched !== content) {
      writeFileSync(file, patched, "utf8");
    }
  }
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

function copyPhpRuntimeFiles(targetDir) {
  const files = [
    "api.php",
    "appdata-admin.php",
    "config.php",
    "database.php",
    "browsers.json",
    "index.php",
  ];
  const copied = [];
  for (const file of files) {
    const source = join(root, "src", "php", file);
    if (!existsSync(source)) {
      continue;
    }
    copyFileSync(source, join(targetDir, file));
    copied.push(`src/php/${file}`);
  }
  return copied;
}

function relativePath(path) {
  return String(path).replace(root, "").replace(/^[/\\]/, "").replace(/\\/g, "/");
}
