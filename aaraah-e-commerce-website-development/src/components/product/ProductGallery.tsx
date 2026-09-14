import { useEffect, useState } from "react";
import type { ProductImage } from "@/types";

export function ProductGallery({ images, alt }: { images: ProductImage[]; alt: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => setActive(0), [images]);

  if (!images.length) {
    return <div className="flex aspect-[3/4] items-center justify-center rounded-2xl bg-stone-100 text-stone-300">No Image</div>;
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      <div className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        {images.map((img, idx) => (
          <button
            key={img.id}
            onClick={() => setActive(idx)}
            aria-label={`View image ${idx + 1}`}
            className={`h-16 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 ${
              idx === active ? "border-rose-900" : "border-transparent"
            }`}
          >
            <img src={img.url} alt={img.alt_text || alt} className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden rounded-2xl bg-stone-100">
        <img src={current.url} alt={current.alt_text || alt} className="aspect-[3/4] w-full object-cover" />
      </div>
    </div>
  );
}
