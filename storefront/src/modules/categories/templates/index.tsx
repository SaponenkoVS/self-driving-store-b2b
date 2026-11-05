import { notFound } from "next/navigation"
import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

export default function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (category: HttpTypes.StoreProductCategory) => {
    if (category.parent_category) {
      parents.push(category.parent_category)
      getParents(category.parent_category)
    }
  }

  getParents(category)

  return (
    <div
      className="flex flex-col small:flex-row small:items-start py-6 content-container"
      data-testid="category-container"
    >
      <RefinementList sortBy={sort} data-testid="sort-by-container" />
      <div className="w-full">
        <nav className="mb-3 flex items-center gap-x-2 text-xs text-ink-600">
          <LocalizedClientLink href="/store" className="hover:text-ink">
            Catalogue
          </LocalizedClientLink>
          {[...parents].reverse().map((parent) => (
            <span key={parent.id} className="flex items-center gap-x-2">
              <span>/</span>
              <LocalizedClientLink
                className="hover:text-ink"
                href={`/categories/${parent.handle}`}
                data-testid="sort-by-link"
              >
                {parent.name}
              </LocalizedClientLink>
            </span>
          ))}
        </nav>
        <h1
          className="font-display text-3xl font-bold tracking-tight text-ink small:text-4xl"
          data-testid="category-page-title"
        >
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-3 max-w-2xl text-base text-ink-600">{category.description}</p>
        )}
        {!!category.category_children?.length && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {category.category_children.map((c) => (
              <li key={c.id}>
                <LocalizedClientLink
                  href={`/categories/${c.handle}`}
                  className="inline-flex rounded-circle border border-concrete-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:border-ink hover:bg-ink hover:text-white transition-colors"
                >
                  {c.name}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        )}
        <div className="mb-8" />
        <Suspense
          fallback={
            <SkeletonProductGrid
              numberOfProducts={category.products?.length ?? 8}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            categoryId={[
              category.id,
              ...(category.category_children ?? []).map((child) => child.id),
            ]}
            countryCode={countryCode}
          />
        </Suspense>
      </div>
    </div>
  )
}
