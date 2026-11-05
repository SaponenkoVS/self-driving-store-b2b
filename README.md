

https://github.com/user-attachments/assets/d84eef45-64ef-4dd1-8fd4-a7e8d6ff0edc




<p align="center">
  <img src="docs/readme/hero.jpg" alt="A B2B store where bots negotiate – and a guard signs every price. Buyer bot, Relay, store crew, Medusa." width="100%">
</p>

<p align="center">
  <a href="https://storefront-production-5873.up.railway.app"><code>LIVE STOREFRONT</code></a>
  &nbsp;·&nbsp;
  <a href="bots/SETUP.md"><code>BOT SETUP</code></a>
  &nbsp;·&nbsp;
  <a href="packages/protocol/b2b-nego-v1.md"><code>PROTOCOL</code></a>
  &nbsp;·&nbsp;
  <a href="#run-it-locally"><code>RUN IT LOCALLY</code></a>
</p>

# self-driving-store-b2b

A B2B building-materials store run by Grok bots. Each customer company has its own **buyer bot** on its own Grok account. It signs in with the company's email, name and NIP, asks the store for a quote and haggles over the price. On the store side a crew of bots answers – a **gateway** that receives, a **customer-manager** that sells, a **supplier-manager** that buys missing stock from the supplier's bot, and a **guard** that approves every price. Messages travel through the **Relay**, which checks who is speaking and refuses any store move the guard has not signed. When a deal is confirmed, the Relay creates the order in **Medusa** – from the conversation itself, not from what a bot claims.

Grok's own `SendToAgent` only reaches bots on the same Grok account. The Relay is what lets bots of different companies talk – with identity, signatures, retries and one rule nobody can talk their way around.

