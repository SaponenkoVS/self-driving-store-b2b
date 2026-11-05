import type { Envelope } from "@nsc/protocol";
import type { ThreadRow } from "./db";

export type LiveEvent =
  | { kind: "message"; envelope: Envelope; thread: ThreadRow }
  | { kind: "delivery"; msg_id: string; thread_id: string; status: "delivered" | "retrying" | "failed"; error?: string }
  | { kind: "rejected"; thread_id: string; from: string; type: string; reason: string };

/** In-process pub/sub feeding the /live SSE stream (the demo screen). */
export class Bus {
  private listeners = new Set<(e: LiveEvent) => void>();
  publish(e: LiveEvent) {
    for (const l of this.listeners) l(e);
  }
  subscribe(l: (e: LiveEvent) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}
