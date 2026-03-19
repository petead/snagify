export interface ImageDimensions {
  width: number;
  height: number;
}

function readDimensionsViaImageElement(file: File | Blob): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!width || !height) {
        reject(new Error("Image has no readable pixel dimensions"));
        return;
      }
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image for dimensions"));
    };
    img.src = url;
  });
}

/**
 * True pixel size of the video frame for canvas capture — NOT CSS/display size.
 * Prefers MediaStreamTrack.getSettings() (negotiated camera resolution), then videoWidth/videoHeight.
 */
export function getVideoCaptureDimensions(video: HTMLVideoElement): ImageDimensions {
  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    const track = stream.getVideoTracks()[0];
    const settings = track?.getSettings?.() ?? {};
    const sw = settings.width;
    const sh = settings.height;
    if (typeof sw === "number" && sw > 0 && typeof sh === "number" && sh > 0) {
      return { width: sw, height: sh };
    }
  }
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw > 0 && vh > 0) {
    return { width: vw, height: vh };
  }
  return { width: 0, height: 0 };
}

export function assertValidDimensions(
  dims: ImageDimensions,
  context: string
): asserts dims is ImageDimensions & { width: number; height: number } {
  if (!dims.width || !dims.height) {
    console.error(`[${context}] Photo dimensions missing or zero`, dims);
    throw new Error(`Cannot save photo without dimensions (${context})`);
  }
}

/**
 * Reads pixel dimensions from a File or Blob (actual encoded image, not display size).
 * Uses createImageBitmap when available, else HTMLImageElement naturalWidth/Height.
 * Rejects if dimensions cannot be read or are zero.
 */
export async function getImageDimensions(file: File | Blob): Promise<ImageDimensions> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const width = bitmap.width;
      const height = bitmap.height;
      if (!width || !height) {
        throw new Error("Bitmap has zero dimensions");
      }
      return { width, height };
    } finally {
      bitmap.close();
    }
  } catch {
    return readDimensionsViaImageElement(file);
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
