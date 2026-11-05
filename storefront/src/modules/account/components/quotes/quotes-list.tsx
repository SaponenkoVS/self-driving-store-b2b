import { Quote } from "@lib/data/quotes"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { card, formatDate, formatMoney } from "../company/format"
import QuoteStatusBadge from "./quote-status-badge"

const QuotesList = ({ quotes }: { quotes: Quote[] }) => {
  if (!quotes.length) {
    return (
      <div className={card} data-testid="quotes-empty">
        <p className="font-display text-lg font-bold text-ink">No quotes yet</p>
        <p className="mt-1 text-sm text-ink-600">
          Fill a cart with what your project needs and choose Request a quote. Our trade desk replies
          with project pricing, usually the same working day.
        </p>
        <LocalizedClientLink href="/store" className="mt-4 inline-block text-sm font-semibold text-ink underline">
          Browse products
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="quotes-list">
      {quotes.map((quote) => (
        <li key={quote.id}>
          <LocalizedClientLink
            href={`/account/quotes/${quote.id}`}
            className="flex flex-col gap-3 rounded-large border border-concrete-200 bg-white p-5 transition-colors hover:border-ink/30 small:flex-row small:items-center small:justify-between"
          >
            <div>
              <p className="font-display text-base font-bold text-ink">Quote #{quote.display_id}</p>
              <p className="text-xs text-ink-600">
                Requested {formatDate(quote.created_at)}
                {quote.draft_order?.items ? ` - ${quote.draft_order.items.length} lines` : ""}
                {quote.company?.name ? ` - ${quote.company.name}` : ""}
                {quote.valid_until && quote.status === "pending_customer"
                  ? ` - valid until ${formatDate(quote.valid_until)}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {quote.draft_order && (
                <span className="text-sm font-semibold text-ink">
                  {formatMoney(quote.draft_order.total, quote.draft_order.currency_code)}
                </span>
              )}
              <QuoteStatusBadge status={quote.status} />
            </div>
          </LocalizedClientLink>
        </li>
      ))}
    </ul>
  )
}

export default QuotesList
