/**
 * Server-side: fetch remote image and return a JPEG data URL for @react-pdf/renderer.
 * maxDimension 800 @ quality 82 — sufficient for 72–96 dpi PDF output.
 */

import sharp from "sharp";

export async function compressImageForPdfFromUrl(
  url: string,
  maxDimension = 800
): Promise<string> {
  if (!url || typeof url !== "string") return url;
  if (!url.startsWith("https://")) return url;

  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const input = Buffer.from(await res.arrayBuffer());

    const out = await sharp(input)
      .rotate()
      .resize(maxDimension, maxDimension, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();

    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return url;
  }
}

/** Check-in PDF: meta.rooms[].photos[].url */
export async function compressSimpleRoomPhotos<R extends { photos?: unknown[] }>(
  rooms: R[]
): Promise<R[]> {
  return Promise.all(
    rooms.map(async (room) => {
      const photos = (room.photos ?? []) as Array<Record<string, unknown> & { url?: string }>;
      const nextPhotos = await Promise.all(
        photos.map(async (ph) => ({
          ...ph,
          url:
            typeof ph.url === "string" && ph.url.startsWith("https://")
              ? await compressImageForPdfFromUrl(ph.url)
              : ph.url,
        }))
      );
      return { ...room, photos: nextPhotos } as R;
    })
  );
}

/** Check-out PDF: checkout photo + optional embedded check-in photo URL */
export async function compressCheckoutRoomPhotos<
  T extends {
    url: string;
    checkin_photo?: { url: string } | null;
  } & Record<string, unknown>,
>(photos: T[]): Promise<T[]> {
  return Promise.all(
    photos.map(async (p) => {
      const url = await compressImageForPdfFromUrl(p.url);
      const checkin_photo =
        p.checkin_photo?.url != null
          ? { ...p.checkin_photo, url: await compressImageForPdfFromUrl(p.checkin_photo.url) }
          : p.checkin_photo ?? null;
      return { ...p, url, checkin_photo } as T;
    })
  );
}
