import { HttpTypes } from "@medusajs/types"
import Image from "next/image"

import {
  getBrand,
  getLeadTime,
  getTiers,
  getUnit,
  hasTag,
  isProductInStock,
  pluralUnit,
} from "@lib/util/b2b"
import { getProductPrice } from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PlaceholderImage from "@modules/common/icons/placeholder-image"

export default async function ProductPreview({
  product,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  const { cheapestPrice } = getProductPrice({ product })

  const brand = getBrand(product)
  const unit = getUnit(product)
  const inStock = isProductInStock(product)
  const leadTime = getLeadTime(product)
  const image = product.thumbnail || product.images?.[0]?.url
  const hasManyVariants = (product.variants?.length ?? 0) > 1

  const cheapestVariant = [...(product.variants ?? [])].sort(
    (a, b) =>
      (a.calculated_price?.calculated_amount ?? 0) - (b.calculated_price?.calculated_amount ?? 0)
  )[0]
  const tiers = getTiers(cheapestVariant)
  const bestTier = tiers.length > 1 ? tiers[tiers.length - 1] : null

  const badge = hasTag(product, "bestseller")
    ? { label: "Bestseller", className: "bg-ink text-white" }
    : hasTag(product, "new")
    ? { label: "New line", className: "bg-brand text-white" }
    : hasTag(product, "pallet-deal")
    ? { label: "Pallet deal", className: "bg-brand-light text-brand-dark" }
    : null

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group flex h-full flex-col overflow-hidden rounded-large border border-concrete-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_18px_40px_-24px_rgba(18,22,28,0.45)]"
      data-testid="product-wrapper"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-concrete-50">
        {image ? (
          <Image
            src={image}
            alt={product.title}
            fill
            sizes="(max-width: 1024px) 50vw, 25vw"
            quality={60}
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-600">
            <PlaceholderImage size="32" />
          </div>
        )}
        {badge && (
          <span
            className={`absolute left-3 top-3 rounded-base px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {brand && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-600">
            {brand}
          </span>
        )}
        <h3
          className="mt-1 line-clamp-2 font-display text-[15px] font-semibold leading-snug text-ink group-hover:text-brand-dark transition-colors"
          data-testid="product-title"
        >
          {product.title}
        </h3>
        {product.subtitle && (
          <p className="mt-1 line-clamp-1 text-xs text-ink-600">{product.subtitle}</p>
        )}

        <div className="mt-auto pt-4">
          {cheapestPrice && (
            <div className="flex items-baseline gap-x-1.5">
              {hasManyVariants && <span className="text-xs text-ink-600">from</span>}
              <span className="font-display text-xl font-bold text-ink" data-testid="price">
                {cheapestPrice.calculated_price}
              </span>
              <span className="text-xs text-ink-600">/ {unit}</span>
            </div>
          )}
          {bestTier && cheapestPrice && (
            <p className="mt-0.5 text-xs font-medium text-brand-dark">
              {convertToLocale({ amount: bestTier.amount, currency_code: cheapestPrice.currency_code })}{" "}
              from {bestTier.min_quantity} {pluralUnit(unit)}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-concrete-100 pt-3 text-xs">
            <span className="flex items-center gap-x-1.5 font-medium text-ink-700">
              <span
                className={`h-2 w-2 rounded-circle ${
                  inStock ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {inStock ? "In stock" : leadTime ? "Made to order" : "On request"}
            </span>
            <span className="text-ink-600">excl. VAT</span>
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
