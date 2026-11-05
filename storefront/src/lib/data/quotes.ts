"use server"

import { sdk } from "@lib/config"
import { revalidateTag } from "next/cache"
import { getAuthHeaders, getCacheOptions, getCacheTag, removeCartId } from "./cookies"

export type QuoteStatus =
  | "pending_merchant"
  | "pending_customer"
  | "accepted"
  | "customer_rejected"
  | "merchant_rejected"
  | "expired"

export type QuoteItem = {
  id: string
  title: string
  subtitle?: string | null
  product_title: string | null
  variant_title: string | null
  variant_sku: string | null
  thumbnail: string | null
  quantity: number
  unit_price: number
  subtotal: number
  total: number
}

export type QuoteMessage = {
  id: string
  author_type: "customer" | "merchant" | "system"
  author_id: string | null
  text: string
  created_at: string
}

export type Quote = {
  id: string
  display_id: number
  status: QuoteStatus
  customer_id: string
  cart_id: string | null
  draft_order_id: string | null
  order_id: string | null
  valid_until: string | null
  delivery_postcode: string | null
  customer_note?: string | null
  created_at: string
  updated_at: string
  company?: { id: string; name: string } | null
  customer?: { id: string; email: string; first_name: string | null; last_name: string | null } | null
  draft_order?: {
    id: string
    display_id?: number
    total: number
    subtotal?: number
    item_subtotal?: number
    tax_total?: number
    shipping_total?: number
    discount_total?: number
    currency_code: string
    items?: QuoteItem[]
  } | null
  order?: { id: string; display_id: number; status: string } | null
  messages?: QuoteMessage[]
}

export type QuoteActionResult = { success: boolean; error: string | null; quote_id?: string }

const errorMessage = (error: unknown) => {
  const message = (error as Error)?.message ?? String(error)

  return message.replace(/^APPROVAL_[A-Z]+:\s*/, "")
}

const authHeaders = async () => ({ ...(await getAuthHeaders()) })

const revalidateQuotes = async () => {
  revalidateTag(await getCacheTag("quotes"))
}

export async function listQuotes(status?: QuoteStatus): Promise<Quote[]> {
  const headers = await authHeaders()

  if (!("authorization" in headers)) {
    return []
  }

  return sdk.client
    .fetch<{ quotes: Quote[] }>("/store/quotes", {
      method: "GET",
      query: status ? { status, limit: 50 } : { limit: 50 },
      headers,
      next: { ...(await getCacheOptions("quotes")) },
      cache: "force-cache",
    })
    .then(({ quotes }) => quotes)
    .catch(() => [])
}

export async function retrieveQuote(id: string): Promise<Quote | null> {
  const headers = await authHeaders()

  if (!("authorization" in headers)) {
    return null
  }

  return sdk.client
    .fetch<{ quote: Quote }>(`/store/quotes/${id}`, {
      method: "GET",
      headers,
      next: { ...(await getCacheOptions("quotes")) },
      cache: "force-cache",
    })
    .then(({ quote }) => quote)
    .catch(() => null)
}

export async function requestQuoteFromCart(
  cartId: string,
  note?: string,
  postcode?: string
): Promise<QuoteActionResult> {
  try {
    const { quote } = await sdk.client.fetch<{ quote: { id: string } }>("/store/quotes", {
      method: "POST",
      body: {
        cart_id: cartId,
        customer_note: note?.trim() || null,
        delivery_postcode: postcode?.trim() || null,
      },
      headers: await authHeaders(),
    })

    await removeCartId()
    revalidateTag(await getCacheTag("carts"))
    await revalidateQuotes()

    return { success: true, error: null, quote_id: quote.id }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function acceptQuote(id: string): Promise<QuoteActionResult> {
  try {
    await sdk.client.fetch(`/store/quotes/${id}/accept`, { method: "POST", headers: await authHeaders() })
    await revalidateQuotes()
    revalidateTag(await getCacheTag("orders"))
    return { success: true, error: null, quote_id: id }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function rejectQuote(id: string, reason?: string): Promise<QuoteActionResult> {
  try {
    await sdk.client.fetch(`/store/quotes/${id}/reject`, {
      method: "POST",
      body: { reason: reason?.trim() || null },
      headers: await authHeaders(),
    })
    await revalidateQuotes()
    return { success: true, error: null, quote_id: id }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function sendQuoteMessage(id: string, text: string): Promise<QuoteActionResult> {
  try {
    await sdk.client.fetch(`/store/quotes/${id}/messages`, {
      method: "POST",
      body: { text },
      headers: await authHeaders(),
    })
    await revalidateQuotes()
    return { success: true, error: null, quote_id: id }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}
