import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative} from "node:path";

const target = readArgValue("--target") || process.env.RINGCONF_ADMIN_EXCLUSION_TARGET || "all";
const roots = [
  {target: "standalone", path: "dist/ringconf-v2.1"},
  {target: "woocommerce", path: "_shop/woocommerce/OneRingconf/dist"},
];
const allowedTargets = new Set(["all", "standalone", "woocommerce"]);

if (!allowedTargets.has(target)) {
  console.error(`Unknown admin exclusion target "${target}". Use all, standalone or woocommerce.`);
  process.exit(1);
}

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

for (const rootConfig of roots.filter(root => target === "all" || root.target === target)) {
  if (!existsSync(rootConfig.path)) {
    violations.push(`${rootConfig.path}: output folder is missing`);
    continue;
  }

  for (const file of walk(rootConfig.path)) {
    const fileName = file.replace(/\\/g, "/");
    const baseName = fileName.split("/").pop().toLowerCase();
    if (rootConfig.target === "woocommerce" && (forbiddenWooCommerceFiles.has(baseName) || extensionOf(file) === ".php")) {
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

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}
