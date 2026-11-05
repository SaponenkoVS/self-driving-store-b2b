import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { Bus } from "../src/bus";
import { RelayDb } from "../src/db";
import { Deliverer } from "../src/deliver";
import { RateLimiter, SeedDirectory } from "../src/directory";
import { MedusaStoreApi, StoreApiError, type CreateOrderInput, type StoreApi } from "../src/store-api";

const ANNA = {
  customer_id: "cus_anna",
  employee_id: "emp_anna",
  name: "Anna Keller",
  email: "anna@bellabau.pl",
  company_id: "comp_bella",
  company_name: "Bella Bau Sp. z o.o.",
  tax_id: "5261040828",
};
const CUSTOMER = "co-5261040828";

/** Fake Medusa: records orders, can be told to refuse. */
class FakeStore implements StoreApi {
  orders: CreateOrderInput[] = [];
  refuse: StoreApiError | null = null;
  async catalog(q: object) {
    return { total: 1, count: 1, items: [{ sku: "AQU-1030-01", title: "Steel Downpipe", list_price: 19.9 }], query: q };
  }
  async createOrder(input: CreateOrderInput) {
    if (this.refuse) throw this.refuse;
    this.orders.push(input);
    return { order_id: "order_1", display_id: 7, status: "pending", total: 728, currency: "EUR", thread_id: input.thread_id };
  }
  async order(id: string) {
    return id === "order_1" ? { order_id: "order_1", display_id: 7, status: "pending", total: 728, currency: "EUR", thread_id: "T-1" } : null;
  }
}

let app: ReturnType<typeof createApp>;
let store: FakeStore;
let storeToken: string;
let annaToken: string;

async function req(method: string, path: string, body?: unknown, token?: string) {
  const res = await app.request(path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json()) as any };
}

let n = 0;
const msg = (from: "store" | "buyer", type: string, extra: object = {}) => ({
  protocol: "b2b-nego/v1",
  msg_id: `msg-${++n}-${Date.now()}`,
  thread_id: "T-1",
  from: from === "store" ? { account: "store", role: "customer-manager" } : { account: CUSTOMER, role: "buyer" },
  to: from === "store" ? { account: CUSTOMER, role: "buyer" } : { account: "store", role: "customer-manager" },
  type,
  ...extra,
});
const priced = (p: number) => [{ sku: "AQU-1030-01", qty: 40, unit_price: p, currency: "EUR" }];

/** rfq → offer 19 → counter 18 → offer 18.2 → accept, so the thread waits for the store's confirm. */
async function negotiate() {
  expect((await req("POST", "/messages", msg("buyer", "rfq", { lines: [{ sku: "AQU-1030-01", qty: 40 }] }), annaToken)).status).toBe(202);
  expect((await req("POST", "/messages", msg("store", "offer", { lines: priced(19), decision_id: "DEC-1" }), storeToken)).status).toBe(202);
  expect((await req("POST", "/messages", msg("buyer", "counter", { lines: priced(18) }), annaToken)).status).toBe(202);
  expect((await req("POST", "/messages", msg("store", "offer", { lines: priced(18.2), decision_id: "DEC-2" }), storeToken)).status).toBe(202);
  expect((await req("POST", "/messages", msg("buyer", "accept", { lines: priced(18.2) }), annaToken)).status).toBe(202);
}

beforeEach(async () => {
  const db = new RelayDb(":memory:");
  const bus = new Bus();
  store = new FakeStore();
  app = createApp({
    db,
    bus,
    deliverer: new Deliverer(db, bus, async () => Response.json({ success: true })),
    adminToken: "admin",
    directory: new SeedDirectory([ANNA]),
    loginLimiter: new RateLimiter(50, 60_000),
    store,
  });
  const inv = await req("POST", "/admin/invites", { account_id: "store", name: "Store", kind: "store" }, "admin");
  storeToken = (await req("POST", "/accounts/register", { invite_code: inv.json.invite_code, gateway_url: "https://hooks.example/store" })).json
    .account_token;
  annaToken = (await req("POST", "/customers/auth", { email: ANNA.email, company_name: ANNA.company_name, nip: ANNA.tax_id })).json.token;
});

describe("catalog", () => {
  test("any signed-in account can search; anonymous can't", async () => {
    const r = await req("GET", "/catalog?q=downpipe&qty=40&in_stock=1", undefined, annaToken);
    expect(r.status).toBe(200);
    expect(r.json.items[0].sku).toBe("AQU-1030-01");
    expect(r.json.query).toEqual({ q: "downpipe", qty: 40, in_stock: true });
    expect((await req("GET", "/catalog?q=x")).status).toBe(401);
  });
});

describe("order on confirm", () => {
  test("store confirm creates the Medusa order from the thread and stamps ref.order_id", async () => {
    await negotiate();
    // The bot's confirm claims other lines; the order still uses what the buyer accepted.
    const r = await req("POST", "/messages", msg("store", "confirm", { decision_id: "DEC-2", lines: priced(25) }), storeToken);
    expect(r.status).toBe(202);
    expect(r.json.thread.status).toBe("confirmed");
    expect(store.orders).toEqual([
      { customer_id: "cus_anna", thread_id: "T-1", decision_id: "DEC-2", lines: [{ sku: "AQU-1030-01", qty: 40, unit_price: 18.2 }], note: undefined },
    ]);

    const thread = await req("GET", "/threads/T-1", undefined, annaToken);
    const confirm = thread.json.messages.at(-1);
    expect(confirm.ref).toEqual({ order_id: "order_1", order_display_id: "7" });

    const status = await req("GET", "/threads/T-1/order", undefined, annaToken);
    expect(status.status).toBe(200);
    expect(status.json.order).toMatchObject({ order_id: "order_1", total: 728 });
  });

  test("Medusa refusal blocks the confirm and keeps the thread open", async () => {
    await negotiate();
    store.refuse = new StoreApiError(403, { error: "spending_limit_exceeded", message: "Order total 728 is above the limit 500" });
    const r = await req("POST", "/messages", msg("store", "confirm", { decision_id: "DEC-2" }), storeToken);
    expect(r.status).toBe(422);
    expect(r.json.reason).toContain("spending_limit_exceeded");
    expect((await req("GET", "/threads/T-1", undefined, storeToken)).json.thread.status).toBe("accepted");
  });

  test("no order before a confirm", async () => {
    await negotiate();
    expect((await req("GET", "/threads/T-1/order", undefined, annaToken)).status).toBe(404);
    expect(store.orders).toHaveLength(0);
  });
});

describe("MedusaStoreApi", () => {
  test("calls /bots routes with the service token and passes Medusa errors on", async () => {
    const seen: string[] = [];
    const api = new MedusaStoreApi("http://medusa:9000/", "svc", (async (url: string, init: RequestInit) => {
      seen.push(`${init.method} ${url} ${new Headers(init.headers).get("authorization")}`);
      if (String(url).includes("/bots/orders/missing")) return Response.json({ error: "not_found" }, { status: 404 });
      if (init.method === "POST") return Response.json({ error: "insufficient_stock", message: "no stock" }, { status: 409 });
      return Response.json({ items: [] });
    }) as typeof fetch);
    await api.catalog({ q: "pipe", in_stock: true });
    expect(await api.order("missing")).toBeNull();
    await expect(api.createOrder({ customer_id: "c", thread_id: "t", decision_id: "d", lines: [] })).rejects.toMatchObject({
      status: 409,
      body: { error: "insufficient_stock" },
    });
    expect(seen[0]).toBe("GET http://medusa:9000/bots/catalog?q=pipe&in_stock=1 Bearer svc");
  });
});
