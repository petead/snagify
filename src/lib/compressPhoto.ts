/**
 * Client-side photo compression before upload (browser only).
 * Used by InspectionClient — there is no separate room/camera route; capture goes through GhostCamera + handlePhotoCapture.
 *
 * Target: max 1920px on longest side, JPEG quality 0.82
 * Preserves aspect ratio, never upscales.
 */

export async function compressPhoto(
  file: File | Blob,
  options: {
    maxDimension?: number;
    quality?: number;
  } = {}
): Promise<{ blob: Blob; width: number; height: number }> {
  const maxDim = options.maxDimension ?? 1920;
  const quality = options.quality ?? 0.82;

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      if (!srcW || !srcH) {
        reject(new Error("Invalid image dimensions"));
        return;
      }

      let targetW = srcW;
      let targetH = srcH;

      if (srcW > maxDim || srcH > maxDim) {
        if (srcW >= srcH) {
          targetW = maxDim;
          targetH = Math.round(srcH * (maxDim / srcW));
        } else {
          targetH = maxDim;
          targetW = Math.round(srcW * (maxDim / srcH));
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          resolve({ blob, width: targetW, height: targetH });
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };
    img.src = url;
  });
}

/**
 * Compress a photo from a data URL (e.g. canvas capture).
 */
export async function compressPhotoDataUrl(
  dataUrl: string,
  options: { maxDimension?: number; quality?: number } = {}
): Promise<{ dataUrl: string; blob: Blob; width: number; height: number }> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const compressed = await compressPhoto(blob, options);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        dataUrl: reader.result as string,
        blob: compressed.blob,
        width: compressed.width,
        height: compressed.height,
      });
    reader.onerror = () => reject(new Error("readAsDataURL failed"));
    reader.readAsDataURL(compressed.blob);
  });
}
