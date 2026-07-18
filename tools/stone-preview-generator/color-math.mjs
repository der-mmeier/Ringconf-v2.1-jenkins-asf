const HEX_SHORT = /^#?([0-9a-fA-F]{3})$/;
const HEX_LONG = /^#?([0-9a-fA-F]{6})$/;

export function normalizeHex(value) {
  if (typeof value !== "string") {
    throw new Error("Color value must be a string.");
  }
  const trimmed = value.trim();
  const short = HEX_SHORT.exec(trimmed);
  if (short) {
    return `#${short[1].split("").map((char) => char + char).join("").toUpperCase()}`;
  }
  const long = HEX_LONG.exec(trimmed);
  if (long) {
    return `#${long[1].toUpperCase()}`;
  }
  throw new Error(`Invalid hex color: ${value}`);
}

export function normalizeColorValue(value) {
  if (typeof value === "string") {
    return {
      format: "hex",
      previewHex: normalizeHex(value),
    };
  }

  if (Array.isArray(value) && value.length >= 3) {
    return {
      format: "rgb",
      previewHex: rgbToHex(normalizeRgbChannel(value[0]), normalizeRgbChannel(value[1]), normalizeRgbChannel(value[2])),
    };
  }

  if (value && typeof value === "object") {
    const record = value;
    if (["r", "g", "b"].every((key) => record[key] !== undefined)) {
      const channels = [record.r, record.g, record.b].map(Number);
      const format = channels.every((channel) => channel >= 0 && channel <= 1) ? "color3" : "rgb";
      return {
        format,
        previewHex: rgbToHex(normalizeRgbChannel(record.r), normalizeRgbChannel(record.g), normalizeRgbChannel(record.b)),
      };
    }
  }

  throw new Error("Unsupported color format.");
}

export function deriveFacetPalette(hex) {
  const base = parseHex(normalizeHex(hex));
  const luminance = relativeLuminance(base);
  const saturation = saturationOf(base);
  const blackLike = luminance < 0.055;
  const whiteLike = luminance > 0.88 && saturation < 0.12;

  if (blackLike) {
    return {
      deepShadow: "#050608",
      shadow: "#11161C",
      base: "#242A32",
      midLight: "#475463",
      light: "#8593A3",
      specularTint: "#E8EEF5",
      outline: "#030405",
    };
  }

  if (whiteLike) {
    return {
      deepShadow: "#A6B0BA",
      shadow: "#C2CAD2",
      base: "#EEF3F7",
      midLight: "#F8FBFD",
      light: "#FFFFFF",
      specularTint: "#FFFFFF",
      outline: "#788894",
    };
  }

  return {
    deepShadow: toHex(mix(scaleLinear(base, 0.46), {r: 6, g: 10, b: 18}, 0.16)),
    shadow: toHex(scaleLinear(base, 0.64)),
    base: toHex(base),
    midLight: toHex(mix(scaleLinear(base, 1.28), {r: 255, g: 255, b: 255}, saturation > 0.75 ? 0.14 : 0.2)),
    light: toHex(mix(scaleLinear(base, 1.55), {r: 255, g: 255, b: 255}, saturation > 0.75 ? 0.24 : 0.32)),
    specularTint: toHex(mix(base, {r: 255, g: 255, b: 255}, saturation > 0.75 ? 0.68 : 0.76)),
    outline: toHex(mix(scaleLinear(base, 0.38), {r: 0, g: 0, b: 0}, 0.18)),
  };
}

export function safeAssetId(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Color id must be a non-empty string.");
  }
  if (value.includes("..") || value.includes("/") || value.includes("\\")) {
    throw new Error(`Unsafe color id for filename: ${value}`);
  }
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized || normalized.includes("..") || normalized.includes("/") || normalized.includes("\\")) {
    throw new Error(`Unsafe color id for filename: ${value}`);
  }
  return normalized;
}

export function assertNoFilenameCollisions(colors) {
  const seen = new Map();
  for (const color of colors) {
    const safeId = safeAssetId(color.id);
    const previous = seen.get(safeId);
    if (previous && previous !== color.id) {
      throw new Error(`Filename collision: "${previous}" and "${color.id}" both map to "${safeId}.svg".`);
    }
    seen.set(safeId, color.id);
  }
}

export function sortColors(colors) {
  return colors.slice().sort((a, b) => {
    const sortA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 0;
    const sortB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0;
    if (sortA !== sortB) {
      return sortA - sortB;
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

function normalizeRgbChannel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("RGB channel must be numeric.");
  }
  if (number >= 0 && number <= 1) {
    return Math.round(number * 255);
  }
  if (number >= 0 && number <= 255) {
    return Math.round(number);
  }
  throw new Error(`RGB channel is out of range: ${value}`);
}

function rgbToHex(r, g, b) {
  return toHex({r, g, b});
}

function parseHex(hex) {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHex(color) {
  return `#${[color.r, color.g, color.b].map((channel) => clampByte(channel).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function scaleLinear(color, factor) {
  return {
    r: color.r * factor,
    g: color.g * factor,
    b: color.b * factor,
  };
}

function mix(a, b, amount) {
  return {
    r: a.r * (1 - amount) + b.r * amount,
    g: a.g * (1 - amount) + b.g * amount,
    b: a.b * (1 - amount) + b.b * amount,
  };
}

function relativeLuminance(color) {
  const linear = [color.r, color.g, color.b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function saturationOf(color) {
  const max = Math.max(color.r, color.g, color.b) / 255;
  const min = Math.min(color.r, color.g, color.b) / 255;
  if (max === 0) {
    return 0;
  }
  return (max - min) / max;
}
