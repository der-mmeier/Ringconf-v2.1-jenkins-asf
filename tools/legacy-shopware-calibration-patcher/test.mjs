import assert from "node:assert/strict";
import {inspectBundle, patchBundle, sha256} from "./lib.mjs";

const sample = [
  "webglSettings:{maxTextureSize:2048,ringRotationX:27,ringRotationY:[42,0],ringOffsetZ:[-2.5,0],camera:[-1.8830285392434571,1.1869035161232264,30],cameraMinOrthoSize:20,forceFrames:15,maxFps:40}",
  "let factor=0.05;",
  "Math.abs(camera.alpha-targetAlpha)<=0.001",
].join("");
const sampleHash = sha256(sample);

const inspected = inspectBundle(sample, [sampleHash]);
assert.equal(inspected.acceptedHash, true);
assert.equal(inspected.counts.camera, 1);
assert.equal(inspected.forbiddenPreset2, false);

assert.throws(() => patchBundle(sample, calibration(), "missing", [sampleHash]), /was not found/);
assert.throws(() => patchBundle(sample + sample, calibration(), "wedding-pair", [sha256(sample + sample)]), /expected exactly once/);

const result = patchBundle(sample, calibration(), "wedding-pair", [sampleHash]);
assert.equal(result.report.inputSha256, sampleHash);
assert.notEqual(result.report.outputSha256, sampleHash);
assert.match(result.content, /camera:\[-1,1\.1,44\]/);
assert.match(result.content, /cameraMinOrthoSize:22/);
assert.match(result.content, /ringOffsetZ:\[-3,1\]/);
assert.doesNotMatch(result.content, /preset_2|preset_3/);

console.log("Legacy Shopware calibration patcher tests passed.");

function calibration() {
  return {
    schemaVersion: 2,
    compositions: {
      "wedding-pair": {
        rings: {
          ring0: {position: [0, 0, -3], rotationQuaternion: [0, 0, 0, 1]},
          ring1: {position: [0, 0, 1], rotationQuaternion: [0, 0, 0, 1]},
        },
        startup: {
          end: {
            alpha: -1,
            beta: 1.1,
            target: [0, 10, 0],
            projection: {mode: "orthographic", orthoHeight: 22, radius: 44},
          },
        },
        views: {},
      },
    },
  };
}
