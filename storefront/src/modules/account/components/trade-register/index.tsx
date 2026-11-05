"use client"

import { useActionState } from "react"
import { registerTradeAccount } from "@lib/data/companies"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { eyebrow } from "../company/format"

type Props = {
  mode?: "guest" | "customer"
  setCurrentView?: (view: LOGIN_VIEW) => void
  defaults?: { email?: string | null; first_name?: string | null; last_name?: string | null; phone?: string | null }
}

const COUNTRIES = [
  { code: "pl", label: "Poland" },
  { code: "de", label: "Germany" },
  { code: "cz", label: "Czechia" },
  { code: "sk", label: "Slovakia" },
  { code: "lt", label: "Lithuania" },
]

const TradeRegister = ({ mode = "guest", setCurrentView, defaults }: Props) => {
  const [state, formAction] = useActionState(registerTradeAccount, null)

  if (state?.success) {
    return (
      <div className="w-full max-w-xl rounded-large border border-concrete-200 bg-concrete-50 p-8" data-testid="trade-register-success">
        <p className={eyebrow}>Application received</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-ink">
          {state.company_name} is pending approval
        </h2>
        <p className="mt-3 text-sm text-ink-600">
          Our trade desk checks your NIP and sets your price tier and payment terms, usually within
          one working day. You can browse and order at list prices in the meantime.
        </p>
        <LocalizedClientLink
          href="/account/company"
          className="mt-6 inline-flex rounded-rounded bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-700"
        >
          View company account
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div className="w-full max-w-xl flex flex-col" data-testid="trade-register-page">
      <p className={eyebrow}>Trade account</p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
        Register your company
      </h1>
      <p className="mt-2 mb-6 text-sm text-ink-600">
        Get trade pricing, invoice terms, quotes and multiple buyers under one company account.
      </p>
      <form className="flex w-full flex-col gap-y-6" action={formAction}>
        <input type="hidden" name="mode" value={mode} />
        <fieldset className="flex flex-col gap-y-2">
          <legend className="mb-2 text-sm font-semibold text-ink">Company</legend>
          <Input label="Company name" name="company_name" required autoComplete="organization" />
          <div className="grid grid-cols-1 gap-2 small:grid-cols-2">
            <Input label="NIP (tax ID)" name="tax_id" required inputMode="numeric" />
            <Input label="Company phone" name="company_phone" type="tel" required />
          </div>
          <Input label="Company email (optional)" name="company_email" type="email" />
          <Input label="Street and number" name="address_1" required autoComplete="address-line1" />
          <div className="grid grid-cols-1 gap-2 small:grid-cols-3">
            <Input label="Postal code" name="postal_code" required autoComplete="postal-code" />
            <Input label="City" name="city" required autoComplete="address-level2" />
            <select
              name="country_code"
              defaultValue="pl"
              className="h-11 rounded-md border border-ui-border-base bg-ui-bg-field px-3 text-sm text-ink"
              aria-label="Country"
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-y-2">
          <legend className="mb-2 text-sm font-semibold text-ink">Contact person</legend>
          <div className="grid grid-cols-1 gap-2 small:grid-cols-2">
            <Input label="First name" name="first_name" required defaultValue={defaults?.first_name ?? undefined} autoComplete="given-name" />
            <Input label="Last name" name="last_name" required defaultValue={defaults?.last_name ?? undefined} autoComplete="family-name" />
          </div>
          <Input label="Mobile phone" name="phone" type="tel" required defaultValue={defaults?.phone ?? undefined} autoComplete="tel" />
          {mode === "guest" ? (
            <>
              <Input label="Email" name="email" type="email" required autoComplete="email" />
              <Input label="Password" name="password" type="password" required autoComplete="new-password" />
            </>
          ) : (
            <input type="hidden" name="email" value={defaults?.email ?? ""} />
          )}
        </fieldset>
        <ErrorMessage error={state?.error} data-testid="trade-register-error" />
        <SubmitButton className="w-full" data-testid="trade-register-button">
          Submit for approval
        </SubmitButton>
      </form>
      {setCurrentView && (
        <span className="mt-6 text-center text-small-regular text-ink-600">
          Buying for yourself?{" "}
          <button type="button" onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)} className="underline">
            Create a personal account
          </button>{" "}
          or{" "}
          <button type="button" onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)} className="underline">
            sign in
          </button>
          .
        </span>
      )}
    </div>
  )
}

export default TradeRegister
