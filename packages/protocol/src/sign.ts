import type { Envelope } from "./envelope";

/** Canonical JSON: keys sorted recursively, so signer and verifier hash the same bytes. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}

/** The signed part: everything except relay_sig and context. */
export function signingPayload(env: Envelope): string {
  const { relay_sig: _s, context: _c, ...rest } = env;
  return canonical(rest);
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signEnvelope(env: Envelope, secret: string): Promise<Envelope> {
  const relay_sig = await hmacHex(secret, signingPayload(env));
  const signed = { ...env, relay_sig };
  const { context: _c, ...withoutContext } = signed;
  return { ...signed, context: JSON.stringify(withoutContext) };
}

export async function verifyEnvelope(env: Envelope, secret: string): Promise<boolean> {
  if (!env.relay_sig) return false;
  const expected = await hmacHex(secret, signingPayload(env));
  if (expected.length !== env.relay_sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ env.relay_sig.charCodeAt(i);
  return diff === 0;
}

/**
 * Grok Bot routines sometimes only pass `context` through to the prompt.
 * Read top-level fields first, fall back to parsing context (Team Null's trick).
 */
export function unwrapIncoming(body: unknown): unknown {
  if (body && typeof body === "object" && "protocol" in body) return body;
  if (body && typeof body === "object" && typeof (body as { context?: unknown }).context === "string") {
    try {
      return JSON.parse((body as { context: string }).context);
    } catch {
      return body;
    }
  }
  return body;
}
