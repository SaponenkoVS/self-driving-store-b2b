import { COMMITMENT_TYPES, needsLines, type MessageType, type OutgoingMessage } from "./envelope";

export const ROUND_CAP = 6;

export type ThreadStatus =
  | "open" // created, nothing sent yet
  | "requested" // rfq sent
  | "offered" // responder made an offer
  | "countered" // requester made a counter
  | "accepted"
  | "confirmed" // terminal
  | "rejected" // terminal
  | "expired"; // terminal

export const TERMINAL: ReadonlySet<ThreadStatus> = new Set(["confirmed", "rejected", "expired"]);

export interface ThreadState {
  status: ThreadStatus;
  /** account that sent the rfq (the buyer side) */
  requester: string | null;
  /** account that answers the rfq (the seller side) */
  responder: string | null;
  /** number of offer/counter messages so far */
  round: number;
  /** who must accept: the account that received the last offer/counter */
  pending_on: string | null;
}

export const initialThread = (): ThreadState => ({
  status: "open",
  requester: null,
  responder: null,
  round: 0,
  pending_on: null,
});

export type Verdict = { ok: true; next: ThreadState } | { ok: false; reason: string };

export interface TransitionOptions {
  /** Accounts that may only commit to prices with a decision_id (the store). */
  governedAccounts: ReadonlySet<string>;
  roundCap?: number;
}

/**
 * Pure transition function. The relay calls this before storing a message;
 * illegal moves are rejected so a confused (or malicious) bot can't skip steps.
 */
export function transition(
  state: ThreadState,
  msg: Pick<OutgoingMessage, "type" | "from" | "to" | "lines" | "decision_id">,
  opts: TransitionOptions,
): Verdict {
  const cap = opts.roundCap ?? ROUND_CAP;
  const sender = msg.from.account;
  const type: MessageType = msg.type;

  if (TERMINAL.has(state.status)) return fail(`thread is ${state.status}`);
  if (msg.from.account === msg.to.account) return fail("sender and recipient must be different accounts");

  if (needsLines(type) && !(msg.lines && msg.lines.length > 0)) return fail(`${type} needs at least one line`);
  if (
    (type === "offer" || type === "counter") &&
    msg.lines?.some((l) => l.unit_price === undefined || l.currency === undefined)
  )
    return fail(`${type} lines need unit_price and currency`);

  if (COMMITMENT_TYPES.has(type) && opts.governedAccounts.has(sender) && !msg.decision_id)
    return fail(`${sender} needs a decision_id to send ${type}`);

  if (state.status !== "open") {
    const parties = [state.requester, state.responder];
    if (!parties.includes(sender) || !parties.includes(msg.to.account))
      return fail("only the two thread parties may message in this thread");
  }

  // Messages that never change state.
  if (type === "info" || type === "error" || type === "hold") {
    if (state.status === "open") return fail(`${type} needs an existing negotiation`);
    return ok(state);
  }

  if (type === "reject") {
    if (state.status === "open") return fail("nothing to reject");
    return ok({ ...state, status: "rejected", pending_on: null });
  }

  switch (state.status) {
    case "open":
      if (type !== "rfq") return fail("a thread must start with rfq");
      return ok({
        status: "requested",
        requester: sender,
        responder: msg.to.account,
        round: 0,
        pending_on: msg.to.account,
      });

    case "requested":
      if (type !== "offer") return fail("after rfq the responder must send offer or reject");
      if (sender !== state.responder) return fail("only the responder can offer");
      return ok({ ...state, status: "offered", round: 1, pending_on: state.requester });

    case "offered":
    case "countered": {
      if (sender !== state.pending_on) return fail(`waiting on ${state.pending_on}`);
      if (type === "accept") return ok({ ...state, status: "accepted", pending_on: state.responder });
      const expected = state.status === "offered" ? "counter" : "offer";
      if (type !== expected) return fail(`expected ${expected}, accept or reject`);
      if (state.round >= cap) return fail(`round cap ${cap} reached: accept or reject`);
      return ok({
        ...state,
        status: type === "offer" ? "offered" : "countered",
        round: state.round + 1,
        pending_on: type === "offer" ? state.requester : state.responder,
      });
    }

    case "accepted":
      if (type !== "confirm") return fail("after accept only confirm or reject");
      if (sender !== state.responder) return fail("only the responder confirms");
      return ok({ ...state, status: "confirmed", pending_on: null });
  }
  return fail(`unexpected state ${state.status}`);
}

const ok = (next: ThreadState): Verdict => ({ ok: true, next });
const fail = (reason: string): Verdict => ({ ok: false, reason });
