import {mkdtempSync, rmSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import process from "node:process";

const sourceZip = process.argv[2];
if (!sourceZip) {
  fail("Usage: node tools/test-wordpress-package-validator.mjs <valid-zip>");
}

const validator = join(process.cwd(), "tools", "validate-wordpress-plugin-package.mjs");
const tempDir = mkdtempSync(join(tmpdir(), "asf-ringconf-zip-validator-"));

try {
  const original = readFileSync(sourceZip);

  const backslashZip = join(tempDir, "backslash.zip");
  writeFileSync(backslashZip, replaceAll(original, "asf-ringkonfigurator/includes/", "asf-ringkonfigurator\\includes/"));
  expectValidatorFailure(backslashZip, "Windows path separator");

  const missingMainZip = join(tempDir, "missing-main.zip");
  writeFileSync(missingMainZip, replaceAll(original, "asf-ringkonfigurator/asf-ringkonfigurator.php", "asf-ringkonfigurator/asf-ringkonfigurator.ph_"));
  expectValidatorFailure(missingMainZip, "missing required entry");

  console.log("WordPress package validator regression probes passed.");
} finally {
  rmSync(tempDir, {recursive: true, force: true});
}

function replaceAll(buffer, search, replacement) {
  if (search.length !== replacement.length) {
    throw new Error("Regression probe replacement must keep the ZIP byte length stable.");
  }

  const searchBytes = Buffer.from(search, "utf8");
  const replacementBytes = Buffer.from(replacement, "utf8");
  const copy = Buffer.from(buffer);
  let replacements = 0;
  let offset = copy.indexOf(searchBytes);
  while (offset !== -1) {
    replacementBytes.copy(copy, offset);
    replacements++;
    offset = copy.indexOf(searchBytes, offset + replacementBytes.length);
  }

  if (replacements === 0) {
    throw new Error(`Regression probe could not find ZIP entry fragment: ${search}`);
  }

  return copy;
}

function expectValidatorFailure(zip, expectedText) {
  try {
    execFileSync(process.execPath, [validator, zip], {encoding: "utf8", stdio: "pipe"});
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`;
    if (!output.includes(expectedText)) {
      throw new Error(`Validator failed for the wrong reason. Expected "${expectedText}", got:\n${output}`);
    }
    return;
  }

  throw new Error(`Validator unexpectedly accepted malformed ZIP: ${zip}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
