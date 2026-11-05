import { Metadata } from "next"
import { listQuotes } from "@lib/data/quotes"
import { eyebrow } from "@modules/account/components/company/format"
import QuotesList from "@modules/account/components/quotes/quotes-list"

export const metadata: Metadata = {
  title: "Quotes",
  description: "Your quote requests and offers.",
}

export default async function QuotesPage() {
  const quotes = await listQuotes()

  return (
    <div className="flex w-full flex-col gap-6" data-testid="quotes-page-wrapper">
      <div>
        <p className={eyebrow}>Project pricing</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Quotes</h1>
        <p className="mt-1 text-sm text-ink-600">
          Requests you sent from the cart and the offers from our trade desk.
        </p>
      </div>
      <QuotesList quotes={quotes} />
    </div>
  )
}
