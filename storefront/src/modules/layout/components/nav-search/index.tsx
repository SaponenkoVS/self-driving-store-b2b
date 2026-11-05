"use client"

import { useParams, useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

import { SearchIcon } from "@modules/common/icons/trade-icons"

export default function NavSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }
  const [value, setValue] = useState("")

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const query = value.trim()
    router.push(`/${countryCode}/store${query ? `?q=${encodeURIComponent(query)}` : ""}`)
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative">
      <SearchIcon
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-600"
      />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search cement, OSB, rebar, insulation..."
        aria-label="Search products"
        className="h-11 w-full rounded-rounded border border-concrete-200 bg-concrete-50 pl-11 pr-28 text-sm text-ink placeholder:text-ink-600/70 outline-none transition focus:border-ink focus:bg-white"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-base bg-ink px-4 py-1.5 text-xs font-semibold text-white hover:bg-ink-700 transition-colors"
      >
        Search
      </button>
    </form>
  )
}
