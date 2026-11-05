import { Database } from "bun:sqlite";
import type { Envelope, ThreadState } from "@nsc/protocol";

export type AccountKind = "store" | "customer" | "supplier";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  governed: boolean;
  gateway_url: string | null;
  gateway_key: string | null;
  relay_secret: string;
}

/** Who is calling: the account, plus the person when it's a customer bot credential. */
export interface Principal {
  account: Account;
  customer_id: string | null;
  employee_id: string | null;
  name: string | null;
  email: string | null;
}

export interface CustomerIdentity {
  customer_id: string;
  employee_id: string | null;
  name: string;
  email: string;
  company_id: string;
  company_name: string;
  tax_id: string;
}

export interface ThreadRow extends ThreadState {
  id: string;
  created_at: string;
  updated_at: string;
}

export type DeliveryStatus = "pending" | "delivered" | "failed";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL,
  governed INTEGER NOT NULL, used_at TEXT
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, governed INTEGER NOT NULL,
  gateway_url TEXT, gateway_key TEXT, token_hash TEXT NOT NULL UNIQUE, relay_secret TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY, status TEXT NOT NULL, requester TEXT, responder TEXT, round INTEGER NOT NULL,
  pending_on TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  thread_id TEXT NOT NULL, seq INTEGER NOT NULL, msg_id TEXT NOT NULL UNIQUE,
  from_account TEXT NOT NULL, to_account TEXT NOT NULL, type TEXT NOT NULL, envelope TEXT NOT NULL,
  delivery TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
  next_attempt_at TEXT, acked_at TEXT,
  PRIMARY KEY (thread_id, seq)
);
CREATE INDEX IF NOT EXISTS messages_delivery ON messages (delivery, next_attempt_at);
-- Per-person credentials for customer bots (email + company name + NIP login).
CREATE TABLE IF NOT EXISTS credentials (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, customer_id TEXT NOT NULL,
  employee_id TEXT, name TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS credentials_customer ON credentials (customer_id);
`;

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `${prefix}_${Buffer.from(bytes).toString("base64url")}`;
}

const now = () => new Date().toISOString();

export class RelayDb {
  readonly db: Database;

  constructor(path = ":memory:") {
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(SCHEMA);
  }

  createInvite(input: { account_id: string; name: string; kind: AccountKind; governed: boolean }): string {
    const code = randomToken("inv");
    this.db
      .query("INSERT INTO invites (code, account_id, name, kind, governed) VALUES (?, ?, ?, ?, ?)")
      .run(code, input.account_id, input.name, input.kind, input.governed ? 1 : 0);
    return code;
  }

  /** Redeems an invite. Returns the new account's token + relay secret (shown once). */
  async register(code: string, gateway_url: string | null, gateway_key: string | null) {
    const invite = this.db.query("SELECT * FROM invites WHERE code = ? AND used_at IS NULL").get(code) as
      | { account_id: string; name: string; kind: AccountKind; governed: number }
      | null;
    if (!invite) return null;
    if (this.db.query("SELECT 1 FROM accounts WHERE id = ?").get(invite.account_id)) return null;
    const token = randomToken("nsc");
    const relay_secret = randomToken("rsec");
    const token_hash = await sha256(token);
    this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO accounts (id, name, kind, governed, gateway_url, gateway_key, token_hash, relay_secret, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(invite.account_id, invite.name, invite.kind, invite.governed, gateway_url, gateway_key, token_hash, relay_secret, now());
      this.db.query("UPDATE invites SET used_at = ? WHERE code = ?").run(now(), code);
    })();
    return { account_id: invite.account_id, account_token: token, relay_secret };
  }

  async principalByToken(token: string): Promise<Principal | null> {
    if (!token) return null;
    const hash = await sha256(token);
    const row = this.db.query("SELECT * FROM accounts WHERE token_hash = ?").get(hash);
    if (row) return { account: toAccount(row), customer_id: null, employee_id: null, name: null, email: null };
    const cred = this.db
      .query("SELECT * FROM credentials WHERE token_hash = ? AND revoked_at IS NULL")
      .get(hash) as { account_id: string; customer_id: string; employee_id: string | null; name: string; email: string } | null;
    if (!cred) return null;
    const account = this.account(cred.account_id);
    if (!account) return null;
    return { account, customer_id: cred.customer_id, employee_id: cred.employee_id, name: cred.name, email: cred.email };
  }

  /**
   * After Medusa verified email + company name + NIP: make sure the company has a Relay account
   * (id "co-<nip>") and issue a new credential for this person. Returns the token once.
   */
  async issueCustomerCredential(who: CustomerIdentity) {
    const account_id = `co-${who.tax_id}`;
    const token = randomToken("nsc");
    const token_hash = await sha256(token);
    const ts = now();
    this.db.transaction(() => {
      if (!this.db.query("SELECT 1 FROM accounts WHERE id = ?").get(account_id)) {
        // The company-level token is never handed out; people use their own credentials.
        this.db
          .query(
            `INSERT INTO accounts (id, name, kind, governed, gateway_url, gateway_key, token_hash, relay_secret, created_at)
             VALUES (?, ?, 'customer', 0, NULL, NULL, ?, ?, ?)`,
          )
          .run(account_id, who.company_name, `unused:${randomToken("x")}`, randomToken("rsec"), ts);
      } else {
        this.db.query("UPDATE accounts SET name = ? WHERE id = ?").run(who.company_name, account_id);
      }
      this.db
        .query(
          "INSERT INTO credentials (token_hash, account_id, customer_id, employee_id, name, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(token_hash, account_id, who.customer_id, who.employee_id, who.name, who.email, ts);
    })();
    return { account: this.account(account_id)!, token };
  }

  revokeCustomerCredentials(customer_id: string): number {
    return this.db.query("UPDATE credentials SET revoked_at = ? WHERE customer_id = ? AND revoked_at IS NULL").run(now(), customer_id)
      .changes;
  }

  account(id: string): Account | null {
    const row = this.db.query("SELECT * FROM accounts WHERE id = ?").get(id);
    return row ? toAccount(row) : null;
  }

  updateGateway(id: string, gateway_url: string | null, gateway_key: string | null) {
    this.db.query("UPDATE accounts SET gateway_url = ?, gateway_key = ? WHERE id = ?").run(gateway_url, gateway_key, id);
  }

  directory() {
    return this.db.query("SELECT id, name, kind FROM accounts ORDER BY kind, id").all() as {
      id: string;
      name: string;
      kind: AccountKind;
    }[];
  }

  governedAccounts(): Set<string> {
    const rows = this.db.query("SELECT id FROM accounts WHERE governed = 1").all() as { id: string }[];
    return new Set(rows.map((r) => r.id));
  }

  thread(id: string): ThreadRow | null {
    return (this.db.query("SELECT * FROM threads WHERE id = ?").get(id) as ThreadRow | null) ?? null;
  }

  threadsFor(account: string, onlyPending = false): ThreadRow[] {
    const sql = onlyPending
      ? "SELECT * FROM threads WHERE pending_on = ? ORDER BY updated_at DESC"
      : "SELECT * FROM threads WHERE requester = ? OR responder = ? ORDER BY updated_at DESC LIMIT 100";
    return (onlyPending
      ? this.db.query(sql).all(account)
      : this.db.query(sql).all(account, account)) as ThreadRow[];
  }

  allThreads(limit = 200): ThreadRow[] {
    return this.db.query("SELECT * FROM threads ORDER BY updated_at DESC LIMIT ?").all(limit) as ThreadRow[];
  }

  messageByMsgId(msg_id: string): Envelope | null {
    const row = this.db.query("SELECT envelope FROM messages WHERE msg_id = ?").get(msg_id) as { envelope: string } | null;
    return row ? JSON.parse(row.envelope) : null;
  }

  messages(thread_id: string, since = 0): (Envelope & { delivery: DeliveryStatus })[] {
    const rows = this.db
      .query("SELECT envelope, delivery FROM messages WHERE thread_id = ? AND seq > ? ORDER BY seq")
      .all(thread_id, since) as { envelope: string; delivery: DeliveryStatus }[];
    return rows.map((r) => ({ ...JSON.parse(r.envelope), delivery: r.delivery }));
  }

  /**
   * Atomically: re-check state, assign seq, store message, update thread.
   * `decide` runs inside the transaction so two concurrent sends can't both pass the state check.
   */
  appendMessage(
    thread_id: string,
    decide: (current: ThreadRow | null, nextSeq: number) => { ok: true; next: ThreadState; envelope: Envelope } | { ok: false; reason: string },
  ): { ok: true; envelope: Envelope; thread: ThreadRow } | { ok: false; reason: string } {
    return this.db.transaction(() => {
      const current = this.thread(thread_id);
      const last = this.db.query("SELECT MAX(seq) AS s FROM messages WHERE thread_id = ?").get(thread_id) as { s: number | null };
      const verdict = decide(current, (last.s ?? 0) + 1);
      if (!verdict.ok) return verdict;
      const { next, envelope } = verdict;
      const ts = now();
      if (current) {
        this.db
          .query("UPDATE threads SET status = ?, requester = ?, responder = ?, round = ?, pending_on = ?, updated_at = ? WHERE id = ?")
          .run(next.status, next.requester, next.responder, next.round, next.pending_on, ts, thread_id);
      } else {
        this.db
          .query("INSERT INTO threads (id, status, requester, responder, round, pending_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(thread_id, next.status, next.requester, next.responder, next.round, next.pending_on, ts, ts);
      }
      this.db
        .query(
          "INSERT INTO messages (thread_id, seq, msg_id, from_account, to_account, type, envelope, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(thread_id, envelope.seq, envelope.msg_id, envelope.from.account, envelope.to.account, envelope.type, JSON.stringify(envelope), ts);
      return { ok: true as const, envelope, thread: this.thread(thread_id)! };
    })();
  }

  dueDeliveries(maxAttempts: number): Envelope[] {
    const rows = this.db
      .query("SELECT envelope FROM messages WHERE delivery = 'pending' AND attempts < ? AND next_attempt_at <= ? ORDER BY next_attempt_at LIMIT 50")
      .all(maxAttempts, now()) as { envelope: string }[];
    return rows.map((r) => JSON.parse(r.envelope));
  }

  recordAttempt(msg_id: string, result: { ok: true } | { ok: false; error: string; retryInMs: number | null }) {
    if (result.ok) {
      this.db.query("UPDATE messages SET delivery = 'delivered', attempts = attempts + 1, last_error = NULL WHERE msg_id = ?").run(msg_id);
    } else if (result.retryInMs === null) {
      this.db.query("UPDATE messages SET delivery = 'failed', attempts = attempts + 1, last_error = ? WHERE msg_id = ?").run(result.error, msg_id);
    } else {
      const next = new Date(Date.now() + result.retryInMs).toISOString();
      this.db
        .query("UPDATE messages SET attempts = attempts + 1, last_error = ?, next_attempt_at = ? WHERE msg_id = ?")
        .run(result.error, next, msg_id);
    }
  }

  attempts(msg_id: string): number {
    const row = this.db.query("SELECT attempts FROM messages WHERE msg_id = ?").get(msg_id) as { attempts: number } | null;
    return row?.attempts ?? 0;
  }

  ack(msg_id: string, account: string): boolean {
    const res = this.db
      .query("UPDATE messages SET acked_at = ? WHERE msg_id = ? AND to_account = ? AND acked_at IS NULL")
      .run(now(), msg_id, account);
    return res.changes > 0;
  }
}

function toAccount(row: unknown): Account {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as AccountKind,
    governed: r.governed === 1,
    gateway_url: (r.gateway_url as string | null) ?? null,
    gateway_key: (r.gateway_key as string | null) ?? null,
    relay_secret: r.relay_secret as string,
  };
}
