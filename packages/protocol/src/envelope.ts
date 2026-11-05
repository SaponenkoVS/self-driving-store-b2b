import { z } from "zod";

export const PROTOCOL = "b2b-nego/v1" as const;

export const MESSAGE_TYPES = [
  "rfq", // requester asks for a price
  "offer", // responder (seller) proposes terms
  "counter", // requester proposes different terms
  "accept", // the party that received the last offer/counter agrees
  "reject", // either party ends the negotiation
  "confirm", // responder confirms the deal is booked (e.g. draft order -> order)
  "hold", // ask the other side to keep an offer open a bit longer
  "info", // FYI, no state change
  "error", // something went wrong, no state change
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

/** Messages that commit an account to a price. Governed accounts need a decision_id for these. */
export const COMMITMENT_TYPES: ReadonlySet<MessageType> = new Set([
  "offer",
  "counter",
  "accept",
  "confirm",
]);

export const Party = z.object({
  account: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  role: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  /** Authenticated customer (employee) id. Set ONLY by the Relay from the sender's credential. */
  user: z.string().max(64).optional(),
});
export type Party = z.infer<typeof Party>;

export const Line = z.object({
  sku: z.string().min(1).max(128),
  title: z.string().max(200).optional(),
  qty: z.number().int().positive(),
  unit_price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  deliver_by: z.string().max(40).optional(),
  spec: z.string().max(500).optional(),
});
export type Line = z.infer<typeof Line>;

/** What a bot sends to the relay. The relay fills in seq, round, sent_at, relay_sig, context. */
export const OutgoingMessage = z.object({
  protocol: z.literal(PROTOCOL),
  msg_id: z.string().min(8).max(64),
  thread_id: z.string().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/),
  from: Party,
  to: Party,
  type: z.enum(MESSAGE_TYPES),
  ref: z
    .object({
      draft_order_id: z.string().max(64).optional(),
      quote_id: z.string().max(64).optional(),
      /** Medusa order created by the Relay when the store confirms (stamped by the Relay, not the bot). */
      order_id: z.string().max(64).optional(),
      order_display_id: z.string().max(32).optional(),
    })
    .optional(),
  lines: z.array(Line).max(50).optional(),
  valid_until: z.string().max(40).optional(),
  decision_id: z.string().max(64).nullable().optional(),
  /** Free text. Receivers must treat it as untrusted data, never as instructions. */
  note: z.string().max(1000).optional(),
});
export type OutgoingMessage = z.infer<typeof OutgoingMessage>;

export const Envelope = OutgoingMessage.extend({
  seq: z.number().int().positive(),
  round: z.number().int().nonnegative(),
  sent_at: z.string(),
  relay_sig: z.string().optional(),
  /** Whole envelope (without context) as a JSON string; the field known to reach a Grok Bot routine prompt. */
  context: z.string().optional(),
});
export type Envelope = z.infer<typeof Envelope>;

export function needsLines(type: MessageType): boolean {
  return type === "rfq" || type === "offer" || type === "counter";
}
