import { thumbUrl } from "@/lib/thumb";
import { useEffect, useState } from "react";
import type { ProductImage } from "@/types";
import { imgSrc } from "@/lib/imgProxy";

export function ProductGallery({ images, alt }: { images: ProductImage[]; alt: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => setActive(0), [images]);

  if (!images.length) {
    return <div className="flex aspect-[3/4] items-center justify-center rounded-2xl bg-stone-100 text-stone-300">No Image</div>;
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className="flex min-w-0 max-w-full flex-col-reverse gap-3 md:flex-row">
      <div className="flex max-w-full gap-2 overflow-x-auto md:max-h-[calc(100vh-7rem)] md:flex-col md:overflow-y-auto md:overflow-x-hidden">
        {images.map((img, idx) => (
          <button
            key={img.id}
            onClick={() => setActive(idx)}
            aria-label={`View image ${idx + 1}`}
            className={`aspect-[2/3] w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-stone-100 ${
              idx === active ? "border-rose-900" : "border-transparent"
            }`}
          >
            <img src={thumbUrl(img)} alt={img.alt_text || alt} className="h-full w-full object-contain" loading="lazy" />
          </button>
        ))}
      </div>
      <div className="flex min-h-[320px] min-w-0 flex-1 items-start justify-center overflow-hidden rounded-2xl bg-stone-100 md:items-center">
        {/* key={current.id} remounts the img on every change, re-triggering
            the crossfade — a soft swap instead of a hard cut. */}
        <img
          key={current.id}
          src={imgSrc(current.url)}
          alt={current.alt_text || alt}
          className="h-auto w-full animate-fade-in object-contain md:max-h-[calc(100vh-7rem)] md:w-auto md:max-w-full"
        />
      </div>
    </div>
  );
}
