"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { addEmployee } from "@lib/data/companies"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import { card, eyebrow, secondaryButton } from "./format"

const AddEmployeeForm = () => {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(addEmployee, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      setOpen(false)
    }
  }, [state])

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-large border border-dashed border-concrete-200 p-5">
        <p className="text-sm text-ink-600">
          {state?.success
            ? "Employee added. They can sign up with the same email to start ordering."
            : "Add site managers and buyers so they can order on the company account."}
        </p>
        <button type="button" className={secondaryButton} onClick={() => setOpen(true)} data-testid="add-employee-open">
          Add employee
        </button>
      </div>
    )
  }

  return (
    <section className={card} data-testid="add-employee-form">
      <p className={eyebrow}>Invite</p>
      <h3 className="mt-1 font-display text-lg font-bold text-ink">Add an employee</h3>
      <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-y-2">
        <div className="grid grid-cols-1 gap-2 small:grid-cols-2">
          <Input label="First name" name="first_name" />
          <Input label="Last name" name="last_name" />
        </div>
        <div className="grid grid-cols-1 gap-2 small:grid-cols-2">
          <Input label="Email" name="email" type="email" required />
          <Input label="Phone" name="phone" type="tel" />
        </div>
        <div className="grid grid-cols-1 gap-2 small:grid-cols-2">
          <select
            name="role"
            defaultValue="buyer"
            className="h-11 rounded-md border border-ui-border-base bg-ui-bg-field px-3 text-sm text-ink"
            aria-label="Role"
          >
            <option value="buyer">Buyer</option>
            <option value="admin">Admin</option>
          </select>
          <Input label="Spending limit (empty = no limit)" name="spending_limit" inputMode="decimal" />
        </div>
        <ErrorMessage error={state?.error} />
        <div className="mt-2 flex gap-2">
          <SubmitButton>Add employee</SubmitButton>
          <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}

export default AddEmployeeForm
