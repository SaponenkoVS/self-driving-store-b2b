import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { defaultSalesChannelId, loadCatalog } from "../../../utils/bot-catalog";
import type { BotsReceivePurchaseType } from "../middlewares";

/**
 * POST /bots/purchases
 * receive_purchase: a supplier confirmed a sale to the store (b2b-nego/v1 thread where the store is the buyer).
 * Called by the Relay on that confirm, with lines from the thread. Adds the bought quantity to the store's stock,
 * so the customer order that needed it can be created.
 * Demo simplification: the goods count as received on confirm (no purchase-order / receiving step yet).
 */
export const POST = async (req: MedusaRequest<BotsReceivePurchaseType>, res: MedusaResponse) => {
  const { thread_id, supplier, decision_id, lines } = req.validatedBody;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const inventory = req.scope.resolve(Modules.INVENTORY);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  const catalog = await loadCatalog(req.scope, { skus: lines.map((l) => l.sku) });
  const bySku = new Map(catalog.map((i) => [i.sku.toUpperCase(), i]));
  const unknown = lines.filter((l) => !bySku.has(l.sku.toUpperCase())).map((l) => l.sku);
  if (unknown.length) return res.status(422).json({ error: "unknown_sku", message: `Not in the store catalog: ${unknown.join(", ")}` });

  // The stock location that sells through the default sales channel.
  const salesChannelId = await defaultSalesChannelId(req.scope);
  const { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "stock_locations.id"],
    filters: { id: salesChannelId },
  });
  const locationId = (channels[0] as any)?.stock_locations?.[0]?.id as string | undefined;
  if (!locationId) return res.status(500).json({ error: "no_stock_location", message: "The default sales channel has no stock location" });

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku", "inventory_items.inventory_item_id"],
    filters: { id: catalog.map((i) => i.variant_id) },
  });
  const itemBySku = new Map(
    (variants as any[]).map((v) => [String(v.sku).toUpperCase(), v.inventory_items?.[0]?.inventory_item_id as string | undefined]),
  );

  const received: { sku: string; qty: number; stock_after: number | null }[] = [];
  for (const line of lines) {
    const itemId = itemBySku.get(line.sku.toUpperCase());
    if (!itemId) {
      received.push({ sku: line.sku, qty: line.qty, stock_after: null }); // not inventory-managed: nothing to add
      continue;
    }
    const [level] = await inventory.listInventoryLevels({ inventory_item_id: itemId, location_id: locationId });
    if (level) {
      await inventory.adjustInventory([{ inventoryItemId: itemId, locationId, adjustment: line.qty }]);
    } else {
      await inventory.createInventoryLevels([{ inventory_item_id: itemId, location_id: locationId, stocked_quantity: line.qty }]);
    }
    const [after] = await inventory.listInventoryLevels({ inventory_item_id: itemId, location_id: locationId });
    received.push({
      sku: line.sku,
      qty: line.qty,
      stock_after: after ? Number(after.stocked_quantity) - Number(after.reserved_quantity) : null,
    });
  }

  logger.info(
    `[bots] purchase ${thread_id} from ${supplier} (decision ${decision_id ?? "-"}): ${received.map((r) => `${r.qty} x ${r.sku}`).join(", ")}`,
  );
  return res.status(201).json({ thread_id, supplier, decision_id: decision_id ?? null, location_id: locationId, received });
};
