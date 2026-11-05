import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Envelope,
  OutgoingMessage,
  initialThread,
  signEnvelope,
  transition,
  unwrapIncoming,
  verifyEnvelope,
  type OutgoingMessage as Msg,
  type ThreadState,
} from "../src";

const governed = { governedAccounts: new Set(["store"]) };
const buyer = { account: "bella-bau", role: "buyer" };
const store = { account: "store", role: "customer-manager" };
const line = (price?: number) => ({ sku: "PIPE", qty: 40, ...(price ? { unit_price: price, currency: "CHF" } : {}) });

function run(steps: Partial<Msg>[], opts = governed): ThreadState {
  let s = initialThread();
  for (const step of steps) {
    const v = transition(s, step as Msg, opts);
    if (!v.ok) throw new Error(v.reason);
    s = v.next;
  }
  return s;
}

describe("examples", () => {
  const dir = join(import.meta.dir, "../examples");
  for (const file of readdirSync(dir)) {
    test(`${file} is a valid outgoing message`, () => {
      const parsed = OutgoingMessage.safeParse(JSON.parse(readFileSync(join(dir, file), "utf8")));
      expect(parsed.success).toBe(true);
    });
  }
});

describe("state machine", () => {
  test("happy path: rfq -> offer -> counter -> offer -> accept -> confirm", () => {
    const s = run([
      { type: "rfq", from: buyer, to: store, lines: [line()] },
      { type: "offer", from: store, to: buyer, lines: [line(80)], decision_id: "DEC-1" },
      { type: "counter", from: buyer, to: store, lines: [line(75)] },
      { type: "offer", from: store, to: buyer, lines: [line(78)], decision_id: "DEC-2" },
      { type: "accept", from: buyer, to: store },
      { type: "confirm", from: store, to: buyer, decision_id: "DEC-2" },
    ]);
    expect(s.status).toBe("confirmed");
    expect(s.round).toBe(3);
  });

  test("store cannot offer without a decision_id", () => {
    const s = run([{ type: "rfq", from: buyer, to: store, lines: [line()] }]);
    const v = transition(s, { type: "offer", from: store, to: buyer, lines: [line(80)] }, governed);
    expect(v.ok).toBe(false);
  });

  test("store as buyer toward a supplier also needs decisions for counter/accept", () => {
    const supplier = { account: "steelworks", role: "seller" };
    const sm = { account: "store", role: "supplier-manager" };
    const s = run([
      { type: "rfq", from: sm, to: supplier, lines: [line()] },
      { type: "offer", from: supplier, to: sm, lines: [line(41)] },
    ]);
    expect(transition(s, { type: "accept", from: sm, to: supplier }, governed).ok).toBe(false);
    expect(transition(s, { type: "accept", from: sm, to: supplier, decision_id: "DEC-9" }, governed).ok).toBe(true);
  });

  test("must start with rfq and parties are fixed", () => {
    expect(transition(initialThread(), { type: "offer", from: store, to: buyer, lines: [line(1)], decision_id: "D" }, governed).ok).toBe(false);
    const s = run([{ type: "rfq", from: buyer, to: store, lines: [line()] }]);
    const intruder = { account: "other-co", role: "buyer" };
    expect(transition(s, { type: "reject", from: intruder, to: store }, governed).ok).toBe(false);
  });

  test("only the party being waited on can move", () => {
    const s = run([
      { type: "rfq", from: buyer, to: store, lines: [line()] },
      { type: "offer", from: store, to: buyer, lines: [line(80)], decision_id: "DEC-1" },
    ]);
    expect(transition(s, { type: "accept", from: store, to: buyer, decision_id: "x" }, governed).ok).toBe(false);
  });

  test("round cap forces accept or reject", () => {
    const steps: Partial<Msg>[] = [
      { type: "rfq", from: buyer, to: store, lines: [line()] },
      { type: "offer", from: store, to: buyer, lines: [line(80)], decision_id: "D" },
    ];
    for (let i = 0; i < 5; i++)
      steps.push(
        i % 2 === 0
          ? { type: "counter", from: buyer, to: store, lines: [line(70)] }
          : { type: "offer", from: store, to: buyer, lines: [line(79)], decision_id: "D" },
      );
    const s = run(steps);
    expect(s.round).toBe(6);
    expect(transition(s, { type: "offer", from: store, to: buyer, lines: [line(78)], decision_id: "D" }, governed).ok).toBe(false);
    expect(transition(s, { type: "accept", from: store, to: buyer, decision_id: "D" }, governed).ok).toBe(true);
  });

  test("terminal threads accept nothing", () => {
    const s = run([
      { type: "rfq", from: buyer, to: store, lines: [line()] },
      { type: "reject", from: store, to: buyer },
    ]);
    expect(transition(s, { type: "info", from: buyer, to: store }, governed).ok).toBe(false);
  });
});

describe("signing", () => {
  const env = Envelope.parse({
    ...JSON.parse(readFileSync(join(import.meta.dir, "../examples/02-offer.json"), "utf8")),
    seq: 2,
    round: 1,
    sent_at: "2026-11-05T14:00:00Z",
  });

  test("sign and verify, also via context", async () => {
    const signed = await signEnvelope(env, "s3cret");
    expect(await verifyEnvelope(signed, "s3cret")).toBe(true);
    expect(await verifyEnvelope(signed, "wrong")).toBe(false);
    const fromContext = Envelope.parse(unwrapIncoming({ context: signed.context }));
    expect(await verifyEnvelope(fromContext, "s3cret")).toBe(true);
  });

  test("tampering breaks the signature", async () => {
    const signed = await signEnvelope(env, "s3cret");
    const tampered = { ...signed, lines: [{ ...signed.lines![0]!, unit_price: 1 }] };
    expect(await verifyEnvelope(tampered, "s3cret")).toBe(false);
  });
});
