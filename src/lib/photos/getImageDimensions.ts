export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Reads pixel dimensions from a File or Blob using createImageBitmap.
 * Works in browser only (called before upload).
 * Falls back to null if browser does not support createImageBitmap.
 */
export async function getImageDimensions(
  file: File | Blob
): Promise<ImageDimensions | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    // Fallback: use an Image element
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }
}

/**
 * Returns true if photo is landscape (width > height).
 * Returns false for portrait or square.
 * Returns null if dimensions unknown.
 */
export function isLandscape(
  width?: number | null,
  height?: number | null
): boolean | null {
  if (!width || !height) return null;
  return width > height;
}

/**
 * Calculates display height in PDF points given a column width and image dimensions.
 * Respects original aspect ratio — never crops.
 *
 * @param colWidthPt  Available column width in PDF points
 * @param width       Original image width in px
 * @param height      Original image height in px
 * @param maxHeightPt Optional max height cap (default 340pt)
 */
export function getPdfImageHeight(
  colWidthPt: number,
  width?: number | null,
  height?: number | null,
  maxHeightPt = 340
): number {
  if (!width || !height) return 160; // safe fallback
  const ratio = height / width;
  return Math.min(Math.round(colWidthPt * ratio), maxHeightPt);
}
