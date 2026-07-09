import SftpClient from "ssh2-sftp-client";
import {existsSync, mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {readFile} from "node:fs/promises";
import {join, posix, resolve} from "node:path";
import {tmpdir} from "node:os";

const CHANNELS = new Set(["releases", "development"]);

const root = process.cwd();
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const channel = validateChannel(readArgValue("--channel") || process.env.RINGCONF_CHANNEL || "releases");
const packageArg = readArgValue("--package");
const deployPackage = resolveDeployPackage(packageArg, channel);
const release = JSON.parse(readFileSync(join(deployPackage, "release.json"), "utf8"));
const releaseChannel = validateChannel(release.channel || channel);
if (releaseChannel !== channel) {
  fail(`Deploy package channel "${releaseChannel}" does not match requested channel "${channel}".`);
}

const configResult = loadConfig();
const config = configResult.config;
const remoteBaseDir = normalizeRemotePath(config.remote?.baseDir || "/3d-konfigurator/builds");
const remoteChannelDir = joinRemote(remoteBaseDir, channel);
const remoteReleaseDir = joinRemote(remoteChannelDir, release.id);
const remoteIndexesDir = joinRemote(remoteBaseDir, config.remote?.indexesDir || "indexes");
const remoteIndexPath = joinRemote(remoteIndexesDir, `${channel}.json`);
const remoteCurrentPath = joinRemote(remoteChannelDir, "current.json");
const updateCurrent = config.remote?.updateCurrent ?? config.release?.setCurrentOnDeploy ?? true;

if (dryRun) {
  console.log("SFTP deploy dry run");
  if (configResult.usedFallback) {
    console.log("No .deployrc.json/.deployrc.local.json found; using non-secret default target for dry-run only.");
  }
  printPlan();
  process.exit(0);
}

if (configResult.usedFallback) {
  fail("Missing .deployrc.json or .deployrc.local.json. Copy .deployrc.example.json, fill local SFTP credentials, and keep it uncommitted.");
}

validateConfig(config);
printPlan();

const client = new SftpClient();
try {
  await client.connect(await connectionOptions(config));
  await client.mkdir(remoteChannelDir, true);
  await client.mkdir(remoteReleaseDir, true);
  await client.uploadDir(deployPackage, remoteReleaseDir);

  await client.mkdir(remoteIndexesDir, true);
  const mergedIndex = await buildRemoteReleaseIndex(client);
  const tempDir = mkdtempSync(join(tmpdir(), "ringconf-release-index-"));
  const tempIndex = join(tempDir, `${channel}.json`);
  writeFileSync(tempIndex, JSON.stringify(mergedIndex, null, 2) + "\n", "utf8");
  await client.put(tempIndex, remoteIndexPath);

  if (updateCurrent) {
    const tempCurrent = join(tempDir, "current.json");
    writeFileSync(tempCurrent, JSON.stringify(toCurrentEntry(release), null, 2) + "\n", "utf8");
    await client.put(tempCurrent, remoteCurrentPath);
  }

  console.log(`Uploaded ${channel} package: ${remoteReleaseDir}`);
  console.log(`Updated ${channel} index: ${remoteIndexPath}`);
  if (updateCurrent) {
    console.log(`Updated ${channel} current pointer: ${remoteCurrentPath}`);
  }
} finally {
  await client.end();
}

function readArgValue(name) {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1] || null;
}

function validateChannel(value) {
  if (!CHANNELS.has(value)) {
    fail(`Unknown deployment channel "${value}". Allowed channels: releases, development.`);
  }
  return value;
}

function resolveDeployPackage(argPath, channelValue) {
  if (argPath) {
    const candidate = resolve(root, argPath);
    assertDeployPackage(candidate);
    return candidate;
  }

  const latestPath = join(root, ".deploy", `latest-${channelValue}.json`);
  if (!existsSync(latestPath)) {
    fail(`No .deploy/latest-${channelValue}.json found. Run npm run build:deploy:${channelValue === "releases" ? "release" : "development"} first.`);
  }

  const latest = JSON.parse(readFileSync(latestPath, "utf8"));
  const candidate = resolve(root, latest.path);
  assertDeployPackage(candidate);
  return candidate;
}

function assertDeployPackage(path) {
  if (!existsSync(path)) {
    fail(`Deploy package folder not found: ${path}`);
  }
  if (!existsSync(join(path, "release.json"))) {
    fail(`Deploy package has no release.json: ${path}`);
  }
}

