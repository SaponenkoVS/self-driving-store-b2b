import { Bus } from "./bus";
import { RelayDb } from "./db";
import { Deliverer } from "./deliver";
import { createApp } from "./app";

const db = new RelayDb(process.env.DB_PATH ?? "relay.sqlite");
const bus = new Bus();
const deliverer = new Deliverer(db, bus);
const app = createApp({
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
