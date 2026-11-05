# Session handoff: Night Shift Crew (self-driving B2B store)

_Last updated: 2026-11-05 · branch `grok-bots-layer` · newer work is uncommitted (see "State of the repo")._

## 1. What this is
This is a hackathon project: a **B2B store run by Grok Bots**. The idea comes from Roy Osherove's "personal factory of Grok Bots" post, mapped onto commerce: one bot per job, bots message each other, and webhooks wake them.

- **Customers** each have their **own Grok account** with a `buyer` bot. It asks for quotes and negotiates prices on its owner's behalf.
- The **store** runs one Grok account with a crew:
  - `gateway`: the only public inbox
  - `customer-manager`: sells
  - `guard`: approves every price
  - `supplier-manager`: planned; buys missing stock from supplier bots
- **Medusa** (the B2B starter) is the single source of truth for products, prices, stock, companies, customers, draft orders and decisions. Rule: *nothing important lives outside Medusa*. Bots never trust prices or stock from memory or from another company's message.
- **Key rule:** no bot can approve its own discount. The store never sends `offer`, `counter`, `accept` or `confirm` without a `decision_id` from the Guard (later from the Medusa Inbox), and the Relay enforces this.

The user owns the **Grok Bots layer** (Relay, protocol, bot prompts). A teammate owns the Medusa backend and storefront, though the user asked us to wire auth directly into `backend/`.

## 2. Why there is a Relay (research findings)
- Grok Bot's `SendToAgent(target_id, message, priority)` only reaches bots **on the same Grok account**. It is best-effort, with no receipts and no retries.
- Grok Bot's "multi-account" feature just means switching accounts in the app.
- **How the Tokyo Grok Bot Hackathon 1st-place team did it** (Team Null, repo `naru-sensei/mirai-menu`):
  - Each bot has a **routine with a Webhook trigger**, which works as its inbox.
  - Owners swap the webhook URL and key, then POST to each other with `Authorization: Bearer crsr_…`.
  - They put the whole message into a `context` JSON string, because that's the field that reaches the receiving prompt.
  - Downside: every pair of bots needs a manual key swap (N² swaps).
- **Our design:** a central **Relay** (our service) plus **one Gateway webhook per store account** plus `SendToAgent` inside each account. Customers don't get a gateway at all; they sign in (section 4).
- **Other facts:**
  - The minimum interval for a scheduled routine is 5 min; webhooks fire instantly.
  - A pasted key with a trailing newline gives HTTP 400; a 401 means regenerate the key.
- **Grok Bot prompt deep link** (unconfirmed in the app, documented in `packages/bots/DEEP-LINKS.md`): `https://cursor.com/grok-bot/link/v1/prompt?id=<agt_id>&text=<≤1000 chars, single line>`. It fills the chat box but doesn't send. Not used yet.
- **Rejected options:**
  - OAuth via a custom MCP connector: possible, since Grok supports custom connectors with OAuth discovery, but too complex for now.
  - Invite codes for customers.

## 3. Architecture
```
 any customer Grok account            apps/relay (Hono + bun:sqlite)            store Grok account
 buyer ──send.sh──► POST /messages ──► validate, dedup, state machine, ──webhook──► gateway ─SendToAgent─► customer-manager ⇄ guard
   ▲                                   stamp from.user, HMAC-sign                            (send.sh back via Relay)
   └──── webhook (set_inbox.sh) or polling GET /threads?pending=1 ◄──────────────────────────┘
 buyer ──store_auth.sh──► POST /customers/auth ──► Medusa POST /bots/customers/verify (service token)
```

### Monorepo layout
The tooling is Bun workspaces (`apps/*`, `packages/*`) plus turbo. `backend/` and `storefront/` are **not** workspaces and use their own installs.