function loadConfig() {
  const candidates = [".deployrc.json", ".deployrc.local.json"];
  for (const candidate of candidates) {
    const path = join(root, candidate);
    if (existsSync(path)) {
      return {
        usedFallback: false,
        config: JSON.parse(readFileSync(path, "utf8")),
      };
    }
  }

  return {
    usedFallback: true,
    config: {
      channel: "releases",
      sftp: {
        host: "",
        port: 22,
        username: "",
      },
      remote: {
        baseDir: "/3d-konfigurator/builds",
        publicBaseUrl: "https://toolbox.asf.gmbh/3d-konfigurator/builds",
        indexesDir: "indexes",
        updateCurrent: true,
      },
    },
  };
}

function validateConfig(value) {
  const missing = [];
  if (!value.sftp?.host) missing.push("sftp.host");
  if (!value.sftp?.username) missing.push("sftp.username");
  if (!value.sftp?.password && !value.sftp?.privateKeyPath) missing.push("sftp.password or sftp.privateKeyPath");
  if (!value.remote?.baseDir) missing.push("remote.baseDir");
  if (missing.length > 0) {
    fail(`Deployment config is missing required field(s): ${missing.join(", ")}`);
  }
}

async function connectionOptions(value) {
  const options = {
    host: value.sftp.host,
    port: Number(value.sftp.port || 22),
    username: value.sftp.username,
    password: value.sftp.password || undefined,
    passphrase: value.sftp.passphrase || undefined,
  };

  if (value.sftp.privateKeyPath) {
    options.privateKey = await readFile(resolve(root, value.sftp.privateKeyPath), "utf8");
  }

  return options;
}

async function buildRemoteReleaseIndex(client) {
  const remoteIndex = await readRemoteReleaseIndex(client);
  return upsertRelease(remoteIndex, release, updateCurrent);
}

async function readRemoteReleaseIndex(client) {
  const exists = await client.exists(remoteIndexPath);
  if (!exists) {
    return {current: null, channel, releases: []};
  }

  const tempDir = mkdtempSync(join(tmpdir(), "ringconf-remote-index-"));
  const tempIndex = join(tempDir, `${channel}.json`);
  await client.get(remoteIndexPath, tempIndex);
  return JSON.parse(readFileSync(tempIndex, "utf8"));
}

function upsertRelease(index, releaseValue, setCurrent) {
  const entry = toIndexEntry(releaseValue);
  const releases = (index.releases || []).filter(item => item.id !== entry.id);
  releases.unshift(entry);
  releases.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    current: setCurrent ? entry.id : (index.current || entry.id),
    channel,
    releases,
  };
}

function toIndexEntry(releaseValue) {
  return {
    id: releaseValue.id,
    version: releaseValue.version,
    buildNumber: releaseValue.buildNumber,
    channel: releaseValue.channel,
    branch: releaseValue.branch,
    shortSha: releaseValue.shortSha,
    createdAt: releaseValue.createdAt || releaseValue.buildTime,
    url: releaseValue.publicUrl || releaseValue.url,
    publicUrl: releaseValue.publicUrl || releaseValue.url,
    status: releaseValue.status,
    baseHref: releaseValue.baseHref || "./",
    compatible: releaseValue.compatible,
    appDataContract: releaseValue.appDataContract,
    priceContract: releaseValue.priceContract,
  };
}

function toCurrentEntry(releaseValue) {
  return {
    id: releaseValue.id,
    channel: releaseValue.channel,
    url: releaseValue.publicUrl || releaseValue.url,
    release: `${releaseValue.publicUrl || releaseValue.url}release.json`,
    updatedAt: new Date().toISOString(),
  };
}

function printPlan() {
  console.log(`Channel: ${channel}`);
  console.log(`Local release package: ${relativePath(deployPackage)}`);
  console.log(`Release ID: ${release.id}`);
  console.log(`Remote release dir: ${remoteReleaseDir}`);
  console.log(`Remote release index: ${remoteIndexPath}`);
  console.log(`Remote current pointer: ${updateCurrent ? remoteCurrentPath : "(disabled)"}`);
  console.log(`Public URL: ${release.publicUrl || release.url}`);
  console.log(`SFTP host: ${config.sftp?.host || "(not configured)"}`);
  console.log(`SFTP user: ${config.sftp?.username || "(not configured)"}`);
  console.log("SFTP password/private key: (not printed)");
}

function normalizeRemotePath(value) {
  return `/${String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")}`;
}

function joinRemote(...parts) {
  return posix.join(...parts.map(part => String(part).replace(/\\/g, "/")));
}

function relativePath(path) {
  return String(path).replace(root, "").replace(/^[/\\]/, "").replace(/\\/g, "/");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
