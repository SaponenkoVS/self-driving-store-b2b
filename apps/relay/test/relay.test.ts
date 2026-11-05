import { beforeEach, describe, expect, test } from "bun:test";
import { Envelope, unwrapIncoming, verifyEnvelope } from "@nsc/protocol";
import { createApp } from "../src/app";
import { Bus } from "../src/bus";
import { RelayDb } from "../src/db";
import { Deliverer, type FetchLike } from "../src/deliver";

type Call = { url: string; headers: Record<string, string>; body: unknown };

let db: RelayDb;
let app: ReturnType<typeof createApp>;
let deliverer: Deliverer;
let calls: Call[];
let respond: (url: string) => Response;
const tokens: Record<string, string> = {};
const secrets: Record<string, string> = {};

const fakeFetch: FetchLike = async (url, init) => {
  calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
  return respond(url);
};

async function req(method: string, path: string, body?: unknown, token?: string) {
  const res = await app.request(path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json()) as any };
}

async function onboard(account_id: string, kind: "store" | "customer" | "supplier") {
  const inv = await req("POST", "/admin/invites", { account_id, name: account_id, kind }, "admin");
  const reg = await req("POST", "/accounts/register", {
    invite_code: inv.json.invite_code,
    gateway_url: `https://hooks.example/${account_id}`,
    gateway_key: `crsr_${account_id}\n`,
  });
  tokens[account_id] = reg.json.account_token;
  secrets[account_id] = reg.json.relay_secret;
}

let n = 0;
const msg = (from: [string, string], to: [string, string], type: string, extra: object = {}) => ({
  protocol: "b2b-nego/v1",
  msg_id: `msg-${++n}-xxxx`,
  thread_id: "T-1",
  from: { account: from[0], role: from[1] },
  to: { account: to[0], role: to[1] },
  type,
  ...extra,
});
const BUYER: [string, string] = ["bella-bau", "buyer"];
const STORE: [string, string] = ["store", "customer-manager"];
const lines = (price?: number) => [{ sku: "PIPE", qty: 40, ...(price ? { unit_price: price, currency: "CHF" } : {}) }];
const flush = () => new Promise((r) => setTimeout(r, 10));

beforeEach(async () => {
  db = new RelayDb(":memory:");
  calls = [];
  respond = () => Response.json({ success: true });
  const bus = new Bus();
  deliverer = new Deliverer(db, bus, fakeFetch);
  app = createApp({ db, bus, deliverer, adminToken: "admin" });
  await onboard("store", "store");
  await onboard("bella-bau", "customer");
});

describe("registration", () => {
  test("invite can only be used once and needs the admin token", async () => {
    expect((await req("POST", "/admin/invites", { account_id: "x", name: "x", kind: "customer" }, "nope")).status).toBe(401);
    const inv = await req("POST", "/admin/invites", { account_id: "x", name: "x", kind: "customer" }, "admin");
    expect((await req("POST", "/accounts/register", { invite_code: inv.json.invite_code })).status).toBe(201);
    expect((await req("POST", "/accounts/register", { invite_code: inv.json.invite_code })).status).toBe(400);
  });

  test("store accounts are governed by default", () => {
    expect(db.governedAccounts()).toEqual(new Set(["store"]));
  });
});

describe("messages", () => {
  test("cannot send as another account", async () => {
    const r = await req("POST", "/messages", msg(STORE, BUYER, "rfq", { lines: lines() }), tokens["bella-bau"]);
    expect(r.status).toBe(403);
  });

  test("full negotiation and delivery to the recipient's gateway", async () => {
    expect((await req("POST", "/messages", msg(BUYER, STORE, "rfq", { lines: lines() }), tokens["bella-bau"])).status).toBe(202);
    const blocked = await req("POST", "/messages", msg(STORE, BUYER, "offer", { lines: lines(80) }), tokens.store);
    expect(blocked.status).toBe(422);
    expect(blocked.json.reason).toContain("decision_id");
    await req("POST", "/messages", msg(STORE, BUYER, "offer", { lines: lines(80), decision_id: "DEC-1" }), tokens.store);
    await req("POST", "/messages", msg(BUYER, STORE, "accept"), tokens["bella-bau"]);
    const done = await req("POST", "/messages", msg(STORE, BUYER, "confirm", { decision_id: "DEC-1" }), tokens.store);
    expect(done.json.thread.status).toBe("confirmed");
    await flush();

    expect(calls.map((c) => c.url)).toEqual([
      "https://hooks.example/store",
      "https://hooks.example/bella-bau",
      "https://hooks.example/store",
      "https://hooks.example/bella-bau",
    ]);
    const first = calls[0]!;
    expect(first.headers.authorization).toBe("Bearer crsr_store"); // trailing newline trimmed
    const env = Envelope.parse(unwrapIncoming({ context: (first.body as any).context }));
    expect(env.seq).toBe(1);
    expect(await verifyEnvelope(env, secrets.store!)).toBe(true);
    expect(await verifyEnvelope(env, secrets["bella-bau"]!)).toBe(false);
  });

  test("same msg_id is idempotent", async () => {
    const m = msg(BUYER, STORE, "rfq", { lines: lines() });
    await req("POST", "/messages", m, tokens["bella-bau"]);
    const again = await req("POST", "/messages", m, tokens["bella-bau"]);
    expect(again.status).toBe(200);
    expect(again.json.duplicate).toBe(true);
    expect(db.messages("T-1")).toHaveLength(1);
  });

  test("threads are private to their two parties", async () => {
    await onboard("other-co", "customer");
    await req("POST", "/messages", msg(BUYER, STORE, "rfq", { lines: lines() }), tokens["bella-bau"]);
    expect((await req("GET", "/threads/T-1", undefined, tokens["other-co"])).status).toBe(404);
    const mine = await req("GET", "/threads?pending=1", undefined, tokens.store);
    expect(mine.json.threads.map((t: any) => t.id)).toEqual(["T-1"]);
    const since = await req("GET", "/threads/T-1?since=1", undefined, tokens.store);
    expect(since.json.messages).toHaveLength(0);
  });
});

describe("delivery", () => {
  test("5xx is retried by the sweeper, 4xx fails for good", async () => {
    respond = () => new Response("boom", { status: 503 });
    await req("POST", "/messages", msg(BUYER, STORE, "rfq", { lines: lines() }), tokens["bella-bau"]);
    await flush();
    expect(db.messages("T-1")[0]!.delivery).toBe("pending");

    db.db.query("UPDATE messages SET next_attempt_at = '2000-01-01'").run();
    respond = () => Response.json({ success: true });
    await deliverer.sweep();
    expect(db.messages("T-1")[0]!.delivery).toBe("delivered");

    respond = () => new Response("bad key", { status: 401 });
    await req("POST", "/messages", msg(STORE, BUYER, "reject"), tokens.store);
    await flush();
    expect(db.messages("T-1")[1]!.delivery).toBe("failed");
  });
});
