#!/usr/bin/env bun
/**
 * `bun run setup`: one-time local setup (safe to re-run). Runs steps one at a time.
 * Needs Postgres and Redis running, and backend/.env, apps/relay/.env, storefront/.env present.
 */
import { $ } from "bun";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const backend = join(root, "backend");
const step = (title: string) => console.log(`\n\x1b[36m▶ ${title}\x1b[0m`);

const env = await Bun.file(join(backend, ".env")).text();
const dbName = env.match(/^DB_NAME=(.+)$/m)?.[1]?.trim() ?? "self_driving_store_b2b";
const psql = (sql: string) => $`psql -h localhost -U postgres -d ${dbName} -tAc ${sql}`.nothrow().quiet().text();

step("Install dependencies");
await $`bun install`.cwd(root);
await $`bun install`.cwd(backend);
await $`bun install`.cwd(join(root, "storefront"));

step("Database");
await $`bunx medusa db:create --db ${dbName} --no-interactive`.cwd(backend).nothrow();
await $`bunx medusa db:migrate`.cwd(backend);

const products = Number((await psql("select count(*) from product")).trim() || 0);
if (products === 0) {
  step("Seed store + building materials catalog");
  await $`bun run seed`.cwd(backend);
  await $`bun run seed:catalog`.cwd(backend);
} else {
  console.log(`Catalog already seeded (${products} products), skipping.`);
}

step("Seed bot test companies and customers");
await $`bun run seed:bots`.cwd(backend);

step("Admin user admin@test.com / supersecret");
await $`bunx medusa user -e admin@test.com -p supersecret -i admin`.cwd(backend).nothrow().quiet();

step("Storefront publishable key");
const key = (await psql("select token from api_key where type='publishable' and revoked_at is null order by created_at limit 1")).trim();
const sfEnvPath = join(root, "storefront/.env");
const sfEnv = await Bun.file(sfEnvPath).text();
if (key && !sfEnv.includes(`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${key}`)) {
  await Bun.write(sfEnvPath, sfEnv.replace(/^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=.*$/m, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${key}`));
  console.log("Updated storefront/.env");
} else console.log("Already set.");

console.log("\nDone. Start everything with: bun run dev");