| Path | What |
|---|---|
| `packages/protocol` | `b2b-nego/v1`: zod envelope (`src/envelope.ts`), thread state machine (`src/state-machine.ts`), canonical JSON + HMAC (`src/sign.ts`), NIP and company-name normalization (`src/nip.ts`), spec in `b2b-nego-v1.md`, `examples/` |
| `apps/relay` | the Relay server: `src/app.ts` (routes), `src/db.ts` (SQLite), `src/deliver.ts` (webhook delivery and retries), `src/directory.ts` (customer verification and rate limiter), `src/live-page.ts` (stage screen), `src/server.ts` (entry) |
| `packages/bots` | an earlier version of the bot content: python3-based skills (`skills/nego`, `skills/gateway/route.py`, `skills/state`), `BOT.md` per role, `shared/RULEBOOK.md`, plus an end-to-end test that runs the shell skills against a live Relay. `DEEP-LINKS.md` and `TESTING.md` were written by the user. |
| `bots/` | **The current install guides (the user's), the ones to use.** One `.md` per bot with a ready-to-paste prompt and a cloud-computer setup script (jq + openssl + curl). |
| `backend/` | Medusa 2.8.4 B2B starter, with our auth additions (section 4) |
| `storefront/` | Next.js B2B storefront (teammate) |

> `bots/` and `packages/bots/` overlap. `bots/*.md` are the current prompts. `packages/bots/skills` is a python3 version of the same scripts, covered by tests. **TODO:** merge them, e.g. move `bots/*.md` into `packages/bots/install/` and drop the duplicate `BOT.md` files.

## 4. Customer authentication (email + company name + NIP)
**Flow**
1. The owner tells their Grok `buyer` bot: *"I'd like to buy 40 × … from the B2B store."*
2. If `~/nsc/identity.json` is missing, the bot asks for **work email, company name and NIP** (Polish tax id).
3. `store_auth.sh` → Relay `POST /customers/auth {email, company_name, nip}`.
4. The Relay validates the input with zod (email trimmed), applies the **rate limit** (5 per 10 min per IP and per email, in memory), then calls a `CustomerDirectory`:
   - **`MedusaDirectory`** (when `MEDUSA_URL` is set): `POST {MEDUSA_URL}/bots/customers/verify` with `Authorization: Bearer {MEDUSA_SERVICE_TOKEN}`.
   - **`SeedDirectory`** (when `CUSTOMERS_SEED=<json file>` is set): offline demo; see `apps/relay/customers.seed.example.json`.
5. Medusa (`backend/src/api/bots/customers/verify/route.ts`) runs `query.graph` on `customer`, filtered by `{email, has_account: true}` and including `employee.company`. It matches when `normalizeNip(company.tax_id) === nip` **and** `normalizeCompanyName(company.name) === name`.
   - Returns `{customer_id, employee_id, email, name, is_admin, spending_limit, company_id, company_name, tax_id, currency_code}`, or `404 {"error":"no_match"}`.
   - Read-only, so it uses no workflow.
6. On a match, the Relay `db.issueCustomerCredential()`:
   - creates the company account **`co-<nip>`** (`kind: customer`, not governed) if it doesn't exist yet
   - inserts a row in **`credentials`** (`token_hash`, account_id, customer_id, employee_id, name, email)
   - returns `201 {customer_id, employee_id, name, email, company_id, company_name, account: "co-<nip>", role: "buyer", token: "nsc_…", relay_secret}`
7. The bot saves this in `~/nsc/identity.json` (umask 077) plus a line in its memory, and never asks again.
8. From then on, `Authorization: Bearer <token>` → `db.principalByToken()` → `{account, customer_id, employee_id, name, email}`.
   - On `POST /messages` the Relay **removes any `from.user` / `to.user` the bot sent and sets `from.user = customer_id`**.
   - `from.account` must equal the token's account (otherwise 403).
   - Threads are visible only to their two parties (otherwise 404).

**Normalization** (it exists twice and must stay in sync: `packages/protocol/src/nip.ts` and `backend/src/utils/bot-identity.ts`):
- NIP: strip `PL`, spaces and dashes; it must be 10 digits; the last digit is a checksum with weights `6,5,7,2,3,4,5,6,7` mod 11.
- Company name: NFKD, remove diacritics, lowercase, **drop everything that isn't a-z or 0-9 (including spaces)**. So "Bella-Bau Sp. z o.o." equals "bella bau sp z oo" equals "BellaBau spzoo".
- Email: trim + lowercase.

**Errors:**
- every mismatch gives the same 401 ("no customer matches this email, company name and NIP")
- 429 when rate-limited
- 502 when Medusa is down
- 503 when no directory is configured

**Revoking:** `db.revokeCustomerCredentials(customer_id)` exists, but no HTTP route exposes it yet (TODO: an admin route, or a Medusa-triggered one).

**Known weaknesses:**
- Company name and NIP are public, so the **email is effectively the only secret**. Next step if needed: an emailed one-time 6-digit code before issuing the token.
- The customer webhook inbox is **per company account**. If two employees of the same company connect bots, the last `set_inbox.sh` wins; the other has to poll.
- The rate limiter is in memory and per process.

### Medusa changes (in `backend/`, uncommitted, **not yet type-checked or run**: `backend/node_modules` is missing)
- `src/modules/company/models/company.ts`: `tax_id: model.text().nullable()`
- migration `src/modules/company/migrations/Migration20261105120000.ts`: adds the column and the partial index `IDX_company_tax_id`; both `.snapshot-*.json` files are updated
- `src/types/company/module.ts`: `tax_id` on `ModuleCompany` and `ModuleCreateCompany`
- `src/api/{admin,store}/companies/validators.ts`: `tax_id` (optional, nullable) on create and update
- `src/api/bots/middlewares.ts`:
  - `requireBotsServiceToken` (timing-safe compare against `BOTS_SERVICE_TOKEN`) on `/bots*`
  - zod schema `BotsVerifyCustomer` (strict: email, company_name, nip)
  - registered in `src/api/middlewares.ts`
- `src/api/bots/customers/verify/route.ts`: the matcher described above
- `src/utils/bot-identity.ts`: normalizers
- `.env.template`: `BOTS_SERVICE_TOKEN=change-me`
- The admin UI company form has **no tax_id input**. Set it through the API or a seed.
- The user's own `src/scripts/seed-bot-test.ts` + `bun run seed:bots` create test companies, customers and employees with `tax_id`.

### Test identities (from `seed:bots`, storefront password `supersecret`)
| Relay account | email | company name | NIP | role | limit |
|---|---|---|---|---|---|
| `co-5260250274` | buyer@bella-bau.test | Bella-Bau Sp. z o.o. | 5260250274 | admin | none |
| `co-5260250274` | junior@bella-bau.test | Bella-Bau Sp. z o.o. | 5260250274 | employee | 2000 EUR |
| `co-7781401239` | zakupy@nowak-bud.test | Nowak Budownictwo S.A. | 7781401239 | admin | none |


## 5. Relay API (`apps/relay`)
| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | none | `{ok, protocol}` |
| `POST /admin/invites` | `Bearer ADMIN_TOKEN` | `{account_id, name, kind: store\|customer\|supplier, governed?}` → `invite_code`. Store accounts are governed by default. Used for the **store and suppliers** only. |
| `POST /accounts/register` | invite | `{invite_code, gateway_url, gateway_key}` → `account_token`, `relay_secret` (shown once) |
| `POST /customers/auth` | none (rate-limited) | customer bot sign-in (section 4) |
| `GET /accounts/me` | token | account plus `customer_id`, `employee_id`, `user_name`, `email` |
| `PUT /accounts/me/gateway` | token | set the webhook `{gateway_url, gateway_key}`; customers use it through `set_inbox.sh` |
| `GET /directory` | token | list accounts |
| `POST /messages` | token | send an envelope. Responses: 202 accepted; 200 `duplicate:true` for the same `msg_id`; 403 sending as another account; 404 unknown recipient; 409 `msg_id` reused; 422 protocol violation, with a `reason` |
| `GET /threads[?pending=1]` | token | my threads, or only those waiting on me |
| `GET /threads/:id?since=<seq>` | token, must be a party | the thread and its messages (each with a `delivery` status) |
| `POST /messages/:msg_id/ack` | token | mark a received message as handled |
| `GET /live`, `/live/snapshot`, `/live/events` (SSE) | optional `?token=LIVE_TOKEN` | stage screen showing every thread live |

**Delivery** (`src/deliver.ts`):
- The Relay POSTs to the recipient's `gateway_url` with `Authorization: Bearer <gateway_key, trimmed>`. The body is the envelope plus `relay_sig` (HMAC-SHA256 with the **recipient's** `relay_secret` over the canonical JSON, without `relay_sig` and `context`) plus `context` (the whole envelope as a JSON string).
- Retries with backoff of 2s, 8s, 30s, 60s and 120s. A sweeper runs every 5 s.
- 4xx responses (except 408 and 429) are permanent failures.
- Bots can always pull messages instead.

