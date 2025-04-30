import type { ThemeData } from "./types";

/**
 * Convert a HEX color to HSL format
 * @param hex - The HEX color string (e.g., "#ff0000" or "#f00")
 * @returns HSL values as a string in the format "h s% l%" or null if invalid
 */
export function hexToHsl(hexColor: string): string | null {
  // Remove the hash if present
  const cleanHex = hexColor.replace(/^#/, "");

  // Convert shorthand hex to full form
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((char) => char + char)
          .join("")
      : cleanHex;

  // Validate hex format
  if (!/^[0-9A-Fa-f]{6}$/.test(fullHex)) {
    return null;
  }

  // Convert hex to RGB
  const r = Number.parseInt(fullHex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(fullHex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(fullHex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  // Convert to degrees and percentages
  const hDegrees = Math.round(h * 360);
  const sPercent = Math.round(s * 100);
  const lPercent = Math.round(l * 100);

  return `hsl(${hDegrees}, ${sPercent}%, ${lPercent}%)`;
}

/**
 * Validate if a string is a valid HSL color format
 * @param hsl - The HSL color string to validate
 * @returns boolean indicating if the string is valid HSL format
 */
export function isValidHsl(hsl: string): boolean {
  const pattern = /^hsl\(\s*\d+(\.\d+)?(\s*,\s*\d+(\.\d+)?%){2}\s*\)$/;
  if (!pattern.test(hsl)) return false;

  const values = hsl
    .replace(/^hsl\(|\)$/g, "")
    .split(",")
    .map((val) => Number.parseFloat(val));
  if (values.length !== 3) return false;

  const [h = 0, s = 0, l = 0] = values;
  return h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100;
}

/**
 * Validate if a string is a valid HEX color
 * @param hex - The HEX color string to validate
 * @returns boolean indicating if the string is valid HEX format
 */
export function isValidHex(hex: string): boolean {
  return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

/**
 * Parse a HSL color string to a string of CSS variables
 * @param hsl - The HSL color string to parse
 * @returns A string of CSS variables
 */
export function parseHsl(hsl: string): string | null {
  const [h, s, l] = hsl
    .replace(/^hsl\(|\s*\)$/g, "") // Remove hsl( and ) with any whitespace
    .split(/\s*,\s*/) // Split by comma with any whitespace
    .map((val) => Number.parseFloat(val.replace("%", ""))); // Remove % and convert to number

  if (h === undefined || s === undefined || l === undefined) return null;
  return `${h} ${s}% ${l}%`;
}

/**
 * Convert a ThemeData object to a string of CSS variables
 * @param data - The ThemeData object to convert
 * @returns A string of CSS variables
 */
export function toCssVariables(data: ThemeData): string {
  return Object.entries(data)
    .map(([key, value]) => {
      let colorValue = value;
      if (typeof value === "string") {
        if (isValidHex(value)) {
          const hslValue = hexToHsl(value);
          if (hslValue) {
            colorValue = hslValue;
          }
        }
        if (typeof colorValue === "string" && colorValue.startsWith("hsl")) {
          colorValue = parseHsl(colorValue as string) || colorValue;
        }
      }
      if (key === "radius") {
        colorValue = `${colorValue}rem`;
      }
      return `  --${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${colorValue};`;
    })
    .join("\n");
}
