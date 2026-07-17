import {readFileSync} from "node:fs";
import {join, relative} from "node:path";
import process from "node:process";

const root = process.cwd();
const files = [
  "_shop/woocommerce/OneRingconf/includes/class-asf-ringconf-assets.php",
  "_shop/woocommerce/OneRingconf/includes/class-asf-ringconf-shortcode.php",
  "_shop/woocommerce/OneRingconf/assets/js/frontend-bridge.js",
  "src/app/runtime-config.ts",
  "src/environments/environment.woocommerce.ts",
];

const forbidden = [
  {name: "script_loader_tag filter", pattern: /script_loader_tag/},
  {name: "classic script type=module patch", pattern: /wp_script_add_data\s*\(/},
  {name: "inline runtime JavaScript", pattern: /wp_add_inline_script\s*\(/},
  {name: "global runtime variable", pattern: /window\.__ASF_RINGCONF_RUNTIME__/},
  {name: "hard-coded legacy plugin path", pattern: /\/wp-content\/plugins\/OneRingconf\//},
];

let failed = false;

for (const file of files) {
  const path = join(root, file);
  const source = readFileSync(path, "utf8");
  for (const rule of forbidden) {
    const match = rule.pattern.exec(source);
    if (match) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      console.error(`ERROR: Forbidden ${rule.name} in ${relative(root, path).replace(/\\/g, "/")}:${line}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("WordPress plugin static regression check passed.");
