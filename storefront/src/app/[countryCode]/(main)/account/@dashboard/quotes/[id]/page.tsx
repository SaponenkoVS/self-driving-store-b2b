import { Metadata } from "next"
import { notFound } from "next/navigation"
import { retrieveQuote } from "@lib/data/quotes"
import QuoteDetail from "@modules/account/components/quotes/quote-detail"

type Props = {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Quote",
  description: "Quote details and messages.",
}

export default async function QuoteDetailPage(props: Props) {
  const { id } = await props.params
  const quote = await retrieveQuote(id)

  if (!quote) {
    notFound()
  }

  return <QuoteDetail quote={quote} />
}
