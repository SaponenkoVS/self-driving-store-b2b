import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ArrowRightIcon, CheckIcon } from "@modules/common/icons/trade-icons"
import { HOME_IMAGES, HOUSE_BRANDS } from "@modules/home/content"

const PERKS = [
  "Account pricing and saved order lists",
  "Net 30 invoicing after approval",
  "Multiple delivery sites and site contacts",
  "Order history, invoices and delivery notes",
]

export default function TradeAccountCta() {
  return (
    <>
      <section className="content-container py-16 small:py-24">
        <div className="grid overflow-hidden rounded-large bg-concrete-50 ring-1 ring-concrete-200 small:grid-cols-2">
          <div className="p-8 small:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              Trade account
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink small:text-4xl">
              Built for crews who buy every week
            </h2>
            <p className="mt-4 max-w-md text-ink-600">
              Register your company in two minutes. Your account manager confirms credit terms
              within one working day.
            </p>
            <ul className="mt-6 space-y-3">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-center gap-x-3 text-sm text-ink-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-circle bg-brand text-white">
                    <CheckIcon size={12} strokeWidth={3} />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <LocalizedClientLink
                href="/account"
                className="inline-flex items-center gap-x-2 rounded-rounded bg-ink px-6 py-3.5 text-sm font-semibold text-white hover:bg-ink-700 transition-colors"
              >
                Open a trade account
                <ArrowRightIcon size={16} />
              </LocalizedClientLink>
              <LocalizedClientLink
                href="/collections/pallet-deals"
                className="inline-flex items-center rounded-rounded border border-concrete-200 bg-white px-6 py-3.5 text-sm font-semibold text-ink hover:border-ink/30 transition-colors"
              >
                See pallet deals
              </LocalizedClientLink>
            </div>
          </div>
          <div className="relative min-h-[280px]">
            {HOME_IMAGES.trade && (
              <Image
                src={HOME_IMAGES.trade}
                alt="Pallets of building materials ready for dispatch"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                quality={65}
                className="object-cover"
              />
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-concrete-200 py-10">
        <div className="content-container">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink-600">
            Stocked brands
          </p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {HOUSE_BRANDS.map((brand) => (
              <li
                key={brand}
                className="font-display text-lg font-extrabold uppercase tracking-tight text-ink/35"
              >
                {brand}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
