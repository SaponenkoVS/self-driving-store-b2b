"use server"

import { sdk } from "@lib/config"

export type CallRequestInput = {
  product_id?: string
  variant_id?: string
  quantity?: number
}

export async function requestCallback(
  input: CallRequestInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await sdk.client.fetch("/store/call-requests", {
      method: "POST",
      body: input,
    })

    return { ok: true }
  } catch (error: any) {
    return { ok: false, message: error?.message ?? "We could not place the call. Please try again." }
  }
}
