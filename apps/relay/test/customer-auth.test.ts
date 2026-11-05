import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { Bus } from "../src/bus";
import { RelayDb } from "../src/db";
import { Deliverer } from "../src/deliver";
import { MedusaDirectory, RateLimiter, SeedDirectory } from "../src/directory";

const ANNA = {
  customer_id: "cus_anna",
  employee_id: "emp_anna",
  name: "Anna Keller",
  email: "anna@bellabau.pl",
  company_id: "comp_bella",
  company_name: "Bella Bau Sp. z o.o.",
  tax_id: "5261040828",
};
const OTTO = { ...ANNA, customer_id: "cus_otto", employee_id: "emp_otto", name: "Otto", email: "otto@other.pl", company_id: "comp_other", company_name: "Other Co", tax_id: "7740001454" };

let db: RelayDb;
let app: ReturnType<typeof createApp>;

async function req(method: string, path: string, body?: unknown, token?: string, ip = "1.1.1.1") {
  const res = await app.request(path, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json()) as any };
}

const login = (overrides: object = {}, ip?: string) =>
  req("POST", "/customers/auth", { email: "Anna@BellaBau.pl ", company_name: "bella-bau sp z o.o.", nip: "PL 526-104-08-28", ...overrides }, undefined, ip);

beforeEach(async () => {
  db = new RelayDb(":memory:");
  const bus = new Bus();
  app = createApp({
    db,
    bus,
    deliverer: new Deliverer(db, bus, async () => Response.json({ success: true })),
    adminToken: "admin",
    directory: new SeedDirectory([ANNA, OTTO]),
    loginLimiter: new RateLimiter(5, 60_000),
  });
  const inv = await req("POST", "/admin/invites", { account_id: "store", name: "Store", kind: "store" }, "admin");
  await req("POST", "/accounts/register", { invite_code: inv.json.invite_code, gateway_url: "https://hooks.example/store" });
});

describe("customer login", () => {
  test("email + company name + NIP gives a token bound to the customer", async () => {
    const r = await login();
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ customer_id: "cus_anna", account: "co-5261040828", role: "buyer", company_name: ANNA.company_name });
    expect(r.json.token).toStartWith("nsc_");

    const me = await req("GET", "/accounts/me", undefined, r.json.token);
    expect(me.json).toMatchObject({ id: "co-5261040828", kind: "customer", customer_id: "cus_anna", user_name: "Anna Keller" });
  });

  test("any wrong field → same 401", async () => {
    for (const bad of [{ email: "x@bellabau.pl" }, { company_name: "Bella Beton" }, { nip: "5261040829" }, { nip: OTTO.tax_id }]) {
      const r = await login(bad, `ip-${JSON.stringify(bad)}`);
      expect(r.status).toBe(401);
      expect(r.json.error).toBe("no customer matches this email, company name and NIP");
    }
  });

  test("rate limited per email", async () => {
    for (let i = 0; i < 5; i++) await login({ company_name: "wrong" }, `ip-${i}`);
    expect((await login({}, "fresh-ip")).status).toBe(429);
  });

  test("relay stamps from.user; a claimed user is overwritten", async () => {
    const { token } = (await login()).json;
    const r = await req(
      "POST",
      "/messages",
      {
        protocol: "b2b-nego/v1",
        msg_id: "msg-anna-0001",
        thread_id: "T-co-5261040828-1",
        from: { account: "co-5261040828", role: "buyer", user: "cus_ceo_fake" },
        to: { account: "store", role: "customer-manager" },
        type: "rfq",
        lines: [{ sku: "PIPE-SS-24", qty: 40 }],
      },
      token,
    );
    expect(r.status).toBe(202);
    expect(db.messages("T-co-5261040828-1")[0]!.from).toEqual({ account: "co-5261040828", role: "buyer", user: "cus_anna" });
  });

  test("a customer can't send as or read another company", async () => {
    const anna = (await login()).json.token;
    const otto = (await login({ email: OTTO.email, company_name: OTTO.company_name, nip: OTTO.tax_id }, "2.2.2.2")).json.token;
    const rfq = (from: string, msg_id: string) => ({
      protocol: "b2b-nego/v1",
      msg_id,
      thread_id: "T-x-1",
      from: { account: from, role: "buyer" },
      to: { account: "store", role: "customer-manager" },
      type: "rfq",
      lines: [{ sku: "PIPE", qty: 1 }],
    });
    expect((await req("POST", "/messages", rfq("co-5261040828", "msg-otto-spoof"), otto)).status).toBe(403);
    expect((await req("POST", "/messages", rfq("co-5261040828", "msg-anna-real1"), anna)).status).toBe(202);
    expect((await req("GET", "/threads/T-x-1", undefined, otto)).status).toBe(404);
  });

  test("revoked credentials stop working", async () => {
    const { token } = (await login()).json;
    expect(db.revokeCustomerCredentials("cus_anna")).toBe(1);
    expect((await req("GET", "/accounts/me", undefined, token)).status).toBe(401);
  });
});

describe("MedusaDirectory", () => {
  test("calls /bots/customers/verify with the service token", async () => {
    const seen: { url: string; auth: string | null; body: unknown }[] = [];
    const dir = new MedusaDirectory("http://medusa:9000/", "svc", (async (url: string, init: RequestInit) => {
      seen.push({ url, auth: new Headers(init.headers).get("authorization"), body: JSON.parse(String(init.body)) });
      return (init.body as string).includes("anna") ? Response.json(ANNA) : Response.json({ error: "no_match" }, { status: 404 });
    }) as typeof fetch);
    expect(await dir.verify({ email: "anna@bellabau.pl", company_name: "x", nip: "1" })).toMatchObject({ customer_id: "cus_anna" });
    expect(await dir.verify({ email: "nobody@x.pl", company_name: "x", nip: "1" })).toBeNull();
    expect(seen[0]).toMatchObject({ url: "http://medusa:9000/bots/customers/verify", auth: "Bearer svc" });
  });
});
