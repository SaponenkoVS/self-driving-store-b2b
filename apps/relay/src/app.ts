import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { Envelope, OutgoingMessage, initialThread, transition, PROTOCOL } from "@nsc/protocol";
import { Bus } from "./bus";
import { RelayDb, type Account, type Principal } from "./db";
import { RateLimiter, type CustomerDirectory } from "./directory";
import { Deliverer } from "./deliver";
import { LIVE_HTML } from "./live-page";

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

  authed.post("/messages", async (c) => {
    const me = c.get("account");
    const parsed = OutgoingMessage.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid message", details: parsed.error.flatten() }, 400);
    // Identity comes from the credential, never from the bot: stamp from.user, drop anything the bot claimed.
    const principal = c.get("principal");
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
    return c.json({ ok: true, seq: result.envelope.seq, thread: result.thread }, 202);
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

  return app;
}
