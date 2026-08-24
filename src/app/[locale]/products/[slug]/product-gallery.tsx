"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type GalleryImage = { id: string; src: string; alt: string };

export function ProductGallery({ images, prevLabel = "上一张", nextLabel = "下一张" }: { images: GalleryImage[]; prevLabel?: string; nextLabel?: string }) {
  const [active, setActive] = useState(0);
  const count = images.length;
  if (count === 0) return null;
  const current = images[Math.min(active, count - 1)];
  const prev = () => setActive((active - 1 + count) % count);
  const next = () => setActive((active + 1) % count);

  return (
    <div className="product-gallery">
      <div className="product-gallery-main">
        <img src={current.src} alt={current.alt} />
        {count > 1 && (
          <>
            <button type="button" className="product-gallery-nav prev" onClick={prev} aria-label={prevLabel}><ChevronLeft /></button>
            <button type="button" className="product-gallery-nav next" onClick={next} aria-label={nextLabel}><ChevronRight /></button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="product-gallery-thumbs">
          {images.map((img, i) => (
            <button key={img.id} type="button" className="product-gallery-thumb" aria-current={i === active ? "true" : undefined} onClick={() => setActive(i)}>
              <img src={img.src} alt={img.alt} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
