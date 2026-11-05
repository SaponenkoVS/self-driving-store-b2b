"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import { CartApproval, getCartB2BContext } from "@lib/data/companies"
import { requestQuoteFromCart } from "@lib/data/quotes"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ApprovalNotice from "./approval-notice"

const BLOCKED = ["required", "pending", "rejected"]

const CartB2BActions = ({ cart, checkoutHref }: { cart: HttpTypes.StoreCart; checkoutHref: string }) => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }
  const [loggedIn, setLoggedIn] = useState(false)
  const [approval, setApproval] = useState<CartApproval | null>(null)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [postcode, setPostcode] = useState(cart.shipping_address?.postal_code ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const load = useCallback(() => {
    getCartB2BContext(cart.id)
      .then((context) => {
        setLoggedIn(context.logged_in)
        setApproval(context.approval)
      })
      .catch(() => null)
  }, [cart.id])

  useEffect(() => {
    load()
  }, [load, cart.total])

  const blocked = !!approval && BLOCKED.includes(approval.status)

  const submitQuote = () =>
    startTransition(async () => {
      const result = await requestQuoteFromCart(cart.id, note, postcode)
      setError(result.error)
      if (result.success && result.quote_id) {
        router.push(`/${countryCode}/account/quotes/${result.quote_id}`)
      }
    })

  return (
    <div className="flex flex-col gap-y-4">
      {approval && <ApprovalNotice approval={approval} onChanged={load} />}
      {blocked ? (
        <Button className="w-full h-10" disabled data-testid="checkout-button">
          Approval required
        </Button>
      ) : (
        <LocalizedClientLink href={checkoutHref} data-testid="checkout-button">
          <Button className="w-full h-10">Go to checkout</Button>
        </LocalizedClientLink>
      )}
      <div className="rounded-large border border-concrete-200 p-4" data-testid="request-quote">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Large or project order?</p>
        <p className="mt-1 text-sm text-ink-600">
          Send this cart to our trade desk for project pricing and a delivery date.
        </p>
        {!loggedIn ? (
          <LocalizedClientLink href="/account" className="mt-3 inline-block text-sm font-semibold text-ink underline">
            Sign in to request a quote
          </LocalizedClientLink>
        ) : open ? (
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Project details, delivery window, substitutes allowed"
              className="w-full rounded-rounded border border-concrete-200 bg-white px-3 py-2 text-sm text-ink"
              data-testid="quote-note-input"
            />
            <input
              value={postcode}
              onChange={(event) => setPostcode(event.target.value)}
              placeholder="Delivery postcode"
              className="w-full rounded-rounded border border-concrete-200 bg-white px-3 py-2 text-sm text-ink"
              data-testid="quote-postcode-input"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="flex-1 rounded-rounded border border-concrete-200 px-4 py-2.5 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitQuote}
                disabled={pending}
                className="flex-1 rounded-rounded bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                data-testid="submit-quote-button"
              >
                {pending ? "Sending..." : "Send request"}
              </button>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 w-full rounded-rounded border border-ink px-4 py-2.5 text-sm font-semibold text-ink hover:bg-ink hover:text-white"
            data-testid="request-quote-button"
          >
            Request a quote
          </button>
        )}
      </div>
    </div>
  )
}

export default CartB2BActions
