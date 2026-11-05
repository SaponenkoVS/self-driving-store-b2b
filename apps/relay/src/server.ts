import { Bus } from "./bus";
import { RelayDb } from "./db";
import { Deliverer } from "./deliver";
import { createApp } from "./app";
import { MedusaDirectory, SeedDirectory } from "./directory";

const db = new RelayDb(process.env.DB_PATH ?? "relay.sqlite");
const bus = new Bus();
const deliverer = new Deliverer(db, bus);
// Customer bot logins are checked against Medusa; CUSTOMERS_SEED is a fallback for demos without Medusa.
const directory = process.env.MEDUSA_URL
  ? new MedusaDirectory(process.env.MEDUSA_URL, process.env.MEDUSA_SERVICE_TOKEN ?? "")
  : process.env.CUSTOMERS_SEED
    ? SeedDirectory.fromFile(process.env.CUSTOMERS_SEED)
    : undefined;
if (!directory) console.warn("MEDUSA_URL (or CUSTOMERS_SEED) is not set: customer login is disabled");

const app = createApp({
  directory,
  db,
  bus,
  deliverer,
  adminToken: process.env.ADMIN_TOKEN ?? "",
  liveToken: process.env.LIVE_TOKEN,
});

if (!process.env.ADMIN_TOKEN) console.warn("ADMIN_TOKEN is not set: invite creation is disabled");

const sweeper = setInterval(() => void deliverer.sweep(), 5_000);
process.on("SIGINT", () => {
  clearInterval(sweeper);
  process.exit(0);
});

const port = Number(process.env.PORT ?? 8787);
console.log(`relay listening on http://localhost:${port}  (live view: /live)`);
export default { port, fetch: app.fetch, idleTimeout: 0 };