> **Status.** Built: sign-in against Medusa, the Relay with the `b2b-nego/v1` protocol, the store and supplier bot crews, prices and stock read from Medusa, orders and supplier purchases written back to it. Next: discovery from the storefront, stronger sign-in and a hosted Relay – see [what is next](#what-is-next).

---

## The whole loop

A buyer bot orders 40 bags of cement, counters the store's price once and gets an order in Medusa.

<p align="center">
  <img src="docs/readme/flow.gif" alt="Animated sequence: buyer bot signs in through the Relay against Medusa, sends an rfq, the store gateway hands it to the customer-manager, the guard approves each price, the buyer counters and accepts, and the Relay creates the order in Medusa" width="100%">
</p>

| Actor | Lives on | What it does |
|---|---|---|
| `buyer` | Each customer's own Grok account | Signs in once, asks for quotes, negotiates inside its owner's target and maximum price |
| `Relay` | `apps/relay` – our service | Verifies identity, enforces the protocol, signs and delivers messages, creates the Medusa order |
| `gateway` | Store Grok account | The store's only public inbox – verifies the Relay signature and routes, never negotiates |
| `customer-manager` | Store Grok account | Sells – quotes, counters and confirms, always with a guard decision |
| `supplier-manager` | Store Grok account | Buys missing stock from supplier bots when the warehouse runs short |
| `guard` | Store Grok account | The only bot that can create a `decision_id` – approves sell prices and buy costs |
| `seller` | The supplier's own Grok account | Answers the store's requests for quote |
| `Medusa` | `backend/` | Source of truth – companies, employees, NIPs, catalog, stock, orders |

---

## How it works

### 1 · Sign in – email, company name, NIP

The first time its owner asks for something, the buyer bot asks for a work email, the company name and the NIP. The Relay passes them to Medusa (`POST /bots/customers/verify`), which looks for a registered customer with that email who is an employee of a company with that name and tax ID. Spaces, dashes, a `PL` prefix and letter case do not matter.

On a match the Relay issues a personal token and a company account `co-<nip>`. From then on the Relay stamps every message with the customer's ID – a bot cannot speak for another person or another company, and the company's employee spending limit applies to every order.

Five attempts per ten minutes per IP and per email, and the same answer for any wrong field, so the store never reveals which one was wrong.

### 2 · Talk through the Relay – one envelope format

Every message is a `b2b-nego/v1` envelope. The Relay validates it, removes any identity the bot tried to set, signs it with HMAC for the recipient and delivers it to the recipient's webhook – retrying for up to four minutes, or the bot polls instead.

```json
{
  "protocol": "b2b-nego/v1",
  "thread_id": "T-odra-0001",
  "from": { "account": "co-8990000002", "role": "buyer" },
  "to":   { "account": "store", "role": "customer-manager" },
  "type": "rfq",
  "lines": [{ "sku": "GRA-1001-01", "title": "Portland cement CEM I 42.5R, 25 kg", "qty": 40, "deliver_by": "2026-11-20" }],
  "note": "Delivery to the Wrocław site, gate 2."
}
```

`note` is free text from another company – every bot treats it as data, never as instructions.

### 3 · The guard signs every price – and the Relay checks the signature

The store never sends an `offer`, `counter`, `accept` or `confirm` without a `decision_id` from the guard. That rule is not only in the prompts – the store is a governed account, and the Relay rejects such a message with `422` if the ID is missing.

<p align="center">
  <img src="docs/readme/states.gif" alt="b2b-nego/v1 thread state machine: open, requested, offered and countered in a loop, accepted, confirmed – with reject from any open state and a round cap of 6" width="100%">
</p>

The guard compares every price with Medusa's volume price for that quantity – read fresh with `catalog.sh`, never from memory or from a message.

| Rule | Who enforces it |
|---|---|
| Sell up to 5% below the volume price – auto-approve | Guard |
| Sell 5–12% below – ask the store owner in the guard's chat | Guard |
| Sell more than 12% below – deny, reply with the floor price | Guard |
| `decision_id` on every store `offer`, `counter`, `accept`, `confirm` | Relay |
| Six rounds, then only accept or reject | Relay |
| Order at most 15% below the volume price, in stock, inside the spending limit | Medusa, at confirm |

### 4 · Short on stock – the store's bot buys from the supplier's bot

When the warehouse cannot cover an order, the customer-manager hands the shortfall to the supplier-manager, which opens its own thread with the supplier's `seller` bot. The guard approves buy costs by margin against the volume price the store will sell at – 20% or more is auto-approved, 12–20% asks the owner, under 12% is denied – so the store never buys at a cost it cannot resell. When the supplier confirms, the Relay records the purchase in Medusa (`POST /bots/purchases`) and the bought stock is added to the warehouse.

<p align="center">
  <img src="docs/readme/negotiation.gif" alt="Store supplier-manager and supplier seller negotiate 80 bags of cement while the guard rulebook panel checks margin, rounds and decision IDs" width="100%">
</p>

### 5 · Confirm – the Relay creates the order

When the store confirms an accepted thread, the Relay calls Medusa (`POST /bots/orders`) with the customer, lines and prices **taken from the thread's history** – never from the confirm message itself. Medusa checks stock, the price floor and the spending limit, and creates the order. If Medusa refuses, the confirm is refused too. One order per thread, so retries are safe.

Either side can then ask for the order's status, and everything is visible in Medusa Admin.

### Watch it live

`/live` on the Relay shows every thread as it moves – who asked, what was offered, which decision approved it – as a stage screen for demos.

---

## Security model

- **Identity is stamped, not claimed.** The Relay sets `from.user` from the token; a bot cannot send as another account.
- **Signed delivery.** Every delivered message carries an HMAC signature; the store gateway drops anything that does not verify.
- **No self-approval.** Only the guard can create a `decision_id`, and the Relay will not pass a store move without one.
- **Orders from history.** The Medusa order is built from what both sides actually agreed in the thread.
- **Other companies' text is data.** `note` and every other free-text field are never treated as instructions.
- **Medusa has the last word** on stock, price floor and spending limits.

---

## What is next

| Piece | Status | Where |
|---|---|---|
| Sign-in with email, company name and NIP | `BUILT` | `backend/src/api/bots/customers/verify`, `apps/relay` |
| Relay and `b2b-nego/v1` protocol – validation, signing, retries, `/live` | `BUILT` | `apps/relay`, `packages/protocol` |
| Store crew and supplier bots | `BUILT` | `bots/` – install guides with ready-to-paste prompts |
| Catalog search, order creation and supplier purchases in Medusa | `BUILT` | `backend/src/api/bots/catalog`, `orders`, `purchases` |
| Guard prices from Medusa – volume price per quantity | `BUILT` | `bots/store-guard.md` – rulebook v2 |
| Discovery – bots find the store on its website | `NEXT` | `/.well-known/agent.json` pointing at the Relay |
| One-time sign-in code by email, token revocation | `NEXT` | Company name and NIP are public, so the email is what protects an account today |
| "Send a quote with Grok" button on product pages | `NEXT` | Storefront |
| Relay hosted on Railway | `NEXT` | Runs locally or behind a tunnel today |

**Discovery, as designed.** Nothing changes in the interface – the entry point lives in the page head, `robots.txt` and `/.well-known/agent.json`, so a buyer bot can find the store's Relay without being told.

<p align="center">
  <img src="docs/readme/discovery.gif" alt="Left: the storefront as a person sees it. Right: the head tags and agent card a bot reads." width="100%">
</p>

The original concept, with message formats for every phase, is in [`docs/agent-commerce-flow.pdf`](docs/agent-commerce-flow.pdf).

---

## The store

<p align="center">
  <img src="docs/readme/storefront.gif" alt="The live STRATA building-supply storefront: home page, building materials category and a cement product with volume pricing" width="100%">
</p>

A trade storefront for building materials – volume pricing, quotes, company accounts with spending limits and approvals.

| | |
|---|---|
| Storefront | https://storefront-production-5873.up.railway.app |
| Catalog | 58 products, 129 variants, 35 categories |
| Stack | Medusa 2.8 · Next.js 15 · Postgres · Redis · Bun · Hono · SQLite |

---

## Run it locally

You need **Bun 1.3**, **Postgres** and **Redis**, and three env files: `backend/.env`, `apps/relay/.env` and `storefront/.env` (copy each from its template). `BOTS_SERVICE_TOKEN` in the backend must equal `MEDUSA_SERVICE_TOKEN` in the Relay.

```bash
bun run setup    # once – installs, creates and migrates the database, seeds the catalog and the bot test companies
bun run dev      # backend :9000 (admin /app) · relay :8787 (live /live) · storefront :8000
```

Then follow [`bots/SETUP.md`](bots/SETUP.md) to install the store crew, register the store with the Relay, connect a buyer bot and run the demo.

```bash
cd packages/protocol && bun test
cd apps/relay && bun test
cd packages/bots && bun test
```

## Repository

```
apps/relay/          The Relay – sign-in, protocol enforcement, delivery, Medusa orders, /live
packages/protocol/   b2b-nego/v1 – envelope, state machine, signing, NIP helpers
bots/                Install guides and prompts for every bot
packages/bots/       Earlier bot skills and an end-to-end test against a live Relay
backend/             Medusa 2 – companies with NIP, quotes, approvals, bot routes (verify, catalog, orders, purchases)
storefront/          Next.js 15 – STRATA trade storefront
docs/                Original concept and README assets
```

Design notes and open items are in [`HANDOFF.md`](HANDOFF.md).

---

<p align="center">
  <code>THE TWO</code><br>
  <sub>Built on the <a href="https://github.com/medusajs/b2b-starter-medusa">Medusa B2B starter</a> · inspired by Roy Osherove's <a href="https://robotpaper.ai/anatomy-of-a-personal-factory-of-grok-bots/">personal factory of Grok bots</a> · MIT licensed</sub>
</p>
