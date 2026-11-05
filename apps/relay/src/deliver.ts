import { signEnvelope, type Envelope } from "@nsc/protocol";
import type { Bus } from "./bus";
import type { RelayDb } from "./db";

/** Backoff after attempt n (1-based). After the last entry the message is marked failed; bots can still pull it. */
const BACKOFF_MS = [2_000, 8_000, 30_000, 60_000, 120_000];
export const MAX_ATTEMPTS = BACKOFF_MS.length + 1;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class Deliverer {
  private inflight = new Set<string>();

  constructor(
    private db: RelayDb,
    private bus: Bus,
    private fetchImpl: FetchLike = fetch,
    private timeoutMs = 15_000,
  ) {}

  /** Try to deliver now (called right after a message is stored). */
  async deliver(env: Envelope): Promise<void> {
    if (this.inflight.has(env.msg_id)) return;
    this.inflight.add(env.msg_id);
    try {
      await this.attempt(env);
    } finally {
      this.inflight.delete(env.msg_id);
    }
  }

  /** Retry everything that is due. Run on an interval. */
  async sweep(): Promise<void> {
    await Promise.all(this.db.dueDeliveries(MAX_ATTEMPTS).map((e) => this.deliver(e)));
  }

  private async attempt(env: Envelope) {
    const recipient = this.db.account(env.to.account);
    const attemptNo = this.db.attempts(env.msg_id) + 1;
    const fail = (error: string, permanent = false) => {
      const retryInMs = permanent || attemptNo >= MAX_ATTEMPTS ? null : BACKOFF_MS[attemptNo - 1]!;
      this.db.recordAttempt(env.msg_id, { ok: false, error, retryInMs });
      this.bus.publish({
        kind: "delivery",
        msg_id: env.msg_id,
        thread_id: env.thread_id,
        status: retryInMs === null ? "failed" : "retrying",
        error,
      });
    };

    if (!recipient) return fail(`unknown account ${env.to.account}`, true);
    if (!recipient.gateway_url) return fail("recipient has no gateway webhook (it can still pull /threads)");

    const signed = await signEnvelope(env, recipient.relay_secret);
    const headers: Record<string, string> = { "content-type": "application/json" };
    // Grok Bot routine webhooks authenticate with `Authorization: Bearer <key>`. Keys copied by hand often
    // carry a trailing newline, which makes the webhook answer 400, so trim it.
    if (recipient.gateway_key) headers.authorization = `Bearer ${recipient.gateway_key.trim()}`;

    try {
      const res = await this.fetchImpl(recipient.gateway_url, {
        method: "POST",
        headers,
        body: JSON.stringify(signed),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.ok) {
        this.db.recordAttempt(env.msg_id, { ok: true });
        this.bus.publish({ kind: "delivery", msg_id: env.msg_id, thread_id: env.thread_id, status: "delivered" });
        return;
      }
      const text = (await res.text().catch(() => "")).slice(0, 200);
      // 4xx (except timeouts / rate limits) won't fix itself by retrying: bad key or bad body.
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
      return fail(`HTTP ${res.status} ${text}`.trim(), permanent);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
}
