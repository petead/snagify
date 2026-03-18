/**
 * Compresses an image file client-side using Canvas API.
 * Resizes to maxWidth/maxHeight while maintaining aspect ratio.
 * Outputs as JPEG with specified quality.
 */
export async function compressImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not supported'))

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression failed'))
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          resolve(compressed)
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Preset for avatar photos — 400×400px max, high quality
 */
export function compressAvatar(file: File): Promise<File> {
  return compressImage(file, 400, 400, 0.85)
}

/**
 * Preset for company logos — 1200×600px max, high quality
 * Larger dimensions needed for PDF rendering
 */
export function compressLogo(file: File): Promise<File> {
  if (file.type === 'image/svg+xml') return Promise.resolve(file)
  return compressImage(file, 1200, 600, 0.9)
}
