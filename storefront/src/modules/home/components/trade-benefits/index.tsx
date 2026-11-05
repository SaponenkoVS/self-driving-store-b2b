import {
  CraneIcon,
  LayersIcon,
  ReceiptIcon,
  ShieldIcon,
} from "@modules/common/icons/trade-icons"

const BENEFITS = [
  {
    icon: LayersIcon,
    title: "Volume pricing, automatically",
    text: "Tier prices kick in by quantity in your cart. Pallets and bulk bags get the best rate.",
  },
  {
    icon: CraneIcon,
    title: "Crane offload to site",
    text: "Own HDS fleet across central Poland. Next-day on stock items, timed slots on request.",
  },
  {
    icon: ReceiptIcon,
    title: "Invoice on account",
    text: "Net 30 terms, VAT invoices with your PO number, and one monthly statement.",
  },
  {
    icon: ShieldIcon,
    title: "Certified materials",
    text: "CE-marked products with declarations of performance and datasheets for every SKU.",
  },
]

export default function TradeBenefits() {
  return (
    <section className="border-b border-concrete-200 bg-concrete-50">
      <ul className="content-container grid grid-cols-1 gap-px xsmall:grid-cols-2 medium:grid-cols-4">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-x-4 py-8 medium:px-6 medium:first:pl-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-rounded bg-white text-brand shadow-sm ring-1 ring-concrete-200">
              <Icon size={22} />
            </span>
            <div>
              <p className="font-display text-[15px] font-bold text-ink">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
