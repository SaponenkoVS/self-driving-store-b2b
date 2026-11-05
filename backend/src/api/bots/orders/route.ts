import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createOrderWorkflow, getOrderDetailWorkflow } from "@medusajs/medusa/core-flows";
import type { MedusaContainer } from "@medusajs/framework/types";
import { BOT_CURRENCY, loadCatalog, tierPrice } from "../../../utils/bot-catalog";
import type { BotsCreateOrderType } from "../middlewares";

/** Lowest price a bot deal may reach, as a share below the volume price for that quantity. Medusa's own guardrail. */
const MAX_DISCOUNT = Math.min(Math.max(Number(process.env.BOTS_MAX_DISCOUNT ?? 0.15) || 0.15, 0), 0.9);

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * POST /bots/orders
 * create_order: turns a confirmed b2b-nego/v1 thread into a Medusa order for the customer's company.
 * Called by the Relay when the store confirms (the Relay takes customer, lines and prices from the thread, not from a bot).
 * Idempotent per thread_id: a retry returns the existing order.
 */
export const POST = async (req: MedusaRequest<BotsCreateOrderType>, res: MedusaResponse) => {
  const { customer_id, thread_id, decision_id, lines, note } = req.validatedBody;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // 1. Idempotency: one order per negotiation thread.
  const existing = await pg("order")
    .select("id")
    .whereRaw("metadata->>'bot_thread_id' = ?", [thread_id])
    .whereNull("deleted_at")
    .first();
  if (existing) return res.status(200).json({ ...(await orderSummary(req.scope, existing.id)), duplicate: true });

  // 2. Who is buying: the customer must be an employee of a company.
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "phone",
      "employee.is_admin",
      "employee.spending_limit",
      "employee.company.id",
      "employee.company.name",
      "employee.company.phone",
      "employee.company.address",
      "employee.company.city",
      "employee.company.state",
      "employee.company.zip",
      "employee.company.country",
    ],
    filters: { id: customer_id },
  });
  const customer = customers[0] as any;
  const company = customer?.employee?.company;
  if (!customer || !company) return res.status(404).json({ error: "customer_not_found", message: `No company employee ${customer_id}` });

  // 3. Lines: known SKUs, prices not below Medusa's floor.
  const catalog = await loadCatalog(req.scope, { skus: lines.map((l) => l.sku) });
  const bySku = new Map(catalog.map((i) => [i.sku.toUpperCase(), i]));
  const problems: string[] = [];
  const items = lines.map((l) => {
    const item = bySku.get(l.sku.toUpperCase());
    if (!item) {
      problems.push(`unknown sku ${l.sku}`);
      return null;
    }
    const reference = tierPrice(item, l.qty);
    const floor = reference === null ? null : round2(reference * (1 - MAX_DISCOUNT));
    if (floor !== null && l.unit_price < floor) problems.push(`${l.sku}: ${l.unit_price} is below the floor ${floor}`);
    return {
      variant_id: item.variant_id,
      title: [item.title, item.variant].filter(Boolean).join(" – "),
      quantity: l.qty,
      unit_price: l.unit_price,
      metadata: { bot_reference_price: reference },
    };
  });
  if (problems.length) return res.status(422).json({ error: "invalid_lines", message: problems.join("; ") });

  // 4. Employee spending limit (0 / null = no limit; admins are not limited).
  const total = round2(lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0));
  const limit = Number(customer.employee.spending_limit ?? 0);
  if (!customer.employee.is_admin && limit > 0 && total > limit)
    return res.status(403).json({ error: "spending_limit_exceeded", message: `Order total ${total} is above the limit ${limit}`, total, limit });

  // 5. Create the order. metadata.company_id links it to the company (workflows/hooks/order-created.ts).
  const address = {
    first_name: customer.first_name ?? undefined,
    last_name: customer.last_name ?? undefined,
    company: company.name,
    address_1: company.address ?? undefined,
    city: company.city ?? undefined,
    province: company.state ?? undefined,
    postal_code: company.zip ?? undefined,
    country_code: company.country?.toLowerCase() ?? undefined,
    phone: company.phone ?? customer.phone ?? undefined,
  };
  const { data: regions } = await query.graph({ entity: "region", fields: ["id", "currency_code"] });
  const region = (regions as any[]).find((r) => r.currency_code?.toLowerCase() === BOT_CURRENCY) ?? regions[0];
  if (!region) return res.status(500).json({ error: "no_region", message: "The store has no region" });

  try {
    const { result: order } = await createOrderWorkflow(req.scope).run({
      input: {
        region_id: region.id,
        customer_id: customer.id,
        email: customer.email,
        currency_code: BOT_CURRENCY,
        items: items as any,
        shipping_address: address,
        billing_address: address,
        metadata: {
          company_id: company.id,
          source: "grok-bot",
          bot_thread_id: thread_id,
          bot_decision_id: decision_id,
          ...(note ? { bot_note: note } : {}),
        },
      },
    });
    return res.status(201).json(await orderSummary(req.scope, order.id));
  } catch (err: any) {
    const message = err?.message ?? String(err);
    const status = /inventory|stock/i.test(message) ? 409 : 400;
    return res.status(status).json({ error: status === 409 ? "insufficient_stock" : "order_failed", message });
  }
};

export async function orderSummary(scope: MedusaContainer, id: string) {
  // getOrderDetailWorkflow computes totals and item quantities (a plain query.graph returns them empty).
  let o: any;
  try {
    const { result } = await getOrderDetailWorkflow(scope).run({
      input: {
        order_id: id,
        fields: [
          "id",
          "display_id",
          "status",
          "currency_code",
          "total",
          "subtotal",
          "tax_total",
          "created_at",
          "customer_id",
          "metadata",
          "payment_status",
          "fulfillment_status",
          "items.*",
        ],
      },
    });
    o = result;
  } catch {
    return null;
  }
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: links } = await query.graph({ entity: "order", fields: ["id", "company.id", "company.name"], filters: { id } });
  const company = (links[0] as any)?.company;
  return {
    order_id: o.id,
    display_id: o.display_id,
    status: o.status,
    payment_status: o.payment_status ?? null,
    fulfillment_status: o.fulfillment_status ?? null,
    currency: String(o.currency_code ?? "").toUpperCase(),
    subtotal: Number(o.subtotal ?? 0),
    tax_total: Number(o.tax_total ?? 0),
    total: Number(o.total ?? 0),
    customer_id: o.customer_id,
    company: company ? { id: company.id, name: company.name } : null,
    thread_id: o.metadata?.bot_thread_id ?? null,
    decision_id: o.metadata?.bot_decision_id ?? null,
    created_at: o.created_at,
    lines: (o.items ?? []).map((i: any) => ({
      sku: i.variant_sku,
      title: i.title,
      qty: Number(i.quantity),
      unit_price: Number(i.unit_price),
    })),
  };
}
