/**
 * Creates a cropped image from canvas based on react-easy-crop's croppedAreaPixels.
 */
export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export async function getCroppedImage(
  imageSrc: string,
  croppedAreaPixels: CropArea,
  outputType: "circle" | "square" = "square",
  quality = 0.85
): Promise<File> {
  const image = await createImageBitmap(await fetch(imageSrc).then((r) => r.blob()))

  const canvas = document.createElement("canvas")
  const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height)
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext("2d")!

  if (outputType === "circle") {
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
  }

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    size,
    size
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Canvas toBlob failed"))
        resolve(new File([blob], "cropped.jpg", { type: "image/jpeg" }))
      },
      "image/jpeg",
      quality
    )
  })
}
