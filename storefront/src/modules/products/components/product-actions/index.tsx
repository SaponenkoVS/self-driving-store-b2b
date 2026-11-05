"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import {
  STORE_INFO,
  getAvailability,
  getLeadTime,
  getTierForQuantity,
  getTiers,
  getUnit,
  pluralUnit,
} from "@lib/util/b2b"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import {
  CartIcon,
  CheckIcon,
  ClockIcon,
  TruckIcon,
} from "@modules/common/icons/trade-icons"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import MobileActions from "./mobile-actions"
import QuoteCallback from "./quote-callback"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (variantOptions: HttpTypes.StoreProductVariant["options"]) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

export default function ProductActions({ product, region, disabled }: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const countryCode = useParams().countryCode as string

  useEffect(() => {
    const preselected =
      product.variants?.find((variant) => variant.id === searchParams.get("v_id")) ??
      (product.variants?.length === 1 ? product.variants[0] : undefined)

    if (preselected) {
      setOptions(optionsAsKeymap(preselected.options) ?? {})
    }
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    return product.variants?.find((variant) =>
      isEqual(optionsAsKeymap(variant.options), options)
    )
  }, [product.variants, options])

  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({ ...prev, [optionId]: value }))
  }

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = selectedVariant?.id ?? null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString(), { scroll: false })
  }, [selectedVariant])

  const unit = getUnit(product)
  const leadTime = getLeadTime(product)
  const currency = region.currency_code
  const tiers = getTiers(selectedVariant ?? product.variants?.[0])
  const activeTier = tiers.length ? getTierForQuantity(tiers, quantity) : null
  const basePrice = selectedVariant?.calculated_price?.calculated_amount ?? tiers[0]?.amount
  const unitPrice = activeTier?.amount ?? basePrice ?? 0
  const { inStock, quantity: available } = getAvailability(selectedVariant)
  const exceedsStock = Number.isFinite(available) && quantity > available

  const format = (amount: number) => convertToLocale({ amount, currency_code: currency })

  const actionsRef = useRef<HTMLDivElement>(null)
  const inView = useIntersection(actionsRef, "0px")

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) {
      return
    }

    setIsAdding(true)
    setError(null)

    try {
      await addToCart({ variantId: selectedVariant.id, quantity, countryCode })
      setAdded(true)
      setTimeout(() => setAdded(false), 2500)
    } catch (e: any) {
      setError(e?.message ?? "Could not add to cart")
    } finally {
      setIsAdding(false)
    }
  }

  const changeQuantity = (value: number) => {
    setQuantity(Math.max(1, Math.min(99999, Math.floor(value) || 1)))
  }

  const canAdd = !!selectedVariant && inStock && !exceedsStock && !disabled && !isAdding

  return (
    <div className="flex flex-col gap-y-6" ref={actionsRef}>
      <div className="rounded-large border border-concrete-200 bg-white p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-600">
              {selectedVariant ? "Your price" : "Price from"}
              {activeTier && activeTier.min_quantity > 1 && (
                <span className="ml-2 rounded-base bg-brand-light px-1.5 py-0.5 font-semibold text-brand-dark">
                  Volume tier
                </span>
              )}
            </p>
            <p className="mt-1 flex items-baseline gap-x-2">
              <span
                className="font-display text-4xl font-extrabold tracking-tight text-ink"
                data-testid="product-price"
                data-value={unitPrice}
              >
                {format(unitPrice)}
              </span>
              <span className="text-sm text-ink-600">/ {unit}</span>
            </p>
            <p className="mt-1 text-xs text-ink-600">
              excl. VAT · trade price, applied automatically in cart
            </p>
          </div>
          {quantity > 1 && (
            <div className="text-right">
              <p className="text-xs text-ink-600">
                {quantity} × {format(unitPrice)}
              </p>
              <p className="font-display text-lg font-bold text-ink">{format(unitPrice * quantity)}</p>
            </div>
          )}
        </div>

        {tiers.length > 1 && (
          <div className="mt-5 overflow-hidden rounded-rounded border border-concrete-200">
            <table className="w-full text-sm">
              <thead className="bg-concrete-50 text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Quantity</th>
                  <th className="px-3 py-2 text-right font-semibold">Price / {unit}</th>
                  <th className="px-3 py-2 text-right font-semibold">Saving</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => {
                  const isActive = tier === activeTier
                  const saving = tiers[0].amount
                    ? Math.round((1 - tier.amount / tiers[0].amount) * 100)
                    : 0

                  return (
                    <tr
                      key={tier.min_quantity}
                      onClick={() => changeQuantity(tier.min_quantity)}
                      className={clx(
                        "cursor-pointer border-t border-concrete-100 transition-colors",
                        isActive ? "bg-ink text-white" : "hover:bg-concrete-50"
                      )}
                    >
                      <td className="px-3 py-2.5 font-medium">
                        {tier.max_quantity
                          ? `${tier.min_quantity}–${tier.max_quantity}`
                          : `${tier.min_quantity}+`}{" "}
                        {pluralUnit(unit)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">{format(tier.amount)}</td>
                      <td
                        className={clx(
                          "px-3 py-2.5 text-right text-xs font-semibold",
                          isActive ? "text-brand" : "text-brand-dark"
                        )}
                      >
                        {saving > 0 ? `−${saving}%` : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(product.variants?.length ?? 0) > 1 && (
        <div className="flex flex-col gap-y-5">
          {(product.options || []).map((option) => (
            <OptionSelect
              key={option.id}
              option={option}
              current={options[option.id]}
              updateOption={setOptionValue}
              title={option.title ?? ""}
              data-testid="product-options"
              disabled={!!disabled || isAdding}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-y-3">
        <div className="flex items-center justify-between text-sm">
          {selectedVariant ? (
            inStock ? (
              <span className="flex items-center gap-x-2 font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-circle bg-emerald-500" />
                {Number.isFinite(available)
                  ? `${available.toLocaleString("en-US")} ${pluralUnit(unit, available)} in stock`
                  : "In stock"}
              </span>
            ) : (
              <span className="flex items-center gap-x-2 font-medium text-amber-700">
                <span className="h-2 w-2 rounded-circle bg-amber-500" />
                {leadTime ?? "Out of stock, call for availability"}
              </span>
            )
          ) : (
            <span className="text-ink-600">Select options to see stock</span>
          )}
          {selectedVariant?.sku && (
            <span className="text-xs text-ink-600">SKU {selectedVariant.sku}</span>
          )}
        </div>

        <div className="flex gap-3">
          <div className="flex h-12 items-center rounded-rounded border border-concrete-200 bg-white">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => changeQuantity(quantity - 1)}
              className="h-full w-11 text-lg text-ink-600 hover:text-ink"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => changeQuantity(Number(event.target.value))}
              aria-label="Quantity"
              className="h-full w-16 border-x border-concrete-200 text-center text-sm font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => changeQuantity(quantity + 1)}
              className="h-full w-11 text-lg text-ink-600 hover:text-ink"
            >
              +
            </button>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!canAdd}
            className={clx(
              "flex h-12 flex-1 items-center justify-center gap-x-2 rounded-rounded text-sm font-semibold transition-colors",
              canAdd
                ? "bg-brand text-white hover:bg-brand-dark"
                : "cursor-not-allowed bg-concrete-100 text-ink-600"
            )}
            data-testid="add-product-button"
          >
            {added ? <CheckIcon size={18} /> : <CartIcon size={18} />}
            {isAdding
              ? "Adding..."
              : added
              ? "Added to cart"
              : !selectedVariant
              ? "Select options"
              : !inStock
              ? "Out of stock"
              : exceedsStock
              ? "Exceeds available stock"
              : "Add to cart"}
          </button>
        </div>

        {tiers.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {tiers.slice(1).map((tier) => (
              <button
                key={tier.min_quantity}
                type="button"
                onClick={() => changeQuantity(tier.min_quantity)}
                className="rounded-circle border border-concrete-200 px-3 py-1 text-xs font-medium text-ink-700 hover:border-ink/40"
              >
                Order {tier.min_quantity} for {format(tier.amount)} / {unit}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <QuoteCallback product={product} variant={selectedVariant} quantity={quantity} />
      </div>

      <ul className="divide-y divide-concrete-100 rounded-large bg-concrete-50 px-5 text-sm">
        <li className="flex gap-x-3 py-3.5">
          <TruckIcon size={20} className="shrink-0 text-brand" />
          <span>
            <span className="font-semibold text-ink">Next-day delivery to site</span>
            <span className="block text-xs text-ink-600">
              Order by 14:00. Crane offload for pallets and bulk bags.
            </span>
          </span>
        </li>
        <li className="flex gap-x-3 py-3.5">
          <ClockIcon size={20} className="shrink-0 text-brand" />
          <span>
            <span className="font-semibold text-ink">Click & collect in 2 hours</span>
            <span className="block text-xs text-ink-600">Warszawa depot, {STORE_INFO.hours}</span>
          </span>
        </li>
      </ul>

      <MobileActions
        product={product}
        variant={selectedVariant}
        options={options}
        updateOptions={setOptionValue}
        inStock={inStock}
        handleAddToCart={handleAddToCart}
        isAdding={isAdding}
        show={!inView}
        optionsDisabled={!!disabled || isAdding}
      />
    </div>
  )
}
