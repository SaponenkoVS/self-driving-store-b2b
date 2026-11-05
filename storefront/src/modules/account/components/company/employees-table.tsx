"use client"

import { useState, useTransition } from "react"
import { CompanyEmployee, EmployeeRole, removeEmployee, updateEmployee } from "@lib/data/companies"
import { card, eyebrow, fieldClass, formatMoney, secondaryButton } from "./format"

type Props = {
  employees: CompanyEmployee[]
  currencyCode: string
  isAdmin: boolean
  myCustomerId: string
}

const EmployeeRow = ({
  employee,
  currencyCode,
  isAdmin,
  isMe,
}: {
  employee: CompanyEmployee
  currencyCode: string
  isAdmin: boolean
  isMe: boolean
}) => {
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState<EmployeeRole>(employee.role)
  const [limit, setLimit] = useState(employee.spending_limit?.toString() ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const name =
    [employee.customer?.first_name, employee.customer?.last_name].filter(Boolean).join(" ") ||
    employee.customer?.email ||
    "Invited employee"

  const save = () =>
    startTransition(async () => {
      const value = limit.trim() ? Number(limit.replace(",", ".")) : null
      const result = await updateEmployee(employee.id, { role, spending_limit: value })
      setError(result.error)
      if (result.success) {
        setEditing(false)
      }
    })

  const remove = () =>
    startTransition(async () => {
      if (!window.confirm(`Remove ${name} from the company?`)) {
        return
      }
      const result = await removeEmployee(employee.id)
      setError(result.error)
    })

  return (
    <tr className="border-t border-concrete-200 align-top" data-testid="employee-row">
      <td className="py-3 pr-4">
        <p className="text-sm font-semibold text-ink">
          {name}
          {isMe && <span className="ml-2 text-xs font-normal text-ink-600">(you)</span>}
        </p>
        <p className="text-xs text-ink-600">{employee.customer?.email}</p>
        {employee.customer && !employee.customer.has_account && (
          <p className="text-xs text-brand">Invited, account not created yet</p>
        )}
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </td>
      <td className="py-3 pr-4 text-sm text-ink">
        {editing ? (
          <select value={role} onChange={(event) => setRole(event.target.value as EmployeeRole)} className={fieldClass}>
            <option value="buyer">Buyer</option>
            <option value="admin">Admin</option>
          </select>
        ) : employee.role === "admin" ? (
          "Admin"
        ) : (
          "Buyer"
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-ink">
        {editing ? (
          <input
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="No limit"
            inputMode="decimal"
            className={fieldClass}
            aria-label="Spending limit"
          />
        ) : (
          formatMoney(employee.spending_limit, currencyCode)
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-ink">{employee.phone ?? employee.customer?.phone ?? "-"}</td>
      {isAdmin && (
        <td className="py-3 text-right">
          <div className="flex justify-end gap-2">
            {editing ? (
              <>
                <button type="button" className={secondaryButton} onClick={() => setEditing(false)} disabled={pending}>
                  Cancel
                </button>
                <button type="button" className={secondaryButton} onClick={save} disabled={pending}>
                  Save
                </button>
              </>
            ) : (
              <>
                <button type="button" className={secondaryButton} onClick={() => setEditing(true)}>
                  Edit
                </button>
                {!isMe && (
                  <button type="button" className={secondaryButton} onClick={remove} disabled={pending}>
                    Remove
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}

const EmployeesTable = ({ employees, currencyCode, isAdmin, myCustomerId }: Props) => (
  <section className={card} data-testid="company-employees">
    <p className={eyebrow}>Team</p>
    <h2 className="mt-1 font-display text-xl font-bold text-ink">{isAdmin ? "Employees" : "Your buyer profile"}</h2>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-ink-600">
            <th className="pb-2 pr-4 font-semibold">Name</th>
            <th className="pb-2 pr-4 font-semibold">Role</th>
            <th className="pb-2 pr-4 font-semibold">Spending limit</th>
            <th className="pb-2 pr-4 font-semibold">Phone</th>
            {isAdmin && <th className="pb-2" />}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              currencyCode={currencyCode}
              isAdmin={isAdmin}
              isMe={employee.customer_id === myCustomerId}
            />
          ))}
        </tbody>
      </table>
    </div>
  </section>
)

export default EmployeesTable
