// Load the LINDOL banner as a File so it can be attached to a Web Share. Attaching
// the image directly means it appears in the share even if the destination app
// hasn't cached our Open Graph tags yet.
export async function getShareImageFile() {
  try {
    const res = await fetch('/og-image.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], 'lindol.png', { type: blob.type || 'image/png' });
  } catch {
    return null;
  }
}
