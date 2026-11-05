"use client"

import { useState, useTransition } from "react"
import { acceptQuote, rejectQuote } from "@lib/data/quotes"
import { fieldClass, primaryButton, secondaryButton } from "../company/format"

const QuoteActions = ({ quoteId }: { quoteId: string }) => {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")

  const accept = () =>
    startTransition(async () => {
      const result = await acceptQuote(quoteId)
      setError(result.error)
    })

  const reject = () =>
    startTransition(async () => {
      const result = await rejectQuote(quoteId, reason)
      setError(result.error)
      if (result.success) {
        setRejecting(false)
      }
    })

  return (
    <div className="flex flex-col gap-3" data-testid="quote-actions">
      {rejecting ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Tell us why (optional), for example price or delivery date"
            rows={3}
            className={fieldClass}
          />
          <div className="flex gap-2">
            <button type="button" className={secondaryButton} onClick={() => setRejecting(false)} disabled={pending}>
              Back
            </button>
            <button type="button" className={primaryButton} onClick={reject} disabled={pending}>
              Decline offer
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButton} onClick={accept} disabled={pending} data-testid="accept-quote">
            {pending ? "Placing order..." : "Accept and place order"}
          </button>
          <button type="button" className={secondaryButton} onClick={() => setRejecting(true)} disabled={pending} data-testid="reject-quote">
            Decline
          </button>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  )
}

export default QuoteActions
