const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.7;

// Compresses a captured photo File into a small JPEG Blob, correcting EXIF
// orientation along the way (createImageBitmap's default "from-image"
// handles this — the raw camera JPEG isn't pre-rotated, only tagged).
export async function compressPhoto(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
}
