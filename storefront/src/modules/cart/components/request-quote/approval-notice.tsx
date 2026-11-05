"use client"

import { useState, useTransition } from "react"
import { CartApproval, requestCartApproval } from "@lib/data/companies"
import { convertToLocale } from "@lib/util/money"

const money = (amount: number | null | undefined, currency: string) =>
  amount === null || amount === undefined ? "-" : convertToLocale({ amount, currency_code: currency })

const ApprovalNotice = ({
  approval,
  onChanged,
}: {
  approval: CartApproval
  onChanged: () => void
}) => {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const currency = approval.currency_code ?? "eur"
  const evaluation = approval.evaluation

  if (!["required", "pending", "rejected"].includes(approval.status)) {
    return null
  }

  const request = () =>
    startTransition(async () => {
      const result = await requestCartApproval(approval.cart_id, note)
      setError(result.error)
      if (result.success) {
        onChanged()
      }
    })

  const reasons: string[] = []

  if (evaluation?.reasons.includes("spending_limit")) {
    reasons.push(
      `This order (${money(evaluation.amount, currency)}) plus ${money(evaluation.spent, currency)} already spent this period is over your spending limit of ${money(evaluation.spending_limit, currency)}.`
    )
  }

  if (evaluation?.reasons.includes("approval_threshold")) {
    reasons.push(
      `${approval.company?.name ?? "Your company"} requires approval for orders above ${money(evaluation.approval_threshold, currency)}.`
    )
  }

  return (
    <div
      className={`rounded-large border p-4 text-sm ${
        approval.status === "rejected" ? "border-rose-200 bg-rose-50" : "border-brand/30 bg-brand/5"
      }`}
      data-testid="cart-approval-notice"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Approval needed</p>
      <p className="mt-1 font-semibold text-ink">
        {approval.status === "pending"
          ? "Waiting for your company administrator to approve this order"
          : approval.status === "rejected"
            ? "This order was not approved"
            : "This order needs approval before checkout"}
      </p>
      {reasons.map((reason) => (
        <p key={reason} className="mt-1 text-ink-600">
          {reason}
        </p>
      ))}
      {approval.status !== "pending" && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note for the approver (optional)"
            className="w-full rounded-rounded border border-concrete-200 bg-white px-3 py-2 text-sm text-ink"
          />
          <button
            type="button"
            onClick={request}
            disabled={pending}
            className="inline-flex w-full items-center justify-center rounded-rounded bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-50"
            data-testid="request-approval-button"
          >
            {pending ? "Sending..." : approval.status === "rejected" ? "Request approval again" : "Request approval"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-rose-600">{error}</p>}
    </div>
  )
}

export default ApprovalNotice
