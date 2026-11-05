import { QuoteStatus } from "@lib/data/quotes"

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: string }> = {
  pending_merchant: { label: "Being priced", tone: "bg-concrete-100 text-ink-700 ring-concrete-200" },
  pending_customer: { label: "Offer ready", tone: "bg-brand/10 text-brand ring-brand/30" },
  accepted: { label: "Accepted", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  customer_rejected: { label: "Declined by you", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  merchant_rejected: { label: "Declined by STRATA", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  expired: { label: "Expired", tone: "bg-concrete-100 text-ink-600 ring-concrete-200" },
}

const QuoteStatusBadge = ({ status }: { status: QuoteStatus }) => {
  const config = QUOTE_STATUS[status] ?? { label: status, tone: "bg-concrete-100 text-ink-700 ring-concrete-200" }

  return (
    <span className={`inline-flex rounded-circle px-3 py-1 text-xs font-semibold ring-1 ${config.tone}`} data-testid="quote-status">
      {config.label}
    </span>
  )
}

export default QuoteStatusBadge
