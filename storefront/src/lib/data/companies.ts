"use server"

import { sdk } from "@lib/config"
import { revalidateTag } from "next/cache"
import { transferCart } from "./customer"
import { getAuthHeaders, getCacheOptions, getCacheTag, setAuthToken } from "./cookies"

export type CompanyStatus = "pending" | "approved" | "rejected" | "blocked"
export type EmployeeRole = "admin" | "buyer"

export type CompanyAddress = {
  address_1: string
  address_2?: string | null
  city: string
  postal_code: string
  province?: string | null
  country_code: string
}

export type CompanyEmployee = {
  id: string
  role: EmployeeRole
  spending_limit: number | null
  phone: string | null
  can_order_by_phone: boolean
  customer_id: string
  created_at: string
  customer?: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    has_account: boolean
  } | null
}

export type Company = {
  id: string
  name: string
  tax_id: string | null
  email: string | null
  phone: string | null
  address: CompanyAddress | null
  status: CompanyStatus
  currency_code: string
  payment_terms_days: number
  credit_limit: number | null
  spending_limit_reset: "never" | "daily" | "weekly" | "monthly" | "yearly"
  approval_threshold: number | null
  created_at: string
  employees: CompanyEmployee[]
}

export type MyCompany = {
  company: Company
  employee: CompanyEmployee
}

export type CartApprovalStatus = "not_required" | "required" | "pending" | "approved" | "rejected"

export type CartApproval = {
  cart_id: string
  status: CartApprovalStatus
  amount: number
  currency_code: string | null
  evaluation: {
    required: boolean
    reasons: ("spending_limit" | "approval_threshold")[]
    amount: number
    spent: number
    spending_limit: number | null
    approval_threshold: number | null
  } | null
  approval: { id: string; status: string; note?: string | null } | null
  company: { id: string; name: string } | null
  role: EmployeeRole | null
}

export type Approval = {
  id: string
  cart_id: string
  customer_id: string
  status: "pending" | "approved" | "rejected"
  reason: "spending_limit" | "approval_threshold"
  amount: number
  currency_code: string
  note: string | null
  handled_by_type: "company_admin" | "merchant" | null
  handled_at: string | null
  created_at: string
  customer?: { id: string; email: string; first_name: string | null; last_name: string | null } | null
  cart?: {
    id: string
    total: number
    currency_code: string
    completed_at: string | null
    items?: { id: string; title: string; product_title: string | null; quantity: number }[]
  } | null
}

export type ActionResult = { success: boolean; error: string | null }

const errorMessage = (error: unknown) => {
  const message = (error as Error)?.message ?? String(error)

  return message.replace(/^APPROVAL_[A-Z]+:\s*/, "")
}

const authHeaders = async () => ({ ...(await getAuthHeaders()) })

const revalidateCompany = async () => {
  revalidateTag(await getCacheTag("companies"))
}

export async function retrieveMyCompany(): Promise<MyCompany | null> {
  const headers = await authHeaders()

  if (!("authorization" in headers)) {
    return null
  }

  return sdk.client
    .fetch<MyCompany>("/store/companies/me", {
      method: "GET",
      headers,
      next: { ...(await getCacheOptions("companies")) },
      cache: "force-cache",
    })
    .catch(() => null)
}

