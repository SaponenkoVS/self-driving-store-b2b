import { HttpTypes } from "@medusajs/types"

import { getSpecs, getUnit } from "@lib/util/b2b"
import {
  PalletIcon,
  ReceiptIcon,
  ShieldIcon,
  TruckIcon,
} from "@modules/common/icons/trade-icons"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const COUNTRY_NAMES: Record<string, string> = {
  pl: "Poland",
  de: "Germany",
  se: "Sweden",
  lt: "Lithuania",
  it: "Italy",
  pt: "Portugal",
}

const SERVICES = [
  {
    icon: TruckIcon,
    title: "Delivery",
    text: "Next working day on stock items within 150 km of Warszawa. Timed AM/PM slots available.",
  },
  {
    icon: PalletIcon,
    title: "Pallets & bulk bags",
    text: "Returnable pallets carry a deposit, refunded in full when collected on your next delivery.",
  },
  {
    icon: ReceiptIcon,
    title: "Invoicing",
    text: "VAT invoice with your PO reference. Net 30 terms for approved trade accounts.",
  },
  {
    icon: ShieldIcon,
    title: "Returns",
    text: "Unopened stock items can be returned within 30 days. Made-to-order items are non-returnable.",
  },
]

const ProductTabs = ({ product }: ProductTabsProps) => {
  const specs = getSpecs(product)
  const rows: [string, string][] = [
    ...specs,
    ["Sold per", getUnit(product)],
    ...(product.origin_country
      ? [["Country of origin", COUNTRY_NAMES[product.origin_country.toLowerCase()] ?? product.origin_country.toUpperCase()] as [string, string]]
      : []),
    ...(product.weight ? [["Weight per unit", `${(product.weight / 1000).toLocaleString("en-US")} kg`] as [string, string]] : []),
  ]

  return (
    <div className="grid gap-10 small:grid-cols-12">
      <div className="small:col-span-5">
        <h2 className="font-display text-2xl font-bold text-ink">Product overview</h2>
        <p
          className="mt-4 whitespace-pre-line text-base leading-relaxed text-ink-700"
          data-testid="product-description"
        >
          {product.description}
        </p>
        <ul className="mt-8 grid grid-cols-1 gap-4 xsmall:grid-cols-2">
          {SERVICES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-large border border-concrete-200 p-4">
              <Icon size={20} className="text-brand" />
              <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">{text}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="small:col-span-7">
        <h2 className="font-display text-2xl font-bold text-ink">Technical specifications</h2>
        <dl className="mt-4 overflow-hidden rounded-large border border-concrete-200">
          {rows.map(([label, value], index) => (
            <div
              key={label}
              className={`grid grid-cols-5 gap-4 px-5 py-3.5 text-sm ${
                index % 2 === 0 ? "bg-concrete-50" : "bg-white"
              }`}
            >
              <dt className="col-span-2 text-ink-600">{label}</dt>
              <dd className="col-span-3 font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

export default ProductTabs
