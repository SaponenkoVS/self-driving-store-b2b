import { timingSafeEqual } from "crypto";
import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework";
import { z } from "zod";

/**
 * /bots/* is called server-to-server by the Negotiation Relay (apps/relay),
 * never by browsers. It is protected by a shared service token.
 */
function requireBotsServiceToken(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const expected = process.env.BOTS_SERVICE_TOKEN ?? "";
  const given = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  const ok =
    expected.length > 0 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

export const BotsVerifyCustomer = z
  .object({
    email: z.string().email(),
    company_name: z.string().min(1).max(200),
    nip: z.string().min(10).max(20),
  })
  .strict();
export type BotsVerifyCustomerType = z.infer<typeof BotsVerifyCustomer>;

const flag = z
  .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
  .transform((v) => v === "1" || v === "true");

export const BotsCatalogQuery = z.object({
  q: z.string().max(200).optional(),
  sku: z.string().max(1000).optional(),
  qty: z.coerce.number().int().positive().max(1_000_000).optional(),
  in_stock: flag.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const BotsCreateOrder = z
  .object({
    customer_id: z.string().min(1).max(64),
    thread_id: z.string().min(3).max(64),
    decision_id: z.string().min(1).max(64),
    lines: z
      .array(
        z.object({
          sku: z.string().min(1).max(64),
          qty: z.number().int().positive().max(1_000_000),
          unit_price: z.number().positive(),
        }),
      )
      .min(1)
      .max(50),
    note: z.string().max(1000).optional(),
  })
  .strict();
export type BotsCreateOrderType = z.infer<typeof BotsCreateOrder>;

export const BotsReceivePurchase = z
  .object({
    thread_id: z.string().min(3).max(64),
    supplier: z.string().min(1).max(64),
    decision_id: z.string().max(64).optional(),
    lines: z
      .array(
        z.object({
          sku: z.string().min(1).max(64),
          qty: z.number().int().positive().max(1_000_000),
          unit_price: z.number().positive().optional(),
        }),
      )
      .min(1)
      .max(50),
  })
  .strict();
export type BotsReceivePurchaseType = z.infer<typeof BotsReceivePurchase>;

export const botsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/bots*",
    middlewares: [requireBotsServiceToken],
  },
  {
    matcher: "/bots/customers/verify",
    method: "POST",
    middlewares: [validateAndTransformBody(BotsVerifyCustomer)],
  },
  {
    matcher: "/bots/orders",
    method: "POST",
    middlewares: [validateAndTransformBody(BotsCreateOrder)],
  },
  {
    matcher: "/bots/purchases",
    method: "POST",
    middlewares: [validateAndTransformBody(BotsReceivePurchase)],
  },
];
