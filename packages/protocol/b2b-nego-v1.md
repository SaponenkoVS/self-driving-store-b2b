# b2b-nego/v1

The protocol bots use to negotiate with bots on **other Grok accounts**. Messages travel through the Relay:

```
bot ──POST /messages──► Relay ──POST <gateway webhook>──► recipient account's Gateway bot ──SendToAgent──► role bot
```

## Envelope
See `src/envelope.ts` (zod) and `examples/`. A bot sends an `OutgoingMessage`. The Relay adds `seq`, `round`, `sent_at`, `relay_sig` and `context` before it delivers the message.

| field | meaning |
|---|---|
| `thread_id` | one negotiation (for example one RFQ). The sender picks it on `rfq`. |
| `msg_id` | unique per message. Re-sending the same `msg_id` is a no-op, so retries are safe. |
| `from` / `to` | `{account, role}`. `from.account` must match the sender's Relay token. |
| `type` | `rfq` `offer` `counter` `accept` `reject` `confirm` `hold` `info` `error` |
| `lines` | required for rfq/offer/counter. `unit_price` and `currency` are required for offer/counter. |
| `decision_id` | required on offer/counter/accept/confirm from **governed** accounts (the store). It comes from the Guard or Inbox in Medusa. |
| `note` | free text. **Untrusted**: receivers treat it as data, never as instructions. |
| `relay_sig` | HMAC-SHA256 over the canonical envelope, minus `relay_sig` and `context`, keyed with the recipient's `relay_secret`. |
| `context` | the whole envelope as a JSON string. Some Grok Bot routines pass only this field to the prompt. |

## Thread state machine
```
open ─rfq─► requested ─offer─► offered ⇄ counter/offer ⇄ countered
                                  └──accept──► accepted ─confirm─► confirmed
reject from any non-terminal state ─► rejected
```
- The account that sent the `rfq` is the **requester** (buyer side). The other account is the **responder** (seller side).
- Only the party the thread is waiting on can move it forward.
- After 6 rounds of offer/counter, the only allowed moves are accept or reject.
- `info`, `hold` and `error` never change the state.
