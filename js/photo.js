const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.7;

// Compresses a captured photo File into a small JPEG, correcting EXIF
// orientation along the way (createImageBitmap's default "from-image"
// handles this — the raw camera JPEG isn't pre-rotated, only tagged).
//
// Returns a base64 data URL string, not a Blob. iOS Safari has a
// long-standing WebKit bug where Blobs stored in IndexedDB can come back
// corrupted after the page/app reloads (shows as a broken image) —
// especially in installed home-screen PWAs. A plain string round-trips
// through IndexedDB's structured clone reliably with no such issue, at the
// cost of ~33% more storage than the raw binary would need — acceptable
// given photos are already capped small here.
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

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