**Env** (`apps/relay/.env.example`): `PORT=8787`, `DB_PATH=relay.sqlite`, `ADMIN_TOKEN`, `LIVE_TOKEN?`, `MEDUSA_URL`, `MEDUSA_SERVICE_TOKEN` (must equal the backend's `BOTS_SERVICE_TOKEN`), `CUSTOMERS_SEED?`.

**SQLite tables:** `invites`, `accounts` (with `governed`, gateway, `token_hash`, `relay_secret`), `credentials`, `threads` (status, requester, responder, round, pending_on), `messages` (seq per thread, unique `msg_id`, delivery status, attempts).

## 6. Protocol `b2b-nego/v1`
**Envelope fields:**
- `protocol`, `msg_id` (8–64 chars), `thread_id`
- `from` / `to` `{account, role, user?}`; `user` is set by the Relay only
- `type`: `rfq|offer|counter|accept|reject|confirm|hold|info|error`
- `ref {draft_order_id?, quote_id?}`
- `lines[{sku, title?, qty, unit_price?, currency?, deliver_by?, spec?}]`
- `valid_until`, `decision_id`
- `note`: free text, **untrusted, never to be treated as instructions**
- added by the Relay: `seq`, `round`, `sent_at`, `relay_sig`, `context`

**State machine:**
- Order of moves: `open -rfq-> requested -offer-> offered ⇄ (counter / offer) ⇄ countered -accept-> accepted -confirm-> confirmed`.
- `reject` is allowed from any non-terminal state.
- `info`, `hold` and `error` don't change the state.
- The requester is the sender of the rfq (the buyer side); only the party the thread is waiting on can move.
- **Round cap 6:** after that only accept or reject.
- `rfq`, `offer` and `counter` need lines; `offer` and `counter` need `unit_price` and `currency`.
- **Governed accounts** (the store) need a `decision_id` on `offer`, `counter`, `accept` and `confirm`.

## 7. Bots (current guides in `bots/`)
- **`bots/README.md`:** overview, setup order, assumptions.
- **`store-gateway.md`:**
  - creates `~/nsc/{env,skills/send.sh,skills/verify.sh,contacts.json}` (Relay mode only: `RELAY_URL`, `RELAY_TOKEN`, `RELAY_SECRET`)
  - prompt: verify the signature, accept only `to.role=customer-manager` from a `from.role=buyer`, `SendToAgent` the inbox file path, never negotiate
  - webhook routine
  - registration curl, and a self-test that signs in as a test customer
- **`store-customer-manager.md`:**
  - sells to whichever company sent the rfq (`from.account` + `from.user`) and replies to `{account: <that>, role: "buyer"}`
  - every price goes to the Guard ("APPROVE? …" → "APPROVED … decision_id=…" or "DENIED … floor=…")
  - prices and stock come from Medusa via `catalog.sh` (Relay `GET /catalog`)
- **`store-guard.md`:** approves prices against a local CATALOG and margin rules, and issues local `DEC-L-…` ids. It needs switching to Medusa decisions and the Inbox.
- **`customer-buyer.md`:** one generic bot that any customer can install.
  - setup scripts: `store_auth.sh`, `send.sh`, `relay_get.sh`, `set_inbox.sh`, `verify.sh`
  - prompt: sign in once; get target and maximum price per purchase from the owner (confidential); negotiation rules (accept at or below target, counter halfway, never above max, ask the owner if above max at round 6)
  - replies arrive through its own webhook routine (`set_inbox.sh`) or a 5-minute polling routine
  - `customer-gateway.md` was **deleted**; a customer needs only this one bot
- `RELAY_URL` in `customer-buyer.md` is a placeholder (`https://REPLACE-ME-relay.example`). Expose the Relay with `cloudflared tunnel --url http://localhost:8787`.

## 8. Running and testing
```sh
# tests (one package at a time; the laptop is slow, see ~/.claude/CLAUDE.md)
cd packages/protocol && bun test     # 16 pass
cd apps/relay && bun test            # 14 pass (relay + customer-auth)
cd packages/bots && bun test         # 3 pass (real shell scripts + route.py against a live relay)
# type-check: cd <pkg> && bunx tsc --noEmit   (protocol, relay and bots are clean)

# local stack (needs Postgres + Redis running and the three .env files present)
bun run setup   # once: installs, db:create, migrate, seeds (store, catalog, bot test customers), admin user, storefront key
bun run dev     # backend :9000 (/app), relay :8787 (/live), storefront :8000; Ctrl+C stops all (scripts/dev.ts)
curl -X POST localhost:8787/customers/auth -H 'Content-Type: application/json' \
  -d '{"email":"buyer@bella-bau.test","company_name":"Bella-Bau Sp. z o.o.","nip":"5260250274"}'
```
Machine rules from the user: one heavy command at a time; use `bun`/`bunx`, never npx; don't start dev servers unless asked; type-check only the package you touched; commit only when asked.

## 9. State of the repo
- **Committed** on `grok-bots-layer` (`faae178`, merged with main in `5424f53`): protocol, relay and `packages/bots` v1.
- **Uncommitted, from this session:** (also `scripts/dev.ts`, `scripts/setup.ts`, root `dev` and `setup` scripts, and the storefront publishable key in `storefront/.env`)
  - `Party.user`, `nip.ts` and tests
  - relay credentials, `/customers/auth`, `directory.ts`, stamping, tests, `.env.example`, `customers.seed.example.json`
  - backend `tax_id`, the `/bots/customers/verify` route, middlewares, utils, migration and snapshots, `.env.template`
  - `bots/*.md` rewritten, `customer-gateway.md` deleted, `README.md` note, `DEEP-LINKS.md` row removed
  - this file
- **The user's own uncommitted work:** `backend/package.json` (the `seed:bots` script), `backend/src/scripts/seed-bot-test.ts`, `packages/bots/TESTING.md`, `packages/bots/DEEP-LINKS.md`, and the `bots/` folder itself.

## 10. Open items / next steps
1. ~~Run the backend~~ **Done 2026-11-05:** backend type-checks, the migration ran, seeds ran, and sign-in was verified end to end (Relay → Medusa) with the test identities.
2. **End-to-end with real Grok accounts:** store account (3 bots) and one customer account; sign in → rfq → Guard → offer → counter → accept → confirm; watch `/live`.
3. ~~Catalog mismatch~~ **Done:** bots use real Medusa SKUs in EUR. New routes (service token, called only by the Relay):
   - `GET /bots/catalog?q=&sku=&qty=&in_stock=` → Relay `GET /catalog` (any signed-in account): volume tiers, `unit_price_for_qty`, stock
   - `POST /bots/orders` ← Relay, automatically when the store **confirms** an accepted thread. Customer = rfq's `from.user`, lines = last accepted priced lines (never the bot's confirm). Idempotent per thread; checks a floor (`BOTS_MAX_DISCOUNT`, default 15% under the volume price) and the employee spending limit. The confirm gets `ref.order_id` / `ref.order_display_id`.
   - `GET /bots/orders/:id` → Relay `GET /threads/:id/order` (either party)
   - `POST /bots/purchases` ← Relay, when a **supplier confirms** a sale to the store: adds the stock in Medusa (no receiving step yet)
   - Fixed a starter bug: `links/order-company.ts` was one-to-one, so a company's second order failed.
