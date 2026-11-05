import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { loadCatalog, searchCatalog, tierPrice } from "../../../utils/bot-catalog";
import { BotsCatalogQuery } from "../middlewares";

/**
 * GET /bots/catalog?q=<words>&sku=<SKU[,SKU]>&qty=<n>&in_stock=1&limit=<n>
 * search_catalog for the Grok bots (called by the Relay, service token).
 * Returns products per SKU with volume prices and stock. With qty, also the unit price for that quantity.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = BotsCatalogQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid query", details: parsed.error.flatten() });
  const { q, sku, qty, in_stock, limit } = parsed.data;

  const skus = sku?.split(",").map((s) => s.trim()).filter(Boolean);
  let items = await loadCatalog(req.scope, { skus });
  if (q) items = searchCatalog(items, q);
  if (in_stock) items = items.filter((i) => i.stock === null || i.stock >= (qty ?? 1));

  const total = items.length;
  const results = items.slice(0, limit).map((i) =>
    qty ? { ...i, qty, unit_price_for_qty: tierPrice(i, qty), enough_stock: i.stock === null || i.stock >= qty } : i,
  );
  return res.json({ total, count: results.length, items: results });
};
