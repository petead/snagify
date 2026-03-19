import type { Area } from 'react-easy-crop'

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (e) => reject(e))
    image.src = url
  })
}

/**
 * Draws the cropped region from imageSrc onto a canvas and exports PNG.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2d context unavailable')

  const w = Math.max(1, Math.floor(pixelCrop.width))
  const h = Math.max(1, Math.floor(pixelCrop.height))
  canvas.width = w
  canvas.height = h

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    w,
    h
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to export cropped image'))
      },
      'image/png',
      0.95
    )
  })
}
