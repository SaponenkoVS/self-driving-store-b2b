import { convertToLocale } from "@lib/util/money"

export const formatMoney = (amount: number | null | undefined, currency?: string | null) => {
  if (amount === null || amount === undefined) {
    return "No limit"
  }

  return convertToLocale({ amount: Number(amount), currency_code: currency || "eur" })
}

export const RESET_LABELS: Record<string, string> = {
  never: "Never resets",
  daily: "Resets daily",
  weekly: "Resets weekly",
  monthly: "Resets monthly",
  yearly: "Resets yearly",
}

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  blocked: "Blocked",
}

export const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "-"

export const eyebrow = "text-xs font-semibold uppercase tracking-[0.18em] text-brand"
export const card = "rounded-large border border-concrete-200 bg-white p-6"
export const primaryButton =
  "inline-flex items-center justify-center rounded-rounded bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
export const secondaryButton =
  "inline-flex items-center justify-center rounded-rounded border border-concrete-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-50"
export const fieldClass =
  "w-full rounded-rounded border border-concrete-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
