import {copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {basename, join, resolve} from "node:path";
import {execFileSync} from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const angularJson = JSON.parse(readFileSync(join(root, "angular.json"), "utf8"));

const appName = packageJson.name || "ringconf";
const packageVersion = packageJson.version || "0.0.0";
const gitBranch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
const gitSha = git(["rev-parse", "--short", "HEAD"]);
const buildDate = new Date();
const buildTimestamp = buildDate.toISOString();
const folderTimestamp = buildTimestamp.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
const safeBranch = sanitizeSegment(gitBranch);
const deployName = `ringconf-${packageVersion}-${safeBranch}-${gitSha}-${folderTimestamp}`;
const deployRoot = join(root, ".deploy");
const deployDir = join(deployRoot, deployName);
const distDir = findAngularOutputDir();

rmSync(deployDir, {recursive: true, force: true});
mkdirSync(deployDir, {recursive: true});
cpSync(distDir, deployDir, {recursive: true});
ensureServerIndex(deployDir);

const copiedPhpFiles = copyPhpFiles(deployDir);
const manifest = {
  app: appName,
  package_version: packageVersion,
  git_branch: gitBranch,
  git_sha: gitSha,
  build_timestamp: buildTimestamp,
  build_mode: "production",
  deployment_type: "standalone-php",
  woocommerce_bound: false,
  compatible: null,
  appdata_min_version: null,
  appdata_max_version: null,
  notes: "",
  source_dist: relativePath(distDir),
  copied_php_files: copiedPhpFiles,
};

writeFileSync(join(deployDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
writeFileSync(join(deployRoot, "latest.json"), JSON.stringify({
  path: relativePath(deployDir),
  name: deployName,
  manifest: relativePath(join(deployDir, "manifest.json")),
}, null, 2) + "\n", "utf8");

console.log(`Created deploy package: ${relativePath(deployDir)}`);
console.log(`Manifest: ${relativePath(join(deployDir, "manifest.json"))}`);

function git(args) {
  return execFileSync("git", args, {cwd: root, encoding: "utf8"}).trim();
}

function sanitizeSegment(value) {
  return String(value || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function findAngularOutputDir() {
  const project = angularJson.projects?.["Ringconf-v2.1"] || Object.values(angularJson.projects || {})[0];
  const outputPath = project?.architect?.build?.options?.outputPath;
  const base = typeof outputPath === "string" ? outputPath : outputPath?.base;
  if (!base) {
    throw new Error("Could not determine Angular outputPath from angular.json.");
  }

  const basePath = resolve(root, base);
  const candidates = [
    join(basePath, "browser"),
    basePath,
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html")) || existsSync(join(candidate, "index2.html"))) {
      return candidate;
    }
  }

  throw new Error(`Could not find built Angular index.html under ${relativePath(basePath)}. Run npm run build:production first.`);
}

function ensureServerIndex(targetDir) {
  const indexPath = join(targetDir, "index.html");
  const index2Path = join(targetDir, "index2.html");
  if (!existsSync(indexPath) && existsSync(index2Path)) {
    copyFileSync(index2Path, indexPath);
  }
}

function copyPhpFiles(targetDir) {
  const phpFiles = [
    "api.php",
    "appdata-admin.php",
    "config.php",
    "database.php",
    "browsers.json",
    "index.php",
  ];
  const sourceDir = join(root, "src", "php");
  const copied = [];

  for (const file of phpFiles) {
    const source = join(sourceDir, file);
    if (!existsSync(source)) {
      continue;
    }
    cpSync(source, join(targetDir, file));
    copied.push(`src/php/${file}`);
  }

  return copied;
}

function relativePath(path) {
  return path.replace(root, "").replace(/^[/\\]/, "").replace(/\\/g, "/");
}
