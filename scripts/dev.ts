#!/usr/bin/env bun
/**
 * `bun run dev` from the repo root: starts the whole local stack in one terminal.
 *   backend     Medusa            http://localhost:9000   (admin: /app)
 *   relay       Negotiation Relay http://localhost:8787   (live view: /live)
 *   storefront  Next.js           http://localhost:8000
 * Ctrl+C stops all of them. If one crashes, the others are stopped too.
 */
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const services = [
  { name: "backend", color: 35, cwd: "backend", cmd: ["bun", "run", "dev"] },
  { name: "relay", color: 36, cwd: "apps/relay", cmd: ["bun", "--watch", "src/server.ts"] },
  { name: "storefront", color: 33, cwd: "storefront", cmd: ["bun", "run", "dev"] },
];

const width = Math.max(...services.map((s) => s.name.length));
const children: ReturnType<typeof Bun.spawn>[] = [];
let stopping = false;

async function pipe(stream: ReadableStream<Uint8Array>, prefix: string) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) process.stdout.write(`${prefix}${line}\n`);
  }
  if (buffer) process.stdout.write(`${prefix}${buffer}\n`);
}

/** All descendants of a pid (medusa develop and next dev start their own child processes). */
function descendants(pid: number): number[] {
  const out = Bun.spawnSync(["pgrep", "-P", String(pid)]).stdout.toString().trim();
  const kids = out ? out.split("\n").map(Number) : [];
  return kids.flatMap((k) => [k, ...descendants(k)]);
}

function killTree(pid: number, signal: NodeJS.Signals) {
  for (const p of [...descendants(pid).reverse(), pid]) {
    try {
      process.kill(p, signal);
    } catch {}
  }
}

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) killTree(child.pid, "SIGTERM");
  setTimeout(() => {
    for (const child of children) killTree(child.pid, "SIGKILL");
    process.exit(code);
  }, 5000).unref();
  Promise.all(children.map((c) => c.exited)).then(() => process.exit(code));
}

for (const s of services) {
  const prefix = `\x1b[${s.color}m${s.name.padEnd(width)} │\x1b[0m `;
  const child = Bun.spawn(s.cmd, {
    cwd: join(root, s.cwd),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  children.push(child);
  void pipe(child.stdout, prefix);
  void pipe(child.stderr, prefix);
  child.exited.then((code) => {
    if (stopping) return;
    process.stdout.write(`${prefix}exited with code ${code}; stopping everything\n`);
    stopAll(code || 1);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

console.log(
  [
    "",
    "  backend     http://localhost:9000/app   (admin@test.com / supersecret)",
    "  relay       http://localhost:8787/live",
    "  storefront  http://localhost:8000       (buyer@bella-bau.test / supersecret)",
    "  Ctrl+C stops everything.",
    "",
  ].join("\n"),
);
