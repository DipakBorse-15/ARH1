import type { ProductImage } from "@/types";
import { imgSrc } from "@/lib/imgProxy";

/** Small photo for cards, swatches, cart and wishlist. Falls back to the full photo when no thumbnail exists yet. */
export function thumbUrl(img?: Pick<ProductImage, "url" | "thumb_url"> | null): string | undefined {
  if (!img) return undefined;
  return imgSrc(img.thumb_url || img.url);
}

export const THUMB_SIDE = 640;
export const THUMB_QUALITY = 0.8;
