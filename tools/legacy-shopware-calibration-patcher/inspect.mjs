import {readBundle, inspectBundle, assertInspectable} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.input) {
  fail("Usage: npm run calibration:legacy:inspect -- --input=/path/main.js");
}

try {
  const content = readBundle(args.input);
  const strict = args.strict !== "false";
  const result = strict ? assertInspectable(content) : inspectBundle(content);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  fail(error.message);
}

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value = "true"] = arg.slice(2).split("=");
    result[key] = value;
  }
  return result;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
