import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import Product from "../product-preview"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const queryParams: HttpTypes.StoreProductListParams = {
    region_id: region.id,
    limit: 5,
  }
  const categoryId = product.categories?.[0]?.id

  if (categoryId) {
    queryParams.category_id = [categoryId]
  } else if (product.collection_id) {
    queryParams.collection_id = [product.collection_id]
  }

  const products = await listProducts({
    queryParams,
    countryCode,
  }).then(({ response }) =>
    response.products.filter((responseProduct) => responseProduct.id !== product.id).slice(0, 4)
  )

  if (!products.length) {
    return null
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
        Complete the order
      </p>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
        Often bought for the same job
      </h2>

      <ul className="mt-8 grid grid-cols-2 small:grid-cols-4 gap-4 small:gap-6">
        {products.map((product) => (
          <li key={product.id}>
            <Product region={region} product={product} />
          </li>
        ))}
      </ul>
    </div>
  )
}