4. **Medusa calls for the store bots** (contract drafted in `packages/bots/skills/medusa/SKILL.md`):
   - `GET /bots/products?sku=`
   - `POST /bots/draft-orders` (with `from.user` as the customer)
   - `POST /bots/decisions` → Inbox card for the grey zone
   - `POST /bots/draft-orders/:id/convert {decision_id}`
   - These replace the hard-coded price hints, CATALOG and `DEC-L-` ids, and enforce the employee spending limit with `from.user`.
5. **Credentials:** add a revoke route (and a "connected bots" list in the storefront account page); optionally the emailed one-time-code step.
6. **Storefront button "Send a quote with Grok bot"** on product pages: simplest version is a deep link to the customer's bot with "I'd like to buy <qty> × <product> from the B2B store" (needs the bot's `agt_` id; the deep link is unconfirmed).
7. **Supplier side:** a `supplier-manager` guide plus a supplier `seller` bot (the old drafts are in `packages/bots/{store/supplier-manager,supplier/seller}`).
8. **Merge** `bots/` into `packages/bots/`.
9. **Relay hosting:** a public URL (cloudflared tunnel, or Fly/Railway). D1/Cloudflare Workers is optional; the current store is `bun:sqlite`.

## 11. Sources
- Roy Osherove, "Anatomy of a Personal Factory of Grok Bots": https://robotpaper.ai/anatomy-of-a-personal-factory-of-grok-bots/
- Tokyo hackathon: https://luma.com/grokbot-hackathon-tokyo · 1st place write-up: https://dev.to/goroman/how-we-won-a-hackathon-without-writing-a-single-line-of-code-part-1-three-people-grok-bot-six-184j
- Repos studied: naru-sensei/mirai-menu, LeonYew-Ley/grokbot-task-notify, rashad-h/bot-constellation, kou-uni/grokbot-playground, eightman999/meishi-relay
- Grok Bot 101: https://x.ai/bot/guides/grok-bot-101 · deep link forum post: https://forum.cursor.com/t/support-passing-parameters-through-grok-bot-deep-links/174986
- Medusa B2B starter: https://github.com/medusajs/b2b-starter
