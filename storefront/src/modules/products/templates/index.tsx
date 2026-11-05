import React, { Suspense } from "react"

import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"

import ProductActionsWrapper from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  const category = product.categories?.[0]

  return (
    <>
      <div className="border-b border-concrete-100 bg-white">
        <nav
          aria-label="Breadcrumb"
          className="content-container flex h-12 items-center gap-x-2 overflow-x-auto no-scrollbar text-xs text-ink-600"
        >
          <LocalizedClientLink href="/" className="hover:text-ink">
            Home
          </LocalizedClientLink>
          <span>/</span>
          <LocalizedClientLink href="/store" className="hover:text-ink">
            Catalogue
          </LocalizedClientLink>
          {category && (
            <>
              <span>/</span>
              <LocalizedClientLink href={`/categories/${category.handle}`} className="hover:text-ink">
                {category.name}
              </LocalizedClientLink>
            </>
          )}
          <span>/</span>
          <span className="truncate font-medium text-ink">{product.title}</span>
        </nav>
      </div>

      <div
        className="content-container grid grid-cols-1 gap-10 py-8 small:grid-cols-12 small:gap-12 small:py-12"
        data-testid="product-container"
      >
        <div className="small:col-span-7">
          <ImageGallery images={images} title={product.title} />
        </div>
        <div className="small:col-span-5">
          <div className="flex flex-col gap-y-6 small:sticky small:top-40">
            <ProductInfo product={product} />
            <Suspense
              fallback={<ProductActions disabled={true} product={product} region={region} />}
            >
              <ProductActionsWrapper id={product.id} region={region} />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="border-t border-concrete-200 bg-white">
        <div className="content-container py-14 small:py-20">
          <ProductTabs product={product} />
        </div>
      </div>

      <div
        className="border-t border-concrete-200 bg-concrete-50"
        data-testid="related-products-container"
      >
        <div className="content-container py-14 small:py-20">
          <Suspense fallback={<SkeletonRelatedProducts />}>
            <RelatedProducts product={product} countryCode={countryCode} />
          </Suspense>
        </div>
      </div>
    </>
  )
}

export default ProductTemplate
