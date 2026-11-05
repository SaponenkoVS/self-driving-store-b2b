import { Suspense } from "react"

import { listCategories } from "@lib/data/categories"
import { getLocale } from "@lib/data/locale-actions"
import { listLocales } from "@lib/data/locales"
import { listRegions } from "@lib/data/regions"
import { STORE_INFO } from "@lib/util/b2b"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  CartIcon,
  PhoneIcon,
  TruckIcon,
  UserIcon,
} from "@modules/common/icons/trade-icons"
import CartButton from "@modules/layout/components/cart-button"
import Logo from "@modules/layout/components/logo"
import NavSearch from "@modules/layout/components/nav-search"
import SideMenu from "@modules/layout/components/side-menu"

export default async function Nav() {
  const [regions, locales, currentLocale, categories] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    listCategories({ fields: "id,handle,name,rank,parent_category_id" }).catch(() => []),
  ])

  const topCategories = (categories ?? [])
    .filter((category) => !category.parent_category_id)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))

  return (
    <div className="sticky top-0 inset-x-0 z-50">
      <div className="hidden small:block bg-ink text-white/75 text-xs">
        <div className="content-container flex h-9 items-center justify-between">
          <div className="flex items-center gap-x-6">
            <span className="flex items-center gap-x-2">
              <TruckIcon size={15} className="text-brand" />
              Next-day delivery to site on stock items
            </span>
            <span className="hidden medium:inline">Trade prices shown excl. VAT</span>
            <span className="hidden medium:inline">Net 30 invoicing for approved accounts</span>
          </div>
          <a
            href={STORE_INFO.phoneHref}
            className="flex items-center gap-x-2 font-medium text-white hover:text-brand transition-colors"
          >
            <PhoneIcon size={14} className="text-brand" />
            24/7 phone orders: {STORE_INFO.phone}
          </a>
        </div>
      </div>

      <header className="bg-white border-b border-concrete-200">
        <nav className="content-container flex h-[72px] items-center gap-x-4 small:gap-x-8">
          <div className="small:hidden h-full">
            <SideMenu
              regions={regions}
              locales={locales}
              currentLocale={currentLocale}
              categories={topCategories.map(({ name, handle }) => ({ name, handle }))}
            />
          </div>

          <LocalizedClientLink href="/" data-testid="nav-store-link" className="shrink-0">
            <Logo />
          </LocalizedClientLink>

          <div className="hidden small:block flex-1 max-w-2xl">
            <NavSearch />
          </div>

          <div className="ml-auto flex items-center gap-x-2 small:gap-x-3 h-full">
            <LocalizedClientLink
              href="/account"
              className="hidden small:flex items-center gap-x-2.5 rounded-rounded px-3 py-2 text-sm text-ink hover:bg-concrete-50 transition-colors"
              data-testid="nav-account-link"
            >
              <UserIcon size={22} />
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] text-ink-600">Trade account</span>
                <span className="font-semibold">Sign in</span>
              </span>
            </LocalizedClientLink>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="flex items-center gap-x-2 rounded-rounded bg-ink px-4 py-2.5 text-sm font-semibold text-white"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  <CartIcon size={20} />
                  <span>0</span>
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>

        {topCategories.length > 0 && (
          <div className="hidden small:block border-t border-concrete-100">
            <ul className="content-container flex h-11 items-center gap-x-7 overflow-x-auto no-scrollbar text-[13px] font-medium text-ink-700">
              <li>
                <LocalizedClientLink
                  href="/store"
                  className="whitespace-nowrap font-semibold text-ink hover:text-brand transition-colors"
                >
                  All products
                </LocalizedClientLink>
              </li>
              {topCategories.map((category) => (
                <li key={category.id}>
                  <LocalizedClientLink
                    href={`/categories/${category.handle}`}
                    className="whitespace-nowrap hover:text-brand transition-colors"
                  >
                    {category.name}
                  </LocalizedClientLink>
                </li>
              ))}
              <li className="ml-auto">
                <LocalizedClientLink
                  href="/collections/pallet-deals"
                  className="whitespace-nowrap rounded-circle bg-brand-light px-3 py-1 font-semibold text-brand-dark"
                >
                  Pallet deals
                </LocalizedClientLink>
              </li>
            </ul>
          </div>
        )}
      </header>
    </div>
  )
}
