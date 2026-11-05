# Testing bot communication locally

## 1. Medusa (store)

```sh
cd backend                              # .env is already filled in
bun install
bunx medusa db:create --db self_driving_store_b2b
bunx medusa db:migrate
bun run seed                            # regions, sales channel, publishable key
bun run seed:catalog                    # building materials catalog (EUR, tier prices)
bun run seed:bots                       # test companies + customers below
bunx medusa user -e admin@test.com -p supersecret -i admin
bun run dev                             # http://localhost:9000
```

## 2. Relay

```sh
cd apps/relay && bun src/server.ts      # http://localhost:8787/live
```

`apps/relay/.env` `MEDUSA_SERVICE_TOKEN` and `backend/.env` `BOTS_SERVICE_TOKEN` are the same value.

## Test identities (from `seed:bots`)

A customer bot proves who it acts for with **email + company name + NIP**.

| Relay account | email | company name | NIP | role | spending limit |
|---|---|---|---|---|---|
| `co-5260250274` | `buyer@bella-bau.test` | `Bella-Bau Sp. z o.o.` | `5260250274` | admin | none |
| `co-5260250274` | `junior@bella-bau.test` | `Bella-Bau Sp. z o.o.` | `5260250274` | employee | 2000 EUR |
| `co-7781401239` | `zakupy@nowak-bud.test` | `Nowak Budownictwo S.A.` | `7781401239` | admin | none |

Storefront password for all of them: `supersecret`.

Negative cases to try: wrong NIP checksum (`5260250275`), right NIP with the other company's name, `junior@bella-bau.test` with Nowak's NIP. All should return `404 {"error":"no_match"}`.

## Check verification directly

```sh
source backend/.env
curl -s -X POST http://localhost:9000/bots/customers/verify \
  -H "Authorization: Bearer $BOTS_SERVICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"buyer@bella-bau.test","company_name":"bella bau sp z oo","nip":"PL 526-025-02-74"}'
```

Name and NIP are normalised, so the example above matches. Without the token you get `401`.
