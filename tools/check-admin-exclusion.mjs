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

const forbiddenWooCommerceFiles = new Set([
  "api.php",
  "config.php",
  "database.php",
  "index.php",
  "appdata-admin.php",
  "user-verification.php",
]);

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
    const baseName = fileName.split("/").pop().toLowerCase();
    if (root === "_shop/woocommerce/OneRingconf/dist" && (forbiddenWooCommerceFiles.has(baseName) || extensionOf(file) === ".php")) {
      violations.push(`${relative(process.cwd(), file)}: PHP file copied to WooCommerce output`);
      continue;
    }

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
