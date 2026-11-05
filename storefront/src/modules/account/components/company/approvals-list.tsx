"use client"

import { useState, useTransition } from "react"
import { Approval, handleApproval } from "@lib/data/companies"
import { card, eyebrow, formatDate, formatMoney, primaryButton, secondaryButton } from "./format"

const REASONS: Record<string, string> = {
  spending_limit: "Over spending limit",
  approval_threshold: "Over company approval threshold",
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-brand/10 text-brand",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
}

const ApprovalRow = ({ approval, canHandle }: { approval: Approval; canHandle: boolean }) => {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const requester =
    [approval.customer?.first_name, approval.customer?.last_name].filter(Boolean).join(" ") || approval.customer?.email

  const act = (status: "approved" | "rejected") =>
    startTransition(async () => {
      const result = await handleApproval(approval.id, status)
      setError(result.error)
    })

  return (
    <li className="flex flex-col gap-3 border-t border-concrete-200 py-4 small:flex-row small:items-center small:justify-between" data-testid="approval-row">
      <div>
        <p className="text-sm font-semibold text-ink">
          {formatMoney(approval.amount, approval.currency_code)}
          <span className={`ml-2 rounded-circle px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[approval.status]}`}>
            {approval.status}
          </span>
        </p>
        <p className="text-xs text-ink-600">
          {requester} - {REASONS[approval.reason]} - {formatDate(approval.created_at)}
        </p>
        {approval.cart?.items?.length ? (
          <p className="mt-1 text-xs text-ink-600">
            {approval.cart.items
              .slice(0, 3)
              .map((item) => `${item.quantity} x ${item.product_title ?? item.title}`)
              .join(", ")}
            {approval.cart.items.length > 3 ? ` and ${approval.cart.items.length - 3} more` : ""}
          </p>
        ) : null}
        {approval.note && <p className="mt-1 text-xs italic text-ink-600">{approval.note}</p>}
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
      {canHandle && approval.status === "pending" && (
        <div className="flex gap-2">
          <button type="button" className={secondaryButton} disabled={pending} onClick={() => act("rejected")}>
            Reject
          </button>
          <button type="button" className={primaryButton} disabled={pending} onClick={() => act("approved")}>
            Approve
          </button>
        </div>
      )}
    </li>
  )
}

const ApprovalsList = ({
  approvals,
  isAdmin,
  myCustomerId,
}: {
  approvals: Approval[]
  isAdmin: boolean
  myCustomerId: string
}) => (
  <section className={card} data-testid="company-approvals">
    <p className={eyebrow}>Approvals</p>
    <h2 className="mt-1 font-display text-xl font-bold text-ink">
      {isAdmin ? "Orders waiting for approval" : "Your approval requests"}
    </h2>
    {approvals.length ? (
      <ul className="mt-2">
        {approvals.map((approval) => (
          <ApprovalRow
            key={approval.id}
            approval={approval}
            canHandle={isAdmin && approval.customer_id !== myCustomerId}
          />
        ))}
      </ul>
    ) : (
      <p className="mt-3 text-sm text-ink-600">No approval requests yet.</p>
    )}
  </section>
)

export default ApprovalsList
