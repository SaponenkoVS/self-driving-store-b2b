import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { Envelope, OutgoingMessage, initialThread, transition, PROTOCOL } from "@nsc/protocol";
import type { Envelope as EnvelopeT, OutgoingMessage as OutgoingMessageT } from "@nsc/protocol";
import { Bus } from "./bus";
import { RelayDb, type Account, type Principal } from "./db";
import { RateLimiter, type CustomerDirectory } from "./directory";
import { Deliverer } from "./deliver";
import { LIVE_HTML } from "./live-page";
import { StoreApiError, type OrderLine, type OrderSummary, type StoreApi } from "./store-api";

export interface RelayDeps {
  db: RelayDb;
  bus: Bus;
  deliverer: Deliverer;
  adminToken: string;
  /** Optional token for the public /live view; empty = open. */
  liveToken?: string;
  /** Verifies customer bot logins (email + company name + NIP). Absent = customer login disabled. */
  directory?: CustomerDirectory;
  loginLimiter?: RateLimiter;
  /** The store's Medusa: catalog search, and the order created when the store confirms. Absent = both disabled. */
  store?: StoreApi;
}

type Vars = { Variables: { account: Account; principal: Principal } };

const InviteBody = z.object({
  account_id: z.string().regex(/^[a-z0-9-]+$/).max(64),
  name: z.string().min(1).max(120),
  kind: z.enum(["store", "customer", "supplier"]),
  governed: z.boolean().optional(),
});
const RegisterBody = z.object({
  invite_code: z.string(),
  gateway_url: z.string().url().nullable().optional(),
  gateway_key: z.string().max(500).nullable().optional(),
});
const GatewayBody = RegisterBody.omit({ invite_code: true });
const CustomerLoginBody = z.object({
  email: z.string().trim().email().max(200),
  company_name: z.string().min(1).max(200),
  nip: z.string().min(10).max(20),
});

