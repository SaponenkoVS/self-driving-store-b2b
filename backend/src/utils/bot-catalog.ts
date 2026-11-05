import { ContainerRegistrationKeys, getVariantAvailability } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/framework/types";

/**
 * Catalog as the Grok bots see it (GET /bots/catalog, POST /bots/orders).
 * One entry per variant: the SKU is what bots put in b2b-nego/v1 lines.
 */
export type PriceTier = { min_qty: number; max_qty: number | null; unit_price: number };

export type CatalogItem = {
  sku: string;
  variant_id: string;
  product_id: string;
  title: string;
  variant: string | null;
  handle: string | null;
  category: string | null;
  currency: string;
  /** Price for 1 unit (the highest tier). */
  list_price: number | null;
  /** Volume pricing, ascending min_qty. */
  price_tiers: PriceTier[];
  /** Units available to sell now (stocked - reserved) in the default sales channel. null = not inventory-managed. */
  stock: number | null;
};

export const BOT_CURRENCY = (process.env.BOTS_CURRENCY ?? "eur").toLowerCase();

/** The tier price that applies to `qty` units. */
export function tierPrice(item: Pick<CatalogItem, "price_tiers" | "list_price">, qty: number): number | null {
  const tier = item.price_tiers.find((t) => qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty));
  return tier?.unit_price ?? item.list_price;
}

const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function tiersFrom(variant: any): PriceTier[] {
  const prices = ((variant.prices ?? []) as any[]).filter(
    (p) => p && p.currency_code?.toLowerCase() === BOT_CURRENCY && !p.price_list_id,
  );
  const tiers = prices.map((p) => ({
    min_qty: Number(p.min_quantity ?? 1) || 1,
    max_qty: p.max_quantity == null ? null : Number(p.max_quantity),
    unit_price: Number(p.amount),
  }));
  // Several prices with the same min_qty (e.g. region-specific): keep the one without a max, then the cheapest.
  const byMin = new Map<number, PriceTier>();
  for (const t of tiers) {
    const prev = byMin.get(t.min_qty);
    if (!prev || (prev.max_qty !== null && t.max_qty === null) || t.unit_price < prev.unit_price) byMin.set(t.min_qty, t);
  }
  return [...byMin.values()].sort((a, b) => a.min_qty - b.min_qty);
}

export async function defaultSalesChannelId(container: MedusaContainer): Promise<string | undefined> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: stores } = await query.graph({ entity: "store", fields: ["default_sales_channel_id"] });
  if (stores[0]?.default_sales_channel_id) return stores[0].default_sales_channel_id as string;
  const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id"] });
  return channels[0]?.id as string | undefined;
}

/**
 * Loads published variants that have a SKU. The catalog is small (tens of products), so filtering happens in memory.
 * `skus` limits the lookup to exact SKUs (case-insensitive).
 */
export async function loadCatalog(container: MedusaContainer, opts: { skus?: string[] } = {}): Promise<CatalogItem[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "sku",
      "title",
      "manage_inventory",
      "product.id",
      "product.title",
      "product.handle",
      "product.status",
      "product.categories.name",
      "prices.*",
    ],
  });

  const wanted = opts.skus ? new Set(opts.skus.map((s) => s.trim().toUpperCase())) : null;
  const rows = (variants as any[]).filter(
    (v) => v.sku && v.product?.status === "published" && (!wanted || wanted.has(String(v.sku).toUpperCase())),
  );

  const salesChannelId = await defaultSalesChannelId(container);
  const availability =
    salesChannelId && rows.length
      ? await getVariantAvailability(query as any, { variant_ids: rows.map((v) => v.id), sales_channel_id: salesChannelId })
      : {};

  return rows.map((v) => {
    const price_tiers = tiersFrom(v);
    return {
      sku: v.sku,
      variant_id: v.id,
      product_id: v.product.id,
      title: v.product.title,
      variant: v.title ?? null,
      handle: v.product.handle ?? null,
      category: v.product.categories?.[0]?.name ?? null,
      currency: BOT_CURRENCY.toUpperCase(),
      list_price: price_tiers[0]?.unit_price ?? null,
      price_tiers,
      stock: v.manage_inventory === false ? null : (availability[v.id]?.availability ?? 0),
    };
  });
}

/** Free-text search over SKU, product title, variant title and category. Every word must match. */
export function searchCatalog(items: CatalogItem[], q: string): CatalogItem[] {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((i) => {
    const hay = normalize([i.sku, i.title, i.variant, i.category, i.handle].filter(Boolean).join(" "));
    return words.every((w) => hay.includes(w));
  });
}
