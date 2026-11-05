import { readFileSync } from "node:fs";
import { normalizeCompanyName, normalizeEmail, normalizeNip } from "@nsc/protocol";
import type { CustomerIdentity } from "./db";

export interface LoginInput {
  email: string;
  company_name: string;
  nip: string;
}

/** Answers: is there a customer with this email, employed by a company with this name and NIP? */
export interface CustomerDirectory {
  verify(input: LoginInput): Promise<CustomerIdentity | null>;
}

/**
 * The real one: asks Medusa (backend/src/api/bots/customers/verify/route.ts).
 * Medusa does the matching; the Relay only forwards normalized input.
 */
export class MedusaDirectory implements CustomerDirectory {
  constructor(
    private baseUrl: string,
    private serviceToken: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async verify(input: LoginInput): Promise<CustomerIdentity | null> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}/bots/customers/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.serviceToken}` },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Medusa verify failed: HTTP ${res.status}`);
    const body = (await res.json()) as CustomerIdentity;
    return {
      customer_id: body.customer_id,
      employee_id: body.employee_id ?? null,
      name: body.name,
      email: body.email,
      company_id: body.company_id,
      company_name: body.company_name,
      tax_id: body.tax_id,
    };
  }
}

/** Demo / tests: customers from a JSON file (see customers.seed.example.json). */
export class SeedDirectory implements CustomerDirectory {
  constructor(private customers: (CustomerIdentity & { company_name: string })[]) {}

  static fromFile(path: string) {
    return new SeedDirectory(JSON.parse(readFileSync(path, "utf8")));
  }

  async verify(input: LoginInput): Promise<CustomerIdentity | null> {
    const nip = normalizeNip(input.nip);
    if (!nip) return null;
    const email = normalizeEmail(input.email);
    const company = normalizeCompanyName(input.company_name);
    return (
      this.customers.find(
        (c) =>
          normalizeEmail(c.email) === email &&
          normalizeNip(c.tax_id) === nip &&
          normalizeCompanyName(c.company_name) === company,
      ) ?? null
    );
  }
}

/** Fixed-window limiter: at most `max` hits per key per window. In-memory, good enough for one Relay process. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private max = 5,
    private windowMs = 10 * 60_000,
  ) {}

  /** Returns false when the key is over the limit (and records the hit otherwise). */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
