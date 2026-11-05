# Setup runbook: store Grok bots + customer Grok bots

Do the steps in order. The prompts and setup scripts live in the per-bot files. This page says **where** each one goes and **what to copy between them**.

```
 customer Grok account                 your laptop                                  store Grok account (one cloud computer)
 ┌──────────────┐  /customers/auth   ┌────────────────────────────┐   webhook     ┌───────────────────────────────────────────┐
 │ buyer        │ ─────────────────► │ Relay :8787 (+ ngrok)       │ ────────────► │ gateway ──SendToAgent──► customer-manager  │
 │  (1 bot)     │ ◄───────────────── │        │                    │ ◄──────────── │                send.sh ◄──┘      ⇅        │
 └──────────────┘  webhook / polling │        ▼ verify             │   send.sh     │                               guard        │
                                     │ Medusa :9000 (real data)    │               └───────────────────────────────────────────┘
                                     └────────────────────────────┘
```

You will copy these values between steps:

| Value                                    | From                        | To                                      |
| ---------------------------------------- | --------------------------- | --------------------------------------- |
| `RELAY_URL` (https tunnel URL)           | step 1                      | store `~/nsc/env`, customer `~/nsc/env` |
| `ADMIN_TOKEN`                            | `apps/relay/.env`           | the invite curl (step 3)                |
| Agent IDs of `customer-manager`, `guard`, `supplier-manager` | each bot's settings in Grok | store `~/nsc/contacts.json` |
| Supplier invite code + seller webhook URL/key | step 5 | the seller's `register.sh` |
| Gateway webhook URL + `crsr_…` key       | gateway routine             | the register curl (step 3)              |
| `account_token`, `relay_secret`          | the register response       | store `~/nsc/env`                       |
| Buyer webhook URL + key                  | buyer routine               | `set_inbox.sh` (step 6)                 |

---

## 1. Your laptop: Medusa, Relay, tunnel

```sh
# terminal 1: Medusa (real data; seeds already run: seed, seed:catalog, seed:bots)
cd backend && bun run dev                         # http://localhost:9000

# terminal 2: Relay (apps/relay/.env has MEDUSA_URL + MEDUSA_SERVICE_TOKEN = backend BOTS_SERVICE_TOKEN)
cd apps/relay && bun src/server.ts                # http://localhost:8787/live

# terminal 3: public URL for the Grok cloud computers (ngrok is installed and logged in)
ngrok http --url=https://a8a3-188-117-136-13.ngrok-free.app 8787   # free static domain: dashboard.ngrok.com -> Domains
# or, without a static domain: ngrok http 8787   (copy the https://….ngrok-free.app Forwarding URL)
```

Check it:

```sh
export RELAY_URL=https://a8a3-188-117-136-13.ngrok-free.app
curl -s $RELAY_URL/health
curl -s -X POST $RELAY_URL/customers/auth -H 'Content-Type: application/json' \
  -d '{"email":"buyer@bella-bau.test","company_name":"Bella-Bau Sp. z o.o.","nip":"5260250274"}'
# 201 with "account":"co-5260250274" and a token = Medusa sign-in works through the Relay
```

> Use the **static domain**: without it ngrok gives a **new URL on every restart**, and you must update `RELAY_URL` in both bots' `~/nsc/env`. The customer's `identity.json` also stores it, so re-run `store_auth.sh` on the customer side.

## 2. Store Grok account: create the 4 bots

All four must share **one cloud computer**: the Gateway saves files the others read.

1. **gateway** ([store-gateway.md](store-gateway.md))
   - Create bot `gateway` and paste the prompt from section 3.
   - Run the section 2 script on its cloud computer. It creates `~/nsc/env`, `send.sh` and `verify.sh`.
2. **guard** ([store-guard.md](store-guard.md))
   - Create bot `guard`, paste its prompt and run its section 2 (`~/nsc/decisions`, `guard.json`).
   - No routine needed.
3. **customer-manager** ([store-customer-manager.md](store-customer-manager.md))
   - Create bot `customer-manager`, paste its prompt and run its section 2.
   - No routine needed.
