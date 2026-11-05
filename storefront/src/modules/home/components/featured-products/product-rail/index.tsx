import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"

import { SectionHeading } from "@modules/home/components/category-grid"
import ProductPreview from "@modules/products/components/product-preview"

export default async function ProductRail({
  collection,
  region,
  eyebrow,
  title,
  limit = 4,
}: {
  collection: HttpTypes.StoreCollection
  region: HttpTypes.StoreRegion
  eyebrow: string
  title?: string
  limit?: number
}) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      collection_id: [collection.id],
      limit,
    },
  })

  if (!products?.length) {
    return null
  }

  return (
    <section className="content-container py-12 small:py-16">
      <SectionHeading
        eyebrow={eyebrow}
        title={title ?? collection.title}
        href={`/collections/${collection.handle}`}
        cta={`View all ${collection.title.toLowerCase()}`}
      />
      <ul className="mt-8 grid grid-cols-2 gap-4 small:grid-cols-4 small:gap-6">
        {products.map((product) => (
          <li key={product.id}>
            <ProductPreview product={product} region={region} />
          </li>
        ))}
      </ul>
    </section>
  )
}
