import Image from "next/image"

import { STORE_INFO } from "@lib/util/b2b"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  ArrowRightIcon,
  CheckIcon,
  HeadsetIcon,
  PhoneIcon,
} from "@modules/common/icons/trade-icons"
import { HOME_IMAGES } from "@modules/home/content"

const STATS = [
  { value: "24 h", label: "Delivery to site" },
  { value: "−12%", label: "Volume pricing" },
  { value: "Net 30", label: "Invoice terms" },
  { value: "24/7", label: "Phone orders" },
]

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink">
      {HOME_IMAGES.hero && (
        <Image
          src={HOME_IMAGES.hero}
          alt="Construction site supplied by STRATA"
          fill
          priority
          sizes="100vw"
          quality={70}
          className="-z-10 object-cover"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/85 to-ink/30" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-ink to-transparent" />

      <div className="content-container grid gap-12 pb-14 pt-16 small:grid-cols-12 small:pb-20 small:pt-24">
        <div className="small:col-span-7">
          <span className="inline-flex items-center gap-x-2 rounded-circle border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-circle bg-brand" />
            Trade supplier for contractors & developers
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white xsmall:text-5xl medium:text-6xl">
            Building materials at trade prices,{" "}
            <span className="text-brand">delivered to site.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 small:text-lg">
            Cement, blocks, insulation, drywall, timber and fixings from one stocked depot.
            Volume pricing applies automatically in your cart, and our crane trucks drop
            pallets where you need them.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LocalizedClientLink
              href="/store"
              className="inline-flex items-center gap-x-2 rounded-rounded bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark transition-colors"
            >
              Browse the catalogue
              <ArrowRightIcon size={16} />
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/account"
              className="inline-flex items-center gap-x-2 rounded-rounded border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/10 transition-colors"
            >
              Open a trade account
            </LocalizedClientLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
            {["CE-marked products", "Pallet & bulk-bag pricing", "Crane offload"].map((item) => (
              <li key={item} className="flex items-center gap-x-2">
                <CheckIcon size={16} className="text-brand" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="small:col-span-5 small:flex small:items-end small:justify-end">
          <div className="w-full max-w-sm rounded-large border border-white/10 bg-white/95 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-x-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-rounded bg-brand-light text-brand-dark">
                <HeadsetIcon size={22} />
              </span>
              <div>
                <p className="font-display text-base font-bold text-ink">Order by phone, any time</p>
                <p className="text-xs text-ink-600">AI order desk · answers in under 3 rings</p>
              </div>
            </div>
            <ol className="mt-5 space-y-3 text-sm text-ink-700">
              {[
                "Tell us what you need and where to deliver",
                "We check stock and production lead times",
                "We call back with a confirmed price and date",
              ].map((step, index) => (
                <li key={step} className="flex gap-x-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-circle bg-ink text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <a
              href={STORE_INFO.phoneHref}
              className="mt-6 flex items-center justify-center gap-x-2 rounded-rounded bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-ink-700 transition-colors"
            >
              <PhoneIcon size={16} />
              {STORE_INFO.phone}
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-ink/60 backdrop-blur">
        <dl className="content-container grid grid-cols-2 small:grid-cols-4">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`py-6 ${index > 0 ? "small:border-l small:border-white/10 small:pl-8" : ""}`}
            >
              <dt className="text-xs uppercase tracking-[0.16em] text-white/50">{stat.label}</dt>
              <dd className="mt-1 font-display text-2xl font-bold text-white">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
