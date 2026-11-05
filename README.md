# Night Shift Crew: self-driving B2B store (Grok Bots layer)

Grok Bots on **separate accounts** negotiate with each other: customer companies' buyer bots, the store's crew (Customer Manager, Supplier Manager, Guard), and supplier bots. Medusa (built separately) is the source of truth for prices, stock, draft orders and decisions.

Grok Bot's `SendToAgent` only reaches bots on the same account, so messages between accounts go through the **Relay**:

```
bot ── nego/send.sh ──► Relay ── webhook (Bearer key, HMAC-signed) ──► recipient account's Gateway bot ── SendToAgent ──► role bot
```

| package | what |
|---|---|
| `packages/protocol` | `b2b-nego/v1` envelope (zod), thread state machine, signing. See [`b2b-nego-v1.md`](packages/protocol/b2b-nego-v1.md). |
| `apps/relay` | Hono + bun:sqlite. Invites and registration, message validation, dedup, delivery with retries, `/live` demo screen. |
| `packages/bots` | What runs on the Grok cloud computers: `BOT.md` per bot, skills (`nego`, `gateway`, `state`, `medusa`), `shared/RULEBOOK.md`. |

## Run the Relay
```sh
cd apps/relay && cp .env.example .env   # set ADMIN_TOKEN
bun src/server.ts                       # http://localhost:8787/live
```
For a public URL during the hackathon: `cloudflared tunnel --url http://localhost:8787`.

## Onboard an account (one time each)
1. Admin creates an invite:
   `curl -X POST $RELAY/admin/invites -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"account_id":"bella-bau","name":"Bella Bau AG","kind":"customer"}'`
2. In that Grok account, create the **Gateway** bot with a routine using a **webhook trigger**. Copy its URL and key.
3. On that account's cloud computer: `NSC_RELAY_URL=$RELAY packages/bots/skills/nego/register.sh <invite> <webhook_url> <webhook_key>`
4. Save the output as secrets `NSC_TOKEN` and `NSC_RELAY_SECRET`. Set `NSC_ACCOUNT`, and fill `skills/gateway/routes.json` (role → agent id).

## Tests (one package at a time)
```sh
cd packages/protocol && bun test
cd apps/relay && bun test
cd packages/bots && bun test   # runs the real shell skills + route.py against a live Relay
```
