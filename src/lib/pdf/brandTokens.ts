export interface BrandTokens {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryUltraLight: string;
  onPrimary: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toL = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toL(r) + 0.7152 * toL(g) + 0.0722 * toL(b);
}

function mixWithWhite(hex: string, ratio: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

function darkenHex(hex: string, ratio: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c * (1 - ratio));
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

export function getBrandTokens(primaryColor?: string | null): BrandTokens {
  const primary = primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor.trim()) ? primaryColor.trim() : "#9A88FD";
  return {
    primary,
    primaryDark: darkenHex(primary, 0.18),
    primaryLight: mixWithWhite(primary, 0.62),
    primaryUltraLight: mixWithWhite(primary, 0.88),
    onPrimary: luminance(primary) > 0.35 ? "#1A1A2E" : "#FFFFFF",
  };
}
