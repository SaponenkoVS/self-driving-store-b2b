import { STORE_INFO } from "@lib/util/b2b"
import {
  FactoryIcon,
  HeadsetIcon,
  PhoneIcon,
  TruckIcon,
} from "@modules/common/icons/trade-icons"
import { SectionHeading } from "@modules/home/components/category-grid"

const STEPS = [
  {
    icon: HeadsetIcon,
    title: "Call the order desk",
    text: "Our AI order assistant picks up 24/7, recognises your account and takes the order line by line, then reads it back.",
  },
  {
    icon: FactoryIcon,
    title: "Stock and production check",
    text: "Items on the shelf are reserved for you. Anything out of stock goes straight to our production partners for a firm date.",
  },
  {
    icon: PhoneIcon,
    title: "Confirmed callback",
    text: "We call you back with price and dates. Choose one complete delivery, or two: stock items now and the rest when ready.",
  },
  {
    icon: TruckIcon,
    title: "Delivered to site",
    text: "Crane truck drop-off with live ETA by SMS. Invoice and delivery note land in your trade account.",
  },
]

export default function PhoneOrdering() {
  return (
    <section className="bg-ink py-16 small:py-24">
      <div className="content-container">
        <SectionHeading
          eyebrow="How phone ordering works"
          title="Order like you always have. We handle the rest."
          inverted
        />
        <ol className="mt-12 grid grid-cols-1 gap-6 xsmall:grid-cols-2 medium:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              className="relative rounded-large border border-white/10 bg-ink-800 p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-rounded bg-brand text-white">
                  <Icon size={24} />
                </span>
                <span className="font-display text-4xl font-extrabold text-white/10">
                  0{index + 1}
                </span>
              </div>
              <p className="mt-6 font-display text-lg font-bold text-white">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-col items-start gap-4 rounded-large border border-brand/30 bg-brand/10 p-6 small:flex-row small:items-center small:justify-between">
          <div>
            <p className="font-display text-lg font-bold text-white">
              Prefer to talk it through? The line is always open.
            </p>
            <p className="mt-1 text-sm text-white/65">
              Orders that need a special price are passed to our trade manager the same day.
            </p>
          </div>
          <a
            href={STORE_INFO.phoneHref}
            className="inline-flex shrink-0 items-center gap-x-2 rounded-rounded bg-brand px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
          >
            <PhoneIcon size={16} />
            Call {STORE_INFO.phone}
          </a>
        </div>
      </div>
    </section>
  )
}