4. **supplier-manager** ([store-supplier-manager.md](store-supplier-manager.md)): create bot `supplier-manager`, paste its prompt and run its section 2. No routine needed.
5. **Agent IDs:** copy the agent IDs of `customer-manager`, `guard` and `supplier-manager` into `~/nsc/contacts.json` (template in store-gateway.md §2).
6. **jq / openssl / curl:** if any are missing on the cloud computer, run `apt-get install -y jq openssl curl`.

## 3. Store Grok account: connect it to the Relay

1. On `gateway`, open **Routines** and add a routine:
   - trigger: **Webhook**
   - action: _"Process the incoming webhook as described in your instructions."_
   - Copy the **webhook URL** and the **key** (`crsr_…`).
2. From your laptop, create the store invite and register:

   ```sh
   ADMIN=$(grep ^ADMIN_TOKEN= apps/relay/.env | cut -d= -f2-)
   INVITE=$(curl -s -X POST $RELAY_URL/admin/invites -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
     -d '{"account_id":"store","name":"B2B Store","kind":"store"}' | jq -r .invite_code)

   curl -s -X POST $RELAY_URL/accounts/register -H 'Content-Type: application/json' \
     -d "{\"invite_code\":\"$INVITE\",\"gateway_url\":\"<webhook url>\",\"gateway_key\":\"<crsr_… key, no 'Bearer', no newline>\"}"
   # -> {"account_token":"...","relay_secret":"..."}   shown ONCE, copy both now
   ```

3. On the store cloud computer, fill in `~/nsc/env`:
   ```
   ACCOUNT=store
   RELAY_URL=https://a8a3-188-117-136-13.ngrok-free.app
   RELAY_TOKEN=<account_token>
   RELAY_SECRET=<relay_secret>
   ```
4. Self-test: run store-gateway.md §5 from your laptop.
   - Expected: `/live` shows the rfq as **delivered**, and the gateway's `~/nsc/log.jsonl` has a `routed` line.
   - Then `customer-manager` asks `guard` to approve a price, and an **offer** to `co-5260250274` appears on `/live`. The self-test customer has no bot, so the thread stops there.

## 4. Customer Grok account: the buyer bot

