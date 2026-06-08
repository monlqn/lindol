const MAX_BYTES = 20 * 1024 * 1024;
const MAX_DIM = 1024;
const QUALITY = 0.6;

// Returns an error string if the file is unusable, else null.
export function rejectFile(file) {
  if (!file || !String(file.type).startsWith('image/')) return 'Please use a photo (image) file.';
  if (file.size > MAX_BYTES) return 'That photo is too large.';
  return null;
}

// Downscale to <= MAX_DIM and re-encode as JPEG Blob. Falls back to the original file on failure.
export async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
    return blob ?? file;
  } catch {
    return file;
  }
}
