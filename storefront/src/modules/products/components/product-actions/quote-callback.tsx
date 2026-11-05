"use client"

import { requestCallback } from "@lib/data/call-requests"
import { STORE_INFO } from "@lib/util/b2b"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import { CheckIcon, MailIcon, PhoneIcon } from "@modules/common/icons/trade-icons"
import { useState } from "react"

type QuoteCallbackProps = {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  quantity: number
}

export default function QuoteCallback({ product, variant, quantity }: QuoteCallbackProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState<string | null>(null)

  const onRequest = async () => {
    setStatus("sending")
    setError(null)

    const result = await requestCallback({
      product_id: product.id,
      variant_id: variant?.id,
      quantity,
    })

    if (result.ok) {
      setStatus("sent")
    } else {
      setStatus("idle")
      setError(result.message)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onRequest}
          disabled={status !== "idle"}
          className={clx(
            "flex h-11 items-center justify-center gap-x-2 rounded-rounded border text-sm font-semibold transition-colors disabled:opacity-60",
            status === "sent" ? "border-ink bg-ink text-white" : "border-concrete-200 text-ink hover:border-ink/40"
          )}
        >
          <MailIcon size={16} />
          {status === "sending" ? "Connecting..." : "Request a quote"}
        </button>
        <a
          href={STORE_INFO.phoneHref}
          className="flex h-11 items-center justify-center gap-x-2 rounded-rounded border border-concrete-200 text-sm font-semibold text-ink hover:border-ink/40 transition-colors"
        >
          <PhoneIcon size={16} />
          Order by phone
        </a>
      </div>

      {status === "sent" && (
        <div className="flex items-start gap-x-3 rounded-large border border-concrete-200 bg-concrete-50 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-circle bg-emerald-500 text-white">
            <CheckIcon size={16} />
          </span>
          <div>
            <p className="font-display text-base font-bold text-ink">We are calling you now</p>
            <p className="mt-1 text-sm text-ink-600">
              Our order assistant will ring you in a few seconds about {product.title}
              {quantity > 1 ? ` (${quantity})` : ""}.
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  )
}