export async function updateMyCompany(
  _state: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const body = {
    name: (formData.get("name") as string) || undefined,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
  }

  try {
    await sdk.client.fetch("/store/companies/me", { method: "POST", body, headers: await authHeaders() })
    await revalidateCompany()
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

const parseLimit = (value: FormDataEntryValue | null) => {
  const text = (value as string | null)?.trim()

  if (!text) {
    return null
  }

  const amount = Number(text.replace(",", "."))

  return Number.isFinite(amount) ? amount : null
}

export async function addEmployee(
  _state: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const body = {
    email: formData.get("email") as string,
    first_name: (formData.get("first_name") as string) || null,
    last_name: (formData.get("last_name") as string) || null,
    phone: (formData.get("phone") as string) || null,
    role: ((formData.get("role") as string) || "buyer") as EmployeeRole,
    spending_limit: parseLimit(formData.get("spending_limit")),
  }

  try {
    await sdk.client.fetch("/store/companies/me/employees", { method: "POST", body, headers: await authHeaders() })
    await revalidateCompany()
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function updateEmployee(
  employeeId: string,
  data: { role?: EmployeeRole; spending_limit?: number | null; phone?: string | null }
): Promise<ActionResult> {
  try {
    await sdk.client.fetch(`/store/companies/me/employees/${employeeId}`, {
      method: "POST",
      body: data,
      headers: await authHeaders(),
    })
    await revalidateCompany()
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function removeEmployee(employeeId: string): Promise<ActionResult> {
  try {
    await sdk.client.fetch(`/store/companies/me/employees/${employeeId}`, {
      method: "DELETE",
      headers: await authHeaders(),
    })
    await revalidateCompany()
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function getCartApproval(cartId: string): Promise<CartApproval | null> {
  const headers = await authHeaders()

  if (!("authorization" in headers)) {
    return null
  }

  return sdk.client
    .fetch<{ cart_approval: CartApproval }>("/store/companies/me/cart-approval", {
      method: "GET",
      query: { cart_id: cartId },
      headers,
      cache: "no-store",
    })
    .then(({ cart_approval }) => cart_approval)
    .catch(() => null)
}

export async function requestCartApproval(cartId: string, note?: string): Promise<ActionResult> {
  try {
    await sdk.client.fetch("/store/companies/me/approvals", {
      method: "POST",
      body: { cart_id: cartId, note: note || null },
      headers: await authHeaders(),
    })
    await revalidateCompany()
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function listApprovals(status?: Approval["status"]): Promise<Approval[]> {
  const headers = await authHeaders()

  if (!("authorization" in headers)) {
    return []
  }

  return sdk.client
    .fetch<{ approvals: Approval[] }>("/store/companies/me/approvals", {
      method: "GET",
      query: status ? { status, limit: 50 } : { limit: 50 },
      headers,
      next: { ...(await getCacheOptions("companies")) },
      cache: "force-cache",
    })
    .then(({ approvals }) => approvals)
    .catch(() => [])
}

export async function handleApproval(
  approvalId: string,
  status: "approved" | "rejected",
  note?: string
): Promise<ActionResult> {
  try {
    await sdk.client.fetch(`/store/companies/me/approvals/${approvalId}`, {
      method: "POST",
      body: { status, note: note || null },
      headers: await authHeaders(),
    })
    await revalidateCompany()
    revalidateTag(await getCacheTag("carts"))
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export type TradeRegisterState = { success: boolean; error: string | null; company_name?: string }

export async function registerTradeAccount(
  _state: TradeRegisterState | null,
  formData: FormData
): Promise<TradeRegisterState> {
  const value = (key: string) => ((formData.get(key) as string | null) ?? "").trim()
  const mode = value("mode") === "customer" ? "customer" : "guest"
  const email = value("email").toLowerCase()
  const password = formData.get("password") as string

  const body = {
    email,
    first_name: value("first_name"),
    last_name: value("last_name"),
    phone: value("phone"),
    company: {
      name: value("company_name"),
      tax_id: value("tax_id"),
      email: value("company_email") || null,
      phone: value("company_phone") || null,
      address: {
        address_1: value("address_1"),
        city: value("city"),
        postal_code: value("postal_code"),
        country_code: value("country_code") || "pl",
      },
    },
    notes: value("notes") || null,
  }

  try {
    if (mode === "customer") {
      await sdk.client.fetch("/store/trade-accounts", { method: "POST", body, headers: await authHeaders() })
    } else {
      let token: string

      try {
        token = (await sdk.auth.register("customer", "emailpass", { email, password })) as string
      } catch (error) {
        token = (await sdk.auth.login("customer", "emailpass", { email, password })) as string
      }

      await sdk.client.fetch("/store/trade-accounts", {
        method: "POST",
        body,
        headers: { authorization: `Bearer ${token}` },
      })

      const loginToken = await sdk.auth.login("customer", "emailpass", { email, password })
      await setAuthToken(loginToken as string)
      revalidateTag(await getCacheTag("customers"))
      await transferCart().catch(() => null)
    }

    await revalidateCompany()
    revalidateTag(await getCacheTag("customers"))

    return { success: true, error: null, company_name: body.company.name }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function getCartB2BContext(
  cartId: string
): Promise<{ logged_in: boolean; approval: CartApproval | null }> {
  const headers = await authHeaders()

  if (!("authorization" in headers)) {
    return { logged_in: false, approval: null }
  }

  return { logged_in: true, approval: await getCartApproval(cartId) }
}
