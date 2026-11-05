import { retrieveMyCompany } from "@lib/data/companies"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { eyebrow } from "./format"

const COPY: Record<string, { title: string; text: string; tone: string }> = {
  pending: {
    title: "Your trade account is pending approval",
    text: "Our trade desk is checking your company details. Trade prices and invoice terms switch on as soon as you are approved, usually within one working day.",
    tone: "border-brand/30 bg-brand/5",
  },
  rejected: {
    title: "Your trade account application was not approved",
    text: "You can still order at list prices. Call our trade desk if you think this is a mistake.",
    tone: "border-rose-200 bg-rose-50",
  },
  blocked: {
    title: "Your trade account is on hold",
    text: "Trade pricing and invoice terms are paused. Contact our trade desk to resolve it.",
    tone: "border-rose-200 bg-rose-50",
  },
}

export default async function CompanyStatusBanner({ showLink = true }: { showLink?: boolean }) {
  const data = await retrieveMyCompany()
  const copy = data ? COPY[data.company.status] : null

  if (!data || !copy) {
    return null
  }

  return (
    <div className={`mb-8 rounded-large border p-5 ${copy.tone}`} data-testid="company-status-banner">
      <p className={eyebrow}>{data.company.name}</p>
      <p className="mt-1 font-display text-lg font-bold text-ink">{copy.title}</p>
      <p className="mt-1 text-sm text-ink-600">{copy.text}</p>
      {showLink && (
        <LocalizedClientLink href="/account/company" className="mt-3 inline-block text-sm font-semibold text-ink underline">
          View company account
        </LocalizedClientLink>
      )}
    </div>
  )
}
