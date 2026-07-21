import {createHash} from "node:crypto";
import {readFileSync, writeFileSync} from "node:fs";

export const REFERENCE_SHA256 = "a7f7513004b18323e5b5ca394b6bb2227b0b38147898c9a95a27a5cf390eb415";

export const SIGNATURES = {
  camera: /camera:\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/g,
  cameraMinOrthoSize: /cameraMinOrthoSize:(-?\d+(?:\.\d+)?)/g,
  ringRotationY: /ringRotationY:\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/g,
  ringOffsetZ: /ringOffsetZ:\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/g,
  maxFps: /maxFps:(\d+)/g,
  introFactor: /let ([a-zA-Z_$][\w$]*)=0\.05;/g,
  introEpsilon: /Math\.abs\(([^)]*)\)<=0\.001/g,
};

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function readBundle(path) {
  return readFileSync(path, "utf8");
}

export function inspectBundle(content, allowedHashes = [REFERENCE_SHA256]) {
  const hash = sha256(content);
  const acceptedHash = allowedHashes.includes(hash);
  const counts = {};
  for (const [key, signature] of Object.entries(SIGNATURES)) {
    counts[key] = countMatches(content, signature);
  }
  const forbiddenPreset2 = content.includes("preset_2") || content.includes("preset_3");
  return {hash, acceptedHash, counts, forbiddenPreset2};
}

export function assertInspectable(content, allowedHashes = [REFERENCE_SHA256]) {
  const result = inspectBundle(content, allowedHashes);
  if (!result.acceptedHash) {
    throw new Error(`Unexpected bundle hash ${result.hash}. Expected ${allowedHashes.join(", ")}.`);
  }
  for (const [key, count] of Object.entries(result.counts)) {
    if (count !== 1) {
      throw new Error(`Signature ${key} expected exactly once, found ${count}.`);
    }
  }
  if (result.forbiddenPreset2) {
    throw new Error("Legacy bundle already contains preset_2/preset_3 markers; preset structure patching is forbidden.");
  }
  return result;
}

export function patchBundle(content, calibration, composition, allowedHashes = [REFERENCE_SHA256]) {
  const before = assertInspectable(content, allowedHashes);
  const values = extractLegacyValues(calibration, composition);
  let patched = replaceExactly(content, SIGNATURES.camera, `camera:[${fmt(values.camera[0])},${fmt(values.camera[1])},${fmt(values.camera[2])}]`);
  patched = replaceExactly(patched, SIGNATURES.cameraMinOrthoSize, `cameraMinOrthoSize:${fmt(values.cameraMinOrthoSize)}`);
  patched = replaceExactly(patched, SIGNATURES.ringRotationY, `ringRotationY:[${fmt(values.ringRotationY[0])},${fmt(values.ringRotationY[1])}]`);
  patched = replaceExactly(patched, SIGNATURES.ringOffsetZ, `ringOffsetZ:[${fmt(values.ringOffsetZ[0])},${fmt(values.ringOffsetZ[1])}]`);
  patched = replaceExactly(patched, SIGNATURES.maxFps, `maxFps:${Math.round(values.maxFps)}`);
  patched = replaceExactly(patched, SIGNATURES.introFactor, (_match, name) => `let ${name}=${fmt(values.legacyFactor)};`);
  patched = replaceExactly(patched, SIGNATURES.introEpsilon, (_match, expression) => `Math.abs(${expression})<=${fmt(values.legacyEpsilon)}`);
  const after = inspectBundle(patched, [sha256(patched)]);
  return {
    content: patched,
    report: {
      inputSha256: before.hash,
      outputSha256: after.hash,
      composition,
      patched: values,
    },
  };
}

export function writePatchedBundle(path, content) {
  writeFileSync(path, content, {encoding: "utf8", flag: "wx"});
}

export function extractLegacyValues(calibration, composition) {
  const profile = calibration?.compositions?.[composition];
  if (!profile) {
    throw new Error(`Calibration composition ${composition} was not found.`);
  }
  const end = profile.startup?.end;
  if (!end) {
    throw new Error("Calibration startup.end camera pose is missing.");
  }
  const ring0 = profile.rings?.ring0;
  const ring1 = profile.rings?.ring1;
  return {
    camera: [
      finite(end.alpha, "camera.alpha"),
      finite(end.beta, "camera.beta"),
      finite(end.projection?.radius ?? 30, "camera.radius"),
    ],
    cameraMinOrthoSize: finite(end.projection?.orthoHeight ?? 20, "cameraMinOrthoSize"),
    ringRotationY: [
      ring0 ? quaternionYawDegrees(ring0.rotationQuaternion) : 42,
      ring1 ? quaternionYawDegrees(ring1.rotationQuaternion) : 0,
    ],
    ringOffsetZ: [
      ring0 ? finite(ring0.position?.[2], "ring0.position.z") : -2.5,
      ring1 ? finite(ring1.position?.[2], "ring1.position.z") : 0,
    ],
    maxFps: finite(profile.startup?.legacy?.maxFps ?? 40, "maxFps"),
    legacyFactor: finite(profile.startup?.legacy?.factor ?? 0.05, "legacyFactor"),
    legacyEpsilon: finite(profile.startup?.legacy?.epsilon ?? 0.001, "legacyEpsilon"),
  };
}

function countMatches(content, signature) {
  signature.lastIndex = 0;
  return [...content.matchAll(signature)].length;
}

function replaceExactly(content, signature, replacement) {
  signature.lastIndex = 0;
  const matches = [...content.matchAll(signature)];
  if (matches.length !== 1) {
    throw new Error(`Patch signature expected exactly once, found ${matches.length}.`);
  }
  return content.replace(signature, replacement);
}

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return number;
}

function fmt(value) {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot format non-finite value.");
  }
  return Number(value.toFixed(12)).toString();
}

function quaternionYawDegrees(value) {
  if (!Array.isArray(value) || value.length !== 4) return 0;
  const [x, y, z, w] = value.map(Number);
  const siny = 2 * (w * y + z * x);
  const cosy = 1 - 2 * (y * y + x * x);
  return Math.atan2(siny, cosy) * 180 / Math.PI;
}