Use a **different Grok account** (the customer's). Follow [customer-buyer.md](customer-buyer.md):

1. Create bot `buyer` and paste the prompt from section 3.
2. Run the section 2 script on the buyer's cloud computer (`RELAY_URL` is already set to https://a8a3-188-117-136-13.ngrok-free.app).
3. Choose how replies arrive:
   - **Instant:** a **Webhook** routine with the action _"Process the incoming webhook as described in your instructions."_ Keep its URL and key for step 6.
   - **Simple:** a routine **every 5 min** with the action _"Check the B2B store for replies (polling)."_

You can add more customers the same way: one Grok account and one `buyer` bot each. Each signs in with its own Medusa login.

## 5. Supplier Grok account: the seller bot

Use a **third Grok account** (the supplier's). Follow [supplier-seller.md](supplier-seller.md):

1. Create bot `seller`, paste the prompt from section 4, and add its **Webhook** routine. Keep the URL and key.
2. Run the section 2 script on the seller's cloud computer (`RELAY_URL` is already set to https://a8a3-188-117-136-13.ngrok-free.app).
3. From your laptop, create the supplier invite:
   ```sh
   ADMIN=$(grep ^ADMIN_TOKEN= apps/relay/.env | cut -d= -f2-)
   curl -s -X POST $RELAY_URL/admin/invites -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
     -d '{"account_id":"steelworks","name":"Steelworks Brno","kind":"supplier"}' | jq -r .invite_code
   ```
4. On the seller's cloud computer: `bash ~/nsc/skills/register.sh <invite_code> "<webhook url>" "<crsr_… key>"` → `REGISTERED steelworks`.
5. Self-test: tell the store's `supplier-manager` in chat *"Source 10 × GRA-1001-02 for delivery by <date 3 working days from now>"*. Expected on `/live`: rfq → offer 214.50 EUR (rush) → guard asks you (margin 15%) → accept → confirm. The Relay then adds the 10 pallets to the store's stock in Medusa.

## 6. Run the demo

In the buyer's chat:

1. **You:** "I'd like to buy 40 graphite steel downpipes 90 mm from the B2B store, delivered by 20 November."
   The buyer searches the store's catalog and shows you matches; pick **`AQU-1030-01`** (Steel Downpipe 90 mm, 3 m – Graphite).
2. **buyer:** asks for email, company name and NIP. Answer:
   `buyer@bella-bau.test`, `Bella-Bau Sp. z o.o.`, `5260250274` → "Signed in as Anna Kowalska @ Bella-Bau Sp. z o.o."
3. If you chose the webhook routine: "Run `bash ~/nsc/skills/set_inbox.sh <buyer webhook url> <key>`" (only once).
4. **buyer:** asks for target and maximum unit price. Try **target 17.50, max 18.40** (EUR).
5. Watch `$RELAY_URL/live`: rfq → offer 18.90 → counter → … → accept → **confirm with "Medusa order #N"**.
   The order is in Medusa Admin (Orders) under Bella-Bau, and the buyer reports the order number.
   Ask the buyer *"what's the status of that order?"* to see `order_status.sh` at work.

**Supplier flow** (needs the supplier account from step 5): ask for **60 × GRA-1001-02** (Portland Cement pallet). The store has 50, so:
   - customer thread: rfq → info ("checking with our supplier")
   - supplier thread: rfq → offer 214.50 → guard asks you → accept/counter → confirm → +10 pallets in Medusa
   - customer thread: offer → counter → … → accept → confirm → Medusa order for 60

Where the prices come from (all live from Medusa via `catalog.sh`, nothing hard-coded on the store side):

- **Volume price:** AQU-1030-01 costs 19.90 for 1–19 pieces, **18.90 for 20–59** and 17.91 from 60. The store opens at the volume price for the quantity.
- **Auto-approved:** the guard approves up to **5% below** it on its own (≥ 17.96 for 40 pieces).
- **Asks you:** from 5% to 12% below (**16.64–17.95**), the guard asks **you in the guard's chat** for YES/NO.
- **Denied:** more than 12% below. Medusa also refuses any order more than 15% below the volume price (`BOTS_MAX_DISCOUNT`).
- **Spending limits:** Medusa refuses orders above the employee's limit. For example, `junior@bella-bau.test` has a 2000 EUR limit, so the confirm is refused and the store rejects the deal politely.

Other logins: `zakupy@nowak-bud.test` / `Nowak Budownictwo S.A.` / `7781401239`, or `junior@bella-bau.test` (same company as Anna).

## Troubleshooting

| Symptom                                          | Cause                                                                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `WRONG_DETAILS` at sign-in                       | Email, name or NIP doesn't match Medusa. Case, spaces and punctuation in the name don't matter ("sp z oo" works). |
| `ERROR 502` at sign-in                           | Medusa isn't running, or the service token differs between `backend/.env` and `apps/relay/.env`.                             |
| Send returns 404 `unknown recipient`             | The store hasn't registered with the Relay yet (step 3).                                                                     |
| Send returns 422                                 | Protocol violation (wrong turn, missing price, store message without `decision_id`). The `reason` field says which.          |
| `/live` in a browser shows an ngrok warning page | Normal on the free plan: click **Visit Site**. API calls from bots aren't affected.                                          |
| `/live` shows delivery `failed`                  | Check the gateway key: a 400 usually means a trailing newline, and a 401 means regenerate the key and register again.        |
| `customer-manager` never wakes                   | The agent IDs in `contacts.json` are wrong, or the bots don't share a cloud computer (see the fallback in store-gateway.md). |
| Buyer never hears back                           | `set_inbox.sh` wasn't run, or there's no polling routine. `relay_get.sh "/threads?pending=1"` shows what's waiting.          |
| `catalog.sh` prints `{"error":"catalog is not configured…"}` | The Relay runs without `MEDUSA_URL`. Set it in `apps/relay/.env` and restart the Relay.                         |
| Store confirm returns 422 `order not created`    | Medusa refused the order: `reason` says why (`insufficient_stock`, `spending_limit_exceeded`, price below floor).            |

## Known limits (demo)

- **Decisions are local:** the guard's `DEC-L-…` ids live on the store's cloud computer, not in Medusa yet. Medusa does check its own floor price and the spending limit when the order is created.
- **Purchases skip receiving:** a supplier's confirm adds the stock in Medusa immediately. There's no purchase order or receiving step yet.
- **Supplier price list is in the prompt:** `supplier-seller.md` has its own list of 3 SKUs. That's the supplier's own data, which is intentional.
- **Signed-in customers only:** only real Medusa customers who are company employees and whose company has a `tax_id` can sign in.
