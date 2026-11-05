import { Metadata } from "next"

import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import CategoryGrid from "@modules/home/components/category-grid"
import ProductRail from "@modules/home/components/featured-products/product-rail"
import Hero from "@modules/home/components/hero"
import PhoneOrdering from "@modules/home/components/phone-ordering"
import TradeAccountCta from "@modules/home/components/trade-account-cta"
import TradeBenefits from "@modules/home/components/trade-benefits"

export const metadata: Metadata = {
  title: { absolute: "STRATA Building Supply | Trade building materials delivered to site" },
  description:
    "Cement, blocks, insulation, drywall, timber, fixings and tools at trade prices. Volume pricing, crane offload delivery and 24/7 phone ordering.",
}

const RAILS = [
  { handle: "site-essentials", eyebrow: "Most ordered", title: "Site essentials, always in stock" },
  { handle: "pallet-deals", eyebrow: "Buy by the pallet", title: "Pallet deals" },
  { handle: "energy-efficient", eyebrow: "Build to the new WT standards", title: "Energy-efficient build" },
]

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  const byHandle = new Map((collections ?? []).map((collection) => [collection.handle, collection]))
  const [firstRail, ...otherRails] = RAILS.flatMap((rail) => {
    const collection = byHandle.get(rail.handle)
    return collection ? [{ ...rail, collection }] : []
  })

  return (
    <>
      <Hero />
      <TradeBenefits />
      <CategoryGrid />
      {firstRail && (
        <ProductRail
          collection={firstRail.collection}
          region={region}
          eyebrow={firstRail.eyebrow}
          title={firstRail.title}
        />
      )}
      <PhoneOrdering />
      {otherRails.map((rail) => (
        <ProductRail
          key={rail.handle}
          collection={rail.collection}
          region={region}
          eyebrow={rail.eyebrow}
          title={rail.title}
        />
      ))}
      <TradeAccountCta />
    </>
  )
}