const CatalogParams = z.object({
  q: z.string().max(200).optional(),
  sku: z.string().max(1000).optional(),
  qty: z.coerce.number().int().positive().optional(),
  in_stock: z.enum(["1", "0", "true", "false"]).transform((v) => v === "1" || v === "true").optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * What a confirmed thread turns into: the customer is the Relay-stamped user of the rfq, the lines are the last
 * priced lines both sides saw (the accept, or the offer/counter it accepted). Never taken from the confirm itself.
 */
export function orderFromThread(messages: EnvelopeT[]): { customer_id: string | null; lines: OrderLine[] } {
  const customer_id = messages.find((m) => m.type === "rfq")?.from.user ?? null;
  const priced = [...messages]
    .reverse()
    .find(
      (m) =>
        (m.type === "accept" || m.type === "offer" || m.type === "counter") &&
        m.lines?.length &&
        m.lines.every((l) => typeof l.unit_price === "number"),
    );
  const lines = (priced?.lines ?? []).map((l) => ({ sku: l.sku, qty: l.qty, unit_price: l.unit_price as number }));
  return { customer_id, lines };
}

const bearer = (c: Context) => c.req.header("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";

export function createApp(deps: RelayDeps) {
  const { db, bus, deliverer } = deps;
  const app = new Hono<Vars>();

  app.get("/health", (c) => c.json({ ok: true, protocol: PROTOCOL }));

  // ---- admin: invite codes (one per account, handed to whoever runs that Grok account) ----
  app.post("/admin/invites", async (c) => {
    if (!deps.adminToken || bearer(c) !== deps.adminToken) return c.json({ error: "unauthorized" }, 401);
    const body = InviteBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const governed = body.data.governed ?? body.data.kind === "store";
    return c.json({ invite_code: db.createInvite({ ...body.data, governed }) }, 201);
  });

  // ---- registration: an account redeems its invite once ----
  app.post("/accounts/register", async (c) => {
    const body = RegisterBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const res = await db.register(body.data.invite_code, body.data.gateway_url ?? null, body.data.gateway_key ?? null);
    if (!res) return c.json({ error: "invalid or used invite" }, 400);
    return c.json(res, 201);
  });

  // ---- customer bot login: email + company name + NIP, checked against Medusa ----
  const limiter = deps.loginLimiter ?? new RateLimiter();
  app.post("/customers/auth", async (c) => {
    if (!deps.directory) return c.json({ error: "customer login is not configured" }, 503);
    const body = CustomerLoginBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "email, company_name and nip are required" }, 400);

    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const email = body.data.email.trim().toLowerCase();
    if (!limiter.allow(`ip:${ip}`) || !limiter.allow(`email:${email}`))
      return c.json({ error: "too many attempts, try again in 10 minutes" }, 429);

    let who;
    try {
      who = await deps.directory.verify(body.data);
    } catch (err) {
      console.error("customer verify failed", err);
      return c.json({ error: "store is unavailable, try again" }, 502);
    }
    // Same answer for every mismatch: don't reveal which of the three fields was wrong.
    if (!who) return c.json({ error: "no customer matches this email, company name and NIP" }, 401);

    const { account, token } = await db.issueCustomerCredential(who);
    return c.json(
      {
        customer_id: who.customer_id,
        employee_id: who.employee_id,
        name: who.name,
        email: who.email,
        company_id: who.company_id,
        company_name: who.company_name,
        account: account.id,
        role: "buyer",
        token,
        relay_secret: account.relay_secret,
      },
      201,
    );
  });

  // ---- everything below needs an account token ----
  const authed = new Hono<Vars>();
  authed.use(async (c, next) => {
    const principal = await db.principalByToken(bearer(c));
    if (!principal) return c.json({ error: "unauthorized" }, 401);
    c.set("principal", principal);
    c.set("account", principal.account);
    await next();
  });

  authed.get("/accounts/me", (c) => {
    const { relay_secret: _s, gateway_key: _k, ...me } = c.get("account");
    const p = c.get("principal");
    return c.json({ ...me, customer_id: p.customer_id, employee_id: p.employee_id, user_name: p.name, email: p.email });
  });

  authed.put("/accounts/me/gateway", async (c) => {
    const body = GatewayBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    db.updateGateway(c.get("account").id, body.data.gateway_url ?? null, body.data.gateway_key ?? null);
    return c.json({ ok: true });
  });

  authed.get("/directory", (c) => c.json({ accounts: db.directory() }));

  // search_catalog: products, volume prices and stock from Medusa. Any signed-in account.
  authed.get("/catalog", async (c) => {
    if (!deps.store) return c.json({ error: "catalog is not configured (MEDUSA_URL)" }, 503);
    const params = CatalogParams.safeParse(c.req.query());
    if (!params.success) return c.json({ error: "invalid query", details: params.error.flatten() }, 400);
    try {
      return c.json(await deps.store.catalog(params.data));
    } catch (err) {
      if (err instanceof StoreApiError && err.status < 500) return c.json(err.body, err.status as 400);
      console.error("catalog failed", err);
      return c.json({ error: "store is unavailable, try again" }, 502);
    }
  });

  /** The one path every message takes: validation, identity stamping, Medusa side effects, state machine, delivery. */
  const submitMessage = async (c: Context, principal: Principal, body: unknown) => {
    const me = principal.account;
    const parsed = OutgoingMessage.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid message", details: parsed.error.flatten() }, 400);
    // Identity comes from the credential, never from the bot: stamp from.user, drop anything the bot claimed.
    const { user: _claimedFrom, ...fromParty } = parsed.data.from;
    const { user: _claimedTo, ...toParty } = parsed.data.to;
    const msg = {
      ...parsed.data,
      from: principal.customer_id ? { ...fromParty, user: principal.customer_id } : fromParty,
      to: toParty,
    };

    if (msg.from.account !== me.id) return c.json({ error: `token belongs to ${me.id}, not ${msg.from.account}` }, 403);
    if (!db.account(msg.to.account)) return c.json({ error: `unknown account ${msg.to.account}` }, 404);

    // Idempotent retries: the same msg_id returns the stored envelope.
    const existing = db.messageByMsgId(msg.msg_id);
    if (existing) {
      if (existing.thread_id !== msg.thread_id || existing.from.account !== me.id)
        return c.json({ error: "msg_id already used" }, 409);
      return c.json({ ok: true, duplicate: true, seq: existing.seq, thread: db.thread(msg.thread_id) });
    }

    // create_order: when the store (a governed account) confirms an accepted thread, the order is created in Medusa
    // first, from the thread's history. If Medusa refuses (stock, floor price, spending limit), the confirm is refused.
    if (msg.type === "confirm" && me.governed && deps.store) {
      const placed = await placeOrder(deps.store, msg, me.id);
      if ("error" in placed) {
        bus.publish({ kind: "rejected", thread_id: msg.thread_id, from: me.id, type: msg.type, reason: placed.error });
        return c.json({ error: "order not created", reason: placed.error }, placed.status);
      }
      if (placed.order) {
        msg.ref = { ...msg.ref, order_id: placed.order.order_id, order_display_id: String(placed.order.display_id) };
      }
    }

    // receive_purchase: a supplier confirms a sale to the store (the store is the requester) -> the bought stock is
    // added in Medusa, so the customer order that needed it can be placed. If Medusa refuses, the confirm is refused.
    if (msg.type === "confirm" && !me.governed && deps.store) {
      const bought = await receivePurchase(deps.store, msg, me.id);
      if (bought) {
        bus.publish({ kind: "rejected", thread_id: msg.thread_id, from: me.id, type: msg.type, reason: bought.error });
        return c.json({ error: "purchase not recorded", reason: bought.error }, bought.status);
      }
    }

    const governedAccounts = db.governedAccounts();
    const result = db.appendMessage(msg.thread_id, (current, nextSeq) => {
      const verdict = transition(current ?? initialThread(), msg, { governedAccounts });
      if (!verdict.ok) return verdict;
      const envelope = Envelope.parse({
        ...msg,
        seq: nextSeq,
        round: verdict.next.round,
        sent_at: new Date().toISOString(),
      });
      return { ok: true, next: verdict.next, envelope };
    });

    if (!result.ok) {
      bus.publish({ kind: "rejected", thread_id: msg.thread_id, from: me.id, type: msg.type, reason: result.reason });
      return c.json({ error: "rejected by protocol", reason: result.reason, thread: db.thread(msg.thread_id) }, 422);
    }

    bus.publish({ kind: "message", envelope: result.envelope, thread: result.thread });
    void deliverer.deliver(result.envelope);
    const ref = result.envelope.ref;
    const order = ref?.order_id ? { order: { order_id: ref.order_id, display_id: ref.order_display_id } } : {};
    return c.json({ ok: true, seq: result.envelope.seq, thread: result.thread, ...order }, 202);
  };

  authed.post("/messages", async (c) => submitMessage(c, c.get("principal"), await c.req.json().catch(() => null)));

  // Demo/testing: the admin sends a message AS any account (e.g. start a supplier negotiation as the store
  // without the store bots). Same pipeline as /messages; only the identity comes from the admin's choice.
  app.post("/admin/send", async (c) => {
    if (!deps.adminToken || bearer(c) !== deps.adminToken) return c.json({ error: "unauthorized" }, 401);
    const body = (await c.req.json().catch(() => null)) as { as?: string; message?: unknown } | null;
    const account = body?.as ? db.account(body.as) : null;
    if (!account) return c.json({ error: "unknown account in 'as'" }, 404);
    return submitMessage(c, { account, customer_id: null, employee_id: null, name: "admin", email: null }, body?.message);
  });

  // Threads the caller takes part in. ?pending=1 → only threads waiting on the caller (what to do on wake-up).
  authed.get("/threads", (c) => {
    const me = c.get("account").id;
    return c.json({ threads: db.threadsFor(me, c.req.query("pending") === "1") });
  });

  authed.get("/threads/:id", (c) => {
    const me = c.get("account").id;
    const thread = db.thread(c.req.param("id"));
    if (!thread || (thread.requester !== me && thread.responder !== me)) return c.json({ error: "not found" }, 404);
    const since = Number(c.req.query("since") ?? 0) || 0;
    return c.json({ thread, messages: db.messages(thread.id, since) });
  });

  // get_order_status: the Medusa order of a confirmed thread, for either party.
  authed.get("/threads/:id/order", async (c) => {
    const me = c.get("account").id;
    const thread = db.thread(c.req.param("id"));
    if (!thread || (thread.requester !== me && thread.responder !== me)) return c.json({ error: "not found" }, 404);
    if (!deps.store) return c.json({ error: "orders are not configured (MEDUSA_URL)" }, 503);
    const confirm = db.messages(thread.id).find((m) => m.type === "confirm" && m.ref?.order_id);
    if (!confirm?.ref?.order_id) return c.json({ error: "no order for this thread yet", thread }, 404);
    try {
      const order = await deps.store.order(confirm.ref.order_id);
      return order ? c.json({ thread_id: thread.id, order }) : c.json({ error: "order not found in the store" }, 404);
    } catch (err) {
      console.error("order lookup failed", err);
      return c.json({ error: "store is unavailable, try again" }, 502);
    }
  });

  authed.post("/messages/:msg_id/ack", (c) => {
    const ok = db.ack(c.req.param("msg_id"), c.get("account").id);
    return c.json({ ok }, ok ? 200 : 404);
  });

  app.route("/", authed);

  // ---- demo screen ----
  const liveAllowed = (c: Context) => !deps.liveToken || c.req.query("token") === deps.liveToken;

  app.get("/live", (c) => (liveAllowed(c) ? c.html(LIVE_HTML) : c.text("unauthorized", 401)));

  app.get("/live/snapshot", (c) => {
    if (!liveAllowed(c)) return c.json({ error: "unauthorized" }, 401);
    const threads = db.allThreads(50).map((t) => ({ ...t, messages: db.messages(t.id) }));
    return c.json({ accounts: db.directory(), threads });
  });

  app.get("/live/events", (c) => {
    if (!liveAllowed(c)) return c.text("unauthorized", 401);
    return streamSSE(c, async (stream) => {
      const unsubscribe = bus.subscribe((e) => void stream.writeSSE({ event: e.kind, data: JSON.stringify(e) }));
      stream.onAbort(unsubscribe);
      while (!stream.aborted) await stream.sleep(15_000).then(() => stream.writeSSE({ event: "ping", data: "{}" }));
      unsubscribe();
    });
  });

  /** Creates the Medusa order for a store confirm. { order: null } = not a confirm we can act on; the protocol decides. */
  type Placed = { order: OrderSummary | null } | { error: string; status: 422 | 502 };
  async function placeOrder(store: StoreApi, msg: OutgoingMessageT, me: string): Promise<Placed> {
    const thread = db.thread(msg.thread_id);
    if (!thread || thread.status !== "accepted" || thread.pending_on !== me || !msg.decision_id) return { order: null };
    const { customer_id, lines } = orderFromThread(db.messages(thread.id));
    if (!customer_id) return { error: "the rfq has no signed-in customer, so no order can be created", status: 422 as const };
    if (!lines.length) return { error: "no priced lines were accepted in this thread", status: 422 as const };
    try {
      const order = await store.createOrder({ customer_id, thread_id: thread.id, decision_id: msg.decision_id, lines, note: msg.note });
      return { order };
    } catch (err) {
      if (err instanceof StoreApiError && err.status < 500)
        return { error: `${err.body.error ?? "order_failed"}: ${err.message}`, status: 422 as const };
      console.error("order creation failed", err);
      return { error: "store is unavailable, try again", status: 502 as const };
    }
  }

  /** Records a supplier sale in Medusa. Returns an error, or null when done (or when this confirm isn't one). */
  async function receivePurchase(store: StoreApi, msg: OutgoingMessageT, me: string) {
    const thread = db.thread(msg.thread_id);
    if (!thread || thread.status !== "accepted" || thread.pending_on !== me) return null;
    if (!thread.requester || !db.governedAccounts().has(thread.requester)) return null; // only purchases by the store
    const messages = db.messages(thread.id);
    const { lines } = orderFromThread(messages);
    if (!lines.length) return { error: "no priced lines were accepted in this thread", status: 422 as const };
    const decision_id = [...messages].reverse().find((m) => m.type === "accept")?.decision_id ?? undefined;
    try {
      await store.receivePurchase({ thread_id: thread.id, supplier: me, decision_id, lines });
      return null;
    } catch (err) {
      if (err instanceof StoreApiError && err.status < 500)
        return { error: `${err.body.error ?? "purchase_failed"}: ${err.message}`, status: 422 as const };
      console.error("purchase failed", err);
      return { error: "store is unavailable, try again", status: 502 as const };
    }
  }

  return app;
}
