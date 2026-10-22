/**
 * Shrinks a photo in the browser before it is uploaded, so a 6 MB phone/camera
 * picture does not make every product page slow. Long side is limited to
 * `maxSide` pixels and the file is saved as WebP. If anything goes wrong (or the
 * result is not smaller) the original file is uploaded unchanged.
 */
export async function resizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") return file;
    // Already small and not resized: keep the original rather than re-encoding it.
    if (scale === 1 && blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}
