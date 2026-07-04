import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative} from "node:path";

const roots = [
  "dist/ringconf-v2.1",
  "_shop/woocommerce/OneRingconf/dist",
];

const forbiddenText = [
  "AppData und WebGL-Settings",
  "Mitarbeiter-PIN",
  "Für Produktion freigeben",
  "OBJ-Validator",
  "user-verification.php",
];

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".php",
  ".txt",
]);

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index).toLowerCase();
}

function* walk(path) {
  for (const entry of readdirSync(path)) {
    const fullPath = join(path, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

const violations = [];

for (const root of roots) {
  if (!existsSync(root)) {
    violations.push(`${root}: output folder is missing`);
    continue;
  }

  for (const file of walk(root)) {
    const fileName = file.replace(/\\/g, "/");
    if (fileName.endsWith("/appdata-admin.php")) {
      violations.push(`${relative(process.cwd(), file)}: development-only endpoint copied to output`);
      continue;
    }

    if (!textExtensions.has(extensionOf(file))) {
      continue;
    }

    const content = readFileSync(file, "utf8");
    for (const marker of forbiddenText) {
      if (content.includes(marker)) {
        violations.push(`${relative(process.cwd(), file)}: contains "${marker}"`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Admin exclusion check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Admin exclusion check passed.");
