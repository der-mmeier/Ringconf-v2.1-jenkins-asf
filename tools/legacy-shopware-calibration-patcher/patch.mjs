import {readFileSync} from "node:fs";
import {patchBundle, readBundle, writePatchedBundle} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.calibration || !args.composition || !args.output) {
  fail("Usage: npm run calibration:legacy:patch -- --input=/path/main.js --calibration=ringconf-calibration-v2.json --composition=wedding-pair --output=/path/main.patched.js");
}

try {
  const content = readBundle(args.input);
  const calibration = JSON.parse(readFileSync(args.calibration, "utf8"));
  const result = patchBundle(content, calibration, args.composition);
  writePatchedBundle(args.output, result.content);
  console.log(JSON.stringify(result.report, null, 2));
} catch (error) {
  fail(error.message);
}

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value = ""] = arg.slice(2).split("=");
    result[key] = value;
  }
  return result;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
