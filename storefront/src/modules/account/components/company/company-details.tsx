import { Company } from "@lib/data/companies"
import { card, COMPANY_STATUS_LABELS, eyebrow, formatMoney, RESET_LABELS } from "./format"

const statusTone: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending: "bg-brand/10 text-brand ring-brand/30",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  blocked: "bg-rose-50 text-rose-700 ring-rose-200",
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-y-1">
    <dt className="text-xs uppercase tracking-wide text-ink-600">{label}</dt>
    <dd className="text-sm font-semibold text-ink">{value}</dd>
  </div>
)

const CompanyDetails = ({ company }: { company: Company }) => {
  const address = company.address
    ? [company.address.address_1, `${company.address.postal_code} ${company.address.city}`, company.address.country_code?.toUpperCase()]
        .filter(Boolean)
        .join(", ")
    : "-"

  return (
    <div className="grid grid-cols-1 gap-4 small:grid-cols-2">
      <section className={card} data-testid="company-details">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={eyebrow}>Company</p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink">{company.name}</h2>
          </div>
          <span className={`rounded-circle px-3 py-1 text-xs font-semibold ring-1 ${statusTone[company.status] ?? ""}`}>
            {COMPANY_STATUS_LABELS[company.status] ?? company.status}
          </span>
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-4 small:grid-cols-2">
          <Row label="NIP" value={company.tax_id ?? "-"} />
          <Row label="Phone" value={company.phone ?? "-"} />
          <Row label="Email" value={company.email ?? "-"} />
          <Row label="Address" value={address} />
        </dl>
      </section>
      <section className={card} data-testid="company-terms">
        <p className={eyebrow}>Terms</p>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">Payment and limits</h2>
        <dl className="mt-5 grid grid-cols-1 gap-4 small:grid-cols-2">
          <Row
            label="Payment terms"
            value={company.payment_terms_days > 0 ? `Invoice, ${company.payment_terms_days} days` : "Prepayment"}
          />
          <Row label="Credit limit" value={formatMoney(company.credit_limit, company.currency_code)} />
          <Row label="Order approval above" value={formatMoney(company.approval_threshold, company.currency_code)} />
          <Row label="Spending limits" value={RESET_LABELS[company.spending_limit_reset] ?? company.spending_limit_reset} />
        </dl>
      </section>
    </div>
  )
}

export default CompanyDetails
