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
Customer bots sign in with email + company name + NIP (`POST /customers/auth`). The Relay checks these with Medusa (`backend` route `POST /bots/customers/verify`, which needs `MEDUSA_URL` and `MEDUSA_SERVICE_TOKEN` = `BOTS_SERVICE_TOKEN`). See [`bots/README.md`](bots/README.md).
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

---


<h1 align="center">
  <a href="http://www.amitmerchant.com/electron-markdownify"><img src="https://github.com/user-attachments/assets/38ba3a7b-e07b-4117-8187-7b171eae3769" alt="B2B Commerce Starter" width="80" height="80"></a>
  <br>
  <br>
  Medusa B2B Commerce Starter
  <br>
</h1>

<p align="center">Customizable B2B ecommerce built with <a href="https://medusajs.com/" target="_blank">Medusa 2.0</a> & Next.js Storefront</p>

<p align="center">
  <a href="https://github.com/medusajs/medusa/blob/master/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
  </a>
    
  <a href="https://discord.gg/xpCwq3Kfn8">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>

  <a href="https://twitter.com/intent/follow?screen_name=medusajs">
    <img src="https://img.shields.io/twitter/follow/medusajs.svg?label=Follow%20@medusajs" alt="Follow @medusajs" />
  </a>
</p>

<p align="center">
  <video src="https://github.com/user-attachments/assets/833b26a5-4b52-447f-ac30-6ae02cbe8f05" controls="controls" muted="muted" playsinline="playsinline">
</video>
</p>

<br>

## Table

- [Prerequisites](#prerequisites)
- [Overview](#overview)
  - [Features](#features)
  - [Demo](#demo)
- [Quickstart](#quickstart)
- [Update](#update)
- [Resources](#resources)
- [Contributors](#contributors)

&nbsp;

## Prerequisites

⚠️ We have tested this repo with the below versions:

- ✅ Node 20
- ✅ Postgres 15
- ✅ Medusa 2.4
- ✅ Next.js 15

&nbsp;

## Overview
For a full feature overview, please visit [the project wiki](https://github.com/medusajs/b2b-starter-medusa/wiki).

#### Core features

- **Company Management**. Customers can manage their company and invite employees.
- **Spending Limits**. Company admins can assign spending limits to its employees.
- **Bulk add-to-cart**. Customers can add multiple variants of a product to their cart at once.
- **Quote Management**. Customers & Merchants can communicate, accept or reject quotes.
- **Order Edit**. Merchants can edit orders or quotes - add/remove item, update quantity & price management and more.
- **Company Approvals**. Companies can mandate approvals from company admins before employees can finalize a cart.
- **Merchant Approvals**. Merchants can set up approval processes for orders, ensuring compliance with business rules before fulfillment.
- **Promotions**. Customers can apply manual and automatic promotions to their cart.
- **Free Shipping Nudge**. Displays a component showing progress toward free shipping.
- **Full ecommerce support**
  - Product Pages
  - Product Collections & Categories
  - Cart & Checkout
  - User Accounts
  - Order Details
- **Full Next.js 15 support**
  - App Router
  - Caching
  - Server components/actions
  - Streaming
  - Static Pre-Rendering

&nbsp;

#### Demo

#### Quote Management

<img align="right" src="https://github.com/user-attachments/assets/110c99e8-18ba-49e5-8955-84a058b597c7" alt="image" style=: />
&nbsp;

#### Company Management

<img align="right" src="https://github.com/user-attachments/assets/361702ce-d491-4509-a930-4361ab3b4126" alt="image" style=: />
&nbsp;

#### Approval Management

<img align="right" src="https://github.com/user-attachments/assets/b93b7b94-41a9-4c5f-bd6b-abf87492ed46" alt="image" style=: />
&nbsp;

#### Product Page

<img align="right" src="https://github.com/user-attachments/assets/2cd8a3ff-5999-49af-890a-4bac7b6f2f15" alt="image" style=: />
&nbsp;

#### Cart Summary

<img align="right" src="https://github.com/user-attachments/assets/095f5565-992e-4c74-acdc-a44bd905e59b" alt="image" style=: />
&nbsp;

&nbsp;

## Quickstart

#### Setup Medusa project

```bash
# Clone the repository
git clone https://github.com/medusajs/b2b-starter-medusa.git

## Setup Backend

# Go to the folder
cd ./backend

# Clone .env.template
cp .env.template .env

# Install dependencies
yarn install

# Install dependencies, setup database & seed data
yarn install && yarn medusa db:create && yarn medusa db:migrate && yarn run seed && yarn medusa user -e admin@test.com -p supersecret -i admin

# Start Medusa project - backend & admin
yarn dev

## Setup Storefront

# Go to folder
cd ../storefront

# Clone .env.template
cp .env.template .env

# Install dependencies
yarn install
```

#### Setup publishable key

- ✅ Visit [Admin: Publishable Key](http://localhost:9000/app/settings/publishable-api-keys)
  - <b>Credentials</b>:
    - <b>email</b>: `admin@test.com`
    - <b>password</b>: `supersecret`
- ✅ Copy token key of "Webshop"
- ✅ Open file - `storefront/.env`
- ✅ Add token to this var - `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`

```
# Start Medusa storefront
yarn dev
```

Visit the following links to see the Medusa storefront & admin

- [Medusa Admin](http://localhost:9000/app)
- [Medusa Storefront](http://localhost:8000)

&nbsp;

# Update

Some general guidelines for when you're updating this Starter to a newer version.

## Update packages

Run `yarn install` in both projects to update you're packages to the latest versions.

## Run migrations

To reflect any changes made to data models, make sure to run `npx medusa db:migrate` in the backend project.

> Note: are you updating from a version of this Starter that didn't have the Approval module yet? Run `npx medusa exec src/scripts/create-approval-settings.ts` in the backend project to add approval settings to all existing companies.

# Resources

#### Learn more about Medusa

- [Website](https://www.medusajs.com/)
- [GitHub](https://github.com/medusajs)
- [2.0 Documentation](https://docs.medusajs.com/v2)

#### Learn more about Next.js

- [Website](https://nextjs.org/)
- [GitHub](https://github.com/vercel/next.js)
- [Documentation](https://nextjs.org/docs)

&nbsp;

## Contributors

<a href = "https://github.com/medusajs/b2b-starter-medusa/graphs/contributors">
  <img src = "https://contrib.rocks/image?repo=medusajs/b2b-starter-medusa"/>
</a>
