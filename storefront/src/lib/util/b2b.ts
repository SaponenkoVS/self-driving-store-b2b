import { HttpTypes } from "@medusajs/types"

export type PriceTier = {
  min_quantity: number
  max_quantity: number | null
  amount: number
}

export const STORE_INFO = {
  name: "STRATA",
  tagline: "Building Supply",
  phone: "+48 22 290 41 00",
  phoneHref: "tel:+48222904100",
  email: "trade@strata-supply.eu",
  address: ["ul. Przemysłowa 12", "02-232 Warszawa, Poland"],
  hours: "Mon–Fri 6:00–18:00, Sat 7:00–13:00",
}

const meta = (product: HttpTypes.StoreProduct) =>
  (product.metadata ?? {}) as Record<string, unknown>

export const getBrand = (product: HttpTypes.StoreProduct) =>
  (meta(product).brand as string | undefined) ?? null

export const getUnit = (product: HttpTypes.StoreProduct) =>
  (meta(product).unit as string | undefined) ?? "pcs"

export const getLeadTime = (product: HttpTypes.StoreProduct) =>
  (meta(product).lead_time as string | null | undefined) ?? null

export const getSpecs = (product: HttpTypes.StoreProduct) =>
  Object.entries((meta(product).specs as Record<string, string> | undefined) ?? {})

export const getTiers = (variant?: HttpTypes.StoreProductVariant | null): PriceTier[] => {
  const tiers = (variant?.metadata as Record<string, unknown> | null | undefined)?.price_tiers

  return Array.isArray(tiers) ? (tiers as PriceTier[]) : []
}

export const getProductTiers = (product: HttpTypes.StoreProduct) =>
  getTiers(product.variants?.[0])

export const getTierForQuantity = (tiers: PriceTier[], quantity: number) =>
  [...tiers].reverse().find((tier) => quantity >= tier.min_quantity) ?? tiers[0]

export const getAvailability = (variant?: HttpTypes.StoreProductVariant | null) => {
  if (!variant) {
    return { inStock: false, quantity: 0 }
  }

  if (!variant.manage_inventory || variant.allow_backorder) {
    return { inStock: true, quantity: Infinity }
  }

  const quantity = variant.inventory_quantity ?? 0

  return { inStock: quantity > 0, quantity }
}

export const isProductInStock = (product: HttpTypes.StoreProduct) =>
  (product.variants ?? []).some((variant) => getAvailability(variant).inStock)

export const hasTag = (product: HttpTypes.StoreProduct, value: string) =>
  (product.tags ?? []).some((tag) => tag.value === value)

const UNIT_PLURALS: Record<string, string> = {
  pcs: "pcs",
  "m²": "m²",
  box: "boxes",
  pair: "pairs",
}

export const pluralUnit = (unit: string, quantity = 2) =>
  quantity === 1 ? unit : UNIT_PLURALS[unit] ?? `${unit}s`
