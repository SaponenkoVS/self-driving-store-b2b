"use client"

import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import Image from "next/image"
import { useEffect, useState } from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  title?: string
}

const ImageGallery = ({ images, title = "Product" }: ImageGalleryProps) => {
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive(0)
  }, [images])

  const current = images[active] ?? images[0]

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-large bg-concrete-50 ring-1 ring-concrete-200">
        {current?.url ? (
          <Image
            key={current.url}
            src={current.url}
            alt={`${title} image ${active + 1}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            quality={75}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-600">
            <PlaceholderImage size="48" />
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-3 small:grid-cols-5">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show image ${index + 1}`}
              className={clx(
                "relative aspect-square overflow-hidden rounded-rounded bg-concrete-50 ring-2 transition",
                index === active ? "ring-ink" : "ring-transparent hover:ring-concrete-200"
              )}
            >
              {image.url && (
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="120px"
                  quality={50}
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageGallery
