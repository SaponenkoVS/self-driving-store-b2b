import { listCategories } from "@lib/data/categories"
import { STORE_INFO } from "@lib/util/b2b"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  ArrowRightIcon,
  ClockIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
} from "@modules/common/icons/trade-icons"
import Logo from "@modules/layout/components/logo"

const TRADE_LINKS = [
  { label: "Open a trade account", href: "/account" },
  { label: "Volume & pallet pricing", href: "/collections/pallet-deals" },
  { label: "Site essentials", href: "/collections/site-essentials" },
  { label: "Energy-efficient build", href: "/collections/energy-efficient" },
  { label: "New lines", href: "/collections/new-lines" },
]

const SERVICE_LINKS = [
  "Delivery & crane offload",
  "Click & collect at depot",
  "Returns & pallet deposits",
  "Technical datasheets",
  "Invoice terms",
]

export default async function Footer() {
  const categories = await listCategories({
    fields: "id,handle,name,rank,parent_category_id",
  }).catch(() => [])

  const topCategories = (categories ?? [])
    .filter((category) => !category.parent_category_id)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))

  return (
    <footer className="bg-ink text-white/70">
      <div className="border-b border-white/10">
        <div className="content-container flex flex-col gap-6 py-10 small:flex-row small:items-center small:justify-between">
          <div>
            <p className="font-display text-2xl font-bold text-white">
              Pricing a full project?
            </p>
            <p className="mt-1 text-sm">
              Send your bill of quantities and get a delivered quote within one working day.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`mailto:${STORE_INFO.email}?subject=Project%20quote`}
              className="inline-flex items-center gap-x-2 rounded-rounded bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
            >
              Request a quote
              <ArrowRightIcon size={16} />
            </a>
            <a
              href={STORE_INFO.phoneHref}
              className="inline-flex items-center gap-x-2 rounded-rounded border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:border-white/50 transition-colors"
            >
              <PhoneIcon size={16} />
              {STORE_INFO.phone}
            </a>
          </div>
        </div>
      </div>

      <div className="content-container grid grid-cols-1 gap-10 py-14 xsmall:grid-cols-2 small:grid-cols-12">
        <div className="small:col-span-4">
          <LocalizedClientLink href="/">
            <Logo inverted />
          </LocalizedClientLink>
          <p className="mt-5 max-w-xs text-sm leading-relaxed">
            Trade supplier of building materials for contractors, developers and installers.
            Stocked depot, own fleet with crane offload, and a phone order desk that never sleeps.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-start gap-x-3">
              <PinIcon size={18} className="mt-0.5 shrink-0 text-brand" />
              <span>
                {STORE_INFO.address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </li>
            <li className="flex items-center gap-x-3">
              <PhoneIcon size={18} className="shrink-0 text-brand" />
              <a href={STORE_INFO.phoneHref} className="hover:text-white">
                {STORE_INFO.phone}
              </a>
            </li>
            <li className="flex items-center gap-x-3">
              <MailIcon size={18} className="shrink-0 text-brand" />
              <a href={`mailto:${STORE_INFO.email}`} className="hover:text-white">
                {STORE_INFO.email}
              </a>
            </li>
            <li className="flex items-center gap-x-3">
              <ClockIcon size={18} className="shrink-0 text-brand" />
              <span>{STORE_INFO.hours}</span>
            </li>
          </ul>
        </div>

        <FooterColumn title="Products" className="small:col-span-3">
          {topCategories.map((category) => (
            <li key={category.id}>
              <LocalizedClientLink
                href={`/categories/${category.handle}`}
                className="hover:text-white transition-colors"
              >
                {category.name}
              </LocalizedClientLink>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Trade" className="small:col-span-2">
          {TRADE_LINKS.map((link) => (
            <li key={link.label}>
              <LocalizedClientLink href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </LocalizedClientLink>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Service" className="small:col-span-3">
          {SERVICE_LINKS.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </FooterColumn>
      </div>

      <div className="border-t border-white/10">
        <div className="content-container flex flex-col gap-4 py-6 text-xs small:flex-row small:items-center small:justify-between">
          <p>
            © {new Date().getFullYear()} STRATA Building Supply Sp. z o.o. · NIP 525-000-00-00 · All
            prices excl. VAT ·{" "}
            <LocalizedClientLink href="/photo-credits" className="underline underline-offset-2 hover:text-white">
              Photo credits
            </LocalizedClientLink>
          </p>
          <ul className="flex flex-wrap gap-2">
            {["CE marked", "FSC timber", "ISO 9001", "Visa", "Mastercard", "Bank transfer"].map(
              (badge) => (
                <li
                  key={badge}
                  className="rounded-base border border-white/15 px-2.5 py-1 text-[11px] font-medium text-white/60"
                >
                  {badge}
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">{title}</p>
      <ul className="mt-5 space-y-3 text-sm">{children}</ul>
    </div>
  )
}
