import { HttpTypes } from "@medusajs/types"
import TradeRegister from "../trade-register"
import { card, eyebrow } from "./format"

const NoCompany = ({ customer }: { customer: HttpTypes.StoreCustomer }) => (
  <div className="flex flex-col gap-6" data-testid="no-company">
    <div className={card}>
      <p className={eyebrow}>Company account</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">Your account is not linked to a company yet</h1>
      <p className="mt-2 text-sm text-ink-600">
        Register your company to unlock trade prices, invoice terms, quotes and buyers with their own
        limits. If your company already has a trade account, ask your company administrator to add
        your email ({customer.email}).
      </p>
    </div>
    <TradeRegister
      mode="customer"
      defaults={{
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
      }}
    />
  </div>
)

export default NoCompany
