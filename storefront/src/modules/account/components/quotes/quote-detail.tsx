import { Quote } from "@lib/data/quotes"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { card, eyebrow, formatDate, formatMoney } from "../company/format"
import QuoteActions from "./quote-actions"
import QuoteMessages from "./quote-messages"
import QuoteStatusBadge from "./quote-status-badge"

const STATUS_COPY: Record<string, string> = {
  pending_merchant: "Our trade desk is pricing your request. You will get an offer here and by phone or email.",
  pending_customer: "Your offer is ready. Accept it to place the order on your account terms.",
  accepted: "You accepted this offer and the order has been placed.",
  customer_rejected: "You declined this offer.",
  merchant_rejected: "We could not offer these items. See the messages below for details.",
  expired: "This offer has expired. Request a new quote from your cart.",
}

const QuoteDetail = ({ quote }: { quote: Quote }) => {
  const order = quote.draft_order
  const currency = order?.currency_code ?? "eur"
  const expired =
    quote.status === "pending_customer" && quote.valid_until && new Date(quote.valid_until).getTime() < Date.now()

  return (
    <div className="flex w-full flex-col gap-6" data-testid="quote-detail">
      <div className="flex flex-col gap-2 small:flex-row small:items-end small:justify-between">
        <div>
          <LocalizedClientLink href="/account/quotes" className="text-sm text-ink-600 hover:text-ink">
            All quotes
          </LocalizedClientLink>
          <p className={`${eyebrow} mt-3`}>Quote</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Quote #{quote.display_id}</h1>
          <p className="mt-1 text-sm text-ink-600">
            Requested {formatDate(quote.created_at)}
            {quote.valid_until ? ` - offer valid until ${formatDate(quote.valid_until)}` : ""}
            {quote.delivery_postcode ? ` - delivery to ${quote.delivery_postcode}` : ""}
          </p>
        </div>
        <QuoteStatusBadge status={quote.status} />
      </div>

      <div className="rounded-large border border-concrete-200 bg-concrete-50 p-5">
        <p className="text-sm text-ink-700">
          {expired ? STATUS_COPY.expired : STATUS_COPY[quote.status]}
        </p>
        {quote.status === "pending_customer" && !expired && (
          <div className="mt-4">
            <QuoteActions quoteId={quote.id} />
          </div>
        )}
        {quote.status === "accepted" && quote.order && (
          <LocalizedClientLink
            href={`/account/orders/details/${quote.order.id}`}
            className="mt-3 inline-block text-sm font-semibold text-ink underline"
          >
            View order #{quote.order.display_id}
          </LocalizedClientLink>
        )}
      </div>

      <section className={card} data-testid="quote-items">
        <p className={eyebrow}>Items</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-600">
                <th className="pb-2 pr-4 font-semibold">Product</th>
                <th className="pb-2 pr-4 text-right font-semibold">Qty</th>
                <th className="pb-2 pr-4 text-right font-semibold">Unit price</th>
                <th className="pb-2 text-right font-semibold">Line total</th>
              </tr>
            </thead>
            <tbody>
              {(order?.items ?? []).map((item) => (
                <tr key={item.id} className="border-t border-concrete-200">
                  <td className="py-3 pr-4">
                    <p className="text-sm font-semibold text-ink">{item.product_title ?? item.title}</p>
                    <p className="text-xs text-ink-600">
                      {[item.variant_title, item.variant_sku].filter(Boolean).join(" - ")}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-right text-sm text-ink">{item.quantity}</td>
                  <td className="py-3 pr-4 text-right text-sm text-ink">{formatMoney(item.unit_price, currency)}</td>
                  <td className="py-3 text-right text-sm font-semibold text-ink">
                    {formatMoney(item.subtotal ?? item.unit_price * item.quantity, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {order && (
          <dl className="ml-auto mt-4 flex max-w-xs flex-col gap-1 text-sm">
            <div className="flex justify-between text-ink-600">
              <dt>Subtotal</dt>
              <dd>{formatMoney(order.item_subtotal ?? order.subtotal ?? 0, currency)}</dd>
            </div>
            {!!order.discount_total && (
              <div className="flex justify-between text-ink-600">
                <dt>Discount</dt>
                <dd>-{formatMoney(order.discount_total, currency)}</dd>
              </div>
            )}
            <div className="flex justify-between text-ink-600">
              <dt>Shipping</dt>
              <dd>{order.shipping_total ? formatMoney(order.shipping_total, currency) : "Quoted separately"}</dd>
            </div>
            <div className="flex justify-between text-ink-600">
              <dt>Tax</dt>
              <dd>{formatMoney(order.tax_total ?? 0, currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-concrete-200 pt-2 font-semibold text-ink">
              <dt>Total</dt>
              <dd>{formatMoney(order.total, currency)}</dd>
            </div>
          </dl>
        )}
      </section>

      <QuoteMessages quoteId={quote.id} messages={quote.messages ?? []} />
    </div>
  )
}

export default QuoteDetail
