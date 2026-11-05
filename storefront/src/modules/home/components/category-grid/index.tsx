import Image from "next/image"

import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ArrowRightIcon } from "@modules/common/icons/trade-icons"

export default async function CategoryGrid() {
  const categories = await listCategories({
    fields: "id,handle,name,description,rank,metadata,parent_category_id,*category_children",
  }).catch(() => [])

  const topCategories = (categories ?? [])
    .filter((category) => !category.parent_category_id)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))

  if (!topCategories.length) {
    return null
  }

  return (
    <section className="content-container py-16 small:py-24">
      <SectionHeading
        eyebrow="Shop by category"
        title="Everything for the build, from slab to roof"
        href="/store"
        cta="View all products"
      />
      <ul className="mt-10 grid grid-cols-1 gap-4 xsmall:grid-cols-2 medium:grid-cols-3">
        {topCategories.map((category, index) => {
          const image = (category.metadata as Record<string, string> | null)?.image_url
          const children = [...(category.category_children ?? [])].sort(
            (a, b) => (a.rank ?? 0) - (b.rank ?? 0)
          )

          return (
            <li key={category.id} className={index === 0 ? "medium:row-span-2" : ""}>
              <LocalizedClientLink
                href={`/categories/${category.handle}`}
                className="group relative flex h-full min-h-[240px] flex-col justify-end overflow-hidden rounded-large bg-ink p-6"
              >
                {image && (
                  <Image
                    src={image}
                    alt={category.name}
                    fill
                    sizes="(max-width: 1280px) 50vw, 33vw"
                    quality={60}
                    className="object-cover opacity-80 transition duration-700 group-hover:scale-105 group-hover:opacity-90"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/10" />
                <div className="relative">
                  <h3 className="font-display text-2xl font-bold text-white">{category.name}</h3>
                  {category.description && (
                    <p className="mt-2 max-w-sm text-sm text-white/70 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                  {children.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {children.map((child) => (
                        <li
                          key={child.id}
                          className="rounded-circle bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur"
                        >
                          {child.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <span className="mt-5 inline-flex items-center gap-x-2 text-sm font-semibold text-brand">
                    Shop {category.name.toLowerCase()}
                    <ArrowRightIcon
                      size={16}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </div>
              </LocalizedClientLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  href,
  cta,
  inverted = false,
}: {
  eyebrow: string
  title: string
  href?: string
  cta?: string
  inverted?: boolean
}) {
  return (
    <div className="flex flex-col gap-4 small:flex-row small:items-end small:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
        <h2
          className={`mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight small:text-4xl ${
            inverted ? "text-white" : "text-ink"
          }`}
        >
          {title}
        </h2>
      </div>
      {href && cta && (
        <LocalizedClientLink
          href={href}
          className={`group inline-flex items-center gap-x-2 text-sm font-semibold ${
            inverted ? "text-white" : "text-ink"
          } hover:text-brand transition-colors`}
        >
          {cta}
          <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-1" />
        </LocalizedClientLink>
      )}
    </div>
  )
}
