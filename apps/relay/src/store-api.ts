/**
 * The store's Medusa, as the Relay uses it for the bots (backend/src/api/bots/*, service token).
 * search_catalog and get_order_status are open to any signed-in account; orders are created only by the Relay
 * itself when the store confirms a thread (see app.ts), from the thread's own history.
 */
export interface CatalogQuery {
  q?: string;
  sku?: string;
  qty?: number;
  in_stock?: boolean;
  limit?: number;
}

export interface OrderLine {
  sku: string;
  qty: number;
  unit_price: number;
}

export interface CreateOrderInput {
  customer_id: string;
  thread_id: string;
  decision_id: string;
  lines: OrderLine[];
  note?: string;
}

export interface OrderSummary {
  order_id: string;
  display_id: number | string;
  status: string;
  total: number;
  currency: string;
  thread_id: string | null;
  [key: string]: unknown;
}

/** A Medusa answer the Relay passes on as-is (status + JSON body). */
export class StoreApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; message?: string; [k: string]: unknown },
  ) {
    super(body.message ?? body.error ?? `HTTP ${status}`);
  }
}

export interface ReceivePurchaseInput {
  thread_id: string;
  /** Supplier account id on the Relay. */
  supplier: string;
  decision_id?: string;
  lines: OrderLine[];
}

export interface StoreApi {
  catalog(query: CatalogQuery): Promise<unknown>;
  createOrder(input: CreateOrderInput): Promise<OrderSummary>;
  order(id: string): Promise<OrderSummary | null>;
  /** A supplier confirmed a sale to the store: add the bought stock in Medusa. */
  receivePurchase(input: ReceivePurchaseInput): Promise<unknown>;
}

export class MedusaStoreApi implements StoreApi {
  constructor(
    private baseUrl: string,
    private serviceToken: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(method: string, path: string, body?: unknown) {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${this.serviceToken}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new StoreApiError(res.status, json);
    return json;
  }

  catalog(q: CatalogQuery) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") params.set(k, String(v === true ? 1 : v));
    return this.call("GET", `/bots/catalog?${params}`);
  }

  createOrder(input: CreateOrderInput) {
    return this.call("POST", "/bots/orders", input);
  }

  receivePurchase(input: ReceivePurchaseInput) {
    return this.call("POST", "/bots/purchases", input);
  }

  async order(id: string) {
    try {
      return await this.call("GET", `/bots/orders/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof StoreApiError && err.status === 404) return null;
      throw err;
    }
  }
}
