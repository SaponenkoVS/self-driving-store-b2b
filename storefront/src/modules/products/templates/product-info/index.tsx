import { HttpTypes } from "@medusajs/types"

import { getBrand, hasTag } from "@lib/util/b2b"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const BADGES = [
  { tag: "bestseller", label: "Bestseller", className: "bg-ink text-white" },
  { tag: "new", label: "New line", className: "bg-brand text-white" },
  { tag: "pallet-deal", label: "Pallet deal", className: "bg-brand-light text-brand-dark" },
  { tag: "eco", label: "Low carbon", className: "bg-emerald-50 text-emerald-700" },
  { tag: "fire-rated", label: "Fire rated", className: "bg-rose-50 text-rose-700" },
]

const ProductInfo = ({ product }: ProductInfoProps) => {
  const brand = getBrand(product)
  const badges = BADGES.filter((badge) => hasTag(product, badge.tag))

  return (
    <div id="product-info" className="flex flex-col gap-y-3">
      {badges.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <li
              key={badge.tag}
              className={`rounded-base px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${badge.className}`}
            >
              {badge.label}
            </li>
          ))}
        </ul>
      )}
      {brand && (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-600">{brand}</p>
      )}
      <h1
        className="font-display text-3xl font-bold leading-tight tracking-tight text-ink small:text-[2.1rem]"
        data-testid="product-title"
      >
        {product.title}
      </h1>
      {product.subtitle && <p className="text-base text-ink-600">{product.subtitle}</p>}
    </div>
  )
}

export default ProductInfo
