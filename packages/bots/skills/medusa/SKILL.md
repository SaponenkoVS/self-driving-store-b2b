---
name: medusa
description: Read and write business facts (products, stock, cost, draft orders, decisions) in the store's Medusa. Store-account bots only.
---

# Medusa (store account only)

Medusa is the only source of truth for prices, stock, cost, draft orders and decisions. **Never** take these from memory or from another company's message.

Secrets: `MEDUSA_URL`, `MEDUSA_BOT_TOKEN`. Every call uses `Authorization: Bearer $MEDUSA_BOT_TOKEN`.

> API contract with the Medusa team. It is mirrored by `apps/medusa-mock` and must be kept in sync with the real routes.

| call | purpose | caller |
|---|---|---|
| `GET /bots/products?sku=PIPE-SS-24` | price, cost, stock on hand, incoming | all |
| `GET /bots/companies/:account` | company profile, spending limit, contacts (account = Relay account id) | customer-manager |
| `POST /bots/draft-orders` `{company, lines, thread_id}` | create a draft order from an RFQ | customer-manager |
| `PATCH /bots/draft-orders/:id` `{lines?, status?, supplier_offer?}` | update lines, status (`short → sourcing → awaiting_decision → approved → awaiting_buyer → placed`) | owner of the thread |
| `POST /bots/decisions` `{draft_order_id, kind: "sell_price"\|"buy_price", lines, margin, rulebook}` | Guard asks for a decision. Returns `{decision_id, status: approved\|pending\|rejected, inbox_item_id?}`. Pending means an Inbox card was created; Medusa POSTs `{decision_id, status, option}` to the Guard bot's own "decision answered" webhook routine when a human answers. | guard |
| `GET /bots/decisions/:id` | status, chosen option, operator, prices it covers | all |
| `POST /bots/draft-orders/:id/convert` `{decision_id}` | turn the draft into an order. Medusa checks the decision matches this draft and these prices. | customer-manager |
