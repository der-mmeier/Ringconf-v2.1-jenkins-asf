import {existsSync, readFileSync, statSync, writeFileSync} from "node:fs";
import {join, posix, resolve} from "node:path";
import {tmpdir} from "node:os";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const packageArg = readArgValue("--package");
const deployPackage = resolveDeployPackage(packageArg);
const deployName = posix.basename(deployPackage.replace(/\\/g, "/"));
const manifestPath = join(deployPackage, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const configResult = loadConfig();
const config = configResult.config;
const remoteBasePath = normalizeRemotePath(config.remoteBasePath || "/configurator/builds");
const remoteTargetPath = posix.join(remoteBasePath, deployName);
const publicUrl = config.publicBaseUrl ? `${config.publicBaseUrl.replace(/\/$/, "")}/${deployName}/` : null;

if (dryRun) {
  console.log("Deploy dry run");
  if (configResult.usedFallback) {
    console.log("No .deployrc.local.json found; using non-secret default target for dry-run only.");
  }
  printPlan();
  process.exit(0);
}

if (configResult.usedFallback) {
  fail("Missing .deployrc.local.json. Copy .deployrc.example.json, fill local credentials, and keep it uncommitted.");
}

validateConfig(config);
printPlan();

if ((config.protocol || "ftp").toLowerCase() === "sftp") {
  fail("SFTP is not implemented by this script yet. Use FTP/FTPS config or extend tools/deploy-ftp.mjs with an SFTP client.");
}

await uploadFtp();

async function uploadFtp() {
  let ftp;
  try {
    ftp = await import("basic-ftp");
  } catch {
    fail("Missing dev dependency basic-ftp. Run npm install before deploying.");
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await client.access({
      host: config.host,
      port: Number(config.port || ((config.protocol || "ftp").toLowerCase() === "ftps" ? 21 : 21)),
      user: config.user,
      password: config.password,
      secure: config.secure ?? (config.protocol || "ftp").toLowerCase() === "ftps",
    });
    await client.ensureDir(remoteTargetPath);
    await client.clearWorkingDir();
    await client.uploadFromDir(deployPackage);

    if (config.updateCurrent !== false) {
      const currentPath = posix.join(posix.dirname(remoteBasePath), "current.json");
      const currentLocalPath = join(tmpdir(), `ringconf-current-${Date.now()}.json`);
      writeFileSync(currentLocalPath, JSON.stringify({
        ...manifest,
        deploy_name: deployName,
        remote_path: remoteTargetPath,
        public_url: publicUrl,
      }, null, 2) + "\n", "utf8");
      await client.uploadFrom(currentLocalPath, currentPath);
      console.log(`Updated ${currentPath}`);
    }

    console.log("Deployment complete.");
  } finally {
    client.close();
  }
}

function resolveDeployPackage(argPath) {
  if (argPath) {
    const candidate = resolve(root, argPath);
    assertDeployPackage(candidate);
    return candidate;
  }

  const latestPath = join(root, ".deploy", "latest.json");
  if (!existsSync(latestPath)) {
    fail("No .deploy/latest.json found. Run npm run build:deploy first.");
  }

  const latest = JSON.parse(readFileSync(latestPath, "utf8"));
  const candidate = resolve(root, latest.path);
  assertDeployPackage(candidate);
  return candidate;
}

function assertDeployPackage(path) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    fail(`Deploy package folder not found: ${path}`);
  }
  if (!existsSync(join(path, "manifest.json"))) {
    fail(`Deploy package has no manifest.json: ${path}`);
  }
}

function loadConfig() {
  const localPath = join(root, ".deployrc.local.json");
  if (existsSync(localPath)) {
    return {
      usedFallback: false,
      config: JSON.parse(readFileSync(localPath, "utf8")),
    };
  }

  return {
    usedFallback: true,
    config: {
      protocol: "ftp",
      remoteBasePath: "/configurator/builds",
      publicBaseUrl: "https://example.com/configurator/builds",
      updateCurrent: true,
    },
  };
}

function validateConfig(value) {
  const missing = [];
  for (const field of ["host", "user", "password", "remoteBasePath"]) {
    if (!value[field]) {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    fail(`Deployment config is missing required field(s): ${missing.join(", ")}`);
  }
}

function normalizeRemotePath(value) {
  return `/${String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")}`;
}

function printPlan() {
  console.log(`Local package: ${relative(deployPackage)}`);
  console.log(`Remote target: ${remoteTargetPath}`);
  if (publicUrl) {
    console.log(`Public URL: ${publicUrl}`);
  }
  console.log(`Protocol: ${(config.protocol || "ftp").toLowerCase()}`);
  console.log(`Host: ${config.host || "(not configured)"}`);
  console.log(`User: ${config.user || "(not configured)"}`);
  console.log("Password: (not printed)");
}

function readArgValue(name) {
  const argv = process.argv.slice(2);
  const index = argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  return argv[index + 1] || null;
}

function relative(path) {
  return path.replace(root, "").replace(/^[/\\]/, "").replace(/\\/g, "/");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
