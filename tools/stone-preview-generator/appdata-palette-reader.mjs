import {execFileSync} from "node:child_process";
import {join} from "node:path";
import process from "node:process";

export function readPalette(options = {}) {
  const args = [];
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== null && value !== "" && key !== "dryRun" && key !== "verbose") {
      args.push(`--${key}=${String(value)}`);
    }
  }

  const adapter = join(process.cwd(), "tools", "stone-preview-generator", "php", "read-stone-palette.php");
  try {
    const stdout = execFileSync("php", [adapter, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
    const palette = JSON.parse(stdout);
    validatePalette(palette);
    return palette;
  } catch (error) {
    const stderr = typeof error.stderr === "string" ? error.stderr.trim() : "";
    throw new Error(stderr || "Could not read AppData stone palette.");
  }
}

export function validatePalette(palette) {
  if (!palette || typeof palette !== "object" || palette.schemaVersion !== 1 || !Array.isArray(palette.colors)) {
    throw new Error("Palette adapter returned an invalid schema.");
  }
  for (const color of palette.colors) {
    if (!color || typeof color !== "object") {
      throw new Error("Palette contains an invalid color entry.");
    }
    if (typeof color.id !== "string" || color.id === "") {
      throw new Error("Palette color id is missing.");
    }
    if (typeof color.label !== "string" || color.label === "") {
      throw new Error(`Palette color label is missing for ${color.id}.`);
    }
    if (!color.sourceColor || typeof color.sourceColor.previewHex !== "string") {
      throw new Error(`Palette color previewHex is missing for ${color.id}.`);
    }
  }
}
