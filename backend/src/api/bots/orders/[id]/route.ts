import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { orderSummary } from "../route";

/**
 * GET /bots/orders/:id
 * get_order_status for the Grok bots (the Relay checks that the caller is a party of the order's thread).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const order = await orderSummary(req.scope, req.params.id);
  if (!order) return res.status(404).json({ error: "not_found" });
  return res.json(order);
};
