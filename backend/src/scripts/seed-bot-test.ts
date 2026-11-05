import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";
import { COMPANY_MODULE } from "../modules/company";
import { createCompaniesWorkflow } from "../workflows/company/workflows";
import { createEmployeesWorkflow } from "../workflows/employee/workflows";

/**
 * Test data for bot-to-bot communication (POST /bots/customers/verify).
 * A customer bot proves who it acts for with email + company name + NIP; these are the values to give it.
 *
 *   bun run seed:bots
 *
 * Safe to run more than once: existing companies (by tax_id) and customers (by email) are reused.
 */

const PASSWORD = "supersecret";

type TestCustomer = {
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  spending_limit: number;
};

type TestCompany = {
  /** Relay account id the Relay creates at sign-in (co-<nip>). Informational only. */
  account: string;
  name: string;
  /** Valid Polish NIP (checksum ok), digits only. */
  tax_id: string;
  email: string;
  city: string;
  customers: TestCustomer[];
};

export const BOT_TEST_COMPANIES: TestCompany[] = [
  {
    account: "co-5260250274",
    name: "Bella-Bau Sp. z o.o.",
    tax_id: "5260250274",
    email: "office@bella-bau.test",
    city: "Warszawa",
    customers: [
      { email: "buyer@bella-bau.test", first_name: "Anna", last_name: "Kowalska", is_admin: true, spending_limit: 0 },
      { email: "junior@bella-bau.test", first_name: "Piotr", last_name: "Nowicki", is_admin: false, spending_limit: 2000 },
    ],
  },
  {
    account: "co-7781401239",
    name: "Nowak Budownictwo S.A.",
    tax_id: "7781401239",
    email: "biuro@nowak-bud.test",
    city: "Poznań",
    customers: [
      { email: "zakupy@nowak-bud.test", first_name: "Marek", last_name: "Nowak", is_admin: true, spending_limit: 0 },
    ],
  },
];

export default async function seedBotTest({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const companyService = container.resolve(COMPANY_MODULE) as any;
  const customerService = container.resolve(Modules.CUSTOMER);
  const authService = container.resolve(Modules.AUTH);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  for (const c of BOT_TEST_COMPANIES) {
    let [company] = await companyService.listCompanies({ tax_id: c.tax_id });
    if (!company) {
      const { result } = await createCompaniesWorkflow(container).run({
        input: [
          {
            name: c.name,
            email: c.email,
            phone: null,
            address: null,
            city: c.city,
            state: null,
            zip: null,
            country: "pl",
            logo_url: null,
            tax_id: c.tax_id,
            currency_code: "eur",
            spending_limit_reset_frequency: "monthly",
          } as any,
        ],
      });
      company = result[0];
      logger.info(`Created company ${c.name} (${company.id})`);
    } else {
      logger.info(`Company ${c.name} already exists (${company.id})`);
    }

    for (const p of c.customers) {
      const [existing] = await customerService.listCustomers({ email: p.email, has_account: true });
      let customerId = existing?.id;

      if (!customerId) {
        const { success, authIdentity, error } = await authService.register("emailpass", {
          body: { email: p.email, password: PASSWORD },
        } as any);
        if (!success || !authIdentity) throw new Error(`Auth register failed for ${p.email}: ${error}`);

        const { result: customer } = await createCustomerAccountWorkflow(container).run({
          input: {
            authIdentityId: authIdentity.id,
            customerData: { email: p.email, first_name: p.first_name, last_name: p.last_name },
          },
        });
        customerId = customer.id;
        logger.info(`Created customer ${p.email} (${customerId})`);
      }

      const { data: linked } = await query.graph({
        entity: "customer",
        fields: ["id", "employee.id"],
        filters: { id: customerId },
      });
      if ((linked[0] as any)?.employee?.id) {
        logger.info(`${p.email} is already an employee`);
        continue;
      }

      await createEmployeesWorkflow(container).run({
        input: {
          customerId,
          employeeData: { customer_id: customerId, company_id: company.id, is_admin: p.is_admin, spending_limit: p.spending_limit },
        },
      });
      logger.info(`Linked ${p.email} to ${c.name} as ${p.is_admin ? "admin" : "employee"}`);
    }
  }

  logger.info("Bot test identities (POST /bots/customers/verify):");
  for (const c of BOT_TEST_COMPANIES) {
    for (const p of c.customers) {
      logger.info(`  [${c.account}] email=${p.email} company_name="${c.name}" nip=${c.tax_id}  (storefront password: ${PASSWORD})`);
    }
  }
}
