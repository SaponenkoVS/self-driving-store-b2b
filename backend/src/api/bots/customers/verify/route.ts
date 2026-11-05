import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { normalizeCompanyName, normalizeEmail, normalizeNip } from "../../../../utils/bot-identity";
import type { BotsVerifyCustomerType } from "../../middlewares";

/**
 * POST /bots/customers/verify
 * A customer's Grok bot proves who it acts for with email + company name + NIP.
 * All three must match a registered customer who is an employee of a company with that tax id.
 * Read-only: the Relay issues the bot's credential, not Medusa.
 */
export const POST = async (req: MedusaRequest<BotsVerifyCustomerType>, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const email = normalizeEmail(req.validatedBody.email);
  const nip = normalizeNip(req.validatedBody.nip);
  const companyName = normalizeCompanyName(req.validatedBody.company_name);

  const noMatch = () => res.status(404).json({ error: "no_match" });
  if (!nip) return noMatch();

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "has_account",
      "employee.id",
      "employee.is_admin",
      "employee.spending_limit",
      "employee.company.id",
      "employee.company.name",
      "employee.company.tax_id",
      "employee.company.currency_code",
    ],
    filters: { email, has_account: true },
  });

  const match = customers.find((c: any) => {
    const company = c.employee?.company;
    return (
      company?.tax_id &&
      normalizeNip(company.tax_id) === nip &&
      normalizeCompanyName(company.name ?? "") === companyName
    );
  }) as any;

  if (!match) return noMatch();

  const company = match.employee.company;
  return res.json({
    customer_id: match.id,
    employee_id: match.employee.id,
    email: match.email,
    name: [match.first_name, match.last_name].filter(Boolean).join(" ") || match.email,
    is_admin: match.employee.is_admin,
    spending_limit: Number(match.employee.spending_limit ?? 0),
    company_id: company.id,
    company_name: company.name,
    tax_id: nip,
    currency_code: company.currency_code,
  });
};
