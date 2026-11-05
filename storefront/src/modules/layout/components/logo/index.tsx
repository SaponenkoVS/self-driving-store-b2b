import { clx } from "@medusajs/ui"

import { STORE_INFO } from "@lib/util/b2b"

export default function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="flex items-center gap-x-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-base bg-brand">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor" aria-hidden="true">
          <path d="M3 18h18v3H3zM6 12h12v4H6zM9 6h6v4H9z" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={clx(
            "font-display text-xl font-extrabold tracking-tight",
            inverted ? "text-white" : "text-ink"
          )}
        >
          {STORE_INFO.name}
        </span>
        <span
          className={clx(
            "mt-0.5 text-[10px] font-semibold uppercase tracking-[0.22em]",
            inverted ? "text-white/60" : "text-ink-600"
          )}
        >
          {STORE_INFO.tagline}
        </span>
      </span>
    </span>
  )
}
