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
];
